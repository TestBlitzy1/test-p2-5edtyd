import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { Input } from '../common/Input';
import { ICampaign, PlatformType, CampaignObjective, CampaignStatus } from '../../types/campaign';
import { useCampaign } from '../../hooks/useCampaign';

// Form step definitions
const FORM_STEPS = [
  { id: 'basics', title: 'Campaign Basics' },
  { id: 'targeting', title: 'Audience Targeting' },
  { id: 'budget', title: 'Budget & Schedule' },
  { id: 'review', title: 'Review & Launch' }
];

// Platform-specific field configurations
const PLATFORM_SPECIFIC_FIELDS = {
  [PlatformType.LINKEDIN]: {
    targeting: ['companySize', 'jobTitles', 'industries', 'skills'],
    validation: {
      titleMaxLength: 150,
      descriptionMaxLength: 600
    }
  },
  [PlatformType.GOOGLE]: {
    targeting: ['keywords', 'demographics', 'interests', 'locations'],
    validation: {
      titleMaxLength: 90,
      descriptionMaxLength: 180
    }
  }
};

// Form validation schema
const createValidationSchema = (platform: PlatformType) => yup.object().shape({
  name: yup.string()
    .required('Campaign name is required')
    .max(100, 'Campaign name must be less than 100 characters'),
  platform: yup.string()
    .required('Platform selection is required')
    .oneOf(Object.values(PlatformType)),
  objective: yup.string()
    .required('Campaign objective is required')
    .oneOf(Object.values(CampaignObjective)),
  budget: yup.object().shape({
    amount: yup.number()
      .required('Budget amount is required')
      .min(platform === PlatformType.LINKEDIN ? 10 : 5, 'Minimum budget not met')
      .max(100000, 'Maximum budget exceeded'),
    currency: yup.string().required('Currency is required'),
    period: yup.string().required('Budget period is required')
  }),
  targeting: yup.object().shape({
    locations: yup.array().of(yup.string()).min(1, 'At least one location is required'),
    industries: yup.array().when('platform', {
      is: PlatformType.LINKEDIN,
      then: yup.array().of(yup.string()).min(1, 'At least one industry is required'),
      otherwise: yup.array()
    }),
    companySize: yup.array().when('platform', {
      is: PlatformType.LINKEDIN,
      then: yup.array().of(yup.string()).min(1, 'At least one company size is required'),
      otherwise: yup.array()
    }),
    jobTitles: yup.array().when('platform', {
      is: PlatformType.LINKEDIN,
      then: yup.array().of(yup.string()),
      otherwise: yup.array()
    })
  })
});

interface CampaignFormProps {
  initialData?: Partial<ICampaign>;
  mode: 'create' | 'edit';
  onSubmit: (campaign: ICampaign) => Promise<void>;
}

