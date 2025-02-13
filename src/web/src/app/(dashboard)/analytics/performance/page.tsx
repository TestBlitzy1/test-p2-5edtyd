'use client';

import React, { useMemo, useCallback } from 'react';
import clsx from 'clsx';
import PerformanceChart from '@/components/analytics/PerformanceChart';
import CampaignMetrics from '@/components/analytics/CampaignMetrics';
import { useAnalytics } from '@/hooks/useAnalytics';
import { MetricType, TimeRange } from '@/types/analytics';

/**
 * Configuration for performance metrics display
 */
const PERFORMANCE_METRICS = [
  MetricType.IMPRESSIONS,
  MetricType.CLICKS,
  MetricType.CTR,
  MetricType.CONVERSIONS,
  MetricType.COST,
  MetricType.ROAS,
];

/**
 * Chart accessibility configuration
 */
const CHART_ACCESSIBILITY = {
  role: 'img',
  ariaLabel: 'Campaign Performance Chart',
  description: 'Visual representation of campaign performance metrics over time',
};

/**
 * Performance page component for displaying detailed campaign analytics
 */
const PerformancePage: React.FC = () => {
  // Initialize analytics hook with real-time updates
  const {
    data,
    loading,
    error,
    isStale,
    lastUpdated,
    refetch,
  } = useAnalytics('current-campaign', TimeRange.LAST_30_DAYS, {
    pollingInterval: 30000, // 30 seconds
    staleDuration: 60000, // 1 minute
  });

  /**
   * Memoized chart configuration
   */
  const chartConfig = useMemo(() => ({
    height: 400,
    showForecast: true,
    confidenceInterval: 0.95,
    performance: {
      progressiveLoading: true,
      sampleRate: 2,
      minPointDistance: 5,
    },
  }), []);

  /**
   * Memoized metrics display configuration
   */
  const metricsConfig = useMemo(() => ({
    showTrends: true,
    showConfidenceIntervals: true,
    formatConfig: {
      locale: 'en-US',
      currency: 'USD',
      precision: 2,
    },
  }), []);

  /**
   * Handle chart export
   */
  const handleChartExport = useCallback((data: any) => {
    console.log('Exporting chart:', data);
  }, []);

  /**
   * Handle error display
   */
  const handleError = useCallback((error: Error) => {
    console.error('Performance analytics error:', error);
  }, []);

  return (
    <div className="performance-analytics">
      <header className={clsx('performance-header', { 'stale-data': isStale })}>
        <h1>Campaign Performance Analytics</h1>
        <div className="header-actions">
          <button
            onClick={() => refetch()}
            className="refresh-button"
            aria-label="Refresh analytics data"
          >
            Refresh
          </button>
          {lastUpdated && (
            <span className="last-updated" role="status">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>

      <main className="performance-content">
        {error ? (
          <div className="error-message" role="alert">
            Error loading analytics: {error}
          </div>
        ) : (
          <>
            <section className="performance-charts" aria-label="Performance Charts">
              <PerformanceChart
                campaignId="current-campaign"
                metrics={PERFORMANCE_METRICS}
                timeRange={TimeRange.LAST_30_DAYS}
                className="main-chart"
                height={chartConfig.height}
                showForecast={chartConfig.showForecast}
                confidenceInterval={chartConfig.confidenceInterval}
                accessibility={CHART_ACCESSIBILITY}
                performance={chartConfig.performance}
                onExport={handleChartExport}
              />
            </section>

            <section className="performance-metrics" aria-label="Performance Metrics">
              <CampaignMetrics
                campaignId="current-campaign"
                className="metrics-grid"
                timeRange={TimeRange.LAST_30_DAYS}
                refreshInterval={30000}
                showTrends={metricsConfig.showTrends}
                displayConfig={metricsConfig}
                errorConfig={{
                  fallback: <div>Error loading metrics</div>,
                  onReset: refetch,
                }}
                onError={handleError}
              />
            </section>
          </>
        )}
      </main>

      {loading && (
        <div 
          className="loading-overlay" 
          role="progressbar" 
          aria-busy="true"
          aria-label="Loading analytics data"
        >
          Loading...
        </div>
      )}
    </div>
  );
};

export default PerformancePage;