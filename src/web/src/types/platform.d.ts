/**
 * Platform integration type definitions for the Sales Intelligence Platform
 * Provides type safety for platform-specific operations, data structures, and API interactions
 * @version 1.0.0
 */

import { Status, ApiError } from './common';
import type { OAuth2Client } from '@types/google-auth-library'; // ^8.0.0

/**
 * Supported advertising platform types
 */
export enum PlatformType {
    LINKEDIN = 'LINKEDIN',
    GOOGLE = 'GOOGLE'
}

/**
 * Platform credentials interface with quota management
 */
export interface PlatformCredentials {
    platformType: PlatformType;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    apiVersion: string;
    quotaInfo: PlatformQuotaInfo;
}

/**
 * Platform quota information interface
 */
interface PlatformQuotaInfo {
    dailyQuota: number;
    remainingQuota: number;
    resetTime: Date;
    quotaUnit: 'requests' | 'operations';
}

/**
 * LinkedIn Ads platform configuration interface
 */
export interface LinkedInAdsConfig {
    accountId: string;
    clientId: string;
    clientSecret: string;
    status: Status;
    capabilities: LinkedInAdsCapabilities;
    validationRules: LinkedInAdsValidationRules;
}

/**
 * LinkedIn Ads platform capabilities
 */
interface LinkedInAdsCapabilities {
    supportedObjectives: string[];
    supportedFormats: string[];
    audienceNetworks: string[];
    maxBudget: number;
    minBudget: number;
    bidStrategies: string[];
}

/**
 * LinkedIn Ads validation rules
 */
interface LinkedInAdsValidationRules {
    titleMaxLength: number;
    descriptionMaxLength: number;
    imageAspectRatios: string[];
    allowedMediaTypes: string[];
    budgetConstraints: {
        min: number;
        max: number;
        currency: string;
    };
}

/**
 * Google Ads platform configuration interface
 */
export interface GoogleAdsConfig {
    customerId: string;
    developerToken: string;
    clientId: string;
    clientSecret: string;
    status: Status;
    capabilities: GoogleAdsCapabilities;
    validationRules: GoogleAdsValidationRules;
}

/**
 * Google Ads platform capabilities
 */
interface GoogleAdsCapabilities {
    supportedCampaignTypes: string[];
    supportedBidStrategies: string[];
    supportedNetworks: string[];
    maxBudget: number;
    minBudget: number;
    supportedLanguages: string[];
}

/**
 * Google Ads validation rules
 */
interface GoogleAdsValidationRules {
    headlineMaxLength: number;
    descriptionMaxLength: number;
    displayUrlMaxLength: number;
    imageRequirements: {
        maxSize: number;
        allowedFormats: string[];
        dimensions: {
            width: number;
            height: number;
        }[];
    };
}

/**
 * Platform integration status interface
 */
export interface PlatformIntegrationStatus {
    isConnected: boolean;
    lastSyncTime: Date;
    error: ApiError | null;
    rateLimitStatus: PlatformRateLimitStatus;
    healthStatus: PlatformHealthStatus;
}

/**
 * Platform rate limit status interface
 */
interface PlatformRateLimitStatus {
    remaining: number;
    limit: number;
    resetAt: Date;
    isThrottled: boolean;
}

/**
 * Platform health status interface
 */
interface PlatformHealthStatus {
    status: 'healthy' | 'degraded' | 'down';
    lastChecked: Date;
    responseTime: number;
    availabilityScore: number;
}

/**
 * Platform campaign statistics interface
 */
export interface PlatformCampaignStats {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    ctr: number;
    cpc: number;
    roas: number;
    qualityScore: PlatformQualityScore;
}

/**
 * Platform quality score interface
 */
interface PlatformQualityScore {
    overall: number;
    expectedCtr: number;
    adRelevance: number;
    landingPageExperience: number;
    lastUpdated: Date;
}

/**
 * Platform API response interface
 */
interface PlatformApiResponse<T> {
    data: T;
    meta: {
        requestId: string;
        timestamp: Date;
        quotaUsed: number;
    };
    error?: ApiError;
}

/**
 * Type guard for platform API response
 */
export function isPlatformApiResponse<T>(response: any): response is PlatformApiResponse<T> {
    return (
        response &&
        'data' in response &&
        'meta' in response &&
        typeof response.meta.requestId === 'string' &&
        response.meta.timestamp instanceof Date
    );
}