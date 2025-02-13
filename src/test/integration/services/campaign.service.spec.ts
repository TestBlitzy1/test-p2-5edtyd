// External package imports
import { jest } from '@jest/globals';
import supertest from 'supertest';
import '@testing-library/jest-dom';

// Internal imports
import { CampaignService } from '../../../backend/campaign-service/src/services/campaign.service';
import { Campaign } from '../../../backend/campaign-service/src/models/campaign.model';
import { 
    PlatformType,
    CampaignObjective,
    CampaignStatus,
    BudgetPeriod,
    CompanySizeRange,
    ICampaign,
    IAdGroup,
    IBudget,
    ITargeting
} from '../../../shared/types/campaign.types';
import { MetricType } from '../../../shared/types/analytics.types';

// Mock implementations
jest.mock('../../../backend/campaign-service/src/models/campaign.model');

describe('CampaignService Integration Tests', () => {
    let campaignService: CampaignService;
    let mockCampaignModel: jest.Mocked<typeof Campaign>;
    let mockLogger: any;
    let mockEventEmitter: any;
    let mockMetrics: any;

    // Test data
    const mockLinkedInCampaign: ICampaign = {
        id: 'test-linkedin-campaign',
        userId: 'test-user',
        name: 'Test LinkedIn Campaign',
        platform: PlatformType.LINKEDIN,
        objective: CampaignObjective.LEAD_GENERATION,
        status: CampaignStatus.DRAFT,
        budget: {
            amount: 1000,
            currency: 'USD',
            period: BudgetPeriod.DAILY,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        targeting: {
            locations: [{
                id: 'us',
                country: 'United States'
            }],
            industries: ['Technology', 'Software'],
            companySize: [CompanySizeRange.MEDIUM, CompanySizeRange.LARGE],
            jobTitles: ['Software Engineer', 'Developer'],
            interests: ['Programming', 'Technology'],
            platformSpecific: {
                linkedin: {
                    skills: ['JavaScript', 'TypeScript'],
                    groups: ['Tech Professionals'],
                    schools: [],
                    degrees: ['Bachelor'],
                    fieldOfStudy: ['Computer Science']
                }
            }
        },
        adGroups: [],
        performanceTargets: [{
            metric: MetricType.CTR,
            target: 2.5,
            timeframe: 30,
            priority: 1
        }],
        aiOptimization: {
            enabled: true,
            optimizationGoals: [MetricType.CTR, MetricType.CONVERSIONS],
            autoOptimize: true,
            minBudgetAdjustment: 0.1,
            maxBudgetAdjustment: 0.5,
            optimizationFrequency: 24
        },
        platformConfig: {
            linkedin: {
                campaignType: 'Sponsored Content',
                objectiveType: 'Lead Generation',
                audienceExpansion: true,
                enabledNetworks: ['LinkedIn Feed']
            }
        },
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const mockGoogleCampaign: ICampaign = {
        ...mockLinkedInCampaign,
        id: 'test-google-campaign',
        platform: PlatformType.GOOGLE,
        platformConfig: {
            google: {
                networkSettings: {
                    searchNetwork: true,
                    displayNetwork: true,
                    partnerNetwork: false
                },
                deliveryMethod: 'STANDARD',
                targetCPA: 50
            }
        }
    };

    beforeAll(async () => {
        // Initialize mocks
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn()
        };

        mockEventEmitter = {
            emit: jest.fn()
        };

        mockMetrics = {
            Counter: jest.fn().mockImplementation(() => ({
                inc: jest.fn()
            })),
            Gauge: jest.fn().mockImplementation(() => ({
                set: jest.fn()
            })),
            Histogram: jest.fn().mockImplementation(() => ({
                startTimer: jest.fn().mockReturnValue(() => {})
            }))
        };

        // Initialize service
        campaignService = new CampaignService(
            mockCampaignModel,
            mockLogger,
            mockEventEmitter,
            mockMetrics
        );
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('LinkedIn Campaign Operations', () => {
        test('should create LinkedIn campaign with AI optimization', async () => {
            // Setup
            const createSpy = jest.spyOn(mockCampaignModel, 'create')
                .mockResolvedValueOnce(mockLinkedInCampaign);

            // Execute
            const result = await campaignService.createCampaign(mockLinkedInCampaign);

            // Verify
            expect(result).toBeDefined();
            expect(result.platform).toBe(PlatformType.LINKEDIN);
            expect(createSpy).toHaveBeenCalledWith(mockLinkedInCampaign);
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('campaignCreated', expect.any(Object));
            expect(result.aiOptimization.enabled).toBe(true);
        });

        test('should update LinkedIn campaign with validation', async () => {
            // Setup
            const findByIdSpy = jest.spyOn(mockCampaignModel, 'findById')
                .mockResolvedValueOnce(mockLinkedInCampaign);
            
            const updateData = {
                name: 'Updated LinkedIn Campaign',
                status: CampaignStatus.ACTIVE
            };

            // Execute
            const result = await campaignService.updateCampaign(
                mockLinkedInCampaign.id,
                updateData
            );

            // Verify
            expect(result).toBeDefined();
            expect(result.name).toBe(updateData.name);
            expect(result.status).toBe(updateData.status);
            expect(findByIdSpy).toHaveBeenCalledWith(mockLinkedInCampaign.id);
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('campaignUpdated', expect.any(Object));
        });
    });

    describe('Google Ads Campaign Operations', () => {
        test('should create Google Ads campaign with AI optimization', async () => {
            // Setup
            const createSpy = jest.spyOn(mockCampaignModel, 'create')
                .mockResolvedValueOnce(mockGoogleCampaign);

            // Execute
            const result = await campaignService.createCampaign(mockGoogleCampaign);

            // Verify
            expect(result).toBeDefined();
            expect(result.platform).toBe(PlatformType.GOOGLE);
            expect(createSpy).toHaveBeenCalledWith(mockGoogleCampaign);
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('campaignCreated', expect.any(Object));
            expect(result.platformConfig.google).toBeDefined();
        });

        test('should optimize Google Ads campaign performance', async () => {
            // Setup
            const findByIdSpy = jest.spyOn(mockCampaignModel, 'findById')
                .mockResolvedValueOnce({
                    ...mockGoogleCampaign,
                    optimizeWithAI: jest.fn().mockResolvedValueOnce({
                        success: true,
                        recommendations: ['Increase bid by 10%'],
                        changes: { bidAdjustment: 1.1 },
                        confidence: 0.85
                    })
                });

            // Execute
            const result = await campaignService.optimizeCampaign(mockGoogleCampaign.id);

            // Verify
            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.recommendations).toHaveLength(1);
            expect(result.confidence).toBeGreaterThan(0.8);
            expect(findByIdSpy).toHaveBeenCalledWith(mockGoogleCampaign.id);
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('campaignOptimized', expect.any(Object));
        });
    });

    describe('Campaign Performance Tracking', () => {
        test('should track campaign metrics and trigger optimization', async () => {
            // Setup
            const campaign = {
                ...mockLinkedInCampaign,
                performanceMetrics: {
                    [MetricType.CTR]: 1.5,
                    [MetricType.CONVERSIONS]: 100
                },
                optimizeWithAI: jest.fn().mockResolvedValueOnce({
                    success: true,
                    recommendations: ['Adjust targeting'],
                    changes: { targetingAdjustments: {} },
                    confidence: 0.9
                })
            };

            jest.spyOn(mockCampaignModel, 'findById')
                .mockResolvedValueOnce(campaign);

            // Execute
            const result = await campaignService.optimizeCampaign(campaign.id);

            // Verify
            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(campaign.optimizeWithAI).toHaveBeenCalled();
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('campaignOptimized', expect.any(Object));
        });
    });

    describe('Error Handling', () => {
        test('should handle campaign creation validation errors', async () => {
            // Setup
            const invalidCampaign = {
                ...mockLinkedInCampaign,
                budget: { ...mockLinkedInCampaign.budget, amount: -100 }
            };

            // Execute & Verify
            await expect(campaignService.createCampaign(invalidCampaign))
                .rejects.toThrow('Campaign validation failed');
            expect(mockLogger.error).toHaveBeenCalled();
        });

        test('should handle optimization failures gracefully', async () => {
            // Setup
            jest.spyOn(mockCampaignModel, 'findById')
                .mockResolvedValueOnce({
                    ...mockGoogleCampaign,
                    optimizeWithAI: jest.fn().mockRejectedValueOnce(new Error('Optimization failed'))
                });

            // Execute & Verify
            await expect(campaignService.optimizeCampaign(mockGoogleCampaign.id))
                .rejects.toThrow('Campaign optimization failed');
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });
});