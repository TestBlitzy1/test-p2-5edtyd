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
    IAIOptimization,
    ITargeting,
    IBudget,
    IAdGroup,
    IAd,
    ICreativeAsset,
    IPlatformConfig
} from '../../backend/shared/types/campaign.types';
import { MetricType } from '../../backend/shared/types/analytics.types';

/**
 * Generates realistic mock performance targets for campaign testing
 * @param platform The advertising platform type
 * @returns Mock performance targets with platform-specific thresholds
 */
const generateMockPerformanceTargets = (platform: PlatformType) => {
    const baseTargets = [
        {
            metric: MetricType.CTR,
            target: platform === PlatformType.LINKEDIN ? 2.5 : 1.8,
            timeframe: 30,
            priority: 1
        },
        {
            metric: MetricType.CONVERSIONS,
            target: platform === PlatformType.LINKEDIN ? 50 : 75,
            timeframe: 30,
            priority: 2
        },
        {
            metric: MetricType.ROAS,
            target: platform === PlatformType.LINKEDIN ? 3.5 : 4.0,
            timeframe: 30,
            priority: 1
        },
        {
            metric: MetricType.CPC,
            target: platform === PlatformType.LINKEDIN ? 8.5 : 2.5,
            timeframe: 30,
            priority: 3
        }
    ];

    return baseTargets;
};

/**
 * Generates mock AI optimization settings
 * @returns Mock AI optimization configuration
 */
const generateMockAIOptimization = (): IAIOptimization => ({
    enabled: true,
    optimizationGoals: [MetricType.CTR, MetricType.CONVERSIONS, MetricType.ROAS],
    autoOptimize: true,
    minBudgetAdjustment: -20,
    maxBudgetAdjustment: 50,
    optimizationFrequency: 24
});

/**
 * Generates mock targeting configuration
 * @param platform The advertising platform type
 * @returns Mock targeting settings
 */
const generateMockTargeting = (platform: PlatformType): ITargeting => ({
    locations: [{
        id: faker.string.uuid(),
        country: 'United States',
        region: 'California',
        city: 'San Francisco',
        radius: 50,
        radiusUnit: 'MI'
    }],
    industries: ['Software', 'Technology', 'Marketing'],
    companySize: [CompanySizeRange.MEDIUM, CompanySizeRange.LARGE],
    jobTitles: ['Marketing Manager', 'Digital Marketing Specialist', 'Growth Manager'],
    interests: ['Digital Marketing', 'B2B Marketing', 'Lead Generation'],
    ageRange: { min: 25, max: 54 },
    platformSpecific: platform === PlatformType.LINKEDIN ? {
        linkedin: {
            skills: ['Digital Marketing', 'Marketing Strategy', 'Lead Generation'],
            groups: ['Digital Marketing Professionals', 'B2B Marketing Leaders'],
            schools: ['Stanford University', 'MIT'],
            degrees: ['Bachelor's Degree', 'Master's Degree'],
            fieldOfStudy: ['Marketing', 'Business Administration']
        }
    } : {
        google: {
            keywords: ['b2b marketing software', 'marketing automation', 'lead generation tools'],
            topics: ['Marketing', 'Business Software', 'Advertising'],
            placements: ['marketing.com', 'adweek.com'],
            audiences: ['Marketing Professionals', 'Business Decision Makers']
        }
    }
});

/**
 * Generates mock budget configuration
 * @returns Mock budget settings
 */
const generateMockBudget = (): IBudget => ({
    amount: faker.number.int({ min: 5000, max: 50000 }),
    currency: 'USD',
    period: BudgetPeriod.MONTHLY,
    startDate: faker.date.future(),
    endDate: faker.date.future({ years: 1 })
});

/**
 * Generates mock creative assets
 * @returns Array of mock creative assets
 */
const generateMockCreativeAssets = (): ICreativeAsset[] => ([{
    id: faker.string.uuid(),
    type: 'IMAGE',
    url: faker.image.url(),
    title: faker.company.catchPhrase(),
    description: faker.company.buzzPhrase(),
    callToAction: 'Learn More'
}]);

/**
 * Generates mock ads
 * @returns Array of mock ads
 */
const generateMockAds = (): IAd[] => ([{
    id: faker.string.uuid(),
    name: `Ad - ${faker.company.catchPhrase()}`,
    type: 'DISPLAY',
    headline: faker.company.catchPhrase(),
    description: faker.company.buzzPhrase(),
    assets: generateMockCreativeAssets(),
    destinationUrl: faker.internet.url(),
    status: 'ACTIVE',
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent()
}]);

/**
 * Generates mock ad groups
 * @param platform The advertising platform type
 * @returns Array of mock ad groups
 */
const generateMockAdGroups = (platform: PlatformType): IAdGroup[] => ([{
    id: faker.string.uuid(),
    name: `AdGroup - ${faker.company.catchPhrase()}`,
    targeting: generateMockTargeting(platform),
    ads: generateMockAds(),
    status: 'ACTIVE',
    bidStrategy: 'AUTOMATED',
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent()
}]);

/**
 * Generates platform-specific configuration
 * @param platform The advertising platform type
 * @returns Platform-specific configuration
 */
const generatePlatformConfig = (platform: PlatformType): IPlatformConfig => 
    platform === PlatformType.LINKEDIN ? {
        linkedin: {
            campaignType: 'Sponsored Content',
            objectiveType: 'Lead Generation',
            audienceExpansion: true,
            enabledNetworks: ['LinkedIn Feed']
        }
    } : {
        google: {
            networkSettings: {
                searchNetwork: true,
                displayNetwork: true,
                partnerNetwork: false
            },
            deliveryMethod: 'STANDARD',
            targetCPA: 50,
            targetROAS: 400
        }
    };

/**
 * Generates a comprehensive mock campaign for testing
 * @param overrides Optional parameter overrides
 * @returns Complete mock campaign object
 */
export const generateMockCampaign = (overrides?: Partial<ICampaign>): ICampaign => {
    const platform = overrides?.platform || PlatformType.LINKEDIN;
    
    const campaign: ICampaign = {
        id: faker.string.uuid(),
        userId: faker.string.uuid(),
        name: `Campaign - ${faker.company.catchPhrase()}`,
        platform,
        objective: CampaignObjective.LEAD_GENERATION,
        status: CampaignStatus.ACTIVE,
        budget: generateMockBudget(),
        targeting: generateMockTargeting(platform),
        adGroups: generateMockAdGroups(platform),
        performanceTargets: generateMockPerformanceTargets(platform),
        aiOptimization: generateMockAIOptimization(),
        platformConfig: generatePlatformConfig(platform),
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent(),
        ...overrides
    };

    return campaign;
};

/**
 * Pre-defined campaign fixtures for common test scenarios
 */
export const DEFAULT_CAMPAIGN_FIXTURES = {
    LINKEDIN_CAMPAIGN: generateMockCampaign({ platform: PlatformType.LINKEDIN }),
    GOOGLE_CAMPAIGN: generateMockCampaign({ platform: PlatformType.GOOGLE }),
    INVALID_CAMPAIGN: generateMockCampaign({
        status: CampaignStatus.DRAFT,
        budget: { ...generateMockBudget(), amount: -1000 },
        performanceTargets: []
    }),
    AI_OPTIMIZED_CAMPAIGN: generateMockCampaign({
        aiOptimization: {
            ...generateMockAIOptimization(),
            optimizationFrequency: 12,
            maxBudgetAdjustment: 100
        }
    })
};