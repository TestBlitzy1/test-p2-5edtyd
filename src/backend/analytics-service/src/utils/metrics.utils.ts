/**
 * @fileoverview Utility functions for campaign analytics metrics processing
 * Provides calculation, aggregation, and trend analysis capabilities
 * @version 1.0.0
 */

// External imports
import dayjs from 'dayjs';
import { mean, std, round } from 'mathjs';

// Internal imports
import { MetricType, TimeGranularity, IMetric } from '../../shared/types/analytics.types';
import { Logger } from '../../shared/utils/logger';
import { ANALYTICS_CONFIG } from '../../shared/constants';

// Initialize logger
const logger = new Logger('MetricsUtils');

/**
 * Calculates Click-Through Rate (CTR) from impressions and clicks
 * @param clicks - Number of clicks
 * @param impressions - Number of impressions
 * @returns Calculated CTR as a percentage
 */
export const calculateCTR = (clicks: number, impressions: number): number => {
    try {
        // Validate inputs
        if (clicks < 0 || impressions < 0) {
            throw new Error('Clicks and impressions must be non-negative');
        }

        // Handle division by zero
        if (impressions === 0) {
            return 0;
        }

        // Calculate and round CTR to configured precision
        const ctr = (clicks / impressions) * 100;
        return round(ctr, ANALYTICS_CONFIG.METRICS_PRECISION);
    } catch (error) {
        logger.error('Error calculating CTR', error as Error);
        throw error;
    }
};

/**
 * Calculates conversion rate from clicks and conversions
 * @param conversions - Number of conversions
 * @param clicks - Number of clicks
 * @returns Calculated conversion rate as a percentage
 */
export const calculateConversionRate = (conversions: number, clicks: number): number => {
    try {
        // Validate inputs
        if (conversions < 0 || clicks < 0) {
            throw new Error('Conversions and clicks must be non-negative');
        }

        // Handle division by zero
        if (clicks === 0) {
            return 0;
        }

        // Calculate and round conversion rate to configured precision
        const conversionRate = (conversions / clicks) * 100;
        return round(conversionRate, ANALYTICS_CONFIG.METRICS_PRECISION);
    } catch (error) {
        logger.error('Error calculating conversion rate', error as Error);
        throw error;
    }
};

/**
 * Aggregates metrics based on time granularity
 * @param metrics - Array of metrics to aggregate
 * @param granularity - Time granularity for aggregation
 * @returns Aggregated metrics grouped by time period
 */
export const aggregateMetrics = (
    metrics: IMetric[],
    granularity: TimeGranularity
): Record<string, IMetric[]> => {
    try {
        // Input validation
        if (!metrics || !Array.isArray(metrics)) {
            throw new Error('Invalid metrics array');
        }

        // Format timestamp based on granularity
        const getTimeKey = (timestamp: Date): string => {
            const date = dayjs(timestamp);
            switch (granularity) {
                case TimeGranularity.HOURLY:
                    return date.format('YYYY-MM-DD HH:00');
                case TimeGranularity.DAILY:
                    return date.format('YYYY-MM-DD');
                default:
                    throw new Error('Unsupported time granularity');
            }
        };

        // Group metrics by time period
        const groupedMetrics: Record<string, IMetric[]> = {};
        metrics.forEach(metric => {
            const timeKey = getTimeKey(metric.timestamp);
            if (!groupedMetrics[timeKey]) {
                groupedMetrics[timeKey] = [];
            }
            groupedMetrics[timeKey].push(metric);
        });

        // Aggregate metrics within each time period
        Object.keys(groupedMetrics).forEach(timeKey => {
            const periodMetrics = groupedMetrics[timeKey];
            const aggregated: Record<MetricType, number> = {};

            // Calculate sums for additive metrics
            periodMetrics.forEach(metric => {
                if ([MetricType.IMPRESSIONS, MetricType.CLICKS, MetricType.CONVERSIONS].includes(metric.type)) {
                    aggregated[metric.type] = (aggregated[metric.type] || 0) + metric.value;
                }
            });

            // Calculate derived metrics
            if (aggregated[MetricType.IMPRESSIONS] > 0) {
                aggregated[MetricType.CTR] = calculateCTR(
                    aggregated[MetricType.CLICKS],
                    aggregated[MetricType.IMPRESSIONS]
                );
            }

            // Update grouped metrics with aggregated values
            groupedMetrics[timeKey] = Object.entries(aggregated).map(([type, value]) => ({
                type: type as MetricType,
                value,
                timestamp: new Date(timeKey)
            }));
        });

        return groupedMetrics;
    } catch (error) {
        logger.error('Error aggregating metrics', error as Error);
        throw error;
    }
};

/**
 * Calculates trend percentages for metrics between two periods
 * @param currentPeriodMetrics - Current period metrics
 * @param previousPeriodMetrics - Previous period metrics for comparison
 * @returns Trend percentages by metric type
 */
export const calculateTrends = (
    currentPeriodMetrics: IMetric[],
    previousPeriodMetrics: IMetric[]
): Record<MetricType, number> => {
    try {
        // Initialize trends object
        const trends: Record<MetricType, number> = {} as Record<MetricType, number>;

        // Group metrics by type
        const groupMetricsByType = (metrics: IMetric[]): Record<MetricType, number[]> => {
            const grouped: Record<MetricType, number[]> = {};
            metrics.forEach(metric => {
                if (!grouped[metric.type]) {
                    grouped[metric.type] = [];
                }
                grouped[metric.type].push(metric.value);
            });
            return grouped;
        };

        const currentMetrics = groupMetricsByType(currentPeriodMetrics);
        const previousMetrics = groupMetricsByType(previousPeriodMetrics);

        // Calculate trends for each metric type
        Object.values(MetricType).forEach(metricType => {
            const currentAvg = currentMetrics[metricType]?.length > 0 
                ? mean(currentMetrics[metricType])
                : 0;
            const previousAvg = previousMetrics[metricType]?.length > 0
                ? mean(previousMetrics[metricType])
                : 0;

            // Calculate percentage change
            if (previousAvg === 0) {
                trends[metricType] = currentAvg > 0 ? 100 : 0;
            } else {
                trends[metricType] = round(
                    ((currentAvg - previousAvg) / previousAvg) * 100,
                    ANALYTICS_CONFIG.METRICS_PRECISION
                );
            }
        });

        return trends;
    } catch (error) {
        logger.error('Error calculating trends', error as Error);
        throw error;
    }
};