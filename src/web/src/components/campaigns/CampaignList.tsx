import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/router'; // ^14.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import CampaignCard from './CampaignCard';
import { useCampaign } from '../../hooks/useCampaign';
import { ICampaign, CampaignStatus, PlatformType } from '../../types/campaign';
import { Size } from '../../types/common';

/**
 * Sort options for campaign list
 */
enum SortOption {
  NAME_ASC = 'NAME_ASC',
  NAME_DESC = 'NAME_DESC',
  DATE_ASC = 'DATE_ASC',
  DATE_DESC = 'DATE_DESC',
  PERFORMANCE_ASC = 'PERFORMANCE_ASC',
  PERFORMANCE_DESC = 'PERFORMANCE_DESC'
}

/**
 * Props interface for CampaignList component
 */
interface CampaignListProps {
  filterPlatform?: PlatformType;
  filterStatus?: CampaignStatus;
  sortBy?: SortOption;
  enableRealTimeUpdates?: boolean;
  className?: string;
}

/**
 * Error fallback component for campaign list errors
 */
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <div className="p-4 bg-red-50 rounded-lg">
    <h3 className="text-red-800 font-semibold mb-2">Error loading campaigns</h3>
    <p className="text-red-600 mb-4">{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className="btn btn-error btn-sm"
    >
      Try Again
    </button>
  </div>
);

/**
 * Campaign list component with virtualization and real-time updates
 */
const CampaignList: React.FC<CampaignListProps> = memo(({
  filterPlatform,
  filterStatus,
  sortBy = SortOption.DATE_DESC,
  enableRealTimeUpdates = true,
  className
}) => {
  const router = useRouter();
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Campaign management hooks
  const {
    campaigns,
    loading,
    error,
    optimizationStatus,
    updateCampaign,
    optimizeCampaign
  } = useCampaign();

  // Filter and sort campaigns
  const filteredCampaigns = useMemo(() => {
    let result = [...campaigns];

    // Apply platform filter
    if (filterPlatform) {
      result = result.filter(campaign => campaign.platform === filterPlatform);
    }

    // Apply status filter
    if (filterStatus) {
      result = result.filter(campaign => campaign.status === filterStatus);
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case SortOption.NAME_ASC:
          return a.name.localeCompare(b.name);
        case SortOption.NAME_DESC:
          return b.name.localeCompare(a.name);
        case SortOption.DATE_ASC:
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case SortOption.DATE_DESC:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case SortOption.PERFORMANCE_ASC:
          return (a.metrics?.roas || 0) - (b.metrics?.roas || 0);
        case SortOption.PERFORMANCE_DESC:
          return (b.metrics?.roas || 0) - (a.metrics?.roas || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [campaigns, filterPlatform, filterStatus, sortBy]);

  // Virtual list configuration
  const virtualizer = useVirtualizer({
    count: filteredCampaigns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Estimated card height
    overscan: 5
  });

  // Campaign action handlers
  const handleView = useCallback((campaignId: string) => {
    router.push(`/campaigns/${campaignId}`);
  }, [router]);

  const handleEdit = useCallback((campaignId: string) => {
    router.push(`/campaigns/${campaignId}/edit`);
  }, [router]);

  const handleOptimize = useCallback(async (campaignId: string) => {
    await optimizeCampaign(campaignId);
  }, [optimizeCampaign]);

  // Real-time updates subscription
  useEffect(() => {
    if (!enableRealTimeUpdates) return;

    const updateInterval = setInterval(() => {
      filteredCampaigns.forEach(campaign => {
        if (campaign.status === CampaignStatus.ACTIVE) {
          updateCampaign(campaign.id, {});
        }
      });
    }, 30000); // Update every 30 seconds

    return () => clearInterval(updateInterval);
  }, [enableRealTimeUpdates, filteredCampaigns, updateCampaign]);

  // Loading state
  if (loading && !campaigns.length) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="animate-pulse bg-gray-100 rounded-lg h-48"
          />
        ))}
      </div>
    );
  }

  // Empty state
  if (!loading && !filteredCampaigns.length) {
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          No campaigns found
        </h3>
        <p className="text-gray-500 mb-4">
          {filterPlatform || filterStatus
            ? "Try adjusting your filters"
            : "Create your first campaign to get started"}
        </p>
        <button
          onClick={() => router.push('/campaigns/new')}
          className="btn btn-primary"
        >
          Create Campaign
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      <div
        ref={parentRef}
        className={`h-[800px] overflow-auto ${className}`}
        data-testid="campaign-list"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const campaign = filteredCampaigns[virtualRow.index];
            return (
              <div
                key={campaign.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <CampaignCard
                  campaign={campaign}
                  loading={loading}
                  showMetrics={true}
                  onView={() => handleView(campaign.id)}
                  onEdit={() => handleEdit(campaign.id)}
                  onOptimize={() => handleOptimize(campaign.id)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </ErrorBoundary>
  );
});

CampaignList.displayName = 'CampaignList';

export default CampaignList;