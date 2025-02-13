// External package imports
import dotenv from 'dotenv';  // ^16.0.0
import Joi from 'joi';  // ^17.9.0

// Internal imports
import { UserRole } from '../../shared/types/auth.types';

// Load environment variables with schema validation
dotenv.config();

/**
 * Configuration version for tracking and validation
 */
const CONFIG_VERSION = '1.0';

/**
 * Environment type definition for type safety
 */
type Environment = 'development' | 'staging' | 'production' | 'test';

/**
 * Service configuration interface with retry and backoff strategies
 */
interface ServiceConfig {
    url: string;
    timeout: number;
    retries: number;
    backoff: 'none' | 'linear' | 'exponential';
}

/**
 * Rate limiting configuration interface with strategy options
 */
interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    strategy: 'token-bucket' | 'leaky-bucket';
}

/**
 * Enhanced configuration validation schema
 */
const configSchema = Joi.object({
    env: Joi.string().valid('development', 'staging', 'production', 'test').required(),
    port: Joi.number().port().required(),
    cors: Joi.object({
        origin: Joi.string().required(),
        methods: Joi.array().items(Joi.string()).required(),
        allowedHeaders: Joi.array().items(Joi.string()).required(),
        exposedHeaders: Joi.array().items(Joi.string()).required(),
        credentials: Joi.boolean().required(),
        maxAge: Joi.number().required()
    }).required(),
    auth: Joi.object({
        jwtSecret: Joi.string().min(32).required(),
        tokenExpiry: Joi.string().required(),
        refreshTokenExpiry: Joi.string().required(),
        rotationSchedule: Joi.string().required(),
        maxTokensPerUser: Joi.number().min(1).required()
    }).required(),
    services: Joi.object({
        auth: Joi.object({
            url: Joi.string().uri().required(),
            timeout: Joi.number().min(1000).required(),
            retries: Joi.number().min(0).required(),
            backoff: Joi.string().valid('none', 'linear', 'exponential').required()
        }).required(),
        campaign: Joi.object({
            url: Joi.string().uri().required(),
            timeout: Joi.number().min(1000).required(),
            retries: Joi.number().min(0).required(),
            backoff: Joi.string().valid('none', 'linear', 'exponential').required()
        }).required(),
        analytics: Joi.object({
            url: Joi.string().uri().required(),
            timeout: Joi.number().min(1000).required(),
            retries: Joi.number().min(0).required(),
            backoff: Joi.string().valid('none', 'linear', 'exponential').required()
        }).required(),
        ai: Joi.object({
            url: Joi.string().uri().required(),
            timeout: Joi.number().min(1000).required(),
            retries: Joi.number().min(0).required(),
            backoff: Joi.string().valid('none', 'linear', 'exponential').required()
        }).required()
    }).required(),
    rateLimiting: Joi.object({
        authenticated: Joi.object({
            windowMs: Joi.number().min(1000).required(),
            maxRequests: Joi.number().min(1).required(),
            strategy: Joi.string().valid('token-bucket', 'leaky-bucket').required()
        }).required(),
        unauthenticated: Joi.object({
            windowMs: Joi.number().min(1000).required(),
            maxRequests: Joi.number().min(1).required(),
            strategy: Joi.string().valid('token-bucket', 'leaky-bucket').required()
        }).required(),
        ipBased: Joi.object({
            enabled: Joi.boolean().required(),
            windowMs: Joi.number().min(1000).required(),
            maxRequests: Joi.number().min(1).required()
        }).required()
    }).required(),
    monitoring: Joi.object({
        configChangeLogging: Joi.boolean().required(),
        sensitiveKeys: Joi.array().items(Joi.string()).required(),
        metricsEnabled: Joi.boolean().required(),
        healthCheckInterval: Joi.number().min(1000).required()
    }).required()
});

/**
 * Configuration validation function with enhanced error handling
 * @param config Configuration object to validate
 * @returns Validated and sanitized configuration
 */
function validateConfig(config: Record<string, any>): Record<string, any> {
    const { error, value } = configSchema.validate(config, {
        abortEarly: false,
        stripUnknown: true
    });

    if (error) {
        const errorMessage = error.details
            .map(detail => detail.message)
            .join(', ');
        throw new Error(`Configuration validation failed: ${errorMessage}`);
    }

    return value;
}

/**
 * Main configuration object with comprehensive settings
 */
const config = validateConfig({
    env: process.env.NODE_ENV || 'development' as Environment,
    port: parseInt(process.env.API_GATEWAY_PORT || '3000', 10),
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: ['X-Rate-Limit', 'X-Rate-Remaining'],
        credentials: true,
        maxAge: 86400
    },
    auth: {
        jwtSecret: process.env.JWT_SECRET,
        tokenExpiry: process.env.TOKEN_EXPIRY || '1h',
        refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
        rotationSchedule: process.env.JWT_ROTATION_SCHEDULE || '24h',
        maxTokensPerUser: parseInt(process.env.MAX_TOKENS_PER_USER || '5', 10)
    },
    services: {
        auth: {
            url: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
            timeout: parseInt(process.env.AUTH_SERVICE_TIMEOUT || '5000', 10),
            retries: 3,
            backoff: 'exponential'
        },
        campaign: {
            url: process.env.CAMPAIGN_SERVICE_URL || 'http://localhost:3002',
            timeout: parseInt(process.env.CAMPAIGN_SERVICE_TIMEOUT || '5000', 10),
            retries: 2,
            backoff: 'linear'
        },
        analytics: {
            url: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3003',
            timeout: parseInt(process.env.ANALYTICS_SERVICE_TIMEOUT || '5000', 10),
            retries: 2,
            backoff: 'linear'
        },
        ai: {
            url: process.env.AI_SERVICE_URL || 'http://localhost:3004',
            timeout: parseInt(process.env.AI_SERVICE_TIMEOUT || '10000', 10),
            retries: 1,
            backoff: 'none'
        }
    },
    rateLimiting: {
        authenticated: {
            windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW || '900000', 10),
            maxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '1000', 10),
            strategy: 'token-bucket'
        },
        unauthenticated: {
            windowMs: parseInt(process.env.UNAUTH_RATE_LIMIT_WINDOW || '900000', 10),
            maxRequests: parseInt(process.env.UNAUTH_RATE_LIMIT_MAX || '100', 10),
            strategy: 'leaky-bucket'
        },
        ipBased: {
            enabled: true,
            windowMs: 3600000,
            maxRequests: 10000
        }
    },
    monitoring: {
        configChangeLogging: true,
        sensitiveKeys: ['jwtSecret', 'credentials'],
        metricsEnabled: true,
        healthCheckInterval: 30000
    }
});

// Configuration change monitoring setup
if (config.monitoring.configChangeLogging) {
    process.on('config:change', (changes: Record<string, any>) => {
        const sanitizedChanges = { ...changes };
        config.monitoring.sensitiveKeys.forEach(key => {
            if (key in sanitizedChanges) {
                sanitizedChanges[key] = '[REDACTED]';
            }
        });
        console.log('Configuration changed:', sanitizedChanges);
    });
}

export default config;