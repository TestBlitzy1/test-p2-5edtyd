/**
 * Core constants file for the Sales Intelligence Platform web application
 * Contains configuration values, enums, and static data for campaign management,
 * analytics, and UI components
 * @version 1.0.0
 */

import { MetricType } from '../types/analytics';
import { PlatformType } from '../types/campaign';

// API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api';
export const API_TIMEOUT = 30000; // 30 seconds

/**
 * API endpoint configuration for all platform services
 */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
  },
  CAMPAIGNS: {
    BASE: '/campaigns',
    CREATE: '/campaigns/create',
    UPDATE: '/campaigns/:id',
    DELETE: '/campaigns/:id',
    OPTIMIZE: '/campaigns/:id/optimize',
    DUPLICATE: '/campaigns/:id/duplicate',
  },
  ANALYTICS: {
    PERFORMANCE: '/analytics/performance',
    METRICS: '/analytics/metrics',
    FORECASTS: '/analytics/forecasts',
    EXPORT: '/analytics/export',
  },
} as const;

/**
 * Platform-specific configuration for ad platforms
 */
export const PLATFORM_CONFIG = {
  LINKEDIN: {
    API_VERSION: '202401',
    CAMPAIGN_LIMITS: {
      MIN_BUDGET: 10,
      MAX_BUDGET: 100000,
      MAX_AD_GROUPS: 100,
      MAX_ADS_PER_GROUP: 50,
    },
    TARGETING_LIMITS: {
      MAX_LOCATIONS: 100,
      MAX_INDUSTRIES: 50,
      MAX_JOB_TITLES: 100,
    },
  },
  GOOGLE: {
    API_VERSION: 'v14',
    CAMPAIGN_LIMITS: {
      MIN_BUDGET: 5,
      MAX_BUDGET: 500000,
      MAX_AD_GROUPS: 200,
      MAX_ADS_PER_GROUP: 100,
    },
    TARGETING_LIMITS: {
      MAX_LOCATIONS: 250,
      MAX_KEYWORDS: 1000,
      MAX_PLACEMENTS: 500,
    },
  },
} as const;

/**
 * UI constants for responsive design and theming
 */
export const UI_CONSTANTS = {
  BREAKPOINTS: {
    MOBILE: 320,
    TABLET: 768,
    DESKTOP: 1024,
    WIDE: 1440,
  },
  ANIMATION_DURATION: {
    FAST: 200,
    MEDIUM: 300,
    SLOW: 500,
  },
  THEME: {
    COLORS: {
      PRIMARY: '#0066FF',
      SECONDARY: '#6B7280',
      SUCCESS: '#10B981',
      WARNING: '#F59E0B',
      ERROR: '#EF4444',
      BACKGROUND: '#FFFFFF',
      TEXT: '#111827',
    },
    SPACING: {
      XS: '0.25rem',
      SM: '0.5rem',
      MD: '1rem',
      LG: '1.5rem',
      XL: '2rem',
    },
  },
  GRID_CONFIG: {
    COLUMNS: 12,
    GAP: 16,
    CONTAINER_PADDING: 24,
  },
} as const;

/**
 * Analytics configuration including metrics and thresholds
 */
export const ANALYTICS_CONFIG = {
  DEFAULT_METRICS: [
    MetricType.IMPRESSIONS,
    MetricType.CLICKS,
    MetricType.CTR,
    MetricType.CONVERSIONS,
    MetricType.ROAS,
  ],
  CHART_COLORS: [
    '#60A5FA', // Blue
    '#34D399', // Green
    '#F59E0B', // Yellow
    '#EC4899', // Pink
    '#8B5CF6', // Purple
  ],
  REFRESH_INTERVALS: {
    REALTIME: 30000,    // 30 seconds
    STANDARD: 300000,   // 5 minutes
    BACKGROUND: 900000, // 15 minutes
  },
  PERFORMANCE_THRESHOLDS: {
    [MetricType.CTR]: 0.02,        // 2% minimum CTR
    [MetricType.CONVERSION_RATE]: 0.03, // 3% minimum conversion rate
    [MetricType.ROAS]: 2.0,        // 2x minimum ROAS
  },
} as const;

/**
 * Error handling and retry configuration
 */
export const ERROR_CONSTANTS = {
  HTTP_ERRORS: {
    400: 'Bad Request - Please check your input',
    401: 'Unauthorized - Please log in again',
    403: 'Forbidden - You don\'t have permission',
    404: 'Not Found - Resource doesn\'t exist',
    429: 'Too Many Requests - Please try again later',
    500: 'Internal Server Error - Please try again',
  },
  RETRY_CONFIG: {
    MAX_RETRIES: 3,
    INITIAL_DELAY: 1000,
    MAX_DELAY: 5000,
    BACKOFF_FACTOR: 2,
  },
} as const;

/**
 * Constructs a complete API URL for a given endpoint
 * @param endpoint - The API endpoint path
 * @returns The complete API URL
 */
export const getApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};