import React, { useState, useCallback, useEffect, useMemo } from 'react';
import classNames from 'classnames'; // ^2.3.2
import { Input } from '../common/Input';
import { useAnalytics } from '../../hooks/useAnalytics';
import { IAnalyticsData, MetricType, TimeRange } from '../../types/analytics';

// Constants for ROI calculation and validation
const MIN_COST = 0.01;
const MAX_COST = 1000000000;
const DEFAULT_LOCALE = 'en-US';
const DEFAULT_CURRENCY = 'USD';
const REFRESH_INTERVAL = 30000; // 30 seconds

interface ROICalculatorProps {
  campaignId: string;
  className?: string;
  initialRevenue?: number;
  initialCost?: number;
  locale?: string;
  currency?: string;
}

/**
 * Memoized ROI calculation function
 * @param revenue - Total revenue
 * @param cost - Total cost
 * @returns Calculated ROI percentage
 */
const calculateROI = (revenue: number, cost: number): number => {
  if (cost < MIN_COST) return 0;
  return Number((((revenue - cost) / cost) * 100).toFixed(2));
};

/**
 * Currency formatter with localization support
 * @param value - Numeric value to format
 * @param locale - Locale string
 * @param currency - Currency code
 * @returns Formatted currency string
 */
const formatCurrency = (
  value: number,
  locale: string = DEFAULT_LOCALE,
  currency: string = DEFAULT_CURRENCY
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

export const ROICalculator: React.FC<ROICalculatorProps> = ({
  campaignId,
  className,
  initialRevenue = 0,
  initialCost = 0,
  locale = DEFAULT_LOCALE,
  currency = DEFAULT_CURRENCY
}) => {
  // State management
  const [revenue, setRevenue] = useState<number>(initialRevenue);
  const [cost, setCost] = useState<number>(initialCost);
  const [revenueError, setRevenueError] = useState<string>('');
  const [costError, setCostError] = useState<string>('');

  // Analytics integration
  const { data: analyticsData, loading, error } = useAnalytics(
    campaignId,
    TimeRange.LAST_30_DAYS,
    { pollingInterval: REFRESH_INTERVAL }
  );

  // Memoized ROI calculation
  const roi = useMemo(() => calculateROI(revenue, cost), [revenue, cost]);

  // Input validation
  const validateNumber = useCallback((value: number, min: number, max: number): boolean => {
    return !isNaN(value) && value >= min && value <= max;
  }, []);

  // Revenue change handler
  const handleRevenueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (validateNumber(value, 0, MAX_COST)) {
      setRevenue(value);
      setRevenueError('');
    } else {
      setRevenueError('Please enter a valid revenue amount');
    }
  }, [validateNumber]);

  // Cost change handler
  const handleCostChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (validateNumber(value, MIN_COST, MAX_COST)) {
      setCost(value);
      setCostError('');
    } else {
      setCostError(`Cost must be between ${formatCurrency(MIN_COST)} and ${formatCurrency(MAX_COST)}`);
    }
  }, [validateNumber]);

  // Update from analytics data
  useEffect(() => {
    if (analyticsData?.metrics) {
      const costMetric = analyticsData.metrics.find(m => m.type === MetricType.COST);
      const roiMetric = analyticsData.metrics.find(m => m.type === MetricType.ROI);
      
      if (costMetric && roiMetric) {
        setCost(costMetric.value);
        setRevenue(costMetric.value * (1 + roiMetric.value / 100));
      }
    }
  }, [analyticsData]);

  return (
    <div className={classNames(
      'p-4 bg-white rounded-lg shadow-md',
      'border border-gray-200',
      className
    )}>
      <h2 className="text-xl font-semibold mb-4">ROI Calculator</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded" role="alert">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <Input
            name="revenue"
            type="number"
            value={revenue.toString()}
            onChange={handleRevenueChange}
            onBlur={handleRevenueChange}
            error={revenueError}
            placeholder="Enter revenue"
            min={0}
            max={MAX_COST}
            aria-label="Revenue"
            className="w-full"
            required
          />
          <span className="text-sm text-gray-500 mt-1">
            {formatCurrency(revenue, locale, currency)}
          </span>
        </div>

        <div>
          <Input
            name="cost"
            type="number"
            value={cost.toString()}
            onChange={handleCostChange}
            onBlur={handleCostChange}
            error={costError}
            placeholder="Enter cost"
            min={MIN_COST}
            max={MAX_COST}
            aria-label="Cost"
            className="w-full"
            required
          />
          <span className="text-sm text-gray-500 mt-1">
            {formatCurrency(cost, locale, currency)}
          </span>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="font-medium">ROI:</span>
            <span className={classNames(
              'text-xl font-bold',
              roi >= 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {roi}%
            </span>
          </div>
          
          {loading && (
            <div className="mt-2 text-sm text-gray-500">
              Updating calculations...
            </div>
          )}
        </div>
      </div>

      {analyticsData?.recommendations?.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium mb-2">Optimization Suggestions:</h3>
          <ul className="list-disc list-inside text-sm text-gray-600">
            {analyticsData.recommendations.map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ROICalculator;