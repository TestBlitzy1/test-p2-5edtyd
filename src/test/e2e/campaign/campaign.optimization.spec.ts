import { describe, beforeAll, afterAll, it, expect } from 'jest';
import supertest from 'supertest';
import { OptimizationService } from '../../../backend/campaign-service/src/services/optimization.service';
import { generateMockCampaign } from '../../fixtures/campaign.fixture';
import { setupTestEnvironment } from '../../utils/test.helpers';
import { 
    PlatformType, 
    CampaignStatus,
    MetricType 
} from '../../../backend/shared/types/campaign.types';

describe('Campaign Optimization E2E Tests', () => {
    let optimizationService: OptimizationService;
    let testEnv: any;
    let testCampaigns: {
        linkedInCampaign: any;
        googleCampaign: any;
    };

    // Test timeout configuration
    const TEST_TIMEOUT = 30000;
    const OPTIMIZATION_TIMEOUT = 5000;

    beforeAll(async () => {
        // Setup test environment with required configurations
        testEnv = await setupTestEnvironment({
            dbConfig: {
                host: 'localhost',
                port: 5432,
                database: 'test_db',
                user: 'test_user',
                password: 'test_password'
            },
            mockServerPort: 3001,
            simulatedLatency: 100
        });

        // Initialize test campaigns
        testCampaigns = {
            linkedInCampaign: generateMockCampaign({
                platform: PlatformType.LINKEDIN,
                status: CampaignStatus.ACTIVE,
                performanceMetrics: {
                    [MetricType.CTR]: 0.8,
                    [MetricType.CPC]: 12.5,
                    [MetricType.CONVERSIONS]: 25,
                    [MetricType.ROAS]: 1.5
                }
            }),
            googleCampaign: generateMockCampaign({
                platform: PlatformType.GOOGLE,
                status: CampaignStatus.ACTIVE,
                performanceMetrics: {
                    [MetricType.CTR]: 0.5,
                    [MetricType.CPC]: 4.5,
                    [MetricType.CONVERSIONS]: 45,
                    [MetricType.ROAS]: 2.1
                }
            })
        };

        // Initialize optimization service
        optimizationService = new OptimizationService(
            testEnv.mockServer.getApp(),
            testEnv.logger,
            testEnv.redisCache,
            testEnv.statsEngine,
            {}
        );
    }, TEST_TIMEOUT);

    afterAll(async () => {
        await testEnv.cleanup();
    });

    describe('Campaign Optimization Flow', () => {
        it('should optimize underperforming LinkedIn campaign', async () => {
            const { linkedInCampaign } = testCampaigns;

            const optimizationResult = await optimizationService.optimizeCampaign(
                linkedInCampaign.id,
                {
                    forceOptimize: true,
                    optimizationGoals: [MetricType.CTR, MetricType.ROAS]
                }
            );

            expect(optimizationResult.success).toBe(true);
            expect(optimizationResult.changes.length).toBeGreaterThan(0);
            expect(optimizationResult.confidence).toBeGreaterThan(0.8);
            expect(optimizationResult.recommendations).toHaveLength(3);
        }, OPTIMIZATION_TIMEOUT);

        it('should optimize underperforming Google Ads campaign', async () => {
            const { googleCampaign } = testCampaigns;

            const optimizationResult = await optimizationService.optimizeCampaign(
                googleCampaign.id,
                {
                    forceOptimize: true,
                    optimizationGoals: [MetricType.CTR, MetricType.CPC]
                }
            );

            expect(optimizationResult.success).toBe(true);
            expect(optimizationResult.changes.length).toBeGreaterThan(0);
            expect(optimizationResult.confidence).toBeGreaterThan(0.8);
            expect(optimizationResult.recommendations).toHaveLength(3);
        }, OPTIMIZATION_TIMEOUT);
    });

    describe('Budget Optimization', () => {
        it('should optimize budget allocation based on performance', async () => {
            const { linkedInCampaign } = testCampaigns;

            const initialBudget = linkedInCampaign.budget.amount;
            const optimizationResult = await optimizationService.optimizeCampaign(
                linkedInCampaign.id,
                {
                    forceOptimize: true,
                    optimizationGoals: [MetricType.ROAS]
                }
            );

            const budgetChanges = optimizationResult.changes.filter(
                change => change.type === 'budget'
            );

            expect(budgetChanges.length).toBeGreaterThan(0);
            expect(budgetChanges[0].previousValue).toBe(initialBudget);
            expect(budgetChanges[0].newValue).not.toBe(initialBudget);
            expect(optimizationResult.confidence).toBeGreaterThan(0.9);
        }, OPTIMIZATION_TIMEOUT);

        it('should respect budget constraints during optimization', async () => {
            const { googleCampaign } = testCampaigns;

            const optimizationResult = await optimizationService.optimizeCampaign(
                googleCampaign.id,
                {
                    forceOptimize: true,
                    optimizationGoals: [MetricType.CPC]
                }
            );

            const budgetChanges = optimizationResult.changes.filter(
                change => change.type === 'budget'
            );

            expect(budgetChanges[0].newValue).toBeGreaterThan(
                budgetChanges[0].previousValue * 0.5
            );
            expect(budgetChanges[0].newValue).toBeLessThan(
                budgetChanges[0].previousValue * 1.5
            );
        }, OPTIMIZATION_TIMEOUT);
    });

    describe('A/B Testing Optimization', () => {
        it('should optimize based on A/B test results', async () => {
            const testResult = await optimizationService.manageABTests(
                testCampaigns.linkedInCampaign.id,
                {
                    variants: ['A', 'B', 'C'],
                    metrics: [MetricType.CTR, MetricType.CONVERSIONS],
                    duration: 7,
                    sampleSize: 10000
                }
            );

            expect(testResult.testId).toBeDefined();
            expect(testResult.winner).toBeDefined();
            expect(testResult.confidence).toBeGreaterThan(0.95);
            expect(testResult.metrics).toHaveProperty(MetricType.CTR);
            expect(testResult.metrics).toHaveProperty(MetricType.CONVERSIONS);
        }, TEST_TIMEOUT);

        it('should apply winning variant optimizations', async () => {
            const { googleCampaign } = testCampaigns;

            const testResult = await optimizationService.manageABTests(
                googleCampaign.id,
                {
                    variants: ['A', 'B'],
                    metrics: [MetricType.CTR],
                    duration: 7,
                    sampleSize: 5000
                }
            );

            const optimizationResult = await optimizationService.optimizeCampaign(
                googleCampaign.id,
                {
                    forceOptimize: true,
                    optimizationGoals: [MetricType.CTR]
                }
            );

            expect(optimizationResult.success).toBe(true);
            expect(optimizationResult.changes).toContainEqual(
                expect.objectContaining({
                    type: 'creative',
                    action: 'apply_winning_variant'
                })
            );
        }, TEST_TIMEOUT);
    });

    describe('Real-time Performance Optimization', () => {
        it('should generate real-time optimization recommendations', async () => {
            const recommendations = await optimizationService.generateRecommendations(
                [],
                testCampaigns.linkedInCampaign,
                {
                    platform: PlatformType.LINKEDIN,
                    objective: 'LEAD_GENERATION'
                }
            );

            expect(recommendations).toBeInstanceOf(Array);
            expect(recommendations.length).toBeGreaterThan(0);
            expect(recommendations[0]).toMatch(/^(Increase|Decrease|Optimize|Adjust)/);
        }, OPTIMIZATION_TIMEOUT);

        it('should handle optimization failures gracefully', async () => {
            const invalidCampaign = generateMockCampaign({
                status: CampaignStatus.DRAFT,
                performanceMetrics: {}
            });

            await expect(
                optimizationService.optimizeCampaign(invalidCampaign.id, {
                    forceOptimize: true
                })
            ).rejects.toThrow();
        });
    });
});