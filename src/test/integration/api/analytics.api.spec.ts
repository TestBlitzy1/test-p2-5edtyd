import supertest from 'supertest';
import { 
    setupTestEnvironment, 
    createTestUser, 
    createTestCampaign 
} from '../../utils/test.helpers';
import { 
    createMetricFixture, 
    createMetricsBatchFixture, 
    createTimeSeriesMetricsFixture 
} from '../../fixtures/analytics.fixture';
import { 
    MetricType, 
    TimeGranularity, 
    IMetric, 
    IAnalytics, 
    IPerformanceReport, 
    IForecast 
} from '../../../backend/shared/types/analytics.types';
import { TEST_USER, TEST_CAMPAIGN, TEST_AUTH_HEADERS } from '../../utils/test.constants';

describe('Analytics API Integration Tests', () => {
    let request: supertest.SuperTest<supertest.Test>;
    let testEnv: any;
    let testCampaignId: string;

    beforeAll(async () => {
        // Initialize test environment
        testEnv = await setupTestEnvironment({
            dbConfig: {
                host: 'localhost',
                port: 5432,
                database: 'test_db',
                user: 'test_user',
                password: 'test_password'
            },
            mockServerPort: 3001
        });

        request = supertest(testEnv.mockServer.getApp());
        
        // Create test campaign with initial data
        const campaign = await createTestCampaign(TEST_USER.id, TEST_CAMPAIGN.platform);
        testCampaignId = campaign.id;

        // Generate historical metrics data
        const historicalMetrics = createTimeSeriesMetricsFixture(MetricType.IMPRESSIONS, 30);
        await testEnv.dbPool.query(
            'INSERT INTO analytics (campaign_id, metrics) VALUES ($1, $2)',
            [testCampaignId, JSON.stringify(historicalMetrics)]
        );
    });

    afterAll(async () => {
        await testEnv.cleanup();
    });

    describe('POST /api/analytics/metrics', () => {
        it('should track new metrics successfully', async () => {
            const metrics = createMetricsBatchFixture(5, [
                MetricType.IMPRESSIONS,
                MetricType.CLICKS,
                MetricType.CTR
            ]);

            const response = await request
                .post('/api/analytics/metrics')
                .set(TEST_AUTH_HEADERS)
                .send({
                    campaignId: testCampaignId,
                    metrics
                });

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                success: true,
                metricsCount: metrics.length
            });
        });

        it('should validate metric value ranges', async () => {
            const invalidMetric = createMetricFixture(MetricType.CTR, {
                value: 101 // Invalid CTR > 100%
            });

            const response = await request
                .post('/api/analytics/metrics')
                .set(TEST_AUTH_HEADERS)
                .send({
                    campaignId: testCampaignId,
                    metrics: [invalidMetric]
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Invalid metric value');
        });

        it('should handle batch metric correlations', async () => {
            const impressions = 1000;
            const clicks = 100;
            
            const metrics = [
                createMetricFixture(MetricType.IMPRESSIONS, { value: impressions }),
                createMetricFixture(MetricType.CLICKS, { value: clicks }),
                createMetricFixture(MetricType.CTR, { value: (clicks/impressions) * 100 })
            ];

            const response = await request
                .post('/api/analytics/metrics')
                .set(TEST_AUTH_HEADERS)
                .send({
                    campaignId: testCampaignId,
                    metrics
                });

            expect(response.status).toBe(200);
            expect(response.body.validationStatus).toBe('PASSED');
        });
    });

    describe('GET /api/analytics/report/:campaignId', () => {
        it('should generate performance report with trends', async () => {
            const response = await request
                .get(`/api/analytics/report/${testCampaignId}`)
                .set(TEST_AUTH_HEADERS)
                .query({
                    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date().toISOString(),
                    granularity: TimeGranularity.DAILY
                });

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject<IPerformanceReport>({
                campaignId: testCampaignId,
                metrics: expect.any(Object),
                trends: expect.any(Object),
                recommendations: expect.any(Array)
            });
        });

        it('should handle missing data periods', async () => {
            const response = await request
                .get(`/api/analytics/report/${testCampaignId}`)
                .set(TEST_AUTH_HEADERS)
                .query({
                    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date().toISOString()
                });

            expect(response.status).toBe(200);
            expect(response.body.dataCompleteness).toBeLessThan(100);
        });
    });

    describe('GET /api/analytics/forecast/:campaignId', () => {
        it('should generate performance forecast', async () => {
            const response = await request
                .get(`/api/analytics/forecast/${testCampaignId}`)
                .set(TEST_AUTH_HEADERS)
                .query({
                    metricTypes: [MetricType.IMPRESSIONS, MetricType.CTR],
                    horizon: 7 // 7-day forecast
                });

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject<IForecast>({
                campaignId: testCampaignId,
                predictions: expect.any(Object),
                confidence: expect.any(Number),
                forecastDate: expect.any(String)
            });
            expect(response.body.confidence).toBeGreaterThan(0);
            expect(response.body.confidence).toBeLessThanOrEqual(1);
        });

        it('should handle insufficient historical data', async () => {
            const newCampaign = await createTestCampaign(TEST_USER.id, TEST_CAMPAIGN.platform);
            
            const response = await request
                .get(`/api/analytics/forecast/${newCampaign.id}`)
                .set(TEST_AUTH_HEADERS)
                .query({
                    metricTypes: [MetricType.IMPRESSIONS],
                    horizon: 7
                });

            expect(response.status).toBe(422);
            expect(response.body.error).toContain('Insufficient historical data');
        });
    });

    describe('GET /api/analytics/realtime/:campaignId', () => {
        it('should stream real-time metrics updates', async () => {
            const metrics: IMetric[] = [];
            
            const response = await request
                .get(`/api/analytics/realtime/${testCampaignId}`)
                .set(TEST_AUTH_HEADERS)
                .buffer(true)
                .parse((res, cb) => {
                    res.on('data', (chunk: Buffer) => {
                        const metric = JSON.parse(chunk.toString());
                        metrics.push(metric);
                    });
                    res.on('end', () => cb(null, metrics));
                });

            expect(response.status).toBe(200);
            expect(metrics.length).toBeGreaterThan(0);
            metrics.forEach(metric => {
                expect(metric).toMatchObject({
                    type: expect.any(String),
                    value: expect.any(Number),
                    timestamp: expect.any(String)
                });
            });
        });

        it('should handle connection interruptions', async () => {
            const response = await request
                .get(`/api/analytics/realtime/${testCampaignId}`)
                .set(TEST_AUTH_HEADERS)
                .timeout(100)
                .catch(err => err.response);

            expect(response.status).toBe(503);
            expect(response.body.error).toContain('Connection interrupted');
        });
    });
});