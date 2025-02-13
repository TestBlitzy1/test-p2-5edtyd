import React, { memo, useCallback, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import Card from '../common/Card';
import { ICampaign, CampaignStatus, PlatformType } from '../../types/campaign';
import { useCampaign } from '../../hooks/useCampaign';

/**
 * Props interface for the CampaignCard component
 */
interface CampaignCardProps {
  campaign: ICampaign;
  loading?: boolean;
  showMetrics?: boolean;
  onEdit?: () => void;
  onView?: () => void;
  onOptimize?: () => void;
}

/**
 * A reusable campaign card component that displays campaign information with
 * real-time metrics and platform-specific optimizations
 */
const CampaignCard: React.FC<CampaignCardProps> = memo(({
  campaign,
  loading = false,
  showMetrics = true,
  onEdit,
  onView,
  onOptimize
}) => {
  // Campaign management hooks
  const {
    optimizeCampaign,
    updateStatus,
    getOptimizationRecommendations,
    optimizationStatus
  } = useCampaign();

  // Platform-specific status color mapping
  const getStatusColor = useCallback((status: CampaignStatus, platform: PlatformType): string => {
    const baseColors = {
      [CampaignStatus.ACTIVE]: 'text-green-600',
      [CampaignStatus.PAUSED]: 'text-yellow-600',
      [CampaignStatus.COMPLETED]: 'text-blue-600',
      [CampaignStatus.DRAFT]: 'text-gray-600'
    };

    // Platform-specific color adjustments
    if (platform === PlatformType.LINKEDIN && status === CampaignStatus.ACTIVE) {
      return 'text-linkedin-blue';
    }
    if (platform === PlatformType.GOOGLE && status === CampaignStatus.ACTIVE) {
      return 'text-google-red';
    }

    return baseColors[status] || 'text-gray-600';
  }, []);

  // Format budget display with currency
  const formattedBudget = useMemo(() => {
    const { amount, currency } = campaign.budget;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }, [campaign.budget]);

  // Handle optimization trigger
  const handleOptimize = useCallback(async () => {
    if (onOptimize) {
      onOptimize();
    }
    await optimizeCampaign(campaign.id);
  }, [campaign.id, onOptimize, optimizeCampaign]);

  // Monitor optimization status for real-time updates
  useEffect(() => {
    const currentStatus = optimizationStatus?.[campaign.id];
    if (currentStatus?.inProgress) {
      const checkInterval = setInterval(async () => {
        const recommendations = await getOptimizationRecommendations(campaign.id);
        if (recommendations.length > 0) {
          clearInterval(checkInterval);
        }
      }, 5000);

      return () => clearInterval(checkInterval);
    }
  }, [campaign.id, optimizationStatus, getOptimizationRecommendations]);

  return (
    <Card
      className={clsx(
        'campaign-card',
        'transition-all duration-200',
        'hover:shadow-lg',
        loading && 'opacity-75'
      )}
      testId={`campaign-card-${campaign.id}`}
      hoverable
    >
      {/* Campaign Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold truncate" title={campaign.name}>
            {campaign.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={clsx(
              'text-sm font-medium',
              getStatusColor(campaign.status, campaign.platform)
            )}>
              {campaign.status}
            </span>
            <span className="text-sm text-gray-500">
              {campaign.platform}
            </span>
          </div>
        </div>
        
        {/* Platform-specific Icons */}
        <div className="flex-shrink-0">
          {campaign.platform === PlatformType.LINKEDIN && (
            <span className="text-linkedin-blue">
              <i className="fab fa-linkedin text-xl" />
            </span>
          )}
          {campaign.platform === PlatformType.GOOGLE && (
            <span className="text-google-red">
              <i className="fab fa-google text-xl" />
            </span>
          )}
        </div>
      </div>

      {/* Campaign Metrics */}
      {showMetrics && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="metric-item">
            <span className="text-sm text-gray-500">Budget</span>
            <span className="text-lg font-semibold">{formattedBudget}</span>
          </div>
          {campaign.metrics && (
            <>
              <div className="metric-item">
                <span className="text-sm text-gray-500">CTR</span>
                <span className="text-lg font-semibold">
                  {(campaign.metrics.ctr * 100).toFixed(2)}%
                </span>
              </div>
              <div className="metric-item">
                <span className="text-sm text-gray-500">Conversions</span>
                <span className="text-lg font-semibold">
                  {campaign.metrics.conversions}
                </span>
              </div>
              <div className="metric-item">
                <span className="text-sm text-gray-500">ROAS</span>
                <span className="text-lg font-semibold">
                  {campaign.metrics.roas.toFixed(2)}x
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Optimization Status */}
      {optimizationStatus?.[campaign.id]?.inProgress && (
        <div className="bg-blue-50 p-3 rounded-md mb-4">
          <span className="text-sm text-blue-700">
            Optimization in progress...
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={onView}
          className="btn btn-secondary btn-sm"
          disabled={loading}
        >
          View
        </button>
        <button
          onClick={onEdit}
          className="btn btn-primary btn-sm"
          disabled={loading || campaign.status === CampaignStatus.COMPLETED}
        >
          Edit
        </button>
        <button
          onClick={handleOptimize}
          className={clsx(
            'btn btn-sm',
            optimizationStatus?.[campaign.id]?.inProgress
              ? 'btn-disabled'
              : 'btn-success'
          )}
          disabled={
            loading ||
            campaign.status !== CampaignStatus.ACTIVE ||
            optimizationStatus?.[campaign.id]?.inProgress
          }
        >
          Optimize
        </button>
      </div>
    </Card>
  );
});

CampaignCard.displayName = 'CampaignCard';

export default CampaignCard;