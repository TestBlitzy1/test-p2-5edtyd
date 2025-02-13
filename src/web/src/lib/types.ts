/**
 * Central type definitions file for the Sales Intelligence Platform
 * Combines and re-exports domain-specific types while defining shared interfaces and utilities
 * @version 1.0.0
 */

import { ReactNode } from 'react'; // ^18.0.0
import * as Analytics from '../types/analytics';
import * as Campaign from '../types/campaign';
import * as Auth from '../types/auth';
import * as Platform from '../types/platform';
import * as Common from '../types/common';

// Re-export commonly used types from domain-specific modules
export {
    MetricType,
    TimeRange,
    IAnalyticsData,
    IPerformanceReport,
} from '../types/analytics';

export {
    PlatformType,
    CampaignStatus,
    ICampaign,
    ITargeting,
    IBudget,
} from '../types/campaign';

export {
    UserRole,
    AuthProvider,
    User,
    AuthState,
} from '../types/auth';

export {
    Status,
    ApiError,
    PaginationParams,
    DateRange,
} from '../types/common';

export {
    PlatformCredentials,
    PlatformIntegrationStatus,
    PlatformCampaignStats,
} from '../types/platform';

/**
 * Global application state interface
 * Combines all major state slices with strict null checking
 */
export interface AppState {
    /** Current authenticated user */
    user: Auth.User | null;
    
    /** User authentication state */
    auth: Auth.AuthState;
    
    /** Active campaigns */
    campaigns: Campaign.ICampaign[];
    
    /** Real-time analytics data */
    analytics: Analytics.IAnalyticsData | null;
    
    /** Platform integration statuses */
    platformIntegrations: Record<Platform.PlatformType, Platform.PlatformIntegrationStatus>;
    
    /** Global loading states */
    loadingStates: Record<string, LoadingState>;
}

/**
 * Loading state enum for async operations
 */
export enum LoadingState {
    IDLE = 'IDLE',
    LOADING = 'LOADING',
    SUCCESS = 'SUCCESS',
    ERROR = 'ERROR'
}

/**
 * Generic async operation state interface
 */
export interface AsyncState<T = unknown, E = Common.ApiError> {
    /** Current loading state */
    status: LoadingState;
    
    /** Data payload */
    data?: T;
    
    /** Error state */
    error: E | null;
    
    /** Last updated timestamp */
    timestamp: Date;
}

/**
 * Base component props interface with children support
 */
export interface ComponentWithChildren extends Common.BaseComponentProps {
    /** React children nodes */
    children: ReactNode;
    
    /** Optional CSS class name */
    className?: string;
    
    /** Optional test ID for testing */
    'data-testid'?: string;
}

/**
 * Campaign form data interface for type-safe form handling
 */
export interface CampaignFormData {
    name: string;
    platform: Platform.PlatformType;
    objective: Campaign.CampaignObjective;
    budget: Campaign.IBudget;
    targeting: Campaign.ITargeting;
}

/**
 * Type guard for campaign form data validation
 */
export function isValidCampaignFormData(data: any): data is CampaignFormData {
    return (
        data &&
        typeof data.name === 'string' &&
        Object.values(Platform.PlatformType).includes(data.platform) &&
        Object.values(Campaign.CampaignObjective).includes(data.objective) &&
        typeof data.budget?.amount === 'number' &&
        typeof data.targeting === 'object'
    );
}

/**
 * Analytics filter configuration interface
 */
export interface AnalyticsFilterConfig {
    timeRange: Analytics.TimeRange;
    metrics: Analytics.MetricType[];
    segments?: string[];
    compareMode?: boolean;
}

// Global constants
export const PLATFORM_TYPES: Platform.PlatformType[] = [
    Platform.PlatformType.LINKEDIN,
    Platform.PlatformType.GOOGLE
];

export const DEFAULT_LOADING_STATE: LoadingState = LoadingState.IDLE;

/**
 * Type utility for extracting error types from async operations
 */
export type AsyncError<T> = T extends AsyncState<any, infer E> ? E : never;

/**
 * Type utility for platform-specific configurations
 */
export type PlatformConfig = {
    [P in Platform.PlatformType]: P extends Platform.PlatformType.LINKEDIN
        ? Platform.LinkedInAdsConfig
        : Platform.GoogleAdsConfig;
};

/**
 * Type utility for role-based component props
 */
export type RoleRestrictedProps<T> = T & {
    requiredRole: Auth.UserRole;
    fallback?: ReactNode;
};