export const CampaignForm: React.FC<CampaignFormProps> = ({
  initialData,
  mode,
  onSubmit
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, any>>({});
  const { createCampaign, updateCampaign } = useCampaign();

  // Initialize form with react-hook-form
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<ICampaign>({
    defaultValues: {
      ...initialData,
      status: mode === 'create' ? CampaignStatus.DRAFT : initialData?.status
    },
    mode: 'onChange'
  });

  const selectedPlatform = watch('platform');
  const validationSchema = useMemo(
    () => createValidationSchema(selectedPlatform),
    [selectedPlatform]
  );

  // Handle platform change and load AI suggestions
  useEffect(() => {
    if (selectedPlatform) {
      const loadAiSuggestions = async () => {
        try {
          // Simulate AI suggestions - replace with actual AI service call
          const suggestions = {
            targeting: {
              [PlatformType.LINKEDIN]: {
                industries: ['Software', 'Technology', 'Marketing'],
                jobTitles: ['Marketing Manager', 'Digital Marketing Specialist']
              },
              [PlatformType.GOOGLE]: {
                keywords: ['digital marketing', 'advertising solutions'],
                interests: ['Business Technology', 'Marketing']
              }
            }
          };
          setAiSuggestions(suggestions);
        } catch (error) {
          console.error('Error loading AI suggestions:', error);
        }
      };

      loadAiSuggestions();
    }
  }, [selectedPlatform]);

  // Form submission handler
  const onFormSubmit = async (data: ICampaign) => {
    try {
      if (mode === 'create') {
        const campaign = await createCampaign(data);
        if (campaign) {
          onSubmit(campaign);
        }
      } else {
        const updated = await updateCampaign(data.id, data);
        if (updated) {
          onSubmit(data);
        }
      }
    } catch (error) {
      console.error('Campaign submission error:', error);
    }
  };

  // Render form steps
  const renderFormStep = (step: number) => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  label="Campaign Name"
                  error={errors.name?.message}
                  placeholder="Enter campaign name"
                  required
                />
              )}
            />
            <Controller
              name="platform"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Platform
                  </label>
                  <select
                    {...field}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select Platform</option>
                    {Object.values(PlatformType).map((platform) => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ))}
                  </select>
                  {errors.platform && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.platform.message}
                    </p>
                  )}
                </div>
              )}
            />
            <Controller
              name="objective"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Campaign Objective
                  </label>
                  <select
                    {...field}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select Objective</option>
                    {Object.values(CampaignObjective).map((objective) => (
                      <option key={objective} value={objective}>
                        {objective.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                  {errors.objective && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.objective.message}
                    </p>
                  )}
                </div>
              )}
            />
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            {selectedPlatform && (
              <>
                <Controller
                  name="targeting.locations"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      label="Target Locations"
                      error={errors.targeting?.locations?.message}
                      placeholder="Enter target locations"
                      required
                    />
                  )}
                />
                {PLATFORM_SPECIFIC_FIELDS[selectedPlatform].targeting.map((field) => (
                  <Controller
                    key={field}
                    name={`targeting.${field}`}
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          {field.charAt(0).toUpperCase() + field.slice(1)}
                        </label>
                        <select
                          multiple
                          value={value || []}
                          onChange={(e) => {
                            const values = Array.from(
                              e.target.selectedOptions,
                              (option) => option.value
                            );
                            onChange(values);
                          }}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        >
                          {aiSuggestions.targeting?.[selectedPlatform]?.[field]?.map(
                            (suggestion: string) => (
                              <option key={suggestion} value={suggestion}>
                                {suggestion}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    )}
                  />
                ))}
              </>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <Controller
              name="budget.amount"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  type="number"
                  label="Budget Amount"
                  error={errors.budget?.amount?.message}
                  placeholder="Enter budget amount"
                  required
                />
              )}
            />
            <Controller
              name="budget.period"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Budget Period
                  </label>
                  <select
                    {...field}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select Period</option>
                    <option value="DAILY">Daily</option>
                    <option value="LIFETIME">Lifetime</option>
                  </select>
                  {errors.budget?.period && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.budget.period.message}
                    </p>
                  )}
                </div>
              )}
            />
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Review Campaign</h3>
            <pre className="mt-2 whitespace-pre-wrap bg-gray-50 p-4 rounded-md">
              {JSON.stringify(watch(), null, 2)}
            </pre>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="mb-8">
          <nav className="flex justify-between">
            {FORM_STEPS.map((step, index) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setCurrentStep(index)}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  currentStep === index
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
                disabled={index > currentStep && Object.keys(errors).length > 0}
              >
                {step.title}
              </button>
            ))}
          </nav>
        </div>

        {renderFormStep(currentStep)}

        <div className="mt-8 flex justify-between">
          {currentStep > 0 && (
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep - 1)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Previous
            </button>
          )}
          {currentStep < FORM_STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep + 1)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              disabled={Object.keys(errors).length > 0}
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
              disabled={isSubmitting || Object.keys(errors).length > 0}
            >
              {isSubmitting ? 'Submitting...' : mode === 'create' ? 'Create Campaign' : 'Update Campaign'}
            </button>
          )}
        </div>
      </div>
    </form>
  );
};

export default CampaignForm;