'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorBoundary } from 'react-error-boundary';
import toast from 'react-hot-toast';
import CampaignWizard from '@/components/campaigns/CampaignWizard';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useCampaign } from '@/hooks/useCampaign';
import { ICampaign, CampaignStatus, PlatformType } from '@/types/campaign';

// Constants for page configuration
const PAGE_TITLE = 'Create New Campaign';
const SUCCESS_MESSAGE = 'Campaign created successfully! Redirecting to campaign details...';
const ERROR_MESSAGE = 'Failed to create campaign. Please try again or contact support if the issue persists.';
const MAX_RETRY_ATTEMPTS = 3;
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

/**
 * Error fallback component for campaign creation errors
 */
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="p-6 bg-red-50 rounded-lg">
    <h3 className="text-lg font-medium text-red-800">Campaign Creation Error</h3>
    <p className="mt-2 text-red-700">{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
    >
      Try Again
    </button>
  </div>
);

/**
 * New Campaign Page component for AI-powered campaign creation
 */
const NewCampaignPage: React.FC = () => {
  const router = useRouter();
  const { createCampaign, loading, error, retryCreate } = useCampaign();
  const [retryCount, setRetryCount] = useState(0);
  const [draftCampaign, setDraftCampaign] = useState<Partial<ICampaign>>({
    status: CampaignStatus.DRAFT,
    platform: PlatformType.LINKEDIN
  });

  /**
   * Handles successful campaign creation with proper error handling and user feedback
   */
  const handleCampaignComplete = useCallback(async (campaignData: ICampaign) => {
    try {
      // Show loading toast
      const loadingToast = toast.loading('Creating your campaign...');

      // Attempt to create campaign
      const campaign = await createCampaign(campaignData);

      if (campaign) {
        // Clear draft from storage
        localStorage.removeItem('campaign_draft');
        
        // Show success message
        toast.success(SUCCESS_MESSAGE, { id: loadingToast });
        
        // Redirect to campaign details
        router.push(`/campaigns/${campaign.id}`);
      } else {
        throw new Error('Campaign creation failed');
      }
    } catch (error) {
      // Handle retry logic
      if (retryCount < MAX_RETRY_ATTEMPTS) {
        setRetryCount(prev => prev + 1);
        await retryCreate();
      } else {
        toast.error(ERROR_MESSAGE);
        console.error('Campaign creation error:', error);
      }
    }
  }, [createCampaign, retryCount, retryCreate, router]);

  /**
   * Auto-save draft campaign data
   */
  useEffect(() => {
    const saveDraft = () => {
      if (draftCampaign) {
        localStorage.setItem('campaign_draft', JSON.stringify({
          data: draftCampaign,
          timestamp: new Date().toISOString()
        }));
      }
    };

    // Set up auto-save interval
    const autoSaveInterval = setInterval(saveDraft, AUTO_SAVE_INTERVAL);

    // Load existing draft if available
    const existingDraft = localStorage.getItem('campaign_draft');
    if (existingDraft) {
      try {
        const { data, timestamp } = JSON.parse(existingDraft);
        const draftAge = Date.now() - new Date(timestamp).getTime();
        
        // Only restore drafts less than 24 hours old
        if (draftAge < 24 * 60 * 60 * 1000) {
          setDraftCampaign(data);
        } else {
          localStorage.removeItem('campaign_draft');
        }
      } catch (error) {
        console.error('Error loading campaign draft:', error);
        localStorage.removeItem('campaign_draft');
      }
    }

    return () => {
      clearInterval(autoSaveInterval);
      saveDraft(); // Save on unmount
    };
  }, [draftCampaign]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-6">
          <h1 className="text-2xl font-semibold text-gray-900">{PAGE_TITLE}</h1>
          
          <ErrorBoundary
            FallbackComponent={ErrorFallback}
            onReset={() => setRetryCount(0)}
          >
            <div className="mt-6">
              <CampaignWizard
                initialData={draftCampaign}
                onComplete={handleCampaignComplete}
                onCancel={() => router.push('/campaigns')}
              />
            </div>
          </ErrorBoundary>

          {error && (
            <div className="mt-4 p-4 bg-red-50 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default NewCampaignPage;