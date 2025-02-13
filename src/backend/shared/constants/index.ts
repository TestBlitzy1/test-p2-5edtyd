/**
 * @fileoverview Shared constants and configuration values for backend services
 * Provides type-safe, immutable configuration objects for authentication, campaign management,
 * analytics, and platform integration.
 * @version 1.0.0
 */

// Type definitions for configuration objects
interface AuthConfig {
  readonly JWT_SECRET: string;
  readonly JWT_EXPIRY: string;
  readonly TOKEN_TYPE: string;
  readonly REFRESH_TOKEN_EXPIRY: string;
  readonly PASSWORD_SALT_ROUNDS: number;
  readonly MAX_LOGIN_ATTEMPTS: number;
  readonly LOGIN_LOCKOUT_DURATION: number;
  readonly MIN_PASSWORD_LENGTH: number;
  readonly REQUIRE_MFA: boolean;
  readonly SESSION_TIMEOUT: number;
}

interface PlatformConfig {
  readonly LINKEDIN_API_VERSION: string;
  readonly LINKEDIN_API_TIMEOUT: number;
  readonly LINKEDIN_BATCH_SIZE: number;
  readonly GOOGLE_ADS_API_VERSION: string;
  readonly GOOGLE_ADS_API_TIMEOUT: number;
  readonly GOOGLE_ADS_BATCH_SIZE: number;
  readonly API_TIMEOUT: number;
  readonly MAX_RETRIES: number;
  readonly RETRY_DELAY: number;
  readonly RETRY_MULTIPLIER: number;
  readonly HEALTH_CHECK_INTERVAL: number;
}

interface CampaignLimits {
  readonly MIN_BUDGET_AMOUNT: number;
  readonly MAX_BUDGET_AMOUNT: number;
  readonly MAX_AD_GROUPS: number;
  readonly MAX_ADS_PER_GROUP: number;
  readonly MAX_TARGETING_LOCATIONS: number;
  readonly MAX_TARGETING_INDUSTRIES: number;
  readonly MIN_CAMPAIGN_DURATION_DAYS: number;
  readonly MAX_CAMPAIGN_DURATION_DAYS: number;
  readonly MAX_CONCURRENT_CAMPAIGNS: number;
  readonly MAX_KEYWORDS_PER_GROUP: number;
  readonly MAX_NEGATIVE_KEYWORDS: number;
}

interface AnalyticsConfig {
  readonly METRICS_CACHE_TTL: number;
  readonly MAX_TIME_RANGE_DAYS: number;
  readonly ALERT_CHECK_INTERVAL: number;
  readonly PERFORMANCE_THRESHOLD_DEFAULT: number;
  readonly REAL_TIME_UPDATE_INTERVAL: number;
  readonly MAX_METRICS_BATCH_SIZE: number;
  readonly DATA_RETENTION_DAYS: number;
  readonly AGGREGATION_INTERVALS: readonly string[];
  readonly ALERT_SEVERITY_LEVELS: readonly string[];
  readonly METRICS_PRECISION: number;
}

interface ApiRateLimits {
  readonly MAX_REQUESTS_PER_MINUTE: number;
  readonly MAX_REQUESTS_PER_HOUR: number;
  readonly RATE_LIMIT_WINDOW: number;
  readonly BURST_LIMIT: number;
  readonly THROTTLE_THRESHOLD: number;
  readonly COOLDOWN_PERIOD: number;
  readonly PER_IP_LIMIT: number;
  readonly PER_USER_LIMIT: number;
  readonly WHITELIST_RATE_MULTIPLIER: number;
  readonly BLACKLIST_DURATION: number;
}

interface ErrorMessages {
  readonly UNAUTHORIZED: string;
  readonly INVALID_CREDENTIALS: string;
  readonly CAMPAIGN_NOT_FOUND: string;
  readonly INVALID_BUDGET: string;
  readonly PLATFORM_ERROR: string;
  readonly RATE_LIMIT_EXCEEDED: string;
  readonly INVALID_TOKEN: string;
  readonly INSUFFICIENT_PERMISSIONS: string;
  readonly VALIDATION_ERROR: string;
  readonly PLATFORM_TIMEOUT: string;
}

