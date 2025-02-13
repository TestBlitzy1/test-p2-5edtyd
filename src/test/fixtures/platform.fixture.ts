// Internal imports
import { 
    PlatformType,
    ICampaign,
    CampaignObjective,
    CampaignStatus,
    BudgetPeriod,
    CompanySizeRange
} from '../../backend/shared/types/campaign.types';

// Global test constants
export const TEST_CAMPAIGN_ID = 'test-campaign-123';
export const TEST_USER_ID = 'test-user-456';

/**
 * Base campaign configuration for testing
 * @version 1.0.0
 */
const baseCampaignConfig: Partial<ICampaign> = {
    userId: TEST_USER_ID,
    status: CampaignStatus.ACTIVE,
    objective: CampaignObjective.LEAD_GENERATION,
    budget: {
        amount: 1000,
        currency: 'USD',
        period: BudgetPeriod.DAILY,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
    },
    targeting: {
        locations: [{
            id: 'us-1',
            country: 'United States',
            region: 'California'
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
            },
            google: {
                keywords: ['software development', 'programming'],
                topics: ['Technology', 'Software'],
                placements: [],
                audiences: ['Tech enthusiasts']
            }
        }
    },
    adGroups: [],
    performanceTargets: [],
    createdAt: new Date(),
    updatedAt: new Date()
};

/**
 * Creates a mock LinkedIn campaign for testing purposes
 * @param overrides - Optional parameter overrides
 * @returns ICampaign - Mock LinkedIn campaign
 */
export const createMockLinkedInCampaign = (overrides: Partial<ICampaign> = {}): ICampaign => ({
    ...baseCampaignConfig,
    id: TEST_CAMPAIGN_ID,
    name: 'Test LinkedIn Campaign',
    platform: PlatformType.LINKEDIN,
    platformConfig: {
        linkedin: {
            campaignType: 'Sponsored Content',
            objectiveType: 'Lead Generation',
            audienceExpansion: true,
            enabledNetworks: ['LinkedIn Feed']
        }
    },
    aiOptimization: {
        enabled: true,
        optimizationGoals: ['CTR', 'CONVERSIONS'],
        autoOptimize: true,
        minBudgetAdjustment: -20,
        maxBudgetAdjustment: 50,
        optimizationFrequency: 24
    },
    ...overrides
} as ICampaign);

/**
 * Creates a mock Google Ads campaign for testing purposes
 * @param overrides - Optional parameter overrides
 * @returns ICampaign - Mock Google Ads campaign
 */
export const createMockGoogleCampaign = (overrides: Partial<ICampaign> = {}): ICampaign => ({
    ...baseCampaignConfig,
    id: TEST_CAMPAIGN_ID,
    name: 'Test Google Ads Campaign',
    platform: PlatformType.GOOGLE,
    platformConfig: {
        google: {
            networkSettings: {
                searchNetwork: true,
                displayNetwork: true,
                partnerNetwork: false
            },
            deliveryMethod: 'STANDARD',
            targetCPA: 50,
            targetROAS: 200
        }
    },
    aiOptimization: {
        enabled: true,
        optimizationGoals: ['CONVERSIONS', 'ROAS'],
        autoOptimize: true,
        minBudgetAdjustment: -15,
        maxBudgetAdjustment: 30,
        optimizationFrequency: 12
    },
    ...overrides
} as ICampaign);

/**
 * Pre-configured mock campaigns for quick testing
 */
export const mockLinkedInCampaign = createMockLinkedInCampaign();
export const mockGoogleCampaign = createMockGoogleCampaign();

/**
 * Generates mock platform API responses for testing
 * @param platform - Platform type (LINKEDIN or GOOGLE)
 * @param operation - Operation type (e.g., 'create', 'update', 'delete')
 * @returns Mock platform API response
 */
export const getMockPlatformResponse = (
    platform: PlatformType,
    operation: string
): Record<string, any> => {
    const baseResponse = {
        success: true,
        timestamp: new Date().toISOString(),
        requestId: `mock-${platform}-${operation}-${Date.now()}`
    };

    switch (platform) {
        case PlatformType.LINKEDIN:
            return {
                ...baseResponse,
                data: {
                    campaignId: TEST_CAMPAIGN_ID,
                    status: 'ACTIVE',
                    servingStatus: 'SERVING',
                    changeAuditStamps: {
                        created: {
                            time: Date.now()
                        },
                        lastModified: {
                            time: Date.now()
                        }
                    }
                }
            };

        case PlatformType.GOOGLE:
            return {
                ...baseResponse,
                data: {
                    resourceName: `customers/test/campaigns/${TEST_CAMPAIGN_ID}`,
                    id: TEST_CAMPAIGN_ID,
                    status: 'ENABLED',
                    servingStatus: 'SERVING',
                    createTime: new Date().toISOString(),
                    updateTime: new Date().toISOString()
                }
            };

        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
};