'use client';

import React, { useCallback, useEffect, useMemo, Suspense } from 'react';
import { useRouter } from 'next/router';
import { ErrorBoundary } from 'react-error-boundary';
import { Analytics } from '@vercel/analytics';
import { Card } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import AnalyticsDashboard from '../../components/analytics/AnalyticsDashboard';
import CampaignList from '../../components/campaigns/CampaignList';
import useAuth from '../../hooks/useAuth';
import { TimeRange } from '../../types/analytics';
import { PlatformType } from '../../types/platform';

/**
 * Error fallback component for the dashboard
 */
const DashboardErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="p-6 bg-red-50 rounded-lg">
    <h3 className="text-xl font-semibold text-red-800 mb-2">Dashboard Error</h3>
    <p className="text-red-600 mb-4">{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
    >
      Retry
    </button>
  </div>
);

/**
 * Loading fallback component for suspense boundaries
 */
const LoadingFallback = () => (
  <div className="p-6">
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/4"></div>
      <div className="h-64 bg-gray-200 rounded"></div>
      <div className="h-96 bg-gray-200 rounded"></div>
    </div>
  </div>
);

/**
 * Main dashboard page component with enhanced features for real-time updates,
 * role-based access, and performance optimization
 */
const DashboardPage = () => {
  const router = useRouter();
  const { user, hasPermission } = useAuth();

  // Verify authentication
  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
    }
  }, [user, router]);

  // Initialize analytics with default time range
  const { data: analyticsData, error: analyticsError } = useQuery(
    ['dashboardAnalytics'],
    () => fetch('/api/analytics/dashboard').then(res => res.json()),
    {
      staleTime: 30000, // Consider data stale after 30 seconds
      refetchInterval: 30000, // Refetch every 30 seconds
      suspense: true
    }
  );

  // Memoized campaign filters
  const campaignFilters = useMemo(() => ({
    platforms: [PlatformType.LINKEDIN, PlatformType.GOOGLE],
    timeRange: TimeRange.LAST_30_DAYS
  }), []);

  // Handle analytics error
  const handleAnalyticsError = useCallback((error: Error) => {
    console.error('Analytics Error:', error);
    // Implement error reporting service integration here
  }, []);

  // Handle campaign optimization
  const handleCampaignOptimize = useCallback((campaignId: string) => {
    if (!hasPermission('campaign:optimize')) {
      return;
    }
    // Implement campaign optimization logic
  }, [hasPermission]);

  if (!user) {
    return null;
  }

  return (
    <ErrorBoundary
      FallbackComponent={DashboardErrorFallback}
      onReset={() => window.location.reload()}
    >
      <div className="min-h-screen bg-gray-50 p-6">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">
            Welcome back, {user.email}
          </h1>
          <p className="text-gray-600 mt-2">
            Here's an overview of your campaign performance
          </p>
        </div>

        {/* Analytics Dashboard */}
        <Suspense fallback={<LoadingFallback />}>
          <Card className="mb-8 p-6">
            <AnalyticsDashboard
              campaignId="all"
              className="mb-8"
              timeRange={TimeRange.LAST_30_DAYS}
              refreshInterval={30000}
              onError={handleAnalyticsError}
            />
          </Card>
        </Suspense>

        {/* Campaign List */}
        <Suspense fallback={<LoadingFallback />}>
          <Card className="p-6">
            <CampaignList
              filterPlatform={campaignFilters.platforms[0]}
              enableRealTimeUpdates
              className="mt-8"
            />
          </Card>
        </Suspense>

        {/* Analytics Integration */}
        <Analytics />
      </div>
    </ErrorBoundary>
  );
};

export default DashboardPage;