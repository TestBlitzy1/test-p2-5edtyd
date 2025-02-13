'use client';

import React, { useEffect, useState } from 'react';
import { Metadata } from 'next';
import DashboardLayout from '@/components/layout/DashboardLayout';
import BudgetOverview from '@/components/analytics/BudgetOverview';
import { useAnalytics } from '@/hooks/useAnalytics';
import { TimeRange } from '@/types/analytics';

// Enhanced metadata for SEO optimization
export const metadata: Metadata = {
  title: 'Budget Analytics | LinkedIn Ads & Google Ads Campaign Management',
  description: 'Comprehensive budget analytics and optimization insights across LinkedIn Ads and Google Ads platforms with real-time spending tracking and recommendations.',
  openGraph: {
    title: 'Budget Analytics Dashboard',
    description: 'Real-time budget tracking and optimization for digital advertising campaigns',
    type: 'website',
    locale: 'en_US',
    siteName: 'Sales Intelligence Platform'
  }
};

/**
 * Budget Analytics page component providing comprehensive budget tracking
 * and optimization insights across advertising platforms.
 */
const BudgetPage: React.FC = () => {
  // State for time range selection
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>(TimeRange.LAST_30_DAYS);

  // Initialize analytics hook with real-time updates
  const {
    data: analyticsData,
    loading,
    error,
    refetch,
    isStale
  } = useAnalytics('all_campaigns', selectedTimeRange, {
    pollingInterval: 30000, // 30 seconds refresh
    metrics: [
      'COST',
      'CPC',
      'CPM',
      'ROAS'
    ]
  });

  // Effect for handling stale data
  useEffect(() => {
    if (isStale) {
      refetch();
    }
  }, [isStale, refetch]);

  // Effect for cleaning up polling on unmount
  useEffect(() => {
    return () => {
      // Cleanup polling interval
    };
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Budget Analytics
          </h1>
          
          {/* Time Range Selector */}
          <div className="flex items-center space-x-4">
            <label htmlFor="timeRange" className="text-sm font-medium text-gray-700">
              Time Range:
            </label>
            <select
              id="timeRange"
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value as TimeRange)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value={TimeRange.LAST_7_DAYS}>Last 7 Days</option>
              <option value={TimeRange.LAST_30_DAYS}>Last 30 Days</option>
              <option value={TimeRange.CUSTOM}>Custom Range</option>
            </select>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Error loading budget data
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  {error}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Budget Overview Component */}
        <BudgetOverview
          campaignId="all_campaigns"
          timeRange={selectedTimeRange}
          refreshInterval={30000}
          platformFilter={['LINKEDIN', 'GOOGLE']}
          currencyCode="USD"
          className="mt-6"
        />

        {/* Loading State */}
        {loading && !analyticsData && (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default BudgetPage;