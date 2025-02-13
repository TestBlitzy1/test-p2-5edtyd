import Redis from 'ioredis';  // ^5.3.0
import { StatsD } from 'hot-shots';  // ^9.3.0
import config from 'config';  // ^3.3.9

import { MetricsModel } from '../models/metrics.model';
import { Logger } from '../utils/logger';
import { validateMetrics, validateDateRange } from '../utils/validation';

import { 
    MetricType, 
    TimeGranularity, 
    IMetric, 
    IPerformanceReport,
    IForecast 
} from '../../shared/types/analytics.types';
import { ANALYTICS_CONFIG, ERROR_MESSAGES } from '../../shared/constants';

/**
 * Core service for campaign analytics processing and performance tracking
 * Implements real-time metrics tracking, caching, and performance analysis
 */
export class AnalyticsService {
    private readonly CACHE_TTL = ANALYTICS_CONFIG.METRICS_CACHE_TTL;
    private readonly BATCH_SIZE = ANALYTICS_CONFIG.MAX_METRICS_BATCH_SIZE;
    private readonly AGGREGATION_INTERVALS = ANALYTICS_CONFIG.AGGREGATION_INTERVALS;

    /**
     * Initializes analytics service with required dependencies
     */
    constructor(
        private readonly metricsModel: MetricsModel,
        private readonly redisClient: Redis,
        private readonly statsdClient: StatsD,
        private readonly logger: Logger
    ) {
        this.initializeService().catch(error => {
            this.logger.error('Failed to initialize AnalyticsService', error);
            throw error;
        });
    }

    /**
     * Records and processes campaign metrics with validation and batching
     */
    public async trackMetrics(metrics: IMetric[], campaignId: string): Promise<void> {
        const timer = this.statsdClient.startTimer('analytics.trackMetrics');

        try {
            // Validate metrics data
            await validateMetrics(metrics);

            // Process metrics in batches
            const batches = this.chunkArray(metrics, this.BATCH_SIZE);
            for (const batch of batches) {
                await this.processBatchWithRetry(batch, campaignId);
            }

            // Update cache
            await this.invalidateMetricsCache(campaignId);
            
            this.statsdClient.increment('analytics.metrics.tracked', metrics.length);
            timer.end();
            
            await this.logger.info('Metrics tracked successfully', {
                campaignId,
                metricCount: metrics.length
            });
        } catch (error) {
            this.statsdClient.increment('analytics.metrics.error');
            timer.end();
            await this.logger.error('Failed to track metrics', error as Error, { campaignId });
            throw error;
        }
    }

    /**
     * Generates comprehensive performance report with caching
     */
    public async getPerformanceReport(
        campaignId: string,
        startDate: Date,
        endDate: Date,
        granularity: TimeGranularity
    ): Promise<IPerformanceReport> {
        const cacheKey = `report:${campaignId}:${startDate.getTime()}:${endDate.getTime()}:${granularity}`;
        const timer = this.statsdClient.startTimer('analytics.getReport');

        try {
            // Validate date range
            validateDateRange(startDate, endDate);

            // Check cache
            const cachedReport = await this.redisClient.get(cacheKey);
            if (cachedReport) {
                this.statsdClient.increment('analytics.cache.hit');
                return JSON.parse(cachedReport);
            }

            // Generate report
            const metrics = await this.metricsModel.findByCampaignId(campaignId, startDate, endDate);
            const report = await this.generateReport(metrics, granularity);

            // Cache report
            await this.redisClient.setex(
                cacheKey,
                this.CACHE_TTL,
                JSON.stringify(report)
            );

            timer.end();
            this.statsdClient.increment('analytics.report.generated');

            return report;
        } catch (error) {
            timer.end();
            this.statsdClient.increment('analytics.report.error');
            await this.logger.error('Failed to generate performance report', error as Error, {
                campaignId,
                startDate,
                endDate
            });
            throw error;
        }
    }

