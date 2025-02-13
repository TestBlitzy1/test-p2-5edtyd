/**
 * Campaign-related type definitions for the Sales Intelligence Platform
 * Supporting both LinkedIn Ads and Google Ads platforms
 * @version 1.0.0
 */

/**
 * Campaign performance metric types
 */
export enum CampaignMetricType {
    CTR = 'CTR',
    CONVERSIONS = 'CONVERSIONS',
    CPC = 'CPC',
    ROAS = 'ROAS'
}

/**
 * Supported advertising platforms
 */
export enum PlatformType {
    LINKEDIN = 'LINKEDIN',
    GOOGLE = 'GOOGLE'
}

/**
 * Campaign objective options
 */
export enum CampaignObjective {
    LEAD_GENERATION = 'LEAD_GENERATION',
    BRAND_AWARENESS = 'BRAND_AWARENESS',
    WEBSITE_TRAFFIC = 'WEBSITE_TRAFFIC'
}

/**
 * Campaign status states
 */
export enum CampaignStatus {
    DRAFT = 'DRAFT',
    ACTIVE = 'ACTIVE',
    PAUSED = 'PAUSED',
    COMPLETED = 'COMPLETED'
}

/**
 * Campaign budget period options
 */
export enum BudgetPeriod {
    DAILY = 'DAILY',
    LIFETIME = 'LIFETIME'
}

/**
 * Campaign budget configuration interface
 */
export interface IBudget {
    amount: number;
    currency: string;
    period: BudgetPeriod;
}

/**
 * Campaign audience targeting parameters interface
 */
export interface ITargeting {
    locations: string[];
    industries: string[];
    companySize: string[];
    jobTitles: string[];
}

/**
 * Ad creative configuration interface
 */
export interface IAd {
    headline: string;
    description: string;
    imageUrl: string;
    destinationUrl: string;
}

/**
 * Ad group structure interface
 */
export interface IAdGroup {
    name: string;
    ads: IAd[];
    status: CampaignStatus;
}

/**
 * Campaign performance target configuration interface
 */
export interface IPerformanceTarget {
    metricType: CampaignMetricType;
    target: number;
}

/**
 * Main campaign interface combining all campaign-related configurations
 */
export interface ICampaign {
    /** Unique identifier for the campaign */
    id: string;
    
    /** User ID of the campaign owner */
    userId: string;
    
    /** Campaign name */
    name: string;
    
    /** Target advertising platform */
    platform: PlatformType;
    
    /** Campaign objective */
    objective: CampaignObjective;
    
    /** Current campaign status */
    status: CampaignStatus;
    
    /** Campaign budget configuration */
    budget: IBudget;
    
    /** Campaign targeting parameters */
    targeting: ITargeting;
    
    /** Campaign ad groups */
    adGroups: IAdGroup[];
    
    /** Campaign performance targets */
    performanceTargets: IPerformanceTarget[];
    
    /** Campaign creation timestamp */
    createdAt: Date;
    
    /** Campaign last update timestamp */
    updatedAt: Date;
}