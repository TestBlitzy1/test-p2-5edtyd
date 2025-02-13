import { z } from 'zod';
import { MetricType, TimeGranularity } from '../types/analytics.types';
import { validateAnalyticsQuery } from '../utils/validation';

/**
 * Custom validator for metric values ensuring they are non-negative and within reasonable bounds
 * @param value - Numeric value to validate
 * @param metricType - Type of metric being validated
 * @returns boolean indicating if value is valid for metric type
 */
const validateMetricValue = (value: number, metricType: MetricType): boolean => {
    // Base validation - non-negative
    if (value < 0) return false;

    // Metric-specific validation rules
    switch (metricType) {
        case MetricType.CTR:
            return value >= 0 && value <= 100; // CTR is percentage
        case MetricType.IMPRESSIONS:
        case MetricType.CLICKS:
        case MetricType.CONVERSIONS:
            return Number.isInteger(value); // Must be whole numbers
        case MetricType.COST:
        case MetricType.CPC:
        case MetricType.CPM:
            return value <= 1000000; // Reasonable cost ceiling
        case MetricType.ROAS:
            return value >= 0 && value <= 1000; // Reasonable ROAS range
        default:
            return true;
    }
};

/**
 * Schema for individual metric validation with enhanced value range checking
 */
export const metricSchema = z.object({
    type: z.nativeEnum(MetricType),
    value: z.number()
        .refine((val) => !isNaN(val), {
            message: "Metric value must be a valid number"
        })
        .refine((val, ctx) => validateMetricValue(val, ctx.parent.type), {
            message: "Metric value is outside acceptable range for metric type"
        }),
    timestamp: z.date()
        .refine((date) => date <= new Date(), {
            message: "Timestamp cannot be in the future"
        })
});

/**
 * Schema for analytics data collection validation with date range validation
 */
export const analyticsSchema = z.object({
    id: z.string().uuid(),
    campaignId: z.string().uuid(),
    userId: z.string().uuid(),
    metrics: z.array(metricSchema)
        .min(1, "At least one metric is required")
        .max(100, "Maximum of 100 metrics per analytics record"),
    startDate: z.date(),
    endDate: z.date(),
    granularity: z.nativeEnum(TimeGranularity)
}).refine((data) => data.startDate < data.endDate, {
    message: "End date must be after start date",
    path: ["endDate"]
}).refine((data) => {
    const timeDiff = data.endDate.getTime() - data.startDate.getTime();
    const daysDiff = timeDiff / (1000 * 3600 * 24);
    
    switch (data.granularity) {
        case TimeGranularity.HOURLY:
            return daysDiff <= 7; // Max 7 days for hourly data
        case TimeGranularity.DAILY:
            return daysDiff <= 90; // Max 90 days for daily data
        default:
            return true;
    }
}, {
    message: "Time range too large for selected granularity",
    path: ["granularity"]
});

/**
 * Schema for campaign performance report validation with trend analysis
 */
export const performanceReportSchema = z.object({
    campaignId: z.string().uuid(),
    metrics: z.record(z.nativeEnum(MetricType), z.number()
        .refine((val) => !isNaN(val), {
            message: "Metric value must be a valid number"
        })
    ),
    trends: z.record(z.nativeEnum(MetricType), z.number()
        .min(-100)
        .max(100)
        .refine((val) => !isNaN(val), {
            message: "Trend value must be a valid percentage"
        })
    ),
    recommendations: z.array(z.string())
        .min(1, "At least one recommendation is required")
        .max(10, "Maximum of 10 recommendations per report")
});

/**
 * Enhanced schema for performance forecast validation with confidence scoring
 */
export const forecastSchema = z.object({
    campaignId: z.string().uuid(),
    predictions: z.record(z.nativeEnum(MetricType), z.number()
        .refine((val) => !isNaN(val) && val >= 0, {
            message: "Prediction value must be a non-negative number"
        })
    ),
    confidence: z.number()
        .min(0)
        .max(1)
        .refine((val) => !isNaN(val), {
            message: "Confidence score must be between 0 and 1"
        }),
    forecastDate: z.date()
        .refine((date) => date > new Date(), {
            message: "Forecast date must be in the future"
        }),
    modelVersion: z.string()
        .regex(/^[0-9]+\.[0-9]+\.[0-9]+$/, {
            message: "Model version must follow semantic versioning"
        })
});