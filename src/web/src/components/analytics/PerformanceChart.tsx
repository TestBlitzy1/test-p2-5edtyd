import React, { useMemo, useCallback } from 'react';
import classNames from 'classnames'; // ^2.3.0
import { Chart, ChartAccessibilityProps } from '../common/Chart';
import { useAnalytics } from '../../hooks/useAnalytics';
import { MetricType } from '../../types/analytics';

/**
 * Interface for chart performance configuration
 */
interface ChartPerformanceConfig {
  sampleRate?: number;
  progressiveLoading?: boolean;
  minPointDistance?: number;
  maxDataPoints?: number;
  debounceInterval?: number;
}

/**
 * Interface for chart export data
 */
interface ChartExportData {
  imageUrl: string;
  metrics: MetricType[];
  timeRange: string;
  campaignId: string;
}

/**
 * Props interface for PerformanceChart component
 */
interface IPerformanceChartProps {
  campaignId: string;
  metrics: MetricType[];
  timeRange: TimeRange;
  className?: string;
  height?: number;
  width?: number;
  showForecast?: boolean;
  confidenceInterval?: number;
  accessibility?: ChartAccessibilityProps;
  performance?: ChartPerformanceConfig;
  onExport?: (data: ChartExportData) => void;
}

/**
 * Formats and optimizes analytics data for Chart.js with support for forecasting
 */
const formatChartData = (
  data: IAnalyticsData,
  forecast: IForecastData,
  metrics: MetricType[],
  performance?: ChartPerformanceConfig
) => {
  if (!data?.metrics?.length) return null;

  // Apply performance optimizations
  const sampleRate = performance?.sampleRate || 1;
  const maxPoints = performance?.maxDataPoints || 1000;
  const minDistance = performance?.minPointDistance || 1;

  // Group and sort data points
  const sortedData = [...data.metrics].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Sample data based on configuration
  const sampledData = sortedData.filter((_, index) => index % sampleRate === 0);

  // Generate datasets for each metric
  const datasets = metrics.flatMap(metric => {
    const metricData = sampledData.filter(d => d.type === metric);
    const forecastData = forecast?.predictions?.[metric] || [];

    // Skip if no data available
    if (!metricData.length) return [];

    // Calculate confidence intervals if enabled
    const confidenceData = forecast?.confidenceIntervals?.[metric];
    const hasConfidence = confidenceData && Object.keys(confidenceData).length > 0;

    const baseDataset = {
      label: metric,
      data: metricData.map(d => d.value),
      borderColor: getMetricColor(metric),
      fill: false,
      tension: 0.4,
    };

    const datasets = [baseDataset];

    // Add forecast data if available
    if (forecastData.length && showForecast) {
      datasets.push({
        label: `${metric} (Forecast)`,
        data: forecastData.map(d => d.value),
        borderColor: getMetricColor(metric, true),
        borderDash: [5, 5],
        fill: false,
      });

      // Add confidence intervals if available
      if (hasConfidence) {
        datasets.push({
          label: `${metric} (Confidence)`,
          data: forecastData.map(d => d.confidence.upper),
          borderColor: getMetricColor(metric, true),
          backgroundColor: getMetricColor(metric, true, 0.1),
          fill: '+1',
        }, {
          label: `${metric} (Confidence)`,
          data: forecastData.map(d => d.confidence.lower),
          borderColor: getMetricColor(metric, true),
          backgroundColor: getMetricColor(metric, true, 0.1),
          fill: false,
        });
      }
    }

    return datasets;
  });

  return {
    labels: sampledData.map(d => formatDate(d.timestamp)),
    datasets,
  };
};

/**
 * Get color for metric visualization
 */
const getMetricColor = (metric: MetricType, isForecast: boolean = false, alpha: number = 1): string => {
  const colors = {
    [MetricType.IMPRESSIONS]: `rgba(59, 130, 246, ${alpha})`,
    [MetricType.CLICKS]: `rgba(16, 185, 129, ${alpha})`,
    [MetricType.CTR]: `rgba(245, 158, 11, ${alpha})`,
    [MetricType.CONVERSIONS]: `rgba(139, 92, 246, ${alpha})`,
    [MetricType.COST]: `rgba(239, 68, 68, ${alpha})`,
    [MetricType.ROAS]: `rgba(20, 184, 166, ${alpha})`,
  };

  const baseColor = colors[metric] || `rgba(107, 114, 128, ${alpha})`;
  return isForecast ? baseColor.replace(/[\d.]+\)$/, `${alpha * 0.7})`) : baseColor;
};

/**
 * Format date for chart labels
 */
const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
  });
};

/**
 * Enterprise-grade performance metrics visualization component with forecasting
 */
const PerformanceChart = React.memo(({
  campaignId,
  metrics,
  timeRange,
  className,
  height = 400,
  width = '100%',
  showForecast = false,
  confidenceInterval = 0.95,
  accessibility,
  performance,
  onExport,
}: IPerformanceChartProps) => {
  // Fetch analytics data with real-time updates
  const { data, loading, error } = useAnalytics(campaignId, timeRange);

  // Memoize chart data formatting
  const chartData = useMemo(() => {
    if (!data) return null;
    return formatChartData(data, data.forecastData, metrics, performance);
  }, [data, metrics, performance]);

  // Handle chart export
  const handleExport = useCallback((imageUrl: string) => {
    if (onExport) {
      onExport({
        imageUrl,
        metrics,
        timeRange,
        campaignId,
      });
    }
  }, [onExport, metrics, timeRange, campaignId]);

  // Configure chart options
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number) => {
            if (metrics.includes(MetricType.CTR) || metrics.includes(MetricType.ROAS)) {
              return `${value}%`;
            }
            return value;
          },
        },
      },
    },
    plugins: {
      tooltip: {
        enabled: true,
        mode: 'index',
      },
      legend: {
        position: 'top',
      },
    },
  }), [metrics]);

  if (error) {
    return (
      <div className="text-red-500">
        Error loading performance data: {error}
      </div>
    );
  }

  return (
    <div className={classNames('performance-chart', className)}>
      <Chart
        chartType="line"
        chartData={chartData || { labels: [], datasets: [] }}
        chartOptions={chartOptions}
        height={height}
        width={width}
        isLoading={loading}
        accessibility={accessibility}
        exportOptions={{
          fileName: `campaign-${campaignId}-performance`,
          format: 'png',
        }}
        onExport={handleExport}
        theme={{
          fontFamily: "'Inter', sans-serif",
          gridColor: 'rgba(0, 0, 0, 0.1)',
          textColor: 'rgba(0, 0, 0, 0.7)',
        }}
      />
    </div>
  );
});

PerformanceChart.displayName = 'PerformanceChart';

export default PerformanceChart;