/**
 * @fileoverview Campaign Service Configuration
 * Provides centralized configuration management with enhanced security,
 * validation, and performance features for the campaign service.
 * @version 1.0.0
 */

import { config as dotenv } from 'dotenv'; // v16.3.1
import { CAMPAIGN_LIMITS, PLATFORM_CONFIG } from '../../../shared/constants';

// Load environment variables with validation
dotenv();

/**
 * Service configuration interface with strict typing
 */
interface ServiceConfig {
  readonly PORT: number;
  readonly HOST: string;
  readonly NODE_ENV: string;
  readonly SERVICE_NAME: string;
  readonly LOG_LEVEL: string;
  readonly REQUEST_TIMEOUT: number;
  readonly SHUTDOWN_TIMEOUT: number;
}

/**
 * Database configuration interface with connection pool settings
 */
interface DatabaseConfig {
  readonly HOST: string;
  readonly PORT: number;
  readonly NAME: string;
  readonly USER: string;
  readonly PASSWORD: string;
  readonly MAX_POOL_SIZE: number;
  readonly MIN_POOL_SIZE: number;
  readonly IDLE_TIMEOUT: number;
  readonly CONNECTION_TIMEOUT: number;
  readonly RETRY_ATTEMPTS: number;
  readonly RETRY_DELAY: number;
  readonly SSL_ENABLED: boolean;
}

/**
 * Redis configuration interface with enhanced caching options
 */
interface RedisConfig {
  readonly HOST: string;
  readonly PORT: number;
  readonly PASSWORD: string;
  readonly DB_INDEX: number;
  readonly KEY_PREFIX: string;
  readonly RETRY_STRATEGY: (retries: number) => number;
  readonly MAX_RETRIES: number;
  readonly ENABLE_OFFLINE_QUEUE: boolean;
  readonly CACHE_TTL: number;
  readonly RECONNECT_TIMEOUT: number;
}

/**
 * Campaign-specific configuration interface
 */
interface CampaignConfig {
  readonly MIN_BUDGET: number;
  readonly MAX_BUDGET: number;
  readonly MAX_AD_GROUPS: number;
  readonly LINKEDIN_API_VERSION: string;
  readonly GOOGLE_ADS_API_VERSION: string;
  readonly API_TIMEOUT: number;
  readonly BATCH_PROCESSING_SIZE: number;
  readonly OPTIMIZATION_INTERVAL: number;
  readonly PERFORMANCE_CHECK_INTERVAL: number;
}

/**
 * Validates required environment variables
 * @throws {Error} If required environment variables are missing
 */
const validateEnvironment = (): void => {
  const required = [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'REDIS_HOST',
    'REDIS_PORT',
    'REDIS_PASSWORD'
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

// Initialize configuration with validation
validateEnvironment();

/**
 * Service configuration with secure defaults
 */
const service: ServiceConfig = {
  PORT: Number(process.env.CAMPAIGN_SERVICE_PORT) || 3002,
  HOST: process.env.CAMPAIGN_SERVICE_HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',
  SERVICE_NAME: 'campaign-service',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  REQUEST_TIMEOUT: Number(process.env.REQUEST_TIMEOUT) || 30000,
  SHUTDOWN_TIMEOUT: Number(process.env.SHUTDOWN_TIMEOUT) || 10000,
} as const;

/**
 * Database configuration with connection pooling
 */
const database: DatabaseConfig = {
  HOST: process.env.DB_HOST!,
  PORT: Number(process.env.DB_PORT),
  NAME: process.env.DB_NAME!,
  USER: process.env.DB_USER!,
  PASSWORD: process.env.DB_PASSWORD!,
  MAX_POOL_SIZE: 20,
  MIN_POOL_SIZE: 5,
  IDLE_TIMEOUT: 10000,
  CONNECTION_TIMEOUT: 5000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  SSL_ENABLED: process.env.DB_SSL_ENABLED === 'true',
} as const;

/**
 * Redis configuration with resilient connection handling
 */
const redis: RedisConfig = {
  HOST: process.env.REDIS_HOST!,
  PORT: Number(process.env.REDIS_PORT),
  PASSWORD: process.env.REDIS_PASSWORD!,
  DB_INDEX: 0,
  KEY_PREFIX: 'campaign:',
  RETRY_STRATEGY: (times: number) => Math.min(times * 50, 2000),
  MAX_RETRIES: 3,
  ENABLE_OFFLINE_QUEUE: true,
  CACHE_TTL: 3600,
  RECONNECT_TIMEOUT: 5000,
} as const;

/**
 * Campaign-specific configuration with platform integration settings
 */
const campaign: CampaignConfig = {
  MIN_BUDGET: CAMPAIGN_LIMITS.MIN_BUDGET_AMOUNT,
  MAX_BUDGET: CAMPAIGN_LIMITS.MAX_BUDGET_AMOUNT,
  MAX_AD_GROUPS: CAMPAIGN_LIMITS.MAX_AD_GROUPS,
  LINKEDIN_API_VERSION: PLATFORM_CONFIG.LINKEDIN_API_VERSION,
  GOOGLE_ADS_API_VERSION: PLATFORM_CONFIG.GOOGLE_ADS_API_VERSION,
  API_TIMEOUT: PLATFORM_CONFIG.API_TIMEOUT,
  BATCH_PROCESSING_SIZE: 100,
  OPTIMIZATION_INTERVAL: 3600000, // 1 hour
  PERFORMANCE_CHECK_INTERVAL: 300000, // 5 minutes
} as const;

/**
 * Unified configuration object with enhanced validation and security features
 */
export const config = {
  service,
  database,
  redis,
  campaign,
} as const;

export type Config = typeof config;