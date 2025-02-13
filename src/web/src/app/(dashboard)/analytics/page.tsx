'use client';

import React, { useCallback } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Metadata } from 'next';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import { useAnalytics } from '@/hooks/useAnalytics';
import { TimeRange } from '@/types/analytics';

/**
 * Generate metadata for analytics page
 */
export const generateMetadata = (): Metadata => {
  return {
    title: 'Campaign Analytics | Sales Intelligence Platform',
    description: 'Real-time campaign performance analytics, ROI tracking, and budget optimization across LinkedIn Ads and Google Ads platforms.',
    openGraph: {
      title: 'Campaign Analytics Dashboard',
      description: 'Comprehensive campaign performance analytics and optimization insights',
      type: 'website',
    },
    robots: {
      index: true,
      follow: true,
    },
    viewport: 'width=device-width, initial-scale=1',
    themeColor: '#2563eb',
  };
};

/**
 * Analytics page component providing comprehensive campaign performance tracking
 * and optimization insights with real-time updates.
 */
const AnalyticsPage: React.FC = () => {
  // Initialize analytics hook with default time range
  const {
    data,
    loading,
    error,
    refetch,
  } = useAnalytics('all-campaigns', TimeRange.LAST_30_DAYS, {
    pollingInterval: 30000, // 30 seconds refresh
    metrics: [
      'IMPRESSIONS',
      'CLICKS',
      'CTR',
      'CONVERSIONS',
      'COST',
      'ROAS',
      'ROI'
    ]
  });

  /**
   * Error handler for analytics dashboard
   */
  const handleError = useCallback((error: Error) => {
    console.error('Analytics Dashboard Error:', error);
    // Implement error tracking/logging here
  }, []);

  /**
   * Error boundary fallback component
   */
  const ErrorFallback = useCallback(({ error, resetErrorBoundary }: any) => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-red-600 mb-4">
          Analytics Error
        </h2>
        <pre className="text-sm text-gray-600 mb-4 overflow-auto">
          {error.message}
        </pre>
        <button
          onClick={resetErrorBoundary}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Retry Loading Analytics
        </button>
      </div>
    </div>
  ), []);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={refetch}
    >
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Campaign Analytics
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Real-time performance tracking and optimization insights
            </p>
          </header>

          <div className="space-y-6">
            <AnalyticsDashboard
              campaignId="all-campaigns"
              className="analytics-dashboard"
              timeRange={TimeRange.LAST_30_DAYS}
              refreshInterval={30000}
              onError={handleError}
              onDataUpdate={(data) => {
                // Implement data update handler
                console.log('Analytics data updated:', data);
              }}
            />

            {loading && (
              <div
                className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg"
                role="status"
                aria-live="polite"
              >
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                  <span className="text-sm text-gray-600">
                    Updating analytics...
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div
                className="fixed bottom-4 right-4 bg-red-50 p-4 rounded-lg shadow-lg"
                role="alert"
              >
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-red-600">
                    Error updating analytics: {error}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </ErrorBoundary>
  );
};

export default AnalyticsPage;