// Authentication configuration
export const AUTH_CONFIG: Readonly<AuthConfig> = {
  JWT_SECRET: process.env.JWT_SECRET as string,
  JWT_EXPIRY: '24h',
  TOKEN_TYPE: 'Bearer',
  REFRESH_TOKEN_EXPIRY: '7d',
  PASSWORD_SALT_ROUNDS: 10,
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_LOCKOUT_DURATION: 900000, // 15 minutes
  MIN_PASSWORD_LENGTH: 12,
  REQUIRE_MFA: true,
  SESSION_TIMEOUT: 3600000, // 1 hour
} as const;

// Platform integration configuration
export const PLATFORM_CONFIG: Readonly<PlatformConfig> = {
  LINKEDIN_API_VERSION: '202401',
  LINKEDIN_API_TIMEOUT: 20000,
  LINKEDIN_BATCH_SIZE: 100,
  GOOGLE_ADS_API_VERSION: 'v14',
  GOOGLE_ADS_API_TIMEOUT: 25000,
  GOOGLE_ADS_BATCH_SIZE: 500,
  API_TIMEOUT: 30000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  RETRY_MULTIPLIER: 2,
  HEALTH_CHECK_INTERVAL: 60000,
} as const;

// Campaign management limits
export const CAMPAIGN_LIMITS: Readonly<CampaignLimits> = {
  MIN_BUDGET_AMOUNT: 5,
  MAX_BUDGET_AMOUNT: 1000000,
  MAX_AD_GROUPS: 100,
  MAX_ADS_PER_GROUP: 50,
  MAX_TARGETING_LOCATIONS: 100,
  MAX_TARGETING_INDUSTRIES: 50,
  MIN_CAMPAIGN_DURATION_DAYS: 1,
  MAX_CAMPAIGN_DURATION_DAYS: 365,
  MAX_CONCURRENT_CAMPAIGNS: 50,
  MAX_KEYWORDS_PER_GROUP: 2000,
  MAX_NEGATIVE_KEYWORDS: 1000,
} as const;

// Analytics configuration
export const ANALYTICS_CONFIG: Readonly<AnalyticsConfig> = {
  METRICS_CACHE_TTL: 300, // 5 minutes
  MAX_TIME_RANGE_DAYS: 365,
  ALERT_CHECK_INTERVAL: 300000, // 5 minutes
  PERFORMANCE_THRESHOLD_DEFAULT: 0.1,
  REAL_TIME_UPDATE_INTERVAL: 60000, // 1 minute
  MAX_METRICS_BATCH_SIZE: 1000,
  DATA_RETENTION_DAYS: 730, // 2 years
  AGGREGATION_INTERVALS: ['1h', '1d', '7d', '30d'],
  ALERT_SEVERITY_LEVELS: ['low', 'medium', 'high', 'critical'],
  METRICS_PRECISION: 4,
} as const;

// API rate limiting configuration
export const API_RATE_LIMITS: Readonly<ApiRateLimits> = {
  MAX_REQUESTS_PER_MINUTE: 100,
  MAX_REQUESTS_PER_HOUR: 5000,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  BURST_LIMIT: 200,
  THROTTLE_THRESHOLD: 0.8,
  COOLDOWN_PERIOD: 300000, // 5 minutes
  PER_IP_LIMIT: 50,
  PER_USER_LIMIT: 100,
  WHITELIST_RATE_MULTIPLIER: 2,
  BLACKLIST_DURATION: 3600000, // 1 hour
} as const;

// Standardized error messages
export const ERROR_MESSAGES: Readonly<ErrorMessages> = {
  UNAUTHORIZED: 'Unauthorized access',
  INVALID_CREDENTIALS: 'Invalid email or password',
  CAMPAIGN_NOT_FOUND: 'Campaign not found',
  INVALID_BUDGET: 'Invalid campaign budget',
  PLATFORM_ERROR: 'Error communicating with ad platform',
  RATE_LIMIT_EXCEEDED: 'API rate limit exceeded. Please try again later',
  INVALID_TOKEN: 'Invalid or expired authentication token',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions for this operation',
  VALIDATION_ERROR: 'Request validation failed',
  PLATFORM_TIMEOUT: 'Platform request timed out',
} as const;