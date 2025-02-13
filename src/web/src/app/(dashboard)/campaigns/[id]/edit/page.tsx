'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ErrorBoundary } from '@sentry/react';

import DashboardLayout from '../../components/layout/DashboardLayout';
import CampaignForm from '../../components/campaigns/CampaignForm';
import { useCampaign } from '../../hooks/useCampaign';
import { ICampaign, PlatformType } from '../../types/campaign';
import { useAnalytics } from '../../hooks/useAnalytics';
import { TimeRange } from '../../types/analytics';

// Performance monitoring constants
const PERFORMANCE_THRESHOLD_MS = 1500;
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Campaign edit page component with AI-assisted optimization
 */
const CampaignEditPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Campaign management hooks
  const {
    selectedCampaign,
    updateCampaign,
    optimizationStatus,
    getOptimizationRecommendations
  } = useCampaign();

  // Analytics hook for real-time performance tracking
  const analytics = useAnalytics('campaign_edit', TimeRange.LAST_7_DAYS, {
    pollingInterval: 30000, // 30 seconds
    enableRealtime: true
  });

  // Load campaign data with error handling
  useEffect(() => {
    const loadCampaign = async () => {
      try {
        if (!params.id) {
          throw new Error('Campaign ID is required');
        }

        setIsLoading(true);
        setError(null);

        // Track performance
        const startTime = performance.now();

        // Load campaign data and optimization recommendations
        await Promise.all([
          selectCampaign(params.id as string),
          getOptimizationRecommendations(params.id as string)
        ]);

        // Performance monitoring
        const loadTime = performance.now() - startTime;
        if (loadTime > PERFORMANCE_THRESHOLD_MS) {
          console.warn(`Slow campaign load detected: ${loadTime.toFixed(2)}ms`);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load campaign');
        console.error('Campaign load error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadCampaign();
  }, [params.id]);

  /**
   * Handle campaign update with validation and optimization
   */
  const handleCampaignUpdate = useCallback(async (campaignData: Partial<ICampaign>) => {
    if (!selectedCampaign?.id) return;

    try {
      // Apply platform-specific validation
      const platformValidation = validatePlatformSpecificRules(
        campaignData,
        selectedCampaign.platform
      );

      if (!platformValidation.isValid) {
        throw new Error(platformValidation.error);
      }

      // Track update performance
      const startTime = performance.now();

      // Update campaign with retry logic
      let retryCount = 0;
      let success = false;

      while (!success && retryCount < MAX_RETRY_ATTEMPTS) {
        try {
          await updateCampaign(selectedCampaign.id, campaignData);
          success = true;
        } catch (err) {
          retryCount++;
          if (retryCount === MAX_RETRY_ATTEMPTS) throw err;
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      // Performance monitoring
      const updateTime = performance.now() - startTime;
      if (updateTime > PERFORMANCE_THRESHOLD_MS) {
        console.warn(`Slow campaign update detected: ${updateTime.toFixed(2)}ms`);
      }

      // Refresh analytics
      analytics.refetch();

      // Navigate to campaign details
      router.push(`/campaigns/${selectedCampaign.id}`);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update campaign');
      console.error('Campaign update error:', err);
    }
  }, [selectedCampaign, updateCampaign, router, analytics]);

  /**
   * Platform-specific validation rules
   */
  const validatePlatformSpecificRules = (
    campaign: Partial<ICampaign>,
    platform: PlatformType
  ): { isValid: boolean; error?: string } => {
    switch (platform) {
      case PlatformType.LINKEDIN:
        return validateLinkedInCampaign(campaign);
      case PlatformType.GOOGLE:
        return validateGoogleCampaign(campaign);
      default:
        return { isValid: true };
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
        </div>
      </DashboardLayout>
    );
  }

  // Render error state
  if (error || !selectedCampaign) {
    return (
      <DashboardLayout>
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <h2 className="text-red-700 text-lg font-medium mb-2">Error</h2>
          <p className="text-red-600">{error || 'Campaign not found'}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <ErrorBoundary fallback={<div>Error loading campaign editor</div>}>
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">
              Edit Campaign: {selectedCampaign.name}
            </h1>
          </div>

          {/* AI Optimization Status */}
          {optimizationStatus && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h3 className="text-blue-700 font-medium mb-2">
                AI Optimization Status
              </h3>
              <p className="text-blue-600">
                Last optimized: {optimizationStatus.lastOptimized?.toLocaleString() || 'Never'}
              </p>
            </div>
          )}

          {/* Campaign Form */}
          <CampaignForm
            initialData={selectedCampaign}
            mode="edit"
            onSubmit={handleCampaignUpdate}
            platformType={selectedCampaign.platform}
          />
        </div>
      </DashboardLayout>
    </ErrorBoundary>
  );
};

export default CampaignEditPage;