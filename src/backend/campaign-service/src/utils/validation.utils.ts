import { z } from 'zod'; // ^3.22.0
import { 
    ICampaign,
    PlatformType,
    IAdGroup,
    IAd,
    CampaignObjective,
    CompanySizeRange,
    BudgetPeriod
} from '../../../shared/types/campaign.types';
import { 
    validateCampaignBudget,
    validateCampaignTargeting
} from '../../../shared/utils/validation';

// Platform-specific validation constants
const LINKEDIN_CONSTRAINTS = {
    HEADLINE_MAX_LENGTH: 200,
    DESCRIPTION_MAX_LENGTH: 600,
    IMAGE_DIMENSIONS: {
        MIN_WIDTH: 400,
        MIN_HEIGHT: 400,
        MAX_SIZE_MB: 5
    },
    AD_VARIATIONS_PER_GROUP: {
        MIN: 1,
        MAX: 5
    },
    OBJECTIVES: [
        CampaignObjective.LEAD_GENERATION,
        CampaignObjective.BRAND_AWARENESS,
        CampaignObjective.WEBSITE_TRAFFIC
    ]
};

const GOOGLE_CONSTRAINTS = {
    HEADLINE_MAX_LENGTH: 30,
    DESCRIPTION_MAX_LENGTH: 90,
    IMAGE_DIMENSIONS: {
        MIN_WIDTH: 600,
        MIN_HEIGHT: 314,
        MAX_SIZE_MB: 10
    },
    AD_VARIATIONS_PER_GROUP: {
        MIN: 2,
        MAX: 50
    },
    OBJECTIVES: [
        CampaignObjective.LEAD_GENERATION,
        CampaignObjective.WEBSITE_TRAFFIC,
        CampaignObjective.CONVERSIONS,
        CampaignObjective.APP_INSTALLS
    ]
};

/**
 * Validates LinkedIn-specific campaign requirements and constraints
 * @param campaign Campaign configuration to validate
 * @returns Promise resolving to validation result
 */
export const validateLinkedInCampaign = async (campaign: ICampaign): Promise<boolean> => {
    try {
        // Initialize LinkedIn campaign schema
        const linkedInCampaignSchema = z.object({
            objective: z.enum(LINKEDIN_CONSTRAINTS.OBJECTIVES as [string, ...string[]]),
            platformConfig: z.object({
                linkedin: z.object({
                    campaignType: z.string(),
                    objectiveType: z.string(),
                    audienceExpansion: z.boolean(),
                    enabledNetworks: z.array(z.string()).min(1)
                }).required()
            }).required()
        });

        // Validate campaign structure
        linkedInCampaignSchema.parse(campaign);

        // Validate budget constraints
        const budgetValidation = await validateCampaignBudget(campaign.budget, PlatformType.LINKEDIN);
        if (!budgetValidation.isValid) {
            return false;
        }

        // Validate targeting parameters
        const targetingValidation = await validateCampaignTargeting(campaign.targeting, PlatformType.LINKEDIN);
        if (!targetingValidation.isValid) {
            return false;
        }

        // Validate ad groups
        for (const adGroup of campaign.adGroups) {
            if (!await validateAdGroup(adGroup, PlatformType.LINKEDIN)) {
                return false;
            }
        }

        return true;
    } catch (error) {
        console.error('LinkedIn campaign validation failed:', error);
        return false;
    }
};

/**
 * Validates Google Ads-specific campaign requirements and constraints
 * @param campaign Campaign configuration to validate
 * @returns Promise resolving to validation result
 */
