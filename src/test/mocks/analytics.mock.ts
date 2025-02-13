// External imports
import { jest } from '@jest/globals';

// Internal imports
import { 
    MetricType, 
    TimeGranularity, 
    IMetric, 
    IAnalytics,
    IPerformanceReport,
    IForecast 
} from '../../../backend/shared/types/analytics.types';
import { 
    createMetricFixture,
    createMetricsBatchFixture,
    createTimeSeriesMetricsFixture 
} from '../fixtures/analytics.fixture';

/**
 * Mock storage for analytics data during tests
 */
const mockMetricsStore: Map<string, IMetric[]> = new Map();
const mockLatencyRange = { min: 20, max: 200 };
const mockErrorRate = 0.05;

/**
 * Simulates network latency for realistic testing
 */
const simulateLatency = async (): Promise<void> => {
    const latency = Math.random() * (mockLatencyRange.max - mockLatencyRange.min) + mockLatencyRange.min;
    await new Promise(resolve => setTimeout(resolve, latency));
};

/**
 * Simulates random errors based on configured error rate
 */
const simulateRandomError = (): void => {
    if (Math.random() < mockErrorRate) {
        throw new Error('Simulated analytics service error');
    }
};

/**
 * Enhanced mock implementation of analytics tracking functionality
 */
export const mockTrackMetrics = jest.fn(async (
    metrics: IMetric[],
    campaignId: string
): Promise<void> => {
    // Input validation
    if (!metrics?.length) {
        throw new Error('Metrics array cannot be empty');
    }
    if (!campaignId?.trim()) {
        throw new Error('Campaign ID is required');
    }

    await simulateLatency();
    simulateRandomError();

    // Store metrics with timestamp
    const existingMetrics = mockMetricsStore.get(campaignId) || [];
    mockMetricsStore.set(campaignId, [
        ...existingMetrics,
        ...metrics.map(metric => ({
            ...metric,
            timestamp: metric.timestamp || new Date()
        }))
    ]);
});

/**
 * Enhanced mock implementation of performance report generation
 */
export const mockGetPerformanceReport = jest.fn(async (
    campaignId: string,
    startDate: Date,
    endDate: Date,
    granularity: TimeGranularity
): Promise<IPerformanceReport> => {
    // Input validation
    if (!campaignId?.trim()) throw new Error('Campaign ID is required');
    if (!startDate || !endDate) throw new Error('Date range is required');
    if (startDate > endDate) throw new Error('Invalid date range');

    await simulateLatency();
    simulateRandomError();

    // Generate correlated metrics
    const metrics = createMetricsBatchFixture(10, Object.values(MetricType));
    const trends = Object.values(MetricType).reduce((acc, type) => ({
        ...acc,
        [type]: Math.random() * 2 - 1 // Random trend between -1 and 1
    }), {});

    return {
        campaignId,
        metrics: metrics.reduce((acc, metric) => ({
            ...acc,
            [metric.type]: metric.value
        }), {}),
        trends,
        recommendations: [
            'Increase budget allocation for better performing ad groups',
            'Optimize targeting parameters based on conversion data',
            'Update ad creatives to improve CTR'
        ]
    };
});

/**
 * Enhanced mock implementation of performance forecasting
 */
export const mockGetForecast = jest.fn(async (
    campaignId: string,
    targetDate: Date
): Promise<IForecast> => {
    // Input validation
    if (!campaignId?.trim()) throw new Error('Campaign ID is required');
    if (!targetDate) throw new Error('Target date is required');
    if (targetDate < new Date()) throw new Error('Target date must be in the future');

    await simulateLatency();
    simulateRandomError();

    // Generate ML-simulated predictions
    const predictions = Object.values(MetricType).reduce((acc, type) => {
        const baseMetric = createMetricFixture(type);
        const growthFactor = 1 + (Math.random() * 0.5); // 0-50% growth
        return {
            ...acc,
            [type]: baseMetric.value * growthFactor
        };
    }, {});

    return {
        campaignId,
        predictions,
        confidence: 0.7 + (Math.random() * 0.3), // 70-100% confidence
        forecastDate: new Date()
    };
});

/**
 * Enhanced mock implementation of real-time metrics retrieval
 */
export const mockGetRealtimeMetrics = jest.fn(async (
    campaignId: string
): Promise<Record<MetricType, number>> => {
    // Input validation
    if (!campaignId?.trim()) throw new Error('Campaign ID is required');

    await simulateLatency();
    simulateRandomError();

    // Generate real-time metrics with time-of-day patterns
    const hour = new Date().getHours();
    const timeMultiplier = hour >= 9 && hour <= 17 ? 1.5 : 0.8; // Business hours boost

    return Object.values(MetricType).reduce((acc, type) => {
        const baseMetric = createMetricFixture(type);
        return {
            ...acc,
            [type]: baseMetric.value * timeMultiplier
        };
    }, {} as Record<MetricType, number>);
});

/**
 * Mock analytics service implementation
 */
export const mockAnalyticsService = {
    trackMetrics: mockTrackMetrics,
    getPerformanceReport: mockGetPerformanceReport,
    getForecast: mockGetForecast,
    getRealtimeMetrics: mockGetRealtimeMetrics
};

/**
 * Mock metrics model implementation
 */
export const mockMetricsModel = {
    create: jest.fn(async (metrics: IMetric[]) => {
        return { id: 'mock-metrics-id', metrics };
    }),

    findByCampaignId: jest.fn(async (campaignId: string) => {
        return mockMetricsStore.get(campaignId) || [];
    }),

    aggregateByType: jest.fn(async (
        campaignId: string,
        type: MetricType,
        startDate: Date,
        endDate: Date
    ) => {
        const metrics = mockMetricsStore.get(campaignId) || [];
        return metrics
            .filter(m => m.type === type && m.timestamp >= startDate && m.timestamp <= endDate)
            .reduce((sum, m) => sum + m.value, 0);
    })
};