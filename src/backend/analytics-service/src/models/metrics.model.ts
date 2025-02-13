// External package imports
import { Pool } from 'pg';  // ^8.11.0
import { StatsD } from 'hot-shots';  // ^9.3.0

// Internal imports
import { MetricType, IMetric } from '../../../shared/types/analytics.types';
import { metricSchema } from '../../../shared/schemas/analytics.schema';

// Constants
const DB_METRICS_TABLE = 'campaign_metrics';
const BATCH_SIZE = 1000;
const CACHE_TTL = 300; // 5 minutes in seconds

/**
 * Core model class for managing campaign metrics data with optimized batch processing,
 * caching, and real-time aggregation capabilities.
 */
export class MetricsModel {
    private readonly dbPool: Pool;
    private readonly statsdClient: StatsD;
    private readonly cache: Map<string, { data: any; timestamp: number }>;

    /**
     * Initializes the metrics model with database connection and monitoring
     */
    constructor(dbPool: Pool, statsdClient: StatsD) {
        this.dbPool = dbPool;
        this.statsdClient = statsdClient;
        this.cache = new Map();
    }

    /**
     * Creates a new metric record with validation and monitoring
     */
    async create(metric: IMetric, campaignId: string): Promise<IMetric> {
        const timer = this.statsdClient.startTimer('metrics.create');

        try {
            // Validate metric data
            await metricSchema.parseAsync(metric);

            const query = `
                INSERT INTO ${DB_METRICS_TABLE} 
                (campaign_id, metric_type, value, timestamp)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `;

            const values = [campaignId, metric.type, metric.value, metric.timestamp];
            const result = await this.dbPool.query(query, values);

            // Invalidate related cache entries
            this.invalidateCache(campaignId);

            // Report metrics
            this.statsdClient.increment('metrics.create.success');
            timer.end();

            return this.transformDbRecord(result.rows[0]);
        } catch (error) {
            this.statsdClient.increment('metrics.create.error');
            timer.end();
            throw error;
        }
    }

    /**
     * Retrieves metrics for a campaign with caching support
     */
    async findByCampaignId(
        campaignId: string,
        startDate: Date,
        endDate: Date
    ): Promise<IMetric[]> {
        const cacheKey = `metrics:${campaignId}:${startDate.getTime()}:${endDate.getTime()}`;
        const timer = this.statsdClient.startTimer('metrics.find');

        try {
            // Check cache first
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                this.statsdClient.increment('metrics.cache.hit');
                timer.end();
                return cached;
            }

            const query = `
                SELECT * FROM ${DB_METRICS_TABLE}
                WHERE campaign_id = $1
                AND timestamp BETWEEN $2 AND $3
                ORDER BY timestamp DESC
            `;

            const result = await this.dbPool.query(query, [campaignId, startDate, endDate]);
            const metrics = result.rows.map(this.transformDbRecord);

            // Cache the results
            this.setCache(cacheKey, metrics);

            this.statsdClient.increment('metrics.find.success');
            timer.end();

            return metrics;
        } catch (error) {
            this.statsdClient.increment('metrics.find.error');
            timer.end();
            throw error;
        }
    }

    /**
     * Aggregates metrics by type with trend analysis
     */
    async aggregateByType(
        campaignId: string,
        metricType: MetricType,
        startDate: Date,
        endDate: Date
    ): Promise<{ value: number; trend: number }> {
        const cacheKey = `aggregate:${campaignId}:${metricType}:${startDate.getTime()}:${endDate.getTime()}`;
        const timer = this.statsdClient.startTimer('metrics.aggregate');

        try {
            // Check cache first
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                this.statsdClient.increment('metrics.cache.hit');
                timer.end();
                return cached;
            }

            const query = `
                WITH current_period AS (
                    SELECT AVG(value) as current_value
                    FROM ${DB_METRICS_TABLE}
                    WHERE campaign_id = $1
                    AND metric_type = $2
                    AND timestamp BETWEEN $3 AND $4
                ),
                previous_period AS (
                    SELECT AVG(value) as previous_value
                    FROM ${DB_METRICS_TABLE}
                    WHERE campaign_id = $1
                    AND metric_type = $2
                    AND timestamp BETWEEN 
                        $3 - ($4 - $3) AND $3
                )
                SELECT 
                    current_value,
                    ((current_value - previous_value) / NULLIF(previous_value, 0)) * 100 as trend
                FROM current_period, previous_period
            `;

            const result = await this.dbPool.query(query, [
                campaignId,
                metricType,
                startDate,
                endDate
            ]);

            const aggregation = {
                value: result.rows[0]?.current_value || 0,
                trend: result.rows[0]?.trend || 0
            };

            // Cache the results
            this.setCache(cacheKey, aggregation);

            this.statsdClient.increment('metrics.aggregate.success');
            timer.end();

            return aggregation;
        } catch (error) {
            this.statsdClient.increment('metrics.aggregate.error');
            timer.end();
            throw error;
        }
    }

    /**
     * Performs optimized batch insertion of metrics
     */
    async batchInsert(metrics: IMetric[], campaignId: string): Promise<void> {
        const timer = this.statsdClient.startTimer('metrics.batchInsert');

        try {
            // Validate all metrics
            await Promise.all(metrics.map(metric => metricSchema.parseAsync(metric)));

            // Split into chunks
            const chunks = this.chunkArray(metrics, BATCH_SIZE);

            // Begin transaction
            const client = await this.dbPool.connect();
            try {
                await client.query('BEGIN');

                for (const chunk of chunks) {
                    const values = chunk.map((metric, idx) => `($1, $${idx * 3 + 2}, $${idx * 3 + 3}, $${idx * 3 + 4})`).join(',');
                    const flatParams = chunk.flatMap(metric => [
                        metric.type,
                        metric.value,
                        metric.timestamp
                    ]);

                    const query = `
                        INSERT INTO ${DB_METRICS_TABLE}
                        (campaign_id, metric_type, value, timestamp)
                        VALUES ${values}
                    `;

                    await client.query(query, [campaignId, ...flatParams]);
                }

                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

            // Invalidate cache
            this.invalidateCache(campaignId);

            this.statsdClient.increment('metrics.batchInsert.success');
            this.statsdClient.gauge('metrics.batchSize', metrics.length);
            timer.end();
        } catch (error) {
            this.statsdClient.increment('metrics.batchInsert.error');
            timer.end();
            throw error;
        }
    }

    // Private helper methods
    private transformDbRecord(record: any): IMetric {
        return {
            type: record.metric_type,
            value: record.value,
            timestamp: record.timestamp
        };
    }

    private getFromCache(key: string): any | null {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL * 1000) {
            return cached.data;
        }
        return null;
    }

    private setCache(key: string, data: any): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    private invalidateCache(campaignId: string): void {
        for (const key of this.cache.keys()) {
            if (key.includes(campaignId)) {
                this.cache.delete(key);
            }
        }
    }

    private chunkArray<T>(array: T[], size: number): T[][] {
        return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
            array.slice(i * size, i * size + size)
        );
    }
}