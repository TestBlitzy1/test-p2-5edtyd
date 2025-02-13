import React, { memo, useMemo, useCallback } from 'react';
import clsx from 'clsx'; // ^2.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import Card from '../common/Card';
import useAnalytics from '../../hooks/useAnalytics';
import { MetricType, TimeRange, IMetric } from '../../types/analytics';
import { Size, Variant } from '../../types/common';

interface MetricDisplayConfig {
  showTrends: boolean;
  showConfidenceIntervals: boolean;
  virtualizeThreshold: number;
  formatConfig: {
    locale: string;
    currency: string;
    precision: number;
  };
}

interface ErrorHandlingConfig {
  fallback: React.ReactNode;
  onReset?: () => void;
  resetKeys?: any[];
}

interface CampaignMetricsProps {
  campaignId: string;
  className?: string;
  timeRange: TimeRange;
  refreshInterval?: number;
  showTrends?: boolean;
  displayConfig?: Partial<MetricDisplayConfig>;
  errorConfig?: ErrorHandlingConfig;
  onError?: (error: Error) => void;
}

const defaultDisplayConfig: MetricDisplayConfig = {
  showTrends: true,
  showConfidenceIntervals: true,
  virtualizeThreshold: 20,
  formatConfig: {
    locale: 'en-US',
    currency: 'USD',
    precision: 2,
  },
};

const CampaignMetrics: React.FC<CampaignMetricsProps> = memo(({
  campaignId,
  className,
  timeRange,
  refreshInterval = 30000,
  showTrends = true,
  displayConfig = {},
  errorConfig,
  onError,
}) => {
  // Merge display config with defaults
  const effectiveConfig = useMemo(() => ({
    ...defaultDisplayConfig,
    ...displayConfig,
  }), [displayConfig]);

  // Initialize analytics hook
  const {
    data,
    loading,
    error,
    isStale,
    refetch,
  } = useAnalytics(campaignId, timeRange, {
    pollingInterval: refreshInterval,
  });

  // Format metric value based on type
  const formatMetricValue = useCallback((type: MetricType, value: number): string => {
    const { locale, currency, precision } = effectiveConfig.formatConfig;
    
    switch (type) {
      case MetricType.CTR:
      case MetricType.CONVERSION_RATE:
      case MetricType.ROI:
        return `${(value * 100).toFixed(precision)}%`;
      
      case MetricType.COST:
      case MetricType.CPC:
      case MetricType.CPM:
      case MetricType.ROAS:
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          minimumFractionDigits: precision,
        }).format(value);
      
      default:
        return new Intl.NumberFormat(locale, {
          maximumFractionDigits: precision,
        }).format(value);
    }
  }, [effectiveConfig.formatConfig]);

  // Calculate trend indicator
  const getTrendIndicator = useCallback((metric: IMetric): JSX.Element => {
    const trend = data?.forecastData?.trends[metric.type] || 0;
    const trendClass = clsx('metric-trend', {
      'trend-up': trend > 0,
      'trend-down': trend < 0,
      'trend-neutral': trend === 0,
    });

    return (
      <span className={trendClass} aria-label={`Trend ${trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral'}`}>
        {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'}
      </span>
    );
  }, [data?.forecastData?.trends]);

  // Setup virtualization for large metric sets
  const parentRef = React.useRef<HTMLDivElement>(null);
  const metrics = data?.metrics || [];
  
  const rowVirtualizer = useVirtualizer({
    count: metrics.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  // Error handler
  const handleError = useCallback((error: Error) => {
    onError?.(error);
    console.error('Campaign metrics error:', error);
  }, [onError]);

  // Render loading skeleton
  if (loading) {
    return (
      <Card
        className={clsx('campaign-metrics', className)}
        title="Campaign Metrics"
        loading
        size={Size.LARGE}
        variant={Variant.PRIMARY}
      />
    );
  }

  return (
    <ErrorBoundary
      fallback={errorConfig?.fallback || <div>Error loading metrics</div>}
      onError={handleError}
      onReset={errorConfig?.onReset}
      resetKeys={errorConfig?.resetKeys}
    >
      <Card
        className={clsx('campaign-metrics', className, { 'stale-data': isStale })}
        title="Campaign Metrics"
        size={Size.LARGE}
        variant={Variant.PRIMARY}
        headerActions={
          <button
            onClick={() => refetch()}
            className="refresh-button"
            aria-label="Refresh metrics"
          >
            ↻
          </button>
        }
      >
        <div
          ref={parentRef}
          className="metrics-container"
          style={{
            height: '500px',
            overflow: 'auto',
          }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const metric = metrics[virtualRow.index];
              const confidenceInterval = data?.forecastData?.confidenceIntervals[metric.type];

              return (
                <div
                  key={`${metric.type}-${virtualRow.index}`}
                  className="metric-row"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="metric-content">
                    <h3 className="metric-title">{metric.type}</h3>
                    <div className="metric-value">
                      {formatMetricValue(metric.type, metric.value)}
                      {showTrends && getTrendIndicator(metric)}
                    </div>
                    {effectiveConfig.showConfidenceIntervals && confidenceInterval && (
                      <div className="confidence-interval" aria-label="Confidence interval">
                        {formatMetricValue(metric.type, confidenceInterval.lower)} - 
                        {formatMetricValue(metric.type, confidenceInterval.upper)}
                      </div>
                    )}
                    <div className="confidence-score">
                      Confidence: {(metric.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
      </Card>
    </ErrorBoundary>
  );
});

CampaignMetrics.displayName = 'CampaignMetrics';

export default CampaignMetrics;