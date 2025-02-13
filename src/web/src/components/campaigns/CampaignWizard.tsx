import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { Steps } from 'antd';
import CampaignForm from './CampaignForm';
import TargetingEditor from './TargetingEditor';
import CreativeEditor from './CreativeEditor';
import { useCampaign } from '../../hooks/useCampaign';
import { 
  ICampaign, 
  PlatformType, 
  CampaignStatus,
  ITargeting,
  IAd 
} from '../../types/campaign';
import { ApiError } from '../../types/common';

// Wizard step definitions with validation rules
const WIZARD_STEPS = [
  {
    title: 'Campaign Details',
    key: 'details',
    description: 'Basic campaign information',
    validationRules: ['name', 'platform', 'objective', 'budget']
  },
  {
    title: 'Audience Targeting',
    key: 'targeting',
    description: 'Define your target audience',
    validationRules: ['locations', 'industries', 'companySize']
  },
  {
    title: 'Ad Creatives',
    key: 'creatives',
    description: 'Create your ad content',
    validationRules: ['headline', 'description', 'imageUrl']
  },
  {
    title: 'Review & Launch',
    key: 'review',
    description: 'Review and launch campaign',
    validationRules: ['all']
  }
];

// Platform-specific validation configurations
const PLATFORM_VALIDATION = {
  [PlatformType.LINKEDIN]: {
    minBudget: 10,
    maxBudget: 100000,
    requiredTargeting: ['industries', 'companySize', 'jobTitles']
  },
  [PlatformType.GOOGLE]: {
    minBudget: 5,
    maxBudget: 50000,
    requiredTargeting: ['locations', 'keywords', 'demographics']
  }
};

interface CampaignWizardProps {
  initialStep?: number;
  initialData?: Partial<ICampaign>;
  platform?: PlatformType;
  onComplete: (campaign: ICampaign) => void;
  onCancel: () => void;
}

export const CampaignWizard: React.FC<CampaignWizardProps> = ({
  initialStep = 0,
  initialData,
  platform = PlatformType.LINKEDIN,
  onComplete,
  onCancel
}) => {
  const router = useRouter();
  const { createCampaign, updateCampaign, error: campaignError } = useCampaign();
  
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [campaignData, setCampaignData] = useState<Partial<ICampaign>>(
    initialData || {
      platform,
      status: CampaignStatus.DRAFT,
      targeting: {} as ITargeting,
      adGroups: [{ ads: [] as IAd[] }]
    }
  );
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Memoize platform-specific validation rules
  const validationRules = useMemo(
    () => PLATFORM_VALIDATION[campaignData.platform || platform],
    [campaignData.platform, platform]
  );

  // Validate current step data
  const validateStep = useCallback((step: number): boolean => {
    const currentStepRules = WIZARD_STEPS[step].validationRules;
    const errors: Record<string, string> = {};

    currentStepRules.forEach(rule => {
      switch (rule) {
        case 'name':
          if (!campaignData.name?.trim()) {
            errors.name = 'Campaign name is required';
          }
          break;
        case 'budget':
          if (!campaignData.budget?.amount) {
            errors.budget = 'Budget amount is required';
          } else if (campaignData.budget.amount < validationRules.minBudget) {
            errors.budget = `Minimum budget is ${validationRules.minBudget}`;
          }
          break;
        case 'targeting':
          validationRules.requiredTargeting.forEach(field => {
            if (!campaignData.targeting?.[field]?.length) {
              errors[field] = `${field} targeting is required`;
            }
          });
          break;
        // Add more validation rules as needed
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [campaignData, validationRules]);

  // Handle step navigation
  const handleStepChange = useCallback(async (direction: 'next' | 'prev') => {
    if (direction === 'next' && !validateStep(currentStep)) {
      return;
    }

    const newStep = direction === 'next' ? currentStep + 1 : currentStep - 1;
    setCurrentStep(newStep);
    router.push(`?step=${newStep}`, undefined, { shallow: true });
  }, [currentStep, validateStep, router]);

  // Handle campaign data updates
  const handleDataUpdate = useCallback((field: keyof ICampaign, value: any) => {
    setCampaignData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Handle campaign submission
  const handleSubmit = useCallback(async () => {
    if (!validateStep(currentStep)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const campaign = await createCampaign(campaignData as ICampaign);
      if (campaign) {
        onComplete(campaign);
      }
    } catch (error) {
      setValidationErrors({
        submit: (error as ApiError).message
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [campaignData, currentStep, createCampaign, onComplete, validateStep]);

  // Render current step content
  const renderStepContent = useCallback(() => {
    switch (currentStep) {
      case 0:
        return (
          <CampaignForm
            initialData={campaignData}
            mode="create"
            onSubmit={(data) => handleDataUpdate('details', data)}
          />
        );
      case 1:
        return (
          <TargetingEditor
            campaignId={campaignData.id || ''}
            initialTargeting={campaignData.targeting || {}}
            platform={campaignData.platform || platform}
            onChange={(targeting) => handleDataUpdate('targeting', targeting)}
            onError={(error) => setValidationErrors({ targeting: error })}
            showAISuggestions
          />
        );
      case 2:
        return (
          <CreativeEditor
            creative={campaignData.adGroups?.[0]?.ads?.[0] || {}}
            platform={campaignData.platform || platform}
            onChange={(creative) => handleDataUpdate('creative', creative)}
            onValidationError={(errors) => setValidationErrors({ creative: errors.join(', ') })}
          />
        );
      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Review Campaign</h3>
            <pre className="bg-gray-50 p-4 rounded-md overflow-auto">
              {JSON.stringify(campaignData, null, 2)}
            </pre>
          </div>
        );
      default:
        return null;
    }
  }, [currentStep, campaignData, platform, handleDataUpdate]);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <Steps
        current={currentStep}
        items={WIZARD_STEPS.map(step => ({
          title: step.title,
          description: step.description
        }))}
      />

      <div className="mt-8">
        {renderStepContent()}
      </div>

      {validationErrors.submit && (
        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md" role="alert">
          {validationErrors.submit}
        </div>
      )}

      <div className="mt-8 flex justify-between">
        {currentStep > 0 && (
          <button
            onClick={() => handleStepChange('prev')}
            className="px-4 py-2 text-gray-600 border rounded hover:bg-gray-50"
          >
            Previous
          </button>
        )}

        <div className="ml-auto">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 border rounded hover:bg-gray-50 mr-4"
          >
            Cancel
          </button>

          {currentStep < WIZARD_STEPS.length - 1 ? (
            <button
              onClick={() => handleStepChange('next')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={Object.keys(validationErrors).length > 0}
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              disabled={isSubmitting || Object.keys(validationErrors).length > 0}
            >
              {isSubmitting ? 'Creating Campaign...' : 'Launch Campaign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignWizard;