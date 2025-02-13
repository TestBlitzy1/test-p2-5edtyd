// External imports
import { faker } from '@faker-js/faker';

// Internal imports
import {
    ICampaign,
    PlatformType,
    CampaignObjective,
    CampaignStatus,
    BudgetPeriod,
    CompanySizeRange,
    ITargeting,
    IBudget,
    IAIOptimization,
    IAdGroup,
    IAd,
    ICreativeAsset,
    IPlatformConfig,
    IPerformanceTarget
} from '../../backend/shared/types/campaign.types';
import { MetricType } from '../../backend/shared/types/analytics.types';

/**
 * Generates a mock creative asset for campaign testing
 * @param type - Asset type (IMAGE, VIDEO, CAROUSEL)
 * @returns ICreativeAsset - Mock creative asset
 */
const generateMockCreativeAsset = (type: 'IMAGE' | 'VIDEO' | 'CAROUSEL'): ICreativeAsset => ({
    id: faker.string.uuid(),
    type,
    url: faker.image.url(),
    title: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    callToAction: faker.helpers.arrayElement(['Learn More', 'Sign Up', 'Contact Us', 'Get Started'])
});

/**
 * Generates a mock ad for testing
 * @param type - Ad type (TEXT, DISPLAY, VIDEO)
 * @returns IAd - Mock ad configuration
 */
const generateMockAd = (type: 'TEXT' | 'DISPLAY' | 'VIDEO'): IAd => ({
    id: faker.string.uuid(),
    name: `${type.toLowerCase()}_ad_${faker.number.int(1000)}`,
    type,
    headline: faker.company.catchPhrase(),
    description: faker.company.buzzPhrase(),
    assets: [generateMockCreativeAsset(type === 'VIDEO' ? 'VIDEO' : 'IMAGE')],
    destinationUrl: faker.internet.url(),
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date()
});

/**
 * Generates mock targeting configuration based on platform
 * @param platform - Target advertising platform
 * @returns ITargeting - Platform-specific targeting configuration
 */
const generateMockTargeting = (platform: PlatformType): ITargeting => ({
    locations: [{
        id: faker.string.uuid(),
        country: faker.location.country(),
        region: faker.location.state(),
        city: faker.location.city(),
        radius: faker.number.int({ min: 10, max: 50 }),
        radiusUnit: 'KM'
    }],
    industries: Array.from({ length: 3 }, () => faker.company.industry()),
    companySize: [
        CompanySizeRange.SMALL,
        CompanySizeRange.MEDIUM,
        CompanySizeRange.LARGE
    ],
    jobTitles: Array.from({ length: 5 }, () => faker.person.jobTitle()),
    interests: Array.from({ length: 4 }, () => faker.company.buzzNoun()),
    ageRange: {
        min: 25,
        max: 65
    },
    platformSpecific: {
        linkedin: platform === PlatformType.LINKEDIN ? {
            skills: Array.from({ length: 5 }, () => faker.person.jobArea()),
            groups: Array.from({ length: 3 }, () => faker.string.uuid()),
            schools: Array.from({ length: 2 }, () => faker.company.name()),
            degrees: ['Bachelor', 'Master'],
            fieldOfStudy: ['Computer Science', 'Business']
        } : undefined,
        google: platform === PlatformType.GOOGLE ? {
            keywords: Array.from({ length: 10 }, () => faker.company.buzzPhrase()),
            topics: Array.from({ length: 5 }, () => faker.commerce.department()),
            placements: Array.from({ length: 3 }, () => faker.internet.url()),
            audiences: Array.from({ length: 4 }, () => faker.commerce.productAdjective())
        } : undefined
    }
});

/**
 * Generates mock AI optimization settings
 * @param objective - Campaign objective
 * @returns IAIOptimization - AI optimization configuration
 */
const generateMockAIOptimization = (objective: CampaignObjective): IAIOptimization => ({
    enabled: true,
    optimizationGoals: [
        objective === CampaignObjective.LEAD_GENERATION ? MetricType.CONVERSIONS :
        objective === CampaignObjective.BRAND_AWARENESS ? MetricType.IMPRESSIONS :
        MetricType.CLICKS,
        MetricType.CTR,
        MetricType.ROAS
    ],
    autoOptimize: true,
    minBudgetAdjustment: -20,
    maxBudgetAdjustment: 50,
    optimizationFrequency: 24
});

/**
 * Generates platform-specific campaign configuration
 * @param platform - Target advertising platform
 * @param objective - Campaign objective
 * @returns IPlatformConfig - Platform-specific settings
 */
const generatePlatformConfig = (platform: PlatformType, objective: CampaignObjective): IPlatformConfig => ({
    linkedin: platform === PlatformType.LINKEDIN ? {
        campaignType: 'Sponsored Content',
        objectiveType: objective.toLowerCase(),
        audienceExpansion: true,
        enabledNetworks: ['linkedin_feed', 'linkedin_spotlight']
    } : undefined,
    google: platform === PlatformType.GOOGLE ? {
        networkSettings: {
            searchNetwork: true,
            displayNetwork: true,
            partnerNetwork: false
        },
        deliveryMethod: 'STANDARD',
        targetCPA: objective === CampaignObjective.LEAD_GENERATION ? 50 : undefined,
        targetROAS: objective === CampaignObjective.CONVERSIONS ? 300 : undefined
    } : undefined
});

/**
 * Generates a complete mock campaign for testing
 * @param overrides - Optional property overrides
 * @param platform - Target advertising platform
 * @returns ICampaign - Complete mock campaign
 */
export const generateMockCampaign = (
    overrides: Partial<ICampaign> = {},
    platform: PlatformType = PlatformType.LINKEDIN
): ICampaign => {
    const objective = faker.helpers.arrayElement(Object.values(CampaignObjective));
    const adGroups: IAdGroup[] = Array.from({ length: 3 }, () => ({
        id: faker.string.uuid(),
        name: `ad_group_${faker.number.int(1000)}`,
        targeting: generateMockTargeting(platform),
        ads: [
            generateMockAd('TEXT'),
            generateMockAd('DISPLAY'),
            platform === PlatformType.GOOGLE ? generateMockAd('VIDEO') : null
        ].filter(Boolean) as IAd[],
        status: 'ACTIVE',
        bidAmount: faker.number.float({ min: 5, max: 50, precision: 2 }),
        bidStrategy: faker.helpers.arrayElement(['AUTOMATED', 'MANUAL']),
        createdAt: new Date(),
        updatedAt: new Date()
    }));

    const campaign: ICampaign = {
        id: faker.string.uuid(),
        userId: faker.string.uuid(),
        name: `${platform.toLowerCase()}_campaign_${faker.number.int(1000)}`,
        platform,
        objective,
        status: CampaignStatus.ACTIVE,
        budget: {
            amount: faker.number.float({ min: 1000, max: 50000, precision: 2 }),
            currency: 'USD',
            period: BudgetPeriod.DAILY,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        targeting: generateMockTargeting(platform),
        adGroups,
        performanceTargets: [
            {
                metric: MetricType.CTR,
                target: 2.5,
                timeframe: 30,
                priority: 1
            },
            {
                metric: MetricType.CONVERSIONS,
                target: 100,
                timeframe: 30,
                priority: 2
            }
        ],
        aiOptimization: generateMockAIOptimization(objective),
        platformConfig: generatePlatformConfig(platform, objective),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };

    return campaign;
};

/**
 * Mock campaign service for testing campaign operations
 */
export const mockCampaignService = {
    createCampaign: async (campaign: Partial<ICampaign>): Promise<ICampaign> => {
        return generateMockCampaign(campaign);
    },

    updateCampaign: async (id: string, updates: Partial<ICampaign>): Promise<ICampaign> => {
        return generateMockCampaign(updates);
    },

    optimizeCampaign: async (id: string): Promise<ICampaign> => {
        const campaign = generateMockCampaign();
        campaign.aiOptimization.enabled = true;
        return campaign;
    },

    generateAIRecommendations: async (id: string): Promise<string[]> => {
        return [
            'Increase budget allocation for top-performing ad groups',
            'Expand targeting to similar audiences',
            'Optimize ad copy based on performance data',
            'Adjust bidding strategy for peak hours'
        ];
    },

    syncPlatformData: async (id: string): Promise<boolean> => {
        return true;
    }
};

/**
 * Export mock data generators for testing
 */
export const mockCampaignData = {
    generateMockCampaign,
    generateMockAIOptimization,
    generatePlatformConfig
};