// External imports
import dotenv from 'dotenv'; // ^16.3.1

// Internal imports
import { PlatformType } from '../../../shared/types/campaign.types';

// Initialize environment variables
dotenv.config();

// Global constants
const NODE_ENV = process.env.NODE_ENV || 'development';
const CONFIG_VERSION = '1.0.0';

/**
 * Platform-specific API version validation
 */
const VALID_API_VERSIONS = {
    [PlatformType.LINKEDIN]: ['v2', 'v2.1'],
    [PlatformType.GOOGLE]: ['v11', 'v12']
};

/**
 * Required OAuth2 scopes for platform integrations
 */
const REQUIRED_SCOPES = {
    [PlatformType.LINKEDIN]: [
        'r_ads',
        'r_ads_reporting',
        'w_ads',
        'r_organization_social'
    ],
    [PlatformType.GOOGLE]: [
        'https://www.googleapis.com/auth/adwords',
        'https://www.googleapis.com/auth/adwords.readonly'
    ]
};

/**
 * Validates platform-specific configuration settings
 * @param platformConfig Platform configuration object
 * @returns boolean indicating validation status
 */
const validatePlatformConfig = (platformConfig: any): boolean => {
    if (!platformConfig.clientId || !platformConfig.clientSecret) {
        throw new Error('Missing required OAuth credentials');
    }

    if (!platformConfig.apiVersion || 
        !VALID_API_VERSIONS[platformConfig.platform].includes(platformConfig.apiVersion)) {
        throw new Error(`Invalid API version for ${platformConfig.platform}`);
    }

    if (!platformConfig.baseUrl || !platformConfig.baseUrl.startsWith('https://')) {
        throw new Error('Invalid or insecure API base URL');
    }

    return true;
};

/**
 * Loads and validates the platform configuration
 * @returns Validated configuration object
 */
const loadConfig = () => {
    // Platform-specific configurations
    const platformConfig = {
        [PlatformType.LINKEDIN]: {
            platform: PlatformType.LINKEDIN,
            apiVersion: process.env.LINKEDIN_API_VERSION || 'v2',
            baseUrl: 'https://api.linkedin.com',
            clientId: process.env.LINKEDIN_CLIENT_ID,
            clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
            redirectUri: process.env.LINKEDIN_REDIRECT_URI,
            scope: REQUIRED_SCOPES[PlatformType.LINKEDIN],
            timeout: parseInt(process.env.LINKEDIN_TIMEOUT || '30000'),
            retryAttempts: parseInt(process.env.LINKEDIN_RETRY_ATTEMPTS || '3'),
            rateLimits: {
                requestsPerSecond: 100,
                burstSize: 20
            },
            validation: {
                requiredScopes: REQUIRED_SCOPES[PlatformType.LINKEDIN],
                allowedApiVersions: VALID_API_VERSIONS[PlatformType.LINKEDIN]
            }
        },
        [PlatformType.GOOGLE]: {
            platform: PlatformType.GOOGLE,
            apiVersion: process.env.GOOGLE_ADS_API_VERSION || 'v12',
            baseUrl: 'https://googleads.googleapis.com',
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            developerToken: process.env.GOOGLE_DEVELOPER_TOKEN,
            timeout: parseInt(process.env.GOOGLE_TIMEOUT || '30000'),
            retryAttempts: parseInt(process.env.GOOGLE_RETRY_ATTEMPTS || '3'),
            rateLimits: {
                requestsPerDay: 100000,
                requestsPerMinute: 1000
            },
            validation: {
                requiredScopes: REQUIRED_SCOPES[PlatformType.GOOGLE],
                allowedApiVersions: VALID_API_VERSIONS[PlatformType.GOOGLE]
            }
        }
    };

    // Validate platform configurations
    Object.values(platformConfig).forEach(validatePlatformConfig);

    // General API configuration
    const apiConfig = {
        timeout: parseInt(process.env.API_TIMEOUT || '30000'),
        maxRetries: parseInt(process.env.API_MAX_RETRIES || '3'),
        rateLimiting: {
            enabled: process.env.ENABLE_RATE_LIMITING !== 'false',
            maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'),
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
            strategy: process.env.RATE_LIMIT_STRATEGY || 'sliding'
        },
        circuitBreaker: {
            enabled: process.env.ENABLE_CIRCUIT_BREAKER !== 'false',
            failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5'),
            resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '30000'),
            halfOpenRequests: parseInt(process.env.CIRCUIT_BREAKER_HALF_OPEN || '3')
        }
    };

    // Security configuration
    const securityConfig = {
        encryption: {
            algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
            keyRotationInterval: parseInt(process.env.KEY_ROTATION_INTERVAL || '86400000')
        },
        audit: {
            enabled: process.env.ENABLE_AUDIT_LOGGING !== 'false',
            logLevel: process.env.AUDIT_LOG_LEVEL || 'info',
            retention: parseInt(process.env.AUDIT_LOG_RETENTION || '90')
        },
        validation: {
            schemaVersion: CONFIG_VERSION,
            strictMode: process.env.STRICT_VALIDATION !== 'false'
        }
    };

    return {
        env: NODE_ENV,
        version: CONFIG_VERSION,
        platforms: platformConfig,
        api: apiConfig,
        security: securityConfig
    };
};

// Export the configuration object
export const config = loadConfig();

// Named exports for specific configuration sections
export const { platforms, api, security } = config;