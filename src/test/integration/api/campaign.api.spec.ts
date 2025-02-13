// External imports
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import supertest from 'supertest';

// Internal imports
import { 
    generateMockCampaign, 
    DEFAULT_CAMPAIGN_FIXTURES 
} from '../../fixtures/campaign.fixture';
import { 
    ICampaign, 
    PlatformType,
    CampaignStatus,
    CampaignObjective 
} from '../../../backend/shared/types/campaign.types';
import { setupTestEnvironment } from '../../utils/test.setup';
import { teardownTestEnvironment } from '../../utils/test.teardown';
import { MetricType } from '../../../backend/shared/types/analytics.types';

describe('Campaign API Integration Tests', () => {
    let request: supertest.SuperTest<supertest.Test>;
    let testAuthToken: string;

    beforeAll(async () => {
        await setupTestEnvironment();
        request = supertest(global.app);
        testAuthToken = global.mockAuthToken;
    });

    afterAll(async () => {
        await teardownTestEnvironment();
    });

    beforeEach(async () => {
        // Reset test state between each test
        await request
            .post('/api/test/reset')
            .set('Authorization', `Bearer ${testAuthToken}`);
    });

    describe('Campaign Creation', () => {
        test('should create LinkedIn campaign successfully', async () => {
            const mockCampaign = generateMockCampaign({
                platform: PlatformType.LINKEDIN,
                objective: CampaignObjective.LEAD_GENERATION
            });

            const response = await request
                .post('/api/campaigns')
                .set('Authorization', `Bearer ${testAuthToken}`)
                .send(mockCampaign);

            expect(response.status).toBe(201);
            expect(response.body).toMatchObject({
                platform: PlatformType.LINKEDIN,
                status: CampaignStatus.DRAFT,
                objective: CampaignObjective.LEAD_GENERATION
            });
            expect(response.body.id).toBeDefined();
            expect(response.body.aiOptimization).toBeDefined();
        });

        test('should create Google Ads campaign successfully', async () => {
            const mockCampaign = generateMockCampaign({
                platform: PlatformType.GOOGLE,
                objective: CampaignObjective.CONVERSIONS
            });

            const response = await request
                .post('/api/campaigns')
                .set('Authorization', `Bearer ${testAuthToken}`)
                .send(mockCampaign);

            expect(response.status).toBe(201);
            expect(response.body).toMatchObject({
                platform: PlatformType.GOOGLE,
                status: CampaignStatus.DRAFT,
                objective: CampaignObjective.CONVERSIONS
            });
            expect(response.body.platformConfig.google).toBeDefined();
        });

        test('should validate campaign requirements', async () => {
            const invalidCampaign = {
                ...DEFAULT_CAMPAIGN_FIXTURES.INVALID_CAMPAIGN,
                budget: { amount: -1000 }
            };

            const response = await request
                .post('/api/campaigns')
                .set('Authorization', `Bearer ${testAuthToken}`)
                .send(invalidCampaign);

            expect(response.status).toBe(400);
            expect(response.body.errors).toContain('Invalid budget amount');
        });
    });

    describe('Campaign Optimization', () => {
        test('should optimize campaign using AI recommendations', async () => {
            // Create initial campaign
            const campaign = await request
                .post('/api/campaigns')
                .set('Authorization', `Bearer ${testAuthToken}`)
                .send(DEFAULT_CAMPAIGN_FIXTURES.LINKEDIN_CAMPAIGN);

            const campaignId = campaign.body.id;

            // Trigger optimization
            const response = await request
                .post(`/api/campaigns/${campaignId}/optimize`)
                .set('Authorization', `Bearer ${testAuthToken}`)
                .send({
                    metrics: [MetricType.CTR, MetricType.CONVERSIONS],
                    autoApply: true
                });

            expect(response.status).toBe(200);
            expect(response.body.recommendations).toBeDefined();
            expect(response.body.predictedImprovements).toBeDefined();
        });

        test('should handle platform-specific optimization rules', async () => {
            const campaign = await request
                .post('/api/campaigns')
                .set('Authorization', `Bearer ${testAuthToken}`)
                .send(DEFAULT_CAMPAIGN_FIXTURES.GOOGLE_CAMPAIGN);

            const response = await request
                .post(`/api/campaigns/${campaign.body.id}/optimize`)
                .set('Authorization', `Bearer ${testAuthToken}`)
                .send({
                    metrics: [MetricType.ROAS],
                    autoApply: true
                });

            expect(response.status).toBe(200);
            expect(response.body.platformConfig.google.targetROAS).toBeDefined();
        });
    });

    describe('Campaign Management', () => {
        test('should update campaign status', async () => {
            const campaign = await request
                .post('/api/campaigns')
                .set('Authorization', `Bearer ${testAuthToken}`)
                .send(DEFAULT_CAMPAIGN_FIXTURES.LINKEDIN_CAMPAIGN);

            const response = await request
                .patch(`/api/campaigns/${campaign.body.id}/status`)
                .set('Authorization', `Bearer ${testAuthToken}`)
                .send({ status: CampaignStatus.ACTIVE });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe(CampaignStatus.ACTIVE);
            expect(response.body.updatedAt).toBeDefined();
        });

        test('should sync campaign with platform', async () => {
            const campaign = await request
                .post('/api/campaigns')
                .set('Authorization', `Bearer ${testAuthToken}`)
                .send(DEFAULT_CAMPAIGN_FIXTURES.LINKEDIN_CAMPAIGN);

            const response = await request
                .post(`/api/campaigns/${campaign.body.id}/sync`)
                .set('Authorization', `Bearer ${testAuthToken}`);

            expect(response.status).toBe(200);
            expect(response.body.platformStatus).toBeDefined();
            expect(response.body.lastSyncedAt).toBeDefined();
        });
    });

    describe('Campaign Analytics', () => {
        test('should retrieve campaign performance metrics', async () => {
            const campaign = await request
                .post('/api/campaigns')
                .set('Authorization', `Bearer ${testAuthToken}`)
                .send(DEFAULT_CAMPAIGN_FIXTURES.LINKEDIN_CAMPAIGN);

            const response = await request
                .get(`/api/campaigns/${campaign.body.id}/analytics`)
                .set('Authorization', `Bearer ${testAuthToken}`)
                .query({ timeframe: '30d' });

            expect(response.status).toBe(200);
            expect(response.body.metrics).toBeDefined();
            expect(response.body.trends).toBeDefined();
        });

        test('should generate performance forecast', async () => {
            const campaign = await request
                .post('/api/campaigns')
                .set('Authorization', `Bearer ${testAuthToken}`)
                .send(DEFAULT_CAMPAIGN_FIXTURES.GOOGLE_CAMPAIGN);

            const response = await request
                .get(`/api/campaigns/${campaign.body.id}/forecast`)
                .set('Authorization', `Bearer ${testAuthToken}`)
                .query({ horizon: '30d' });

            expect(response.status).toBe(200);
            expect(response.body.predictions).toBeDefined();
            expect(response.body.confidence).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        test('should handle unauthorized access', async () => {
            const response = await request
                .post('/api/campaigns')
                .send(DEFAULT_CAMPAIGN_FIXTURES.LINKEDIN_CAMPAIGN);

            expect(response.status).toBe(401);
        });

        test('should handle invalid campaign data', async () => {
            const response = await request
                .post('/api/campaigns')
                .set('Authorization', `Bearer ${testAuthToken}`)
                .send({
                    ...DEFAULT_CAMPAIGN_FIXTURES.LINKEDIN_CAMPAIGN,
                    platform: 'INVALID_PLATFORM'
                });

            expect(response.status).toBe(400);
            expect(response.body.errors).toBeDefined();
        });

        test('should handle non-existent campaign', async () => {
            const response = await request
                .get('/api/campaigns/non-existent-id')
                .set('Authorization', `Bearer ${testAuthToken}`);

            expect(response.status).toBe(404);
        });
    });
});