/**
 * Analytics type definitions for the Sales Intelligence Platform
 * Supporting real-time performance tracking, forecasting, and budget optimization
 * @version 1.0.0
 */

import { ICampaign } from '../types/campaign';

/**
 * Comprehensive set of supported analytics metric types
 */
export enum MetricType {
    IMPRESSIONS = 'IMPRESSIONS',
    CLICKS = 'CLICKS',
    CTR = 'CTR',
    CONVERSIONS = 'CONVERSIONS',
    CONVERSION_RATE = 'CONVERSION_RATE',
    COST = 'COST',
    CPC = 'CPC',
    CPM = 'CPM',
    ROAS = 'ROAS',
    ROI = 'ROI'
}

/**
 * Time range options for analytics data filtering
 */
export enum TimeRange {
    TODAY = 'TODAY',
    YESTERDAY = 'YESTERDAY',
    LAST_7_DAYS = 'LAST_7_DAYS',
    LAST_30_DAYS = 'LAST_30_DAYS',
    THIS_MONTH = 'THIS_MONTH',
    LAST_MONTH = 'LAST_MONTH',
    YEAR_TO_DATE = 'YEAR_TO_DATE',
    CUSTOM = 'CUSTOM'
}

/**
 * Individual metric measurement interface with confidence scoring
 */
export interface IMetric {
    /** Type of metric being measured */
    type: MetricType;
    
    /** Numerical value of the metric */
    value: number;
    
    /** Timestamp of measurement */
    timestamp: Date;
    
    /** Confidence score (0-1) for forecasted metrics */
    confidence: number;
    
    /** Optional segment identifier for segmented analytics */
    segment?: string;
}

/**
 * Comprehensive analytics data structure
 */
export interface IAnalyticsData {
    /** Reference to campaign ID */
    campaignId: string;
    
    /** Array of metric measurements */
    metrics: IMetric[];
    
    /** Selected time range for the data */
    timeRange: TimeRange;
    
    /** Active segments for data analysis */
    segments: string[];
    
    /** Comparative data for trend analysis */
    comparisonData?: IMetric[];
}

/**
 * Enhanced performance report interface with forecasting
 */
export interface IPerformanceReport {
    /** Reference to campaign ID */
    campaignId: string;
    
    /** Current metric values */
    metrics: Record<MetricType, number>;
    
    /** Trend indicators for each metric (-1 to 1) */
    trends: Record<MetricType, number>;
    
    /** AI-generated optimization recommendations */
    recommendations: string[];
    
    /** Confidence intervals for forecasted metrics */
    confidenceIntervals: Record<MetricType, {
        lower: number;
        upper: number;
    }>;
    
    /** Overall forecast accuracy score (0-1) */
    forecastAccuracy: number;
}

/**
 * Props interface for Analytics Dashboard component
 */
export interface IAnalyticsDashboardProps {
    /** Campaign ID for analytics */
    campaignId: string;
    
    /** Optional CSS class name */
    className?: string;
    
    /** Initial time range selection */
    initialTimeRange: TimeRange;
    
    /** Initial metrics to display */
    initialMetrics: MetricType[];
    
    /** Real-time refresh interval in milliseconds */
    refreshInterval: number;
    
    /** Toggle for confidence interval display */
    showConfidenceIntervals: boolean;
}

/**
 * Return type for useAnalytics hook
 */
export interface IAnalyticsHookResult {
    /** Analytics data */
    data: IAnalyticsData;
    
    /** Loading state indicator */
    loading: boolean;
    
    /** Error state */
    error: string | null;
    
    /** Manual refresh function */
    refetch: () => Promise<void>;
    
    /** Last data update timestamp */
    lastUpdated: Date;
    
    /** Indicates if data needs refresh */
    isStale: boolean;
}