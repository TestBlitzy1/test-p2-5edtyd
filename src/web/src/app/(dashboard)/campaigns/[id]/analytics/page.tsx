'use client';

import React, { Suspense } from 'react';
import { notFound } from 'next/navigation';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import { useAnalytics } from '@/hooks/useAnalytics';
import { TimeRange } from '@/types/analytics';

/**
 * Metadata generation for campaign analytics page
 */
export async function generateMetadata({ params }: { params: { id: string } }) {
  try {
    return {
      title: `Campaign Analytics - ${params.id}`,
      description: 'Real-time campaign performance analytics and insights',
      openGraph: {
        title: `Campaign Analytics - ${params.id}`,
        description: 'Campaign performance metrics and optimization insights',
        type: 'website',
      },
      robots: {
        index: false,
        follow: true,
      },
    };
  } catch (error) {
    return {
      title: 'Campaign Analytics',
      description: 'Campaign performance analytics dashboard',
    };
  }
}

/**
 * Loading component for analytics dashboard
 */
const AnalyticsLoading = () => (
  <div className="min-h-screen p-6 bg-gray-50">
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4 mb-8" />
      <div className="grid gap-6 md:grid-cols-3 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-200 rounded" />
        ))}
      </div>
      <div className="h-96 bg-gray-200 rounded" />
    </div>
  </div>
);

/**
 * Campaign Analytics Page Component
 * Provides comprehensive real-time analytics and performance insights for a specific campaign
 */
const CampaignAnalyticsPage = ({ params }: { params: { id: string } }) => {
  // Initialize analytics hook with campaign data
  const { data, loading, error } = useAnalytics(params.id, TimeRange.LAST_30_DAYS, {
    pollingInterval: 30000, // 30 seconds refresh
    metrics: [
      'IMPRESSIONS',
      'CLICKS',
      'CTR',
      'CONVERSIONS',
      'CONVERSION_RATE',
      'COST',
      'CPC',
      'CPM',
      'ROAS',
      'ROI'
    ]
  });

  // Handle invalid campaign ID
  if (error?.code === 'CAMPAIGN_NOT_FOUND') {
    notFound();
  }

  // Error boundary fallback
  if (error) {
    return (
      <div className="min-h-screen p-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
            <h2 className="text-red-800 font-semibold mb-2">Error Loading Analytics</h2>
            <p className="text-red-600">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <Suspense fallback={<AnalyticsLoading />}>
          <AnalyticsDashboard
            campaignId={params.id}
            className="analytics-dashboard"
            timeRange={TimeRange.LAST_30_DAYS}
            refreshInterval={30000}
            onError={(error) => {
              console.error('Analytics Dashboard Error:', error);
            }}
            onDataUpdate={(data) => {
              // Handle real-time data updates
              if (data?.metrics?.length > 0) {
                // Trigger any necessary side effects or state updates
              }
            }}
          />
        </Suspense>
      </div>
    </div>
  );
};

export default CampaignAnalyticsPage;