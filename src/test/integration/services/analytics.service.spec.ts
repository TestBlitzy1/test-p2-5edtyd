import { AnalyticsService } from '../../../backend/analytics-service/src/services/analytics.service';
import { MetricsModel } from '../../../backend/analytics-service/src/models/metrics.model';
import { 
    createMetricFixture,
    createMetricsBatchFixture,
    createTimeSeriesMetricsFixture 
} from '../../fixtures/analytics.fixture';
import { cleanDatabase, setupTestEnvironment } from '../../utils/test.helpers';
import { TEST_CAMPAIGN_ID } from '../../utils/test.constants';
import { MetricType, TimeGranularity } from '../../../backend/shared/types/analytics.types';
import { ANALYTICS_CONFIG } from '../../../backend/shared/constants';
import Redis from 'ioredis';  // ^5.3.0
import { StatsD } from 'hot-shots';  // ^9.3.0
import { Logger } from '../../../backend/shared/utils/logger';

describe('AnalyticsService Integration Tests', () => {
    let analyticsService: AnalyticsService;
    let metricsModel: MetricsModel;
    let redisClient: Redis;
    let statsdClient: StatsD;
    let logger: Logger;

    const testTimeoutConfig = {
        defaultTimeout: 10000,
        longOperationTimeout: 30000
    };

    const metricThresholds = {
        responseTime: 5000, // 5s threshold from requirements
        cacheHitRatio: 0.8,
        batchProcessingTime: 1000
    };

    beforeAll(async () => {
        // Initialize test environment
        const testEnv = await setupTestEnvironment({
            dbConfig: {
                host: process.env.TEST_DB_HOST || 'localhost',
                port: parseInt(process.env.TEST_DB_PORT || '5432'),
                database: 'test_analytics',
                user: process.env.TEST_DB_USER || 'test',
                password: process.env.TEST_DB_PASSWORD || 'test'
            },
            mockServerPort: 3001
        });

        // Initialize dependencies
        redisClient = new Redis({
            host: process.env.TEST_REDIS_HOST || 'localhost',
            port: parseInt(process.env.TEST_REDIS_PORT || '6379'),
            db: 1, // Use separate DB for tests
            enableOfflineQueue: false
        });

        statsdClient = new StatsD({
            host: 'localhost',
            port: 8125,
            prefix: 'test.analytics.',
            mock: true
        });

        logger = new Logger('analytics-test', {
            level: 'debug',
            filePath: './test-logs'
        });

        metricsModel = new MetricsModel(testEnv.dbPool, statsdClient);
        analyticsService = new AnalyticsService(
            metricsModel,
            redisClient,
            statsdClient,
            logger
        );
    });

    beforeEach(async () => {
        await cleanDatabase(metricsModel);
        await redisClient.flushdb();
    });

    afterAll(async () => {
        await redisClient.quit();
        await cleanDatabase(metricsModel);
    });

    describe('Real-time Metrics Tracking', () => {
        it('should track metrics batch with performance validation', async () => {
            // Generate test metrics batch
            const metrics = createMetricsBatchFixture(100, [
                MetricType.IMPRESSIONS,
                MetricType.CLICKS,
                MetricType.CTR,
                MetricType.CONVERSIONS
            ]);

            const startTime = Date.now();

            // Track metrics
            await analyticsService.trackMetrics(metrics, TEST_CAMPAIGN_ID);

            const processingTime = Date.now() - startTime;

            // Verify database records
            const storedMetrics = await metricsModel.findByCampaignId(
                TEST_CAMPAIGN_ID,
                new Date(Date.now() - 86400000),
                new Date()
            );

            // Performance assertions
            expect(processingTime).toBeLessThan(metricThresholds.responseTime);
            expect(storedMetrics.length).toBe(metrics.length);

            // Verify cache invalidation
            const cachedMetrics = await redisClient.get(`metrics:${TEST_CAMPAIGN_ID}`);
            expect(cachedMetrics).toBeNull();
        });

        it('should handle concurrent metric tracking requests', async () => {
            const batchCount = 5;
            const batchSize = 50;
            const batches = Array.from({ length: batchCount }, () =>
                createMetricsBatchFixture(batchSize, [
                    MetricType.IMPRESSIONS,
                    MetricType.CLICKS
                ])
            );

            // Track metrics concurrently
            const startTime = Date.now();
            await Promise.all(
                batches.map(batch => 
                    analyticsService.trackMetrics(batch, TEST_CAMPAIGN_ID)
                )
            );
            const processingTime = Date.now() - startTime;

            // Verify all metrics were stored
            const storedMetrics = await metricsModel.findByCampaignId(
                TEST_CAMPAIGN_ID,
                new Date(Date.now() - 86400000),
                new Date()
            );

            expect(storedMetrics.length).toBe(batchCount * batchSize * 2);
            expect(processingTime).toBeLessThan(metricThresholds.responseTime);
        });
    });

    describe('Performance Reporting', () => {
        it('should generate performance report with trend analysis', async () => {
            // Create time series data
            const timeSeriesMetrics = createTimeSeriesMetricsFixture(
                MetricType.CONVERSIONS,
                30 // 30 days of data
            );

            await analyticsService.trackMetrics(timeSeriesMetrics, TEST_CAMPAIGN_ID);

            // Generate report
            const report = await analyticsService.getPerformanceReport(
                TEST_CAMPAIGN_ID,
                new Date(Date.now() - 30 * 86400000),
                new Date(),
                TimeGranularity.DAILY
            );

            // Verify report structure
            expect(report.campaignId).toBe(TEST_CAMPAIGN_ID);
            expect(report.metrics).toBeDefined();
            expect(report.trends).toBeDefined();
            expect(report.recommendations.length).toBeGreaterThan(0);

            // Verify trend calculations
            expect(report.trends[MetricType.CONVERSIONS]).toBeDefined();
            expect(typeof report.trends[MetricType.CONVERSIONS]).toBe('number');
        });

        it('should utilize cache for repeated report requests', async () => {
            const metrics = createMetricsBatchFixture(100, [
                MetricType.IMPRESSIONS,
                MetricType.CLICKS
            ]);

            await analyticsService.trackMetrics(metrics, TEST_CAMPAIGN_ID);

            // First request (cache miss)
            const startTime1 = Date.now();
            const report1 = await analyticsService.getPerformanceReport(
                TEST_CAMPAIGN_ID,
                new Date(Date.now() - 86400000),
                new Date(),
                TimeGranularity.HOURLY
            );
            const time1 = Date.now() - startTime1;

            // Second request (cache hit)
            const startTime2 = Date.now();
            const report2 = await analyticsService.getPerformanceReport(
                TEST_CAMPAIGN_ID,
                new Date(Date.now() - 86400000),
                new Date(),
                TimeGranularity.HOURLY
            );
            const time2 = Date.now() - startTime2;

            expect(time2).toBeLessThan(time1);
            expect(report2).toEqual(report1);
        });
    });

    describe('Metrics Forecasting', () => {
        it('should generate accurate performance forecasts', async () => {
            // Create historical data with known patterns
            const historicalMetrics = createTimeSeriesMetricsFixture(
                MetricType.IMPRESSIONS,
                90 // 90 days of historical data
            );

            await analyticsService.trackMetrics(historicalMetrics, TEST_CAMPAIGN_ID);

            // Generate forecast
            const forecast = await analyticsService.getForecast(
                TEST_CAMPAIGN_ID,
                30 // 30 days forecast
            );

            // Verify forecast structure
            expect(forecast.campaignId).toBe(TEST_CAMPAIGN_ID);
            expect(forecast.predictions).toBeDefined();
            expect(forecast.confidence).toBeGreaterThan(0);
            expect(forecast.confidence).toBeLessThanOrEqual(1);

            // Verify predictions
            expect(forecast.predictions[MetricType.IMPRESSIONS]).toBeDefined();
            expect(typeof forecast.predictions[MetricType.IMPRESSIONS]).toBe('number');
        });
    });

    describe('Real-time Metrics Retrieval', () => {
        it('should retrieve real-time metrics within latency requirements', async () => {
            const realtimeMetrics = createMetricsBatchFixture(24, [
                MetricType.IMPRESSIONS,
                MetricType.CLICKS,
                MetricType.CTR
            ]);

            await analyticsService.trackMetrics(realtimeMetrics, TEST_CAMPAIGN_ID);

            const startTime = Date.now();
            const metrics = await analyticsService.getRealtimeMetrics(TEST_CAMPAIGN_ID);
            const responseTime = Date.now() - startTime;

            expect(responseTime).toBeLessThan(1000); // 1s max for real-time
            expect(metrics).toBeDefined();
            expect(metrics[MetricType.IMPRESSIONS]).toBeDefined();
            expect(metrics[MetricType.CLICKS]).toBeDefined();
            expect(metrics[MetricType.CTR]).toBeDefined();
        });
    });
});