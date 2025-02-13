import { jest } from '@jest/globals';
import supertest from 'supertest';
import { 
    setupTestEnvironment, 
    createTestUser, 
    createTestCampaign, 
    generateTestMetrics 
} from '../../utils/test.helpers';
import { CampaignService } from '../../../backend/campaign-service/src/services/campaign.service';
import { AnalyticsService } from '../../../backend/analytics-service/src/services/analytics.service';
import { 
    MetricType, 
    TimeGranularity 
} from '../../../backend/shared/types/analytics.types';
import { 
    PlatformType, 
    CampaignStatus 
} from '../../../backend/shared/types/campaign.types';
import { ANALYTICS_CONFIG } from '../../../backend/shared/constants';

describe('Campaign Performance E2E Tests', () => {
    let testEnv: any;
    let testUser: any;
    let linkedInCampaign: any;
    let googleCampaign: any;
    let analyticsService: AnalyticsService;
    let campaignService: CampaignService;

    beforeAll(async () => {
        // Setup test environment with required services
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

        // Create test user and campaigns
        testUser = await createTestUser();
        linkedInCampaign = await createTestCampaign(testUser.id, PlatformType.LINKEDIN);
        googleCampaign = await createTestCampaign(testUser.id, PlatformType.GOOGLE);

        // Initialize services
        analyticsService = testEnv.analyticsService;
        campaignService = testEnv.campaignService;
    });

    afterAll(async () => {
        await testEnv.cleanup();
    });

    describe('Real-time Performance Tracking', () => {
        it('should track real-time campaign metrics correctly', async () => {
            // Generate test metrics data
            const testMetrics = await generateTestMetrics(linkedInCampaign.id, [
                MetricType.IMPRESSIONS,
                MetricType.CLICKS,
                MetricType.CTR,
                MetricType.CONVERSIONS,
                MetricType.COST
            ]);

            // Track metrics
            await analyticsService.trackMetrics(testMetrics, linkedInCampaign.id);

            // Verify real-time metrics
            const realtimeMetrics = await analyticsService.getRealtimeMetrics(linkedInCampaign.id);

            // Validate metric values
            expect(realtimeMetrics).toBeDefined();
            expect(realtimeMetrics[MetricType.IMPRESSIONS]).toBeGreaterThan(0);
            expect(realtimeMetrics[MetricType.CTR]).toBeLessThanOrEqual(100);
            expect(realtimeMetrics[MetricType.COST]).toBeGreaterThan(0);

            // Verify response time
            const startTime = Date.now();
            await analyticsService.getRealtimeMetrics(linkedInCampaign.id);
            const responseTime = Date.now() - startTime;
            expect(responseTime).toBeLessThan(5000); // 5s threshold
        });

        it('should handle concurrent metric updates correctly', async () => {
            const updatePromises = Array.from({ length: 10 }, async () => {
                const metrics = await generateTestMetrics(linkedInCampaign.id, [
                    MetricType.IMPRESSIONS,
                    MetricType.CLICKS
                ]);
                return analyticsService.trackMetrics(metrics, linkedInCampaign.id);
            });

            await expect(Promise.all(updatePromises)).resolves.not.toThrow();
        });
    });

    describe('Performance Reports', () => {
        it('should generate accurate performance reports', async () => {
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 days ago

            const report = await analyticsService.getPerformanceReport(
                linkedInCampaign.id,
                startDate,
                endDate,
                TimeGranularity.DAILY
            );

            expect(report).toBeDefined();
            expect(report.metrics).toHaveProperty(MetricType.IMPRESSIONS);
            expect(report.metrics).toHaveProperty(MetricType.CTR);
            expect(report.trends).toBeDefined();
            expect(report.recommendations).toHaveLength.greaterThan(0);
        });

        it('should cache and retrieve reports efficiently', async () => {
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - (24 * 60 * 60 * 1000)); // 1 day ago

            // First request - should hit database
            const startTime1 = Date.now();
            await analyticsService.getPerformanceReport(
                linkedInCampaign.id,
                startDate,
                endDate,
                TimeGranularity.HOURLY
            );
            const firstRequestTime = Date.now() - startTime1;

            // Second request - should hit cache
            const startTime2 = Date.now();
            await analyticsService.getPerformanceReport(
                linkedInCampaign.id,
                startDate,
                endDate,
                TimeGranularity.HOURLY
            );
            const cachedRequestTime = Date.now() - startTime2;

            expect(cachedRequestTime).toBeLessThan(firstRequestTime);
        });
    });

    describe('Campaign Optimization', () => {
        it('should trigger optimization based on performance thresholds', async () => {
            // Generate underperforming metrics
            const underperformingMetrics = await generateTestMetrics(linkedInCampaign.id, [
                MetricType.CTR,
                MetricType.CONVERSIONS
            ], { performanceLevel: 'low' });

            await analyticsService.trackMetrics(underperformingMetrics, linkedInCampaign.id);

            // Trigger optimization
            const optimizationResult = await campaignService.optimizeCampaign(linkedInCampaign.id);

            expect(optimizationResult.success).toBe(true);
            expect(optimizationResult.recommendations).toHaveLength.greaterThan(0);
            expect(optimizationResult.changes).toBeDefined();
            expect(optimizationResult.confidence).toBeGreaterThan(0);
        });

        it('should apply optimization changes correctly', async () => {
            const beforeOptimization = await campaignService.getCampaign(linkedInCampaign.id);
            
            // Trigger optimization
            await campaignService.optimizeCampaign(linkedInCampaign.id);
            
            const afterOptimization = await campaignService.getCampaign(linkedInCampaign.id);
            
            expect(afterOptimization.updatedAt).toBeGreaterThan(beforeOptimization.updatedAt);
            expect(afterOptimization.aiOptimization.lastOptimizedAt).toBeDefined();
        });
    });

    describe('Multi-Platform Performance Tracking', () => {
        it('should handle multi-platform campaign performance tracking', async () => {
            // Generate metrics for both platforms
            const linkedInMetrics = await generateTestMetrics(linkedInCampaign.id, [
                MetricType.IMPRESSIONS,
                MetricType.CTR
            ]);
            const googleMetrics = await generateTestMetrics(googleCampaign.id, [
                MetricType.IMPRESSIONS,
                MetricType.CTR
            ]);

            // Track metrics for both platforms
            await Promise.all([
                analyticsService.trackMetrics(linkedInMetrics, linkedInCampaign.id),
                analyticsService.trackMetrics(googleMetrics, googleCampaign.id)
            ]);

            // Get real-time metrics for both platforms
            const [linkedInPerformance, googlePerformance] = await Promise.all([
                analyticsService.getRealtimeMetrics(linkedInCampaign.id),
                analyticsService.getRealtimeMetrics(googleCampaign.id)
            ]);

            expect(linkedInPerformance).toBeDefined();
            expect(googlePerformance).toBeDefined();
            expect(linkedInPerformance[MetricType.IMPRESSIONS]).toBeDefined();
            expect(googlePerformance[MetricType.IMPRESSIONS]).toBeDefined();
        });

        it('should maintain platform-specific metric accuracy', async () => {
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days

            const [linkedInReport, googleReport] = await Promise.all([
                analyticsService.getPerformanceReport(
                    linkedInCampaign.id,
                    startDate,
                    endDate,
                    TimeGranularity.DAILY
                ),
                analyticsService.getPerformanceReport(
                    googleCampaign.id,
                    startDate,
                    endDate,
                    TimeGranularity.DAILY
                )
            ]);

            // Verify platform-specific metrics
            expect(linkedInReport.metrics).toHaveProperty('CTR');
            expect(googleReport.metrics).toHaveProperty('CTR');
            expect(typeof linkedInReport.metrics.CTR).toBe('number');
            expect(typeof googleReport.metrics.CTR).toBe('number');
        });
    });
});