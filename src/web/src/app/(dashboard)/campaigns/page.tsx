'use client';

import React, { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorBoundary } from 'react-error-boundary';

import CampaignList from '../../components/campaigns/CampaignList';
import Button from '../../components/common/Button';
import { useCampaign } from '../../hooks/useCampaign';
import { Size, Variant } from '../../types/common';

/**
 * Error fallback component for campaign page errors
 */
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <div className="p-8 bg-red-50 rounded-lg text-center">
    <h3 className="text-xl font-semibold text-red-800 mb-4">
      Error Loading Campaigns
    </h3>
    <p className="text-red-600 mb-6">{error.message}</p>
    <Button
      onClick={resetErrorBoundary}
      variant={Variant.SECONDARY}
      size={Size.MEDIUM}
      ariaLabel="Retry loading campaigns"
    >
      Try Again
    </Button>
  </div>
);

/**
 * Main campaigns dashboard page component
 * Displays a list of advertising campaigns across LinkedIn and Google Ads platforms
 */
const CampaignsPage: React.FC = React.memo(() => {
  const router = useRouter();
  const { loading, error, optimizationStatus } = useCampaign();

  /**
   * Handles navigation to campaign creation page
   */
  const handleCreateCampaign = useCallback(async () => {
    try {
      // Track campaign creation initiation
      if (window.gtag) {
        window.gtag('event', 'create_campaign_start', {
          event_category: 'campaigns',
          event_label: 'dashboard_create_button'
        });
      }
      
      router.push('/campaigns/new');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [router]);

  // Setup keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Alt + N to create new campaign
      if (event.altKey && event.key === 'n') {
        handleCreateCampaign();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleCreateCampaign]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      <div className="container mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Campaigns
            </h1>
            <p className="text-gray-600 mt-1">
              Manage your advertising campaigns across platforms
            </p>
          </div>
          
          <Button
            onClick={handleCreateCampaign}
            size={Size.MEDIUM}
            variant={Variant.PRIMARY}
            ariaLabel="Create new campaign"
            className="whitespace-nowrap"
          >
            Create Campaign
          </Button>
        </div>

        {/* Campaign List */}
        <div className="bg-white rounded-lg shadow">
          {loading ? (
            // Loading skeleton
            <div className="p-6 space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-48 bg-gray-100 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : (
            <CampaignList
              enableRealTimeUpdates={true}
              className="p-6"
            />
          )}
        </div>

        {/* Optimization Status Banner */}
        {Object.entries(optimizationStatus || {}).map(([campaignId, status]) => (
          status?.inProgress && (
            <div
              key={campaignId}
              className="fixed bottom-4 right-4 bg-blue-50 p-4 rounded-lg shadow-lg"
              role="status"
              aria-live="polite"
            >
              <p className="text-blue-700">
                Optimizing campaign...
              </p>
            </div>
          )
        ))}
      </div>
    </ErrorBoundary>
  );
});

CampaignsPage.displayName = 'CampaignsPage';

export default CampaignsPage;