// Internal imports
import { IUser } from './auth.types';

/**
 * Comprehensive enumeration of supported analytics metric types
 * for campaign performance tracking across platforms
 */
export enum MetricType {
    IMPRESSIONS = 'IMPRESSIONS',   // Total ad impressions
    CLICKS = 'CLICKS',            // Total ad clicks
    CTR = 'CTR',                 // Click-through rate
    CONVERSIONS = 'CONVERSIONS',  // Total conversions
    COST = 'COST',               // Total spend
    CPC = 'CPC',                 // Cost per click
    CPM = 'CPM',                 // Cost per thousand impressions
    ROAS = 'ROAS'               // Return on ad spend
}

/**
 * Time interval options for analytics data aggregation
 * and analysis granularity control
 */
export enum TimeGranularity {
    HOURLY = 'HOURLY',     // Hour-by-hour analysis
    DAILY = 'DAILY',       // Day-by-day analysis
    WEEKLY = 'WEEKLY',     // Week-by-week analysis
    MONTHLY = 'MONTHLY'    // Month-by-month analysis
}

/**
 * Structure for individual metric measurements with
 * type classification, numeric value, and timestamp
 */
export interface IMetric {
    type: MetricType;      // Type of metric being measured
    value: number;         // Numeric measurement value
    timestamp: Date;       // Measurement timestamp
}

/**
 * Comprehensive analytics data collection structure
 * with time range and granularity support
 */
export interface IAnalytics {
    id: string;                   // Unique analytics record identifier
    campaignId: string;           // Associated campaign identifier
    userId: string;               // Owner user identifier
    metrics: IMetric[];           // Collection of metric measurements
    startDate: Date;              // Analysis period start
    endDate: Date;                // Analysis period end
    granularity: TimeGranularity; // Time interval granularity
}

/**
 * Campaign performance report structure with metrics,
 * trends, and AI-driven recommendations
 */
export interface IPerformanceReport {
    campaignId: string;                       // Target campaign identifier
    metrics: Record<MetricType, number>;      // Current metric values
    trends: Record<MetricType, number>;       // Metric trend indicators
    recommendations: string[];                // AI-generated optimization suggestions
}

/**
 * Performance forecast structure with predictions,
 * confidence scoring, and forecast date
 */
export interface IForecast {
    campaignId: string;                       // Target campaign identifier
    predictions: Record<MetricType, number>;  // Predicted metric values
    confidence: number;                       // Forecast confidence score (0-1)
    forecastDate: Date;                       // Forecast generation timestamp
}