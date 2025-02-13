// Internal imports
import { MetricType } from './analytics.types';

/**
 * Supported advertising platform types
 */
export enum PlatformType {
    LINKEDIN = 'LINKEDIN',
    GOOGLE = 'GOOGLE'
}

/**
 * Campaign objectives aligned with platform capabilities
 */
export enum CampaignObjective {
    LEAD_GENERATION = 'LEAD_GENERATION',
    BRAND_AWARENESS = 'BRAND_AWARENESS',
    WEBSITE_TRAFFIC = 'WEBSITE_TRAFFIC',
    CONVERSIONS = 'CONVERSIONS',
    APP_INSTALLS = 'APP_INSTALLS'
}

/**
 * Campaign status lifecycle states
 */
export enum CampaignStatus {
    DRAFT = 'DRAFT',
    PENDING_APPROVAL = 'PENDING_APPROVAL',
    ACTIVE = 'ACTIVE',
    PAUSED = 'PAUSED',
    COMPLETED = 'COMPLETED',
    ARCHIVED = 'ARCHIVED'
}

/**
 * Budget period options for campaign spending
 */
export enum BudgetPeriod {
    DAILY = 'DAILY',
    LIFETIME = 'LIFETIME',
    MONTHLY = 'MONTHLY'
}

/**
 * Company size range options for targeting
 */
export enum CompanySizeRange {
    SELF_EMPLOYED = '1',
    SMALL = '2-10',
    MEDIUM = '11-50',
    LARGE = '51-200',
    ENTERPRISE = '201-10000',
    GLOBAL = '10001+'
}

/**
 * Location targeting interface
 */
export interface ILocation {
    id: string;
    country: string;
    region?: string;
    city?: string;
    radius?: number;
    radiusUnit?: 'KM' | 'MI';
}

/**
 * Age range targeting interface
 */
export interface IAgeRange {
    min: number;
    max: number;
}

/**
 * Platform-specific targeting parameters
 */
export interface IPlatformTargeting {
    linkedin?: {
        skills: string[];
        groups: string[];
        schools: string[];
        degrees: string[];
        fieldOfStudy: string[];
    };
    google?: {
        keywords: string[];
        topics: string[];
        placements: string[];
        audiences: string[];
    };
}

/**
 * Comprehensive targeting configuration
 */
export interface ITargeting {
    locations: ILocation[];
    industries: string[];
    companySize: CompanySizeRange[];
    jobTitles: string[];
    interests: string[];
    ageRange?: IAgeRange;
    platformSpecific: IPlatformTargeting;
}

/**
 * Budget configuration interface
 */
export interface IBudget {
    amount: number;
    currency: string;
    period: BudgetPeriod;
    startDate: Date;
    endDate?: Date;
}

/**
 * Performance target configuration
 */
export interface IPerformanceTarget {
    metric: MetricType;
    target: number;
    timeframe: number; // Days
    priority: number; // 1-5, 1 being highest
}

/**
 * AI optimization settings
 */
export interface IAIOptimization {
    enabled: boolean;
    optimizationGoals: MetricType[];
    autoOptimize: boolean;
    minBudgetAdjustment: number;
    maxBudgetAdjustment: number;
    optimizationFrequency: number; // Hours
}

/**
 * Creative asset configuration
 */
export interface ICreativeAsset {
    id: string;
    type: 'IMAGE' | 'VIDEO' | 'CAROUSEL';
    url: string;
    title?: string;
    description?: string;
    callToAction?: string;
}

/**
 * Ad configuration interface
 */
export interface IAd {
    id: string;
    name: string;
    type: 'TEXT' | 'DISPLAY' | 'VIDEO';
    headline: string;
    description: string;
    assets: ICreativeAsset[];
    destinationUrl: string;
    status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Ad group configuration
 */
export interface IAdGroup {
    id: string;
    name: string;
    targeting: ITargeting;
    ads: IAd[];
    status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
    budget?: IBudget;
    bidAmount?: number;
    bidStrategy: 'AUTOMATED' | 'MANUAL';
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Platform-specific configuration options
 */
export interface IPlatformConfig {
    linkedin?: {
        campaignType: string;
        objectiveType: string;
        audienceExpansion: boolean;
        enabledNetworks: string[];
    };
    google?: {
        networkSettings: {
            searchNetwork: boolean;
            displayNetwork: boolean;
            partnerNetwork: boolean;
        };
        deliveryMethod: 'STANDARD' | 'ACCELERATED';
        targetCPA?: number;
        targetROAS?: number;
    };
}

/**
 * Comprehensive campaign interface
 */
export interface ICampaign {
    id: string;
    userId: string;
    name: string;
    platform: PlatformType;
    objective: CampaignObjective;
    status: CampaignStatus;
    budget: IBudget;
    targeting: ITargeting;
    adGroups: IAdGroup[];
    performanceTargets: IPerformanceTarget[];
    aiOptimization: IAIOptimization;
    platformConfig: IPlatformConfig;
    createdAt: Date;
    updatedAt: Date;
}