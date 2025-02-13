// External imports
import { faker } from '@faker-js/faker';

// Internal imports
import { MetricType, IMetric } from '../../../backend/shared/types/analytics.types';
import { TEST_CAMPAIGN_ID } from '../utils/test.constants';

/**
 * Default value ranges for each metric type based on industry standards
 * and realistic campaign performance patterns
 */
export const DEFAULT_METRIC_RANGES = {
    [MetricType.IMPRESSIONS]: { min: 1000, max: 1000000 },
    [MetricType.CLICKS]: { min: 10, max: 50000 },
    [MetricType.CTR]: { min: 0.1, max: 10.0 },
    [MetricType.CONVERSIONS]: { min: 1, max: 1000 },
    [MetricType.COST]: { min: 100, max: 10000 },
    [MetricType.ROAS]: { min: 0.5, max: 20.0 }
} as const;

/**
 * Creates a single metric fixture with realistic values and proper validation
 * @param type - Type of metric to generate
 * @param overrides - Optional override values for the metric
 * @returns Generated metric fixture
 */
export function createMetricFixture(
    type: MetricType,
    overrides: Partial<IMetric> = {}
): IMetric {
    // Validate metric type
    if (!Object.values(MetricType).includes(type)) {
        throw new Error(`Invalid metric type: ${type}`);
    }

    // Generate base value within realistic range
    const range = DEFAULT_METRIC_RANGES[type];
    let value = faker.number.float({
        min: range.min,
        max: range.max,
        precision: type === MetricType.CTR || type === MetricType.ROAS ? 0.01 : 1
    });

    // Create metric object with current timestamp
    const metric: IMetric = {
        type,
        value,
        timestamp: new Date(),
        ...overrides
    };

    // Validate final value is within bounds
    if (metric.value < range.min || metric.value > range.max) {
        throw new Error(`Value ${metric.value} out of range for metric type ${type}`);
    }

    return metric;
}

/**
 * Creates a batch of correlated metrics with realistic relationships
 * @param count - Number of metrics to generate
 * @param types - Array of metric types to include
 * @returns Array of correlated metrics
 */
export function createMetricsBatchFixture(
    count: number,
    types: MetricType[]
): IMetric[] {
    if (count < 1) throw new Error('Count must be positive');
    if (!types.length) throw new Error('At least one metric type required');

    const metrics: IMetric[] = [];
    const baseTimestamp = new Date();

    for (let i = 0; i < count; i++) {
        const batchMetrics: IMetric[] = [];

        // Generate base metrics
        const impressions = createMetricFixture(MetricType.IMPRESSIONS, {
            timestamp: new Date(baseTimestamp.getTime() + i * 3600000) // Hourly intervals
        });

        const clicks = createMetricFixture(MetricType.CLICKS, {
            value: impressions.value * (faker.number.float({ min: 0.001, max: 0.1 })),
            timestamp: impressions.timestamp
        });

        // Add requested metrics with correlations
        types.forEach(type => {
            switch (type) {
                case MetricType.IMPRESSIONS:
                    batchMetrics.push(impressions);
                    break;
                case MetricType.CLICKS:
                    batchMetrics.push(clicks);
                    break;
                case MetricType.CTR:
                    batchMetrics.push({
                        type: MetricType.CTR,
                        value: (clicks.value / impressions.value) * 100,
                        timestamp: impressions.timestamp
                    });
                    break;
                default:
                    batchMetrics.push(createMetricFixture(type, {
                        timestamp: impressions.timestamp
                    }));
            }
        });

        metrics.push(...batchMetrics);
    }

    return metrics;
}

/**
 * Creates time-series metrics with realistic trends and patterns
 * @param type - Metric type to generate
 * @param days - Number of days of data to generate
 * @returns Array of time-series metrics
 */
export function createTimeSeriesMetricsFixture(
    type: MetricType,
    days: number
): IMetric[] {
    if (days < 1) throw new Error('Days must be positive');

    const metrics: IMetric[] = [];
    const baseValue = faker.number.float({
        min: DEFAULT_METRIC_RANGES[type].min,
        max: DEFAULT_METRIC_RANGES[type].max / 2 // Allow room for growth
    });

    // Generate trend pattern
    const trendType = faker.helpers.arrayElement(['linear', 'exponential', 'seasonal']);
    const trendStrength = faker.number.float({ min: 0.1, max: 0.3 });

    for (let i = 0; i < days; i++) {
        const timestamp = new Date();
        timestamp.setDate(timestamp.getDate() - (days - i - 1));
        timestamp.setHours(0, 0, 0, 0);

        // Calculate trend value
        let trendValue = baseValue;
        switch (trendType) {
            case 'linear':
                trendValue += baseValue * (i / days) * trendStrength;
                break;
            case 'exponential':
                trendValue *= (1 + trendStrength) ** (i / days);
                break;
            case 'seasonal':
                // Add weekly seasonality
                const weekday = timestamp.getDay();
                const weekdayFactor = weekday >= 1 && weekday <= 5 ? 1.2 : 0.8;
                trendValue *= weekdayFactor;
                break;
        }

        // Add random noise
        const noise = faker.number.float({ min: -0.1, max: 0.1 }) * trendValue;
        trendValue += noise;

        // Ensure value stays within bounds
        trendValue = Math.max(
            DEFAULT_METRIC_RANGES[type].min,
            Math.min(DEFAULT_METRIC_RANGES[type].max, trendValue)
        );

        metrics.push({
            type,
            value: trendValue,
            timestamp
        });
    }

    return metrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}