export const validateGoogleCampaign = async (campaign: ICampaign): Promise<boolean> => {
    try {
        // Initialize Google Ads campaign schema
        const googleCampaignSchema = z.object({
            objective: z.enum(GOOGLE_CONSTRAINTS.OBJECTIVES as [string, ...string[]]),
            platformConfig: z.object({
                google: z.object({
                    networkSettings: z.object({
                        searchNetwork: z.boolean(),
                        displayNetwork: z.boolean(),
                        partnerNetwork: z.boolean()
                    }),
                    deliveryMethod: z.enum(['STANDARD', 'ACCELERATED']),
                    targetCPA: z.number().optional(),
                    targetROAS: z.number().optional()
                }).required()
            }).required()
        });

        // Validate campaign structure
        googleCampaignSchema.parse(campaign);

        // Validate budget constraints
        const budgetValidation = await validateCampaignBudget(campaign.budget, PlatformType.GOOGLE);
        if (!budgetValidation.isValid) {
            return false;
        }

        // Validate targeting parameters
        const targetingValidation = await validateCampaignTargeting(campaign.targeting, PlatformType.GOOGLE);
        if (!targetingValidation.isValid) {
            return false;
        }

        // Validate ad groups
        for (const adGroup of campaign.adGroups) {
            if (!await validateAdGroup(adGroup, PlatformType.GOOGLE)) {
                return false;
            }
        }

        return true;
    } catch (error) {
        console.error('Google campaign validation failed:', error);
        return false;
    }
};

/**
 * Validates ad group structure and configurations with platform-specific rules
 * @param adGroup Ad group configuration to validate
 * @param platform Target advertising platform
 * @returns Boolean indicating validation result
 */
export const validateAdGroup = async (adGroup: IAdGroup, platform: PlatformType): Promise<boolean> => {
    try {
        // Common ad group schema
        const adGroupSchema = z.object({
            name: z.string().min(1).max(255),
            status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']),
            bidStrategy: z.enum(['AUTOMATED', 'MANUAL']),
            ads: z.array(z.any()).min(
                platform === PlatformType.LINKEDIN 
                    ? LINKEDIN_CONSTRAINTS.AD_VARIATIONS_PER_GROUP.MIN 
                    : GOOGLE_CONSTRAINTS.AD_VARIATIONS_PER_GROUP.MIN
            ).max(
                platform === PlatformType.LINKEDIN 
                    ? LINKEDIN_CONSTRAINTS.AD_VARIATIONS_PER_GROUP.MAX 
                    : GOOGLE_CONSTRAINTS.AD_VARIATIONS_PER_GROUP.MAX
            )
        });

        // Validate ad group structure
        adGroupSchema.parse(adGroup);

        // Validate individual ads
        for (const ad of adGroup.ads) {
            if (!await validateAdCreative(ad, platform)) {
                return false;
            }
        }

        return true;
    } catch (error) {
        console.error('Ad group validation failed:', error);
        return false;
    }
};

/**
 * Validates ad creative content and specifications with platform-specific rules
 * @param ad Ad creative configuration to validate
 * @param platform Target advertising platform
 * @returns Boolean indicating validation result
 */
export const validateAdCreative = async (ad: IAd, platform: PlatformType): Promise<boolean> => {
    try {
        const constraints = platform === PlatformType.LINKEDIN 
            ? LINKEDIN_CONSTRAINTS 
            : GOOGLE_CONSTRAINTS;

        // Ad creative schema
        const adCreativeSchema = z.object({
            name: z.string().min(1).max(255),
            type: z.enum(['TEXT', 'DISPLAY', 'VIDEO']),
            headline: z.string().min(1).max(constraints.HEADLINE_MAX_LENGTH),
            description: z.string().min(1).max(constraints.DESCRIPTION_MAX_LENGTH),
            destinationUrl: z.string().url(),
            status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']),
            assets: z.array(z.object({
                type: z.enum(['IMAGE', 'VIDEO', 'CAROUSEL']),
                url: z.string().url()
            })).min(1)
        });

        // Validate ad creative structure
        adCreativeSchema.parse(ad);

        // Additional platform-specific validations can be added here
        // such as image dimension checks, file size validation, etc.

        return true;
    } catch (error) {
        console.error('Ad creative validation failed:', error);
        return false;
    }
};