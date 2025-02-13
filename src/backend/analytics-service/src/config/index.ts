/**
 * @fileoverview Analytics Service Configuration
 * Centralizes configuration settings for the analytics service including database,
 * caching, performance tracking, and metric processing configurations.
 * @version 1.0.0
 */

// External imports
import { config as dotenvConfig } from 'dotenv'; // v16.3.1

// Internal imports
import { ANALYTICS_CONFIG } from '../../shared/constants';
import { MetricType } from '../../shared/types/analytics.types';

// Load environment variables
dotenvConfig();

/**
 * Database connection configuration
 */
const DATABASE_CONFIG = {
  host: process.env.ANALYTICS_DB_HOST,
  port: parseInt(process.env.ANALYTICS_DB_PORT!, 10),
  database: process.env.ANALYTICS_DB_NAME,
  username: process.env.ANALYTICS_DB_USER,
  password: process.env.ANALYTICS_DB_PASSWORD,
  poolSize: parseInt(process.env.DB_POOL_SIZE!, 10) || 20,
  ssl: process.env.NODE_ENV === 'production',
  connectionTimeout: 10000,
  idleTimeoutMillis: 30000,
  statement_timeout: 30000,
} as const;

/**
 * Redis cache configuration for analytics data
 */
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT!, 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB!, 10) || 0,
  keyPrefix: 'analytics:',
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  connectTimeout: 10000,
  maxRetryAttempts: 5,
  retryStrategy: (times: number) => Math.min(times * 200, 2000),
} as const;

/**
 * Analytics service configuration
 */
const SERVICE_CONFIG = {
  port: parseInt(process.env.ANALYTICS_SERVICE_PORT!, 10) || 3003,
  host: process.env.ANALYTICS_SERVICE_HOST || '0.0.0.0',
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  metricsEnabled: process.env.ENABLE_METRICS !== 'false',
  tracingEnabled: process.env.ENABLE_TRACING !== 'false',
} as const;

/**
 * Metric processing configuration for real-time analytics
 */
export const METRIC_PROCESSING_CONFIG = {
  batchSize: 1000,
  processingInterval: 60000, // 1 minute
  retentionDays: ANALYTICS_CONFIG.DATA_RETENTION_DAYS,
  aggregationIntervals: ANALYTICS_CONFIG.AGGREGATION_INTERVALS,
  cacheTTL: ANALYTICS_CONFIG.METRICS_CACHE_TTL,
  precision: ANALYTICS_CONFIG.METRICS_PRECISION,
  realTimeUpdateInterval: ANALYTICS_CONFIG.REAL_TIME_UPDATE_INTERVAL,
  maxTimeRange: ANALYTICS_CONFIG.MAX_TIME_RANGE_DAYS * 24 * 60 * 60 * 1000, // in ms
} as const;

/**
 * Performance threshold configuration for analytics alerts
 */
export const PERFORMANCE_THRESHOLDS = {
  minCTR: 0.02, // 2% minimum click-through rate
  maxCPC: 5.00, // $5.00 maximum cost per click
  targetROAS: 3.0, // 300% target return on ad spend
  metrics: {
    [MetricType.IMPRESSIONS]: 1000,
    [MetricType.CLICKS]: 100,
    [MetricType.CONVERSIONS]: 10
  },
  alertThreshold: ANALYTICS_CONFIG.PERFORMANCE_THRESHOLD_DEFAULT,
  checkInterval: ANALYTICS_CONFIG.ALERT_CHECK_INTERVAL,
} as const;

/**
 * Unified configuration object for the analytics service
 */
export const config = {
  database: DATABASE_CONFIG,
  redis: REDIS_CONFIG,
  service: SERVICE_CONFIG,
  metrics: METRIC_PROCESSING_CONFIG,
  thresholds: PERFORMANCE_THRESHOLDS,
  maxBatchSize: ANALYTICS_CONFIG.MAX_METRICS_BATCH_SIZE,
  alertSeverityLevels: ANALYTICS_CONFIG.ALERT_SEVERITY_LEVELS,
} as const;