'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Tabs } from 'antd';
import { ErrorBoundary } from 'react-error-boundary';
import CampaignCard from '@/components/campaigns/CampaignCard';
import CampaignMetrics from '@/components/analytics/CampaignMetrics';
import { useCampaign } from '@/hooks/useCampaign';
import { TimeRange, MetricType } from '@/types/analytics';
import { CampaignStatus, ICampaign, ICampaignOptimization } from '@/types/campaign';
import { Size, Variant } from '@/types/common';

// Constants for configuration
const REFRESH_INTERVAL = 30000; // 30 seconds
const OPTIMIZATION_POLL_INTERVAL = 60000; // 1 minute

// Tab configuration
const TAB_ITEMS = [
  {
    key: 'overview',
    label: 'Overview',
    children: null,
  },
  {
    key: 'performance',
    label: 'Performance',
    children: null,
  },
  {
    key: 'targeting',
    label: 'Targeting',
    children: null,
  },
  {
    key: 'creatives',
    label: 'Creatives',
    children: null,
  },
  {
    key: 'settings',
    label: 'Settings',
    children: null,
  },
];

/**
 * Campaign details page component with real-time analytics and AI optimization
 */
const CampaignPage: React.FC = () => {
  // Get campaign ID from URL parameters
  const params = useParams();
  const campaignId = params.id as string;

  // Local state management
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [optimizationError, setOptimizationError] = useState<string | null>(null);

  // Campaign management hooks
  const {
    selectedCampaign,
    loading,
    error,
    optimizationStatus,
    updateCampaign,
    optimizeCampaign,
    getOptimizationRecommendations,
  } = useCampaign();

  // Fetch campaign data on mount
  useEffect(() => {
    if (campaignId) {
      updateCampaign(campaignId, {});
    }
  }, [campaignId, updateCampaign]);

  // Handle optimization application
  const handleOptimizationApply = useCallback(async (
    optimizationId: string,
    optimization: ICampaignOptimization
  ) => {
    try {
      setOptimizationError(null);
      
      if (!selectedCampaign) return;

      // Apply optimization to campaign
      const success = await optimizeCampaign(selectedCampaign.id);
      
      if (success) {
        // Refresh campaign data and recommendations
        await updateCampaign(selectedCampaign.id, {});
        await getOptimizationRecommendations(selectedCampaign.id);
      }
    } catch (err) {
      setOptimizationError('Failed to apply optimization. Please try again.');
      console.error('Optimization error:', err);
    }
  }, [selectedCampaign, optimizeCampaign, updateCampaign, getOptimizationRecommendations]);

  // Error fallback component
  const ErrorFallback = useCallback(({ error, resetErrorBoundary }) => (
    <div className="error-container" role="alert">
      <h2>Something went wrong:</h2>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  ), []);

  // Render loading state
  if (loading || !selectedCampaign) {
    return (
      <div className="campaign-page-loading">
        <div className="loading-spinner" />
        <p>Loading campaign details...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="campaign-page-error" role="alert">
        <h2>Error loading campaign</h2>
        <p>{error.message}</p>
        <button onClick={() => updateCampaign(campaignId, {})}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => updateCampaign(campaignId, {})}
    >
      <div className="campaign-page">
        {/* Campaign Overview Section */}
        <section className="campaign-overview">
          <CampaignCard
            campaign={selectedCampaign}
            showMetrics={false}
            onOptimize={() => optimizeCampaign(selectedCampaign.id)}
          />
        </section>

        {/* Campaign Performance Metrics */}
        <section className="campaign-metrics">
          <CampaignMetrics
            campaignId={selectedCampaign.id}
            timeRange={TimeRange.LAST_7_DAYS}
            refreshInterval={REFRESH_INTERVAL}
            showTrends={true}
            displayConfig={{
              showConfidenceIntervals: true,
              formatConfig: {
                locale: 'en-US',
                currency: selectedCampaign.budget.currency,
                precision: 2,
              },
            }}
            errorConfig={{
              fallback: <div>Error loading metrics</div>,
              onReset: () => updateCampaign(campaignId, {}),
            }}
          />
        </section>

        {/* AI Optimization Suggestions */}
        {selectedCampaign.status === CampaignStatus.ACTIVE && (
          <section className="campaign-optimizations">
            <h3>AI-Powered Optimization Suggestions</h3>
            {optimizationStatus?.[selectedCampaign.id]?.inProgress ? (
              <div className="optimization-progress">
                Analyzing campaign performance...
              </div>
            ) : (
              <div className="optimization-suggestions">
                {optimizationError && (
                  <div className="optimization-error" role="alert">
                    {optimizationError}
                  </div>
                )}
                {/* Optimization recommendations would be rendered here */}
              </div>
            )}
          </section>
        )}

        {/* Detailed Campaign Information Tabs */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={TAB_ITEMS}
          className="campaign-tabs"
        />
      </div>
    </ErrorBoundary>
  );
};

export default CampaignPage;