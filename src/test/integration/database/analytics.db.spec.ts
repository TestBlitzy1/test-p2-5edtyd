import { Pool } from 'pg';
import { cleanDatabase, TestDataFactory } from '../../utils/test.helpers';
import { IAnalytics, MetricType, TimeGranularity } from '../../../backend/shared/types/analytics.types';
import { TEST_CAMPAIGN_ID, TEST_USER_ID, TEST_METRICS } from '../../utils/test.constants';

describe('Analytics Database Integration Tests', () => {
  let dbPool: Pool;
  let testDataFactory: TestDataFactory;

  beforeAll(async () => {
    // Initialize database connection pool with test configuration
    dbPool = new Pool({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      database: process.env.TEST_DB_NAME || 'test_db',
      user: process.env.TEST_DB_USER || 'test_user',
      password: process.env.TEST_DB_PASSWORD || 'test_password'
    });

    testDataFactory = new TestDataFactory(dbPool, null);
  });

  beforeEach(async () => {
    await cleanDatabase(dbPool);
  });

  afterAll(async () => {
    await dbPool.end();
  });

  describe('Analytics Record Creation', () => {
    it('should successfully create analytics record with all required fields', async () => {
      const client = await dbPool.connect();
      try {
        // Create test analytics record
        const analytics: IAnalytics = {
          id: 'test-analytics-1',
          campaignId: TEST_CAMPAIGN_ID,
          userId: TEST_USER_ID,
          metrics: TEST_METRICS.metrics,
          startDate: new Date('2024-01-01T00:00:00Z'),
          endDate: new Date('2024-01-31T23:59:59Z'),
          granularity: TimeGranularity.DAILY
        };

        const result = await client.query(
          `INSERT INTO analytics (
            id, campaign_id, user_id, metrics, start_date, end_date, granularity
          ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [
            analytics.id,
            analytics.campaignId,
            analytics.userId,
            JSON.stringify(analytics.metrics),
            analytics.startDate,
            analytics.endDate,
            analytics.granularity
          ]
        );

        expect(result.rows[0]).toBeTruthy();
        expect(result.rows[0].id).toBe(analytics.id);
        expect(result.rows[0].campaign_id).toBe(analytics.campaignId);
      } finally {
        client.release();
      }
    });

    it('should enforce foreign key constraints for campaign_id', async () => {
      const client = await dbPool.connect();
      try {
        await expect(client.query(
          `INSERT INTO analytics (
            id, campaign_id, user_id, metrics, start_date, end_date, granularity
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            'test-analytics-2',
            'non-existent-campaign',
            TEST_USER_ID,
            JSON.stringify([]),
            new Date(),
            new Date(),
            TimeGranularity.DAILY
          ]
        )).rejects.toThrow();
      } finally {
        client.release();
      }
    });
  });

  describe('Metrics Storage and Retrieval', () => {
    it('should store and retrieve complex metric data structures', async () => {
      const client = await dbPool.connect();
      try {
        const metrics = [
          {
            type: MetricType.IMPRESSIONS,
            value: 10000,
            timestamp: new Date('2024-01-01T00:00:00Z')
          },
          {
            type: MetricType.CTR,
            value: 2.5,
            timestamp: new Date('2024-01-01T00:00:00Z')
          }
        ];

        await client.query(
          `INSERT INTO analytics (
            id, campaign_id, user_id, metrics, start_date, end_date, granularity
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            'test-analytics-3',
            TEST_CAMPAIGN_ID,
            TEST_USER_ID,
            JSON.stringify(metrics),
            new Date(),
            new Date(),
            TimeGranularity.DAILY
          ]
        );

        const result = await client.query(
          'SELECT metrics FROM analytics WHERE id = $1',
          ['test-analytics-3']
        );

        const storedMetrics = result.rows[0].metrics;
        expect(storedMetrics).toHaveLength(2);
        expect(storedMetrics[0].type).toBe(MetricType.IMPRESSIONS);
        expect(storedMetrics[1].type).toBe(MetricType.CTR);
      } finally {
        client.release();
      }
    });

    it('should validate metric type enumeration values', async () => {
      const client = await dbPool.connect();
      try {
        const invalidMetrics = [{
          type: 'INVALID_METRIC_TYPE',
          value: 100,
          timestamp: new Date()
        }];

        await expect(client.query(
          `INSERT INTO analytics (
            id, campaign_id, user_id, metrics, start_date, end_date, granularity
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            'test-analytics-4',
            TEST_CAMPAIGN_ID,
            TEST_USER_ID,
            JSON.stringify(invalidMetrics),
            new Date(),
            new Date(),
            TimeGranularity.DAILY
          ]
        )).rejects.toThrow();
      } finally {
        client.release();
      }
    });
  });

  describe('Performance Report Generation', () => {
    it('should aggregate metrics for performance reporting', async () => {
      const client = await dbPool.connect();
      try {
        // Insert test data
        await client.query(
          `INSERT INTO analytics (
            id, campaign_id, user_id, metrics, start_date, end_date, granularity
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            'test-analytics-5',
            TEST_CAMPAIGN_ID,
            TEST_USER_ID,
            JSON.stringify(TEST_METRICS.metrics),
            new Date('2024-01-01T00:00:00Z'),
            new Date('2024-01-31T23:59:59Z'),
            TimeGranularity.DAILY
          ]
        );

        // Query aggregated metrics
        const result = await client.query(`
          SELECT 
            campaign_id,
            jsonb_path_query_array(metrics, '$[*] ? (@.type == "IMPRESSIONS")') as impressions,
            jsonb_path_query_array(metrics, '$[*] ? (@.type == "CTR")') as ctr
          FROM analytics 
          WHERE campaign_id = $1
          GROUP BY campaign_id
        `, [TEST_CAMPAIGN_ID]);

        expect(result.rows[0]).toBeTruthy();
        expect(result.rows[0].impressions).toBeTruthy();
        expect(result.rows[0].ctr).toBeTruthy();
      } finally {
        client.release();
      }
    });
  });

  describe('Time-based Analytics Queries', () => {
    it('should filter analytics by date range', async () => {
      const client = await dbPool.connect();
      try {
        const startDate = new Date('2024-01-01T00:00:00Z');
        const endDate = new Date('2024-01-31T23:59:59Z');

        await client.query(
          `INSERT INTO analytics (
            id, campaign_id, user_id, metrics, start_date, end_date, granularity
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            'test-analytics-6',
            TEST_CAMPAIGN_ID,
            TEST_USER_ID,
            JSON.stringify(TEST_METRICS.metrics),
            startDate,
            endDate,
            TimeGranularity.DAILY
          ]
        );

        const result = await client.query(
          `SELECT * FROM analytics 
           WHERE campaign_id = $1 
           AND start_date >= $2 
           AND end_date <= $3`,
          [TEST_CAMPAIGN_ID, startDate, endDate]
        );

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].start_date).toEqual(startDate);
        expect(result.rows[0].end_date).toEqual(endDate);
      } finally {
        client.release();
      }
    });
  });
});