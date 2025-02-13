// External imports
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'jest';
import supertest from 'supertest'; // ^6.3.3

// Internal imports
import { GoogleAdsService } from '../../../backend/platform-integration/src/services/google.service';
import { LinkedInService } from '../../../backend/platform-integration/src/services/linkedin.service';
import { MockGoogleAdsService, MockLinkedInService } from '../../mocks/platform.mock';
import { 
    createMockLinkedInCampaign, 
    createMockGoogleCampaign,
    TEST_USER_ID,
    getMockPlatformResponse 
} from '../../fixtures/platform.fixture';
import { PlatformType, CampaignStatus } from '../../../backend/shared/types/campaign.types';

// Constants
const API_BASE_URL = '/api/v1';
const MOCK_DELAY = 50; // milliseconds

describe('Platform API Integration Tests', () => {
    let app: any;
    let request: supertest.SuperTest<supertest.Test>;
    let mockLinkedInService: MockLinkedInService;
    let mockGoogleAdsService: MockGoogleAdsService;
    let authToken: string;

    beforeAll(async () => {
        // Initialize mock services
        mockLinkedInService = new MockLinkedInService(MOCK_DELAY);
        mockGoogleAdsService = new MockGoogleAdsService(MOCK_DELAY);

        // Setup test environment and dependencies
        process.env.NODE_ENV = 'test';
        
        // Generate test auth token
        authToken = 'test-auth-token';
    });

    afterAll(async () => {
        // Cleanup test environment
        process.env.NODE_ENV = 'development';
    });

    beforeEach(async () => {
        // Reset mock services state
        jest.clearAllMocks();
    });

    describe('LinkedIn Campaign API Tests', () => {
        describe('POST /campaigns/linkedin', () => {
            it('should create a LinkedIn campaign successfully', async () => {
                const mockCampaign = createMockLinkedInCampaign();
                const mockResponse = getMockPlatformResponse(PlatformType.LINKEDIN, 'create');

                const response = await request
                    .post(`${API_BASE_URL}/campaigns/linkedin`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(mockCampaign)
                    .expect(201);

                expect(response.body).toMatchObject({
                    success: true,
                    data: {
                        id: expect.any(String),
                        status: CampaignStatus.PENDING_APPROVAL
                    }
                });
            });

            it('should validate required LinkedIn campaign fields', async () => {
                const invalidCampaign = createMockLinkedInCampaign({ 
                    name: '', 
                    budget: undefined 
                });

                await request
                    .post(`${API_BASE_URL}/campaigns/linkedin`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(invalidCampaign)
                    .expect(400);
            });
        });

        describe('PUT /campaigns/linkedin/:id', () => {
            it('should update a LinkedIn campaign successfully', async () => {
                const campaignId = 'test-campaign-id';
                const updates = {
                    name: 'Updated Campaign Name',
                    status: CampaignStatus.PAUSED
                };

                const response = await request
                    .put(`${API_BASE_URL}/campaigns/linkedin/${campaignId}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(updates)
                    .expect(200);

                expect(response.body).toMatchObject({
                    success: true,
                    data: {
                        id: campaignId,
                        ...updates
                    }
                });
            });

            it('should handle non-existent campaign updates', async () => {
                await request
                    .put(`${API_BASE_URL}/campaigns/linkedin/non-existent`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({ name: 'Updated Name' })
                    .expect(404);
            });
        });

        describe('GET /campaigns/linkedin/:id', () => {
            it('should retrieve LinkedIn campaign details', async () => {
                const mockCampaign = createMockLinkedInCampaign();
                const campaignId = mockCampaign.id;

                const response = await request
                    .get(`${API_BASE_URL}/campaigns/linkedin/${campaignId}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                expect(response.body).toMatchObject({
                    success: true,
                    data: {
                        id: campaignId,
                        platform: PlatformType.LINKEDIN
                    }
                });
            });
        });
    });

    describe('Google Ads Campaign API Tests', () => {
        describe('POST /campaigns/google', () => {
            it('should create a Google Ads campaign successfully', async () => {
                const mockCampaign = createMockGoogleCampaign();
                const mockResponse = getMockPlatformResponse(PlatformType.GOOGLE, 'create');

                const response = await request
                    .post(`${API_BASE_URL}/campaigns/google`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(mockCampaign)
                    .expect(201);

                expect(response.body).toMatchObject({
                    success: true,
                    data: {
                        id: expect.any(String),
                        status: CampaignStatus.PENDING_APPROVAL
                    }
                });
            });

            it('should validate required Google Ads campaign fields', async () => {
                const invalidCampaign = createMockGoogleCampaign({
                    platformConfig: undefined
                });

                await request
                    .post(`${API_BASE_URL}/campaigns/google`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(invalidCampaign)
                    .expect(400);
            });
        });

        describe('PUT /campaigns/google/:id', () => {
            it('should update a Google Ads campaign successfully', async () => {
                const campaignId = 'test-campaign-id';
                const updates = {
                    name: 'Updated Google Campaign',
                    status: CampaignStatus.PAUSED
                };

                const response = await request
                    .put(`${API_BASE_URL}/campaigns/google/${campaignId}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(updates)
                    .expect(200);

                expect(response.body).toMatchObject({
                    success: true,
                    data: {
                        id: campaignId,
                        ...updates
                    }
                });
            });
        });

        describe('GET /campaigns/google/:id/performance', () => {
            it('should retrieve Google Ads campaign performance metrics', async () => {
                const campaignId = 'test-campaign-id';

                const response = await request
                    .get(`${API_BASE_URL}/campaigns/google/${campaignId}/performance`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                expect(response.body).toMatchObject({
                    success: true,
                    data: {
                        impressions: expect.any(Number),
                        clicks: expect.any(Number),
                        ctr: expect.any(Number),
                        conversions: expect.any(Number),
                        cost: expect.any(Number)
                    }
                });
            });
        });
    });

    describe('Error Handling Tests', () => {
        it('should handle unauthorized requests', async () => {
            await request
                .post(`${API_BASE_URL}/campaigns/linkedin`)
                .send(createMockLinkedInCampaign())
                .expect(401);
        });

        it('should handle platform service errors gracefully', async () => {
            const mockCampaign = createMockLinkedInCampaign();
            jest.spyOn(mockLinkedInService, 'createCampaign')
                .mockRejectedValue(new Error('Service unavailable'));

            await request
                .post(`${API_BASE_URL}/campaigns/linkedin`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(mockCampaign)
                .expect(503);
        });

        it('should handle rate limiting', async () => {
            const mockCampaign = createMockGoogleCampaign();
            
            // Simulate multiple rapid requests
            const requests = Array(10).fill(null).map(() => 
                request
                    .post(`${API_BASE_URL}/campaigns/google`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(mockCampaign)
            );

            const responses = await Promise.all(requests);
            expect(responses.some(r => r.status === 429)).toBeTruthy();
        });
    });
});