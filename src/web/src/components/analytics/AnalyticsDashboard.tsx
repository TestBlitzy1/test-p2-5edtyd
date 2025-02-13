import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ErrorBoundary } from 'react-error-boundary';
import PerformanceChart from './PerformanceChart';
import ROICalculator from './ROICalculator';
import BudgetOverview from './BudgetOverview';
import CampaignMetrics from './CampaignMetrics';
import { useAnalytics } from '../../hooks/useAnalytics';
import { MetricType, TimeRange } from '../../types/analytics';
import { PlatformType } from '../../types/platform';

/**
 * Props interface for Analytics Dashboard component
 */
interface IAnalyticsDashboardProps {
  /** Campaign ID for analytics tracking */
  campaignId: string;
  /** Optional CSS class name */
  className?: string;
  /** Time range for data analysis */
  timeRange: TimeRange;
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
  /** Error handler callback */
  onError?: (error: Error) => void;
  /** Data update callback */
  onDataUpdate?: (data: any) => void;
}

/**
 * Analytics Dashboard component that provides a comprehensive view of campaign performance
 * Integrates real-time metrics, ROI calculation, budget tracking, and performance visualization
 */
const AnalyticsDashboard: React.FC<IAnalyticsDashboardProps> = React.memo(({
  campaignId,
  className,
  timeRange,
  refreshInterval = 30000,
  onError,
  onDataUpdate
}) => {
  // Initialize analytics hook with campaign data
  const { data, loading, error, isStale, refetch } = useAnalytics(
    campaignId,
    timeRange,
    {
      pollingInterval: refreshInterval,
      metrics: [
        MetricType.IMPRESSIONS,
        MetricType.CLICKS,
        MetricType.CTR,
        MetricType.CONVERSIONS,
        MetricType.COST,
        MetricType.ROAS,
        MetricType.ROI
      ]
    }
  );

  // Track selected metrics for visualization
  const [selectedMetrics, setSelectedMetrics] = useState<MetricType[]>([
    MetricType.CTR,
    MetricType.CONVERSIONS,
    MetricType.ROAS
  ]);

  // Memoized performance metrics configuration
  const metricsConfig = useMemo(() => ({
    showTrends: true,
    showConfidenceIntervals: true,
    displayConfig: {
      formatConfig: {
        locale: 'en-US',
        currency: 'USD',
        precision: 2
      }
    }
  }), []);

  // Handle time range updates
  const handleTimeRangeChange = useCallback((newTimeRange: TimeRange) => {
    if (newTimeRange !== timeRange) {
      refetch();
    }
  }, [timeRange, refetch]);

  // Notify parent component of data updates
  useEffect(() => {
    if (data && !loading && !error) {
      onDataUpdate?.(data);
    }
  }, [data, loading, error, onDataUpdate]);

  // Error handler for error boundary
  const handleError = useCallback((error: Error) => {
    console.error('Analytics Dashboard Error:', error);
    onError?.(error);
  }, [onError]);

  // Error boundary fallback component
  const ErrorFallback = useCallback(({ error, resetErrorBoundary }: any) => (
    <div className="analytics-error" role="alert">
      <h2>Analytics Error</h2>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  ), []);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={refetch}
    >
      <div className={clsx(
        'analytics-dashboard',
        { 'is-loading': loading },
        { 'is-stale': isStale },
        className
      )}>
        {/* Performance Overview Section */}
        <section className="analytics-dashboard__performance">
          <PerformanceChart
            campaignId={campaignId}
            metrics={selectedMetrics}
            timeRange={timeRange}
            className="analytics-dashboard__chart"
            showForecast
            confidenceInterval={0.95}
            accessibility={{
              ariaLabel: 'Campaign performance chart',
              role: 'img'
            }}
            performance={{
              sampleRate: 1,
              progressiveLoading: true,
              minPointDistance: 5
            }}
          />
        </section>

        {/* Metrics and ROI Section */}
        <div className="analytics-dashboard__metrics-roi">
          <section className="analytics-dashboard__metrics">
            <CampaignMetrics
              campaignId={campaignId}
              timeRange={timeRange}
              refreshInterval={refreshInterval}
              showTrends
              displayConfig={metricsConfig.displayConfig}
              errorConfig={{
                fallback: <div>Failed to load metrics</div>,
                onReset: refetch
              }}
              onError={handleError}
            />
          </section>

          <section className="analytics-dashboard__roi">
            <ROICalculator
              campaignId={campaignId}
              className="analytics-dashboard__roi-calculator"
              currency="USD"
              locale="en-US"
            />
          </section>
        </div>

        {/* Budget Overview Section */}
        <section className="analytics-dashboard__budget">
          <BudgetOverview
            campaignId={campaignId}
            timeRange={timeRange}
            refreshInterval={refreshInterval}
            platformFilter={[PlatformType.LINKEDIN, PlatformType.GOOGLE]}
            currencyCode="USD"
            className="analytics-dashboard__budget-overview"
          />
        </section>

        {/* Data Freshness Indicator */}
        {isStale && (
          <div 
            className="analytics-dashboard__stale-indicator"
            role="alert"
            aria-live="polite"
          >
            Data may be stale. Last updated: {data?.lastUpdated?.toLocaleString()}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div 
            className="analytics-dashboard__error"
            role="alert"
          >
            Error loading analytics data: {error}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
});

AnalyticsDashboard.displayName = 'AnalyticsDashboard';

export default AnalyticsDashboard;