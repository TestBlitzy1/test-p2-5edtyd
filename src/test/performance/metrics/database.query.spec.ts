import { Pool } from 'pg'; // @types/pg@^8.0.0
import { cleanDatabase, TestDataFactory } from '../../utils/test.helpers';
import { MetricType, TimeGranularity } from '../../../backend/shared/types/analytics.types';
import { CampaignStatus, PlatformType } from '../../../backend/shared/types/campaign.types';

/**
 * Performance thresholds for different query types (in milliseconds)
 */
const PERFORMANCE_THRESHOLDS = {
  simple: 50,
  complex: 100,
  aggregation: 150,
  bulkOperation: 200
} as const;

/**
 * Interface for query performance measurement results
 */
interface IQueryPerformanceResult {
  executionTime: number;
  results: any;
  queryPlan?: any;
}

/**
 * Options for query performance measurement
 */
interface IQueryOptions {
  timeout?: number;
  retries?: number;
  collectQueryPlan?: boolean;
}

/**
 * Database query performance test suite
 * @version 1.0.0
 */
export class DatabaseQueryTests {
  private dbPool: Pool;
  private testDataFactory: TestDataFactory;
  private performanceMetrics: Map<string, number[]>;
  private readonly thresholds: typeof PERFORMANCE_THRESHOLDS;

  constructor(dbPool: Pool) {
    this.dbPool = dbPool;
    this.testDataFactory = new TestDataFactory(dbPool, null);
    this.performanceMetrics = new Map();
    this.thresholds = PERFORMANCE_THRESHOLDS;
  }

  /**
   * Measures database query execution time with high precision
   */
  private async measureQueryPerformance(
    queryString: string,
    params: any[] = [],
    options: IQueryOptions = {}
  ): Promise<IQueryPerformanceResult> {
    const startTime = process.hrtime.bigint();
    const client = await this.dbPool.connect();

    try {
      if (options.collectQueryPlan) {
        await client.query('EXPLAIN ANALYZE ' + queryString, params);
      }

      const results = await client.query(queryString, params);
      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

      return {
        executionTime,
        results: results.rows,
        queryPlan: options.collectQueryPlan ? results : undefined
      };
    } finally {
      client.release();
    }
  }

  /**
   * Tests campaign-related query performance
   */
  public async testCampaignQueries(): Promise<void> {
    // Clean database before tests
    await cleanDatabase(this.dbPool);

    // Generate test data
    const { user, campaigns } = await this.testDataFactory.createTestData();

    // Test campaign creation performance
    const createResult = await this.measureQueryPerformance(
      `INSERT INTO campaigns (
        id, user_id, name, platform, status, budget, targeting, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        'test-campaign',
        user.id,
        'Performance Test Campaign',
        PlatformType.LINKEDIN,
        CampaignStatus.DRAFT,
        { amount: 1000, currency: 'USD', period: 'DAILY' },
        { locations: [], industries: [] },
        new Date(),
        new Date()
      ],
      { collectQueryPlan: true }
    );

    expect(createResult.executionTime).toBeLessThan(this.thresholds.simple);

    // Test campaign retrieval performance
    const retrieveResult = await this.measureQueryPerformance(
      'SELECT * FROM campaigns WHERE user_id = $1 AND status = $2',
      [user.id, CampaignStatus.ACTIVE]
    );

    expect(retrieveResult.executionTime).toBeLessThan(this.thresholds.simple);

    // Test complex campaign join query performance
    const complexResult = await this.measureQueryPerformance(
      `SELECT c.*, 
        array_agg(DISTINCT a.id) as ad_group_ids,
        json_agg(DISTINCT m.*) as metrics
      FROM campaigns c
      LEFT JOIN ad_groups a ON c.id = a.campaign_id
      LEFT JOIN campaign_metrics m ON c.id = m.campaign_id
      WHERE c.user_id = $1
      GROUP BY c.id`,
      [user.id],
      { collectQueryPlan: true }
    );

    expect(complexResult.executionTime).toBeLessThan(this.thresholds.complex);
  }

  /**
   * Tests analytics data query performance
   */
  public async testAnalyticsQueries(): Promise<void> {
    // Test high-volume metrics insertion
    const metricsData = Array.from({ length: 1000 }, (_, i) => ({
      campaign_id: `campaign-${i % 10}`,
      metric_type: MetricType.IMPRESSIONS,
      value: Math.random() * 1000,
      timestamp: new Date()
    }));

    const bulkInsertResult = await this.measureQueryPerformance(
      `INSERT INTO analytics_metrics 
      (campaign_id, metric_type, value, timestamp)
      SELECT * FROM UNNEST($1::text[], $2::text[], $3::numeric[], $4::timestamp[])`,
      [
        metricsData.map(m => m.campaign_id),
        metricsData.map(m => m.metric_type),
        metricsData.map(m => m.value),
        metricsData.map(m => m.timestamp)
      ]
    );

    expect(bulkInsertResult.executionTime).toBeLessThan(this.thresholds.bulkOperation);

    // Test complex analytics aggregation
    const aggregationResult = await this.measureQueryPerformance(
      `SELECT 
        date_trunc($1, timestamp) as time_bucket,
        metric_type,
        AVG(value) as avg_value,
        SUM(value) as total_value,
        COUNT(*) as data_points
      FROM analytics_metrics
      WHERE campaign_id = ANY($2)
      AND timestamp >= $3
      GROUP BY date_trunc($1, timestamp), metric_type
      ORDER BY time_bucket DESC`,
      [
        TimeGranularity.DAILY,
        metricsData.slice(0, 5).map(m => m.campaign_id),
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ],
      { collectQueryPlan: true }
    );

    expect(aggregationResult.executionTime).toBeLessThan(this.thresholds.aggregation);
  }

  /**
   * Tests performance of complex join operations
   */
  public async testComplexJoinQueries(): Promise<void> {
    const complexJoinResult = await this.measureQueryPerformance(
      `WITH campaign_metrics AS (
        SELECT 
          campaign_id,
          json_object_agg(metric_type, avg_value) as metrics
        FROM (
          SELECT 
            campaign_id,
            metric_type,
            AVG(value) as avg_value
          FROM analytics_metrics
          GROUP BY campaign_id, metric_type
        ) m
        GROUP BY campaign_id
      )
      SELECT 
        c.*,
        cm.metrics,
        json_agg(DISTINCT ag.*) as ad_groups
      FROM campaigns c
      LEFT JOIN campaign_metrics cm ON c.id = cm.campaign_id
      LEFT JOIN ad_groups ag ON c.id = ag.campaign_id
      WHERE c.status = $1
      GROUP BY c.id, cm.metrics`,
      [CampaignStatus.ACTIVE],
      { collectQueryPlan: true }
    );

    expect(complexJoinResult.executionTime).toBeLessThan(this.thresholds.complex);
  }
}