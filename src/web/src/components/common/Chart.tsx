import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { Chart as ChartJS, registerables } from 'chart.js';
import { throttle } from 'lodash';
import classNames from 'classnames';
import { ErrorBoundary } from 'react-error-boundary';
import useResizeObserver from 'use-resize-observer';

import { MetricType } from '../../types/analytics';
import { formatCurrency, formatPercentage } from '../../lib/utils';

// Register Chart.js components
ChartJS.register(...registerables);

// Chart configuration constants
const CHART_ANIMATION_DURATION = 750;
const THROTTLE_INTERVAL = 250;
const DEFAULT_HEIGHT = 400;
const DEFAULT_WIDTH = '100%';
const CHART_FONT_FAMILY = "'Inter', sans-serif";

interface IChartProps {
  /** Type of chart to render (line, bar, pie, etc.) */
  chartType: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar';
  /** Chart data configuration */
  chartData: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      fill?: boolean;
    }>;
  };
  /** Chart.js options override */
  chartOptions?: any;
  /** Optional CSS class name */
  className?: string;
  /** Chart height in pixels */
  height?: number;
  /** Chart width in pixels or percentage */
  width?: number | string;
  /** Loading state indicator */
  isLoading?: boolean;
  /** Error fallback component */
  errorFallback?: React.ReactNode;
  /** Error callback handler */
  onError?: (error: Error) => void;
  /** Real-time update interval in milliseconds */
  updateInterval?: number;
  /** Update throttle interval in milliseconds */
  throttleInterval?: number;
  /** Enable/disable animations */
  enableAnimations?: boolean;
  /** Enable/disable user interactions */
  enableInteractions?: boolean;
  /** Chart export configuration */
  exportOptions?: {
    fileName?: string;
    backgroundColor?: string;
    format?: 'png' | 'jpeg' | 'pdf';
  };
  /** Theme configuration */
  theme?: {
    backgroundColor?: string;
    gridColor?: string;
    textColor?: string;
    fontFamily?: string;
  };
  /** Accessibility configuration */
  accessibility?: {
    ariaLabel?: string;
    role?: string;
    description?: string;
  };
}

/**
 * Enterprise-grade chart component for visualizing campaign analytics data
 * Supports multiple chart types, real-time updates, and accessibility features
 */
const Chart = React.memo(({
  chartType,
  chartData,
  chartOptions = {},
  className,
  height = DEFAULT_HEIGHT,
  width = DEFAULT_WIDTH,
  isLoading = false,
  errorFallback,
  onError,
  updateInterval,
  throttleInterval = THROTTLE_INTERVAL,
  enableAnimations = true,
  enableInteractions = true,
  exportOptions = {},
  theme = {},
  accessibility = {},
}: IChartProps) => {
  // Refs and state
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<ChartJS | null>(null);
  const { ref: containerRef, width: containerWidth } = useResizeObserver();

  // Memoized default chart options
  const defaultOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: enableAnimations ? CHART_ANIMATION_DURATION : 0,
    },
    interaction: {
      mode: 'index',
      intersect: false,
      enabled: enableInteractions,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            family: theme.fontFamily || CHART_FONT_FAMILY,
            color: theme.textColor,
          },
        },
      },
      tooltip: {
        enabled: enableInteractions,
        callbacks: {
          label: (context: any) => {
            const value = context.raw;
            const label = context.dataset.label || '';
            
            // Format values based on metric type
            if (label.includes('CTR') || label.includes('Rate')) {
              return `${label}: ${formatPercentage(value)}`;
            } else if (label.includes('Cost') || label.includes('Revenue')) {
              return `${label}: ${formatCurrency(value)}`;
            }
            return `${label}: ${value}`;
          },
        },
      },
    },
    scales: chartType !== 'pie' && chartType !== 'doughnut' ? {
      x: {
        grid: {
          color: theme.gridColor,
        },
        ticks: {
          font: {
            family: theme.fontFamily || CHART_FONT_FAMILY,
            color: theme.textColor,
          },
        },
      },
      y: {
        grid: {
          color: theme.gridColor,
        },
        ticks: {
          font: {
            family: theme.fontFamily || CHART_FONT_FAMILY,
            color: theme.textColor,
          },
        },
      },
    } : undefined,
  }), [theme, enableAnimations, enableInteractions]);

  // Chart rendering function
  const renderChart = useCallback(() => {
    if (!chartRef.current) return;

    // Destroy existing chart instance
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Create new chart instance
    chartInstance.current = new ChartJS(chartRef.current, {
      type: chartType,
      data: chartData,
      options: {
        ...defaultOptions,
        ...chartOptions,
      },
    });
  }, [chartType, chartData, chartOptions, defaultOptions]);

  // Throttled update function for real-time data
  const updateChart = useCallback(
    throttle((newData) => {
      if (!chartInstance.current) return;
      
      chartInstance.current.data = newData;
      chartInstance.current.update('none'); // Update without animation for performance
    }, throttleInterval),
    [throttleInterval]
  );

  // Export chart function
  const exportChart = useCallback(async () => {
    if (!chartInstance.current || !exportOptions.format) return;

    const canvas = chartRef.current;
    if (!canvas) return;

    try {
      // Set background color for export
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = exportOptions.backgroundColor || '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Generate image URL
      const imageUrl = canvas.toDataURL(`image/${exportOptions.format}`);
      
      // Create download link
      const link = document.createElement('a');
      link.download = `${exportOptions.fileName || 'chart'}.${exportOptions.format}`;
      link.href = imageUrl;
      link.click();
    } catch (error) {
      onError?.(error as Error);
    }
  }, [exportOptions, onError]);

  // Initial render effect
  useEffect(() => {
    try {
      renderChart();
    } catch (error) {
      onError?.(error as Error);
    }
  }, [renderChart, onError]);

  // Real-time update effect
  useEffect(() => {
    if (!updateInterval) return;

    const intervalId = setInterval(() => {
      updateChart(chartData);
    }, updateInterval);

    return () => clearInterval(intervalId);
  }, [updateInterval, chartData, updateChart]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, []);

  return (
    <ErrorBoundary
      fallback={errorFallback || <div>Chart error</div>}
      onError={onError}
    >
      <div
        ref={containerRef}
        className={classNames('chart-container', className)}
        style={{ height, width }}
      >
        {isLoading ? (
          <div className="chart-loading">Loading chart...</div>
        ) : (
          <canvas
            ref={chartRef}
            role={accessibility.role || 'img'}
            aria-label={accessibility.ariaLabel || 'Analytics Chart'}
            aria-description={accessibility.description}
          />
        )}
      </div>
    </ErrorBoundary>
  );
});

Chart.displayName = 'Chart';

export default Chart;