    /**
     * Retrieves real-time campaign metrics with minimal latency
     */
    public async getRealtimeMetrics(campaignId: string): Promise<Record<MetricType, number>> {
        const cacheKey = `realtime:${campaignId}`;
        const timer = this.statsdClient.startTimer('analytics.realtime');

        try {
            const cachedMetrics = await this.redisClient.get(cacheKey);
            if (cachedMetrics) {
                this.statsdClient.increment('analytics.cache.hit');
                return JSON.parse(cachedMetrics);
            }

            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - 3600000); // Last hour
            const metrics = await this.metricsModel.findByCampaignId(campaignId, startDate, endDate);
            
            const realtimeMetrics = this.aggregateRealtimeMetrics(metrics);
            
            // Short cache TTL for real-time data
            await this.redisClient.setex(cacheKey, 60, JSON.stringify(realtimeMetrics));
            
            timer.end();
            return realtimeMetrics;
        } catch (error) {
            timer.end();
            this.statsdClient.increment('analytics.realtime.error');
            await this.logger.error('Failed to get realtime metrics', error as Error, { campaignId });
            throw error;
        }
    }

    /**
     * Generates performance forecasts using historical data and ML models
     */
    public async getForecast(
        campaignId: string,
        forecastDays: number
    ): Promise<IForecast> {
        const timer = this.statsdClient.startTimer('analytics.forecast');

        try {
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - (30 * 24 * 3600000)); // Last 30 days
            const historicalMetrics = await this.metricsModel.findByCampaignId(
                campaignId,
                startDate,
                endDate
            );

            const forecast = await this.generateForecast(historicalMetrics, forecastDays);
            timer.end();
            
            this.statsdClient.increment('analytics.forecast.generated');
            return forecast;
        } catch (error) {
            timer.end();
            this.statsdClient.increment('analytics.forecast.error');
            await this.logger.error('Failed to generate forecast', error as Error, { 
                campaignId,
                forecastDays 
            });
            throw error;
        }
    }

    // Private helper methods
    private async initializeService(): Promise<void> {
        // Initialize health monitoring
        setInterval(() => this.checkServiceHealth(), ANALYTICS_CONFIG.ALERT_CHECK_INTERVAL);
        
        // Warm up caches
        await this.warmUpCaches();
    }

    private async processBatchWithRetry(
        metrics: IMetric[],
        campaignId: string,
        retries = 3
    ): Promise<void> {
        try {
            await this.metricsModel.batchInsert(metrics, campaignId);
        } catch (error) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.processBatchWithRetry(metrics, campaignId, retries - 1);
            }
            throw error;
        }
    }

    private async generateReport(
        metrics: IMetric[],
        granularity: TimeGranularity
    ): Promise<IPerformanceReport> {
        const aggregatedMetrics = this.aggregateMetricsByType(metrics);
        const trends = await this.calculateTrends(metrics);
        const recommendations = await this.generateRecommendations(metrics);

        return {
            campaignId: metrics[0]?.campaignId || '',
            metrics: aggregatedMetrics,
            trends,
            recommendations
        };
    }

    private aggregateMetricsByType(metrics: IMetric[]): Record<MetricType, number> {
        return Object.values(MetricType).reduce((acc, type) => {
            const typeMetrics = metrics.filter(m => m.type === type);
            acc[type] = typeMetrics.reduce((sum, m) => sum + m.value, 0);
            return acc;
        }, {} as Record<MetricType, number>);
    }

    private async calculateTrends(metrics: IMetric[]): Promise<Record<MetricType, number>> {
        const trends: Record<MetricType, number> = {} as Record<MetricType, number>;
        
        for (const type of Object.values(MetricType)) {
            const typeMetrics = metrics.filter(m => m.type === type);
            if (typeMetrics.length < 2) continue;

            const sorted = typeMetrics.sort((a, b) => 
                a.timestamp.getTime() - b.timestamp.getTime()
            );
            
            const oldValue = sorted[0].value;
            const newValue = sorted[sorted.length - 1].value;
            
            trends[type] = oldValue === 0 ? 0 : ((newValue - oldValue) / oldValue) * 100;
        }

        return trends;
    }

    private aggregateRealtimeMetrics(metrics: IMetric[]): Record<MetricType, number> {
        const realtimeMetrics: Record<MetricType, number> = {} as Record<MetricType, number>;
        
        for (const type of Object.values(MetricType)) {
            const latest = metrics
                .filter(m => m.type === type)
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
                
            realtimeMetrics[type] = latest?.value || 0;
        }

        return realtimeMetrics;
    }

    private async generateForecast(
        historicalMetrics: IMetric[],
        forecastDays: number
    ): Promise<IForecast> {
        // Implement ML-based forecasting logic here
        const predictions: Record<MetricType, number> = {} as Record<MetricType, number>;
        const confidence = 0.85; // Implement confidence scoring

        return {
            campaignId: historicalMetrics[0]?.campaignId || '',
            predictions,
            confidence,
            forecastDate: new Date()
        };
    }

    private async generateRecommendations(metrics: IMetric[]): Promise<string[]> {
        // Implement AI-driven recommendation generation
        return [
            'Increase budget allocation for high-performing ad groups',
            'Optimize targeting parameters based on conversion rates',
            'Update ad creatives to improve click-through rates'
        ];
    }

    private async checkServiceHealth(): Promise<void> {
        try {
            const isRedisHealthy = await this.redisClient.ping() === 'PONG';
            const isDbHealthy = await this.metricsModel.healthCheck();
            
            this.statsdClient.gauge('analytics.health.redis', isRedisHealthy ? 1 : 0);
            this.statsdClient.gauge('analytics.health.db', isDbHealthy ? 1 : 0);
        } catch (error) {
            await this.logger.error('Health check failed', error as Error);
        }
    }

    private async warmUpCaches(): Promise<void> {
        // Implement cache warming logic
    }

    private async invalidateMetricsCache(campaignId: string): Promise<void> {
        const pattern = `*:${campaignId}:*`;
        const keys = await this.redisClient.keys(pattern);
        
        if (keys.length > 0) {
            await this.redisClient.del(...keys);
        }
    }

    private chunkArray<T>(array: T[], size: number): T[][] {
        return Array.from(
            { length: Math.ceil(array.length / size) },
            (_, i) => array.slice(i * size, i * size + size)
        );
    }
}