import React, { useMemo, useCallback } from 'react';
import clsx from 'clsx'; // ^2.0.0
import Card from '../common/Card';
import Chart from '../common/Chart';
import { useAnalytics } from '../../hooks/useAnalytics';
import { MetricType } from '../../types/analytics';
import { formatCurrency, formatPercentage } from '../../lib/utils';
import { PlatformType } from '../../types/platform';

/**
 * Props interface for BudgetOverview component
 */
interface IBudgetOverviewProps {
  /** Campaign ID for budget analysis */
  campaignId: string;
  /** Optional CSS class name */
  className?: string;
  /** Time range for budget analysis */
  timeRange: TimeRange;
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
  /** Platform filter for multi-platform campaigns */
  platformFilter?: PlatformType[];
  /** Currency code for formatting */
  currencyCode?: string;
}

/**
 * BudgetOverview component for comprehensive campaign budget tracking and analysis
 * Provides real-time budget monitoring, forecasting, and platform-specific breakdowns
 */
const BudgetOverview: React.FC<IBudgetOverviewProps> = ({
  campaignId,
  className,
  timeRange,
  refreshInterval = 30000,
  platformFilter,
  currencyCode = 'USD'
}) => {
  // Initialize analytics hook with campaign data
  const { data: analyticsData, loading, error, isStale } = useAnalytics(
    campaignId,
    timeRange,
    {
      pollingInterval: refreshInterval,
      metrics: [
        MetricType.COST,
        MetricType.CPC,
        MetricType.CPM,
        MetricType.ROAS
      ]
    }
  );

  /**
   * Process and format budget metrics from analytics data
   */
  const budgetMetrics = useMemo(() => {
    if (!analyticsData) return null;

    const metrics = analyticsData.metrics;
    const costMetrics = metrics.filter(m => m.type === MetricType.COST);
    
    // Calculate total spend and budget utilization
    const totalSpend = costMetrics.reduce((sum, m) => sum + m.value, 0);
    const budgetLimit = analyticsData.campaign?.budget?.amount || 0;
    const utilization = (totalSpend / budgetLimit) * 100;

    // Calculate platform-specific breakdowns
    const platformBreakdown = costMetrics.reduce((acc, metric) => {
      if (metric.segment && (!platformFilter || platformFilter.includes(metric.segment as PlatformType))) {
        acc[metric.segment] = (acc[metric.segment] || 0) + metric.value;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSpend,
      budgetLimit,
      utilization,
      platformBreakdown,
      dailyAverage: totalSpend / costMetrics.length,
      projectedSpend: totalSpend * (1 + calculateTrend(costMetrics))
    };
  }, [analyticsData, platformFilter]);

  /**
   * Prepare chart data for spending trends
   */
  const chartData = useMemo(() => {
    if (!analyticsData?.metrics) return null;

    const costMetrics = analyticsData.metrics
      .filter(m => m.type === MetricType.COST)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      labels: costMetrics.map(m => new Date(m.timestamp).toLocaleDateString()),
      datasets: [{
        label: 'Daily Spend',
        data: costMetrics.map(m => m.value),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: true
      }]
    };
  }, [analyticsData]);

  /**
   * Handle chart tooltip formatting
   */
  const formatTooltip = useCallback((value: number) => {
    return formatCurrency(value, currencyCode);
  }, [currencyCode]);

  // Early return for loading state
  if (loading) {
    return (
      <Card
        title="Budget Overview"
        className={clsx('budget-overview', className)}
        loading
      />
    );
  }

  // Early return for error state
  if (error) {
    return (
      <Card
        title="Budget Overview"
        className={clsx('budget-overview', className)}
        variant="tertiary"
      >
        <div className="budget-overview__error">
          Failed to load budget data: {error}
        </div>
      </Card>
    );
  }

  // Early return if no budget metrics available
  if (!budgetMetrics || !chartData) {
    return (
      <Card
        title="Budget Overview"
        className={clsx('budget-overview', className)}
      >
        <div className="budget-overview__empty">
          No budget data available
        </div>
      </Card>
    );
  }

  return (
    <div className={clsx('budget-overview', className)}>
      {/* Summary Cards */}
      <div className="budget-overview__summary">
        <Card
          title="Total Spend"
          size="small"
          className="budget-overview__card"
        >
          <div className="budget-overview__metric">
            <span className="budget-overview__value">
              {formatCurrency(budgetMetrics.totalSpend, currencyCode)}
            </span>
            <span className="budget-overview__label">
              of {formatCurrency(budgetMetrics.budgetLimit, currencyCode)}
            </span>
          </div>
          <div className="budget-overview__utilization">
            {formatPercentage(budgetMetrics.utilization / 100)} utilized
          </div>
        </Card>

        <Card
          title="Daily Average"
          size="small"
          className="budget-overview__card"
        >
          <div className="budget-overview__metric">
            <span className="budget-overview__value">
              {formatCurrency(budgetMetrics.dailyAverage, currencyCode)}
            </span>
            <span className="budget-overview__label">per day</span>
          </div>
        </Card>

        <Card
          title="Projected Spend"
          size="small"
          className="budget-overview__card"
        >
          <div className="budget-overview__metric">
            <span className="budget-overview__value">
              {formatCurrency(budgetMetrics.projectedSpend, currencyCode)}
            </span>
            <span className="budget-overview__label">projected total</span>
          </div>
        </Card>
      </div>

      {/* Spending Trends Chart */}
      <Card
        title="Spending Trends"
        className="budget-overview__trends"
        headerActions={
          isStale && (
            <span className="budget-overview__stale-indicator">
              Data may be stale
            </span>
          )
        }
      >
        <Chart
          chartType="line"
          chartData={chartData}
          height={300}
          chartOptions={{
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: (value: number) => formatCurrency(value, currencyCode)
                }
              }
            },
            plugins: {
              tooltip: {
                callbacks: {
                  label: ({ raw }: { raw: number }) => formatTooltip(raw)
                }
              }
            }
          }}
        />
      </Card>

      {/* Platform Breakdown */}
      {Object.keys(budgetMetrics.platformBreakdown).length > 0 && (
        <Card
          title="Platform Breakdown"
          className="budget-overview__breakdown"
        >
          <div className="budget-overview__platforms">
            {Object.entries(budgetMetrics.platformBreakdown).map(([platform, spend]) => (
              <div key={platform} className="budget-overview__platform">
                <span className="budget-overview__platform-name">
                  {platform}
                </span>
                <span className="budget-overview__platform-spend">
                  {formatCurrency(spend, currencyCode)}
                </span>
                <span className="budget-overview__platform-percentage">
                  {formatPercentage(spend / budgetMetrics.totalSpend)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

/**
 * Calculate trend for cost metrics
 */
function calculateTrend(metrics: IMetric[]): number {
  if (metrics.length < 2) return 0;
  
  const recentMetrics = metrics.slice(-7); // Use last 7 data points
  const averageChange = recentMetrics.reduce((sum, metric, index) => {
    if (index === 0) return sum;
    return sum + (metric.value - recentMetrics[index - 1].value) / recentMetrics[index - 1].value;
  }, 0) / (recentMetrics.length - 1);

  return averageChange;
}

export default React.memo(BudgetOverview);