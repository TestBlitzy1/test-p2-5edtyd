import { jest } from '@jest/globals';
import { GoogleAdsService } from '../../../backend/platform-integration/src/services/google.service';
import { MockGoogleAdsService } from '../../mocks/platform.mock';
import { generateMockCampaign, DEFAULT_CAMPAIGN_FIXTURES } from '../../fixtures/campaign.fixture';
import { PlatformType, CampaignStatus } from '../../../backend/shared/types/campaign.types';
import { MetricType } from '../../../backend/shared/types/analytics.types';

describe('Google Ads Platform Integration Tests', () => {
    let googleAdsService: GoogleAdsService;
    let mockService: MockGoogleAdsService;
    let testCampaignId: string;

    beforeAll(async () => {
        // Initialize services with test configuration
        googleAdsService = new GoogleAdsService();
        mockService = new MockGoogleAdsService(50); // 50ms mock delay

        // Set up test environment
        process.env.GOOGLE_CLIENT_ID = 'test-client-id';
        process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
        process.env.GOOGLE_DEVELOPER_TOKEN = 'test-developer-token';
        process.env.GOOGLE_API_VERSION = 'v12';
    });

    afterAll(async () => {
        // Clean up test data
        if (testCampaignId) {
            await mockService.pauseCampaign(testCampaignId);
        }
        
        // Reset environment variables
        delete process.env.GOOGLE_CLIENT_ID;
        delete process.env.GOOGLE_CLIENT_SECRET;
        delete process.env.GOOGLE_DEVELOPER_TOKEN;
        delete process.env.GOOGLE_API_VERSION;
    });

    describe('Campaign Creation', () => {
        it('should successfully create a Google Ads campaign with valid data', async () => {
            // Arrange
            const campaign = generateMockCampaign({
                platform: PlatformType.GOOGLE,
                status: CampaignStatus.DRAFT
            });

            // Act
            testCampaignId = await googleAdsService.createCampaign(campaign);

            // Assert
            expect(testCampaignId).toBeDefined();
            expect(testCampaignId).toMatch(/^ga_\d+_[a-z0-9]+$/);
        });

        it('should validate campaign structure before creation', async () => {
            // Arrange
            const invalidCampaign = DEFAULT_CAMPAIGN_FIXTURES.INVALID_CAMPAIGN;
            invalidCampaign.platform = PlatformType.GOOGLE;

            // Act & Assert
            await expect(googleAdsService.createCampaign(invalidCampaign))
                .rejects
                .toThrow('Invalid campaign structure: missing required fields');
        });

        it('should enforce Google Ads specific configuration', async () => {
            // Arrange
            const campaign = generateMockCampaign({
                platform: PlatformType.GOOGLE,
                platformConfig: { google: undefined }
            });

            // Act & Assert
            await expect(googleAdsService.createCampaign(campaign))
                .rejects
                .toThrow('Missing Google Ads specific configuration');
        });
    });

    describe('Campaign Updates', () => {
        it('should successfully update campaign settings', async () => {
            // Arrange
            const updates = {
                name: 'Updated Campaign Name',
                budget: {
                    amount: 10000,
                    currency: 'USD'
                }
            };

            // Act
            await googleAdsService.updateCampaign(testCampaignId, updates);
            const updatedCampaign = await mockService.getCampaignPerformance(testCampaignId);

            // Assert
            expect(updatedCampaign).toBeDefined();
        });

        it('should validate budget adjustments', async () => {
            // Arrange
            const invalidBudget = {
                budget: {
                    amount: -500,
                    currency: 'USD'
                }
            };

            // Act & Assert
            await expect(googleAdsService.updateCampaign(testCampaignId, invalidBudget))
                .rejects
                .toThrow('Invalid budget amount');
        });
    });

    describe('Performance Tracking', () => {
        it('should retrieve campaign performance metrics', async () => {
            // Act
            const performance = await googleAdsService.getCampaignPerformance(testCampaignId);

            // Assert
            expect(performance).toHaveProperty('impressions');
            expect(performance).toHaveProperty('clicks');
            expect(performance).toHaveProperty('ctr');
            expect(performance).toHaveProperty('conversions');
            expect(performance).toHaveProperty('cost');
        });

        it('should handle performance data aggregation', async () => {
            // Act
            const performance = await googleAdsService.getCampaignPerformance(testCampaignId);

            // Assert
            expect(performance).toHaveProperty('trends');
            expect(performance).toHaveProperty('recommendations');
        });
    });

    describe('Error Handling', () => {
        it('should handle API authentication errors', async () => {
            // Arrange
            process.env.GOOGLE_DEVELOPER_TOKEN = 'invalid-token';

            // Act & Assert
            await expect(googleAdsService.createCampaign(DEFAULT_CAMPAIGN_FIXTURES.GOOGLE_CAMPAIGN))
                .rejects
                .toThrow('Authentication failed');

            // Reset token
            process.env.GOOGLE_DEVELOPER_TOKEN = 'test-developer-token';
        });

        it('should handle rate limiting', async () => {
            // Arrange
            const campaign = generateMockCampaign({ platform: PlatformType.GOOGLE });
            const promises = Array(10).fill(null).map(() => 
                googleAdsService.createCampaign(campaign)
            );

            // Act & Assert
            await expect(Promise.all(promises))
                .rejects
                .toThrow('Rate limit exceeded');
        });

        it('should implement retry logic for transient errors', async () => {
            // Arrange
            const campaign = generateMockCampaign({ platform: PlatformType.GOOGLE });
            jest.spyOn(mockService, 'createCampaign').mockImplementationOnce(() => {
                throw new Error('Network error');
            });

            // Act
            const result = await googleAdsService.createCampaign(campaign);

            // Assert
            expect(result).toBeDefined();
            expect(mockService.createCampaign).toHaveBeenCalledTimes(2);
        });
    });

    describe('Compliance Validation', () => {
        it('should validate ad content policies', async () => {
            // Arrange
            const campaign = generateMockCampaign({
                platform: PlatformType.GOOGLE,
                adGroups: [{
                    ...DEFAULT_CAMPAIGN_FIXTURES.GOOGLE_CAMPAIGN.adGroups[0],
                    ads: [{
                        ...DEFAULT_CAMPAIGN_FIXTURES.GOOGLE_CAMPAIGN.adGroups[0].ads[0],
                        headline: 'Invalid #$% Characters'
                    }]
                }]
            });

            // Act & Assert
            await expect(googleAdsService.createCampaign(campaign))
                .rejects
                .toThrow('Ad content violates Google Ads policies');
        });

        it('should enforce targeting restrictions', async () => {
            // Arrange
            const campaign = generateMockCampaign({
                platform: PlatformType.GOOGLE,
                targeting: {
                    ...DEFAULT_CAMPAIGN_FIXTURES.GOOGLE_CAMPAIGN.targeting,
                    locations: [] // Empty locations
                }
            });

            // Act & Assert
            await expect(googleAdsService.createCampaign(campaign))
                .rejects
                .toThrow('Location targeting is required');
        });

        it('should validate budget constraints', async () => {
            // Arrange
            const campaign = generateMockCampaign({
                platform: PlatformType.GOOGLE,
                budget: {
                    ...DEFAULT_CAMPAIGN_FIXTURES.GOOGLE_CAMPAIGN.budget,
                    amount: 0.5 // Below minimum
                }
            });

            // Act & Assert
            await expect(googleAdsService.createCampaign(campaign))
                .rejects
                .toThrow('Budget amount below minimum threshold');
        });
    });
});