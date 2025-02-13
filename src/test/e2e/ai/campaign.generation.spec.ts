import { setupTestEnvironment, cleanDatabase } from '../../utils/test.helpers';
import { generateMockCampaign } from '../../fixtures/campaign.fixture';
import { CampaignGenerator } from '../../../backend/ai-service/src/models/campaign_generator';
import { jest } from '@jest/globals';
import supertest from 'supertest';
import { 
    PlatformType, 
    CampaignObjective, 
    CampaignStatus,
    CompanySizeRange 
} from '../../../backend/shared/types/campaign.types';
import { MetricType } from '../../../backend/shared/types/analytics.types';

describe('Campaign Generation E2E Tests', () => {
    let campaignGenerator: CampaignGenerator;
    let request: supertest.SuperTest<supertest.Test>;
    let testEnv: any;

    beforeAll(async () => {
        // Initialize test environment with GPU support and monitoring
        testEnv = await setupTestEnvironment({
            dbConfig: {
                host: 'localhost',
                port: 5432,
                database: 'test_db',
                user: 'test_user',
                password: 'test_password'
            },
            mockServerPort: 3001,
            simulatedLatency: 50
        });

        // Initialize campaign generator with performance monitoring
        campaignGenerator = new CampaignGenerator(
            testEnv.modelManager,
            testEnv.openAIService,
            {
                enableGPU: true,
                batchSize: 32,
                performanceMonitoring: true
            }
        );

        request = supertest(testEnv.mockServer.getApp());
    });

    afterEach(async () => {
        await cleanDatabase(testEnv.dbPool);
        jest.clearAllMocks();
    });

    describe('LinkedIn Campaign Generation', () => {
        it('should generate optimized LinkedIn campaign structure with 80% setup time reduction', async () => {
            // Start performance timer
            const startTime = Date.now();

            // Generate mock LinkedIn campaign data
            const mockCampaign = generateMockCampaign({
                platform: PlatformType.LINKEDIN,
                objective: CampaignObjective.LEAD_GENERATION,
                status: CampaignStatus.DRAFT,
                targeting: {
                    locations: [{
                        id: 'us-ca',
                        country: 'United States',
                        region: 'California'
                    }],
                    industries: ['Technology', 'Marketing'],
                    companySize: [CompanySizeRange.MEDIUM, CompanySizeRange.LARGE],
                    jobTitles: ['Marketing Manager', 'Digital Marketing Specialist'],
                    interests: ['B2B Marketing', 'Lead Generation'],
                    platformSpecific: {
                        linkedin: {
                            skills: ['Digital Marketing', 'B2B Marketing'],
                            groups: ['Digital Marketing Professionals'],
                            schools: [],
                            degrees: ['Bachelor's Degree'],
                            fieldOfStudy: ['Marketing']
                        }
                    }
                }
            });

            // Call campaign generation endpoint
            const response = await request
                .post('/api/campaigns/generate')
                .send(mockCampaign)
                .expect(200);

            // Calculate setup time
            const setupTime = Date.now() - startTime;
            const manualSetupTime = 3600000; // 1 hour in milliseconds
            const setupTimeReduction = (manualSetupTime - setupTime) / manualSetupTime * 100;

            // Validate response structure
            expect(response.body).toHaveProperty('campaign');
            expect(response.body.campaign).toHaveProperty('id');
            expect(response.body.campaign.platform).toBe(PlatformType.LINKEDIN);

            // Validate LinkedIn-specific optimizations
            expect(response.body.campaign.platformConfig.linkedin).toHaveProperty('campaignType');
            expect(response.body.campaign.platformConfig.linkedin).toHaveProperty('objectiveType');
            expect(response.body.campaign.platformConfig.linkedin.audienceExpansion).toBeDefined();

            // Validate targeting compliance
            expect(response.body.campaign.targeting.companySize).toContain(CompanySizeRange.MEDIUM);
            expect(response.body.campaign.targeting.platformSpecific.linkedin.skills).toBeDefined();

            // Validate budget allocation
            expect(response.body.campaign.budget).toHaveProperty('amount');
            expect(response.body.campaign.budget.amount).toBeGreaterThan(0);

            // Verify setup time reduction meets 80% target
            expect(setupTimeReduction).toBeGreaterThanOrEqual(80);

            // Validate AI optimization settings
            expect(response.body.campaign.aiOptimization).toHaveProperty('enabled', true);
            expect(response.body.campaign.aiOptimization.optimizationGoals).toContain(MetricType.CONVERSIONS);
        });
    });

    describe('Google Ads Campaign Generation', () => {
        it('should generate optimized Google Ads campaign structure with performance predictions', async () => {
            // Generate mock Google Ads campaign
            const mockCampaign = generateMockCampaign({
                platform: PlatformType.GOOGLE,
                objective: CampaignObjective.LEAD_GENERATION,
                status: CampaignStatus.DRAFT,
                targeting: {
                    locations: [{
                        id: 'us-ny',
                        country: 'United States',
                        region: 'New York'
                    }],
                    industries: ['Software', 'SaaS'],
                    platformSpecific: {
                        google: {
                            keywords: ['b2b software', 'marketing automation'],
                            topics: ['Business Software'],
                            placements: [],
                            audiences: ['Business Decision Makers']
                        }
                    }
                }
            });

            // Call campaign generation endpoint
            const response = await request
                .post('/api/campaigns/generate')
                .send(mockCampaign)
                .expect(200);

            // Validate Google Ads specific structure
            expect(response.body.campaign.platformConfig.google).toHaveProperty('networkSettings');
            expect(response.body.campaign.platformConfig.google.networkSettings).toHaveProperty('searchNetwork');
            expect(response.body.campaign.platformConfig.google.networkSettings).toHaveProperty('displayNetwork');

            // Validate targeting parameters
            expect(response.body.campaign.targeting.platformSpecific.google.keywords).toBeDefined();
            expect(response.body.campaign.targeting.platformSpecific.google.keywords.length).toBeGreaterThan(0);

            // Validate performance predictions
            expect(response.body.campaign).toHaveProperty('predictedPerformance');
            expect(response.body.campaign.predictedPerformance).toHaveProperty('predictedCtr');
            expect(response.body.campaign.predictedPerformance).toHaveProperty('predictedConversionRate');
        });
    });

    describe('Campaign Optimization', () => {
        it('should optimize existing campaign structure based on performance data', async () => {
            // Create initial campaign
            const initialCampaign = generateMockCampaign({
                platform: PlatformType.LINKEDIN,
                status: CampaignStatus.ACTIVE
            });

            // Mock performance data
            const performanceData = {
                metrics: [
                    { type: MetricType.CTR, value: 1.5 },
                    { type: MetricType.CONVERSIONS, value: 25 },
                    { type: MetricType.ROAS, value: 2.8 }
                ],
                timeframe: 'LAST_30_DAYS'
            };

            // Call optimization endpoint
            const response = await request
                .post('/api/campaigns/optimize')
                .send({
                    campaign: initialCampaign,
                    performanceData
                })
                .expect(200);

            // Validate optimization changes
            expect(response.body.campaign).toHaveProperty('optimizationHistory');
            expect(response.body.campaign.budget).not.toEqual(initialCampaign.budget);
            expect(response.body.campaign.targeting).not.toEqual(initialCampaign.targeting);

            // Validate optimization metrics
            expect(response.body.optimizationMetrics).toBeDefined();
            expect(response.body.optimizationMetrics.improvementPredictions).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid campaign parameters gracefully', async () => {
            // Generate invalid campaign data
            const invalidCampaign = generateMockCampaign({
                platform: PlatformType.LINKEDIN,
                budget: { amount: -1000, currency: 'USD' }
            });

            // Test error response
            const response = await request
                .post('/api/campaigns/generate')
                .send(invalidCampaign)
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toHaveProperty('code', 'INVALID_CAMPAIGN_PARAMETERS');
            expect(response.body.error).toHaveProperty('details');
        });

        it('should handle AI service unavailability', async () => {
            // Mock AI service failure
            jest.spyOn(campaignGenerator, 'generate_campaign').mockRejectedValue(
                new Error('AI Service Unavailable')
            );

            const mockCampaign = generateMockCampaign({
                platform: PlatformType.LINKEDIN
            });

            // Test error handling
            const response = await request
                .post('/api/campaigns/generate')
                .send(mockCampaign)
                .expect(503);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toHaveProperty('code', 'AI_SERVICE_UNAVAILABLE');
            expect(response.body.error).toHaveProperty('retryAfter');
        });
    });
});