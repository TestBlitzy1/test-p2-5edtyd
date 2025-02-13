import dayjs from 'dayjs';
import { Logger } from './logger';
import { validateAnalyticsQuery } from './validation';
import { MetricType, IMetric } from '../types/analytics.types';
import { ANALYTICS_CONFIG } from '../constants';

// Initialize logger
const logger = new Logger('MetricsUtil');

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

        // Calculate CTR and round to configured precision
        const ctr = (clicks / impressions) * 100;
        return Number(ctr.toFixed(ANALYTICS_CONFIG.METRICS_PRECISION));
    } catch (error) {
        logger.error('Error calculating CTR', error as Error);
        throw error;
    }
};

/**
 * Calculates Cost Per Click (CPC) from total cost and clicks
 * @param cost - Total cost
 * @param clicks - Number of clicks
 * @returns Calculated CPC value
 */
export const calculateCPC = (cost: number, clicks: number): number => {
    try {
        // Validate inputs
        if (cost < 0 || clicks < 0) {
            throw new Error('Cost and clicks must be non-negative');
        }

        // Handle division by zero
        if (clicks === 0) {
            return 0;
        }

        // Calculate CPC and round to configured precision
        const cpc = cost / clicks;
        return Number(cpc.toFixed(ANALYTICS_CONFIG.METRICS_PRECISION));
    } catch (error) {
        logger.error('Error calculating CPC', error as Error);
        throw error;
    }
};

/**
 * Calculates Return on Ad Spend (ROAS) from revenue and cost
 * @param revenue - Total revenue
 * @param cost - Total cost
 * @returns Calculated ROAS ratio
 */
export const calculateROAS = (revenue: number, cost: number): number => {
    try {
        // Validate inputs
        if (revenue < 0 || cost < 0) {
            throw new Error('Revenue and cost must be non-negative');
        }

        // Handle division by zero
        if (cost === 0) {
            return 0;
        }

        // Calculate ROAS and round to configured precision
        const roas = revenue / cost;
        return Number(roas.toFixed(ANALYTICS_CONFIG.METRICS_PRECISION));
    } catch (error) {
        logger.error('Error calculating ROAS', error as Error);
        throw error;
    }
};

/**
 * Aggregates metrics with support for real-time processing and platform-specific calculations
 * @param metrics - Array of metrics to aggregate
 * @param metricType - Type of metric to aggregate
 * @param startDate - Start date for aggregation period
 * @param endDate - End date for aggregation period
 * @returns Aggregated metric value
 */
export const aggregateMetrics = (
    metrics: IMetric[],
    metricType: MetricType,
    startDate: Date,
    endDate: Date
): number => {
    try {
        // Validate query parameters
        validateAnalyticsQuery({ startDate, endDate, metricType });

        // Filter metrics by type and date range
        const filteredMetrics = metrics.filter(metric => {
            const timestamp = dayjs(metric.timestamp);
            return metric.type === metricType &&
                timestamp.isAfter(startDate) &&
                timestamp.isBefore(endDate);
        });

        if (filteredMetrics.length === 0) {
            return 0;
        }

        // Apply appropriate aggregation strategy based on metric type
        switch (metricType) {
            case MetricType.IMPRESSIONS:
            case MetricType.CLICKS:
            case MetricType.CONVERSIONS:
            case MetricType.COST:
                // Sum-based metrics
                return filteredMetrics.reduce((sum, metric) => sum + metric.value, 0);

            case MetricType.CTR:
            case MetricType.CPC:
            case MetricType.CPM:
            case MetricType.ROAS:
                // Average-based metrics
                const sum = filteredMetrics.reduce((acc, metric) => acc + metric.value, 0);
                return Number((sum / filteredMetrics.length).toFixed(ANALYTICS_CONFIG.METRICS_PRECISION));

            default:
                throw new Error(`Unsupported metric type: ${metricType}`);
        }
    } catch (error) {
        logger.error('Error aggregating metrics', error as Error);
        throw error;
    }
};

/**
 * Formats metric values with appropriate units and precision
 * @param value - Metric value to format
 * @param metricType - Type of metric being formatted
 * @returns Formatted metric value with units
 */
export const formatMetricValue = (value: number, metricType: MetricType): string => {
    try {
        // Round value to configured precision
        const roundedValue = Number(value.toFixed(ANALYTICS_CONFIG.METRICS_PRECISION));

        // Apply metric-specific formatting
        switch (metricType) {
            case MetricType.CTR:
                return `${roundedValue}%`;

            case MetricType.COST:
            case MetricType.CPC:
            case MetricType.CPM:
                return `$${roundedValue}`;

            case MetricType.ROAS:
                return `${roundedValue}x`;

            case MetricType.IMPRESSIONS:
            case MetricType.CLICKS:
            case MetricType.CONVERSIONS:
                return roundedValue.toLocaleString();

            default:
                return roundedValue.toString();
        }
    } catch (error) {
        logger.error('Error formatting metric value', error as Error);
        throw error;
    }
};