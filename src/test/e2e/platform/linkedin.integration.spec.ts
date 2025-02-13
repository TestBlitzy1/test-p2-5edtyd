// External imports
import { jest, describe, beforeAll, afterAll, it, expect } from '@jest/globals'; // ^29.0.0
import supertest from 'supertest'; // ^6.3.3

// Internal imports
import { LinkedInService } from '../../../backend/platform-integration/src/services/linkedin.service';
import { createMockLinkedInCampaign, TEST_USER_ID } from '../../fixtures/platform.fixture';
import { MockLinkedInService } from '../../mocks/platform.mock';
import { 
    PlatformType,
    CampaignStatus,
    CampaignObjective,
    CompanySizeRange,
    BudgetPeriod
} from '../../../backend/shared/types/campaign.types';

describe('LinkedIn Ads Platform Integration Tests', () => {
    let linkedInService: LinkedInService;
    let mockLinkedInService: MockLinkedInService;
    let testCampaignId: string;

    // Test campaign configuration
    const testCampaign = createMockLinkedInCampaign({
        name: 'E2E Test LinkedIn Campaign',
        userId: TEST_USER_ID,
        objective: CampaignObjective.LEAD_GENERATION,
        status: CampaignStatus.DRAFT
    });

    beforeAll(async () => {
        // Initialize services with extended configuration
        linkedInService = new LinkedInService(process.env.LINKEDIN_ACCOUNT_ID || '', {
            maxRetries: 3,
            timeout: 30000,
            circuitBreaker: {
                failureThreshold: 5,
                resetTimeout: 30000
            }
        });

        mockLinkedInService = new MockLinkedInService(100);

        // Setup test environment
        process.env.NODE_ENV = 'test';
    });

    afterAll(async () => {
        // Cleanup test data
        if (testCampaignId) {
            try {
                await linkedInService.deleteCampaign(testCampaignId);
            } catch (error) {
                console.error('Cleanup error:', error);
            }
        }
    });

    describe('Campaign Creation Flow', () => {
        it('should successfully create a LinkedIn campaign with valid configuration', async () => {
            const response = await linkedInService.createCampaign(testCampaign);
            testCampaignId = response;

            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
        });

        it('should validate campaign structure before creation', async () => {
            const invalidCampaign = { ...testCampaign };
            delete invalidCampaign.targeting;

            await expect(linkedInService.createCampaign(invalidCampaign))
                .rejects
                .toThrow('Missing required campaign fields');
        });

        it('should enforce LinkedIn-specific targeting requirements', async () => {
            const invalidTargeting = { ...testCampaign };
            invalidTargeting.targeting.platformSpecific.linkedin = {
                skills: [],
                groups: [],
                schools: [],
                degrees: [],
                fieldOfStudy: []
            };

            await expect(linkedInService.createCampaign(invalidTargeting))
                .rejects
                .toThrow('Invalid LinkedIn targeting configuration');
        });
    });

    describe('Campaign Management Operations', () => {
        it('should successfully update campaign budget', async () => {
            const updates = {
                budget: {
                    amount: 2000,
                    currency: 'USD',
                    period: BudgetPeriod.DAILY,
                    startDate: new Date()
                }
            };

            await expect(linkedInService.updateCampaign(testCampaignId, updates))
                .resolves
                .not.toThrow();

            const updatedCampaign = await linkedInService.getCampaign(testCampaignId);
            expect(updatedCampaign.budget.amount).toBe(2000);
        });

        it('should successfully pause and resume campaign', async () => {
            await linkedInService.pauseCampaign(testCampaignId);
            let campaign = await linkedInService.getCampaign(testCampaignId);
            expect(campaign.status).toBe(CampaignStatus.PAUSED);

            await linkedInService.updateCampaign(testCampaignId, { status: CampaignStatus.ACTIVE });
            campaign = await linkedInService.getCampaign(testCampaignId);
            expect(campaign.status).toBe(CampaignStatus.ACTIVE);
        });
    });

    describe('Campaign Targeting Validation', () => {
        it('should validate location targeting requirements', async () => {
            const invalidLocations = { ...testCampaign };
            invalidLocations.targeting.locations = [];

            await expect(linkedInService.createCampaign(invalidLocations))
                .rejects
                .toThrow('At least one location must be specified');
        });

        it('should validate company size targeting', async () => {
            const validSizes = [CompanySizeRange.SMALL, CompanySizeRange.MEDIUM];
            const updates = {
                targeting: {
                    ...testCampaign.targeting,
                    companySize: validSizes
                }
            };

            await expect(linkedInService.updateCampaign(testCampaignId, updates))
                .resolves
                .not.toThrow();
        });
    });

    describe('Error Handling and Rate Limiting', () => {
        it('should handle API rate limiting', async () => {
            const promises = Array(10).fill(null).map(() => 
                linkedInService.getCampaign(testCampaignId)
            );

            await expect(Promise.all(promises))
                .resolves
                .not.toThrow();
        });

        it('should implement exponential backoff on failures', async () => {
            mockLinkedInService.createCampaignMock.mockRejectedValueOnce(new Error('API Error'));
            mockLinkedInService.createCampaignMock.mockRejectedValueOnce(new Error('API Error'));
            mockLinkedInService.createCampaignMock.mockResolvedValueOnce('success');

            const result = await linkedInService.createCampaign(testCampaign);
            expect(result).toBeDefined();
        });
    });

    describe('Compliance and Validation', () => {
        it('should enforce ad content compliance rules', async () => {
            const nonCompliantCampaign = { ...testCampaign };
            nonCompliantCampaign.adGroups[0].ads[0].description = 'Non-compliant content #@!';

            await expect(linkedInService.createCampaign(nonCompliantCampaign))
                .rejects
                .toThrow('Ad content does not comply with LinkedIn policies');
        });

        it('should validate budget constraints', async () => {
            const invalidBudget = {
                budget: {
                    amount: 0.5, // Below minimum
                    currency: 'USD',
                    period: BudgetPeriod.DAILY,
                    startDate: new Date()
                }
            };

            await expect(linkedInService.updateCampaign(testCampaignId, invalidBudget))
                .rejects
                .toThrow('Budget amount below minimum threshold');
        });
    });

    describe('Performance Optimization', () => {
        it('should apply AI-driven optimization recommendations', async () => {
            const optimizationUpdate = {
                aiOptimization: {
                    enabled: true,
                    optimizationGoals: ['CTR', 'CONVERSIONS'],
                    autoOptimize: true,
                    minBudgetAdjustment: -20,
                    maxBudgetAdjustment: 50,
                    optimizationFrequency: 24
                }
            };

            await expect(linkedInService.updateCampaign(testCampaignId, optimizationUpdate))
                .resolves
                .not.toThrow();
        });
    });
});