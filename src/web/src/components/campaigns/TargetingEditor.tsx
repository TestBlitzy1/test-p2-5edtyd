import React, { useState, useEffect, useCallback, useMemo } from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import debounce from 'lodash/debounce'; // ^4.0.8
import { Select } from '../common/Select';
import { ITargeting } from '../../types/campaign';
import { useCampaign } from '../../hooks/useCampaign';

/**
 * Props interface for the TargetingEditor component
 */
interface TargetingEditorProps {
  campaignId: string;
  initialTargeting: ITargeting;
  disabled?: boolean;
  platform: 'LINKEDIN' | 'GOOGLE';
  onChange: (targeting: ITargeting) => void;
  onError: (error: string) => void;
  showAISuggestions?: boolean;
}

/**
 * Enhanced targeting editor component with AI-powered suggestions
 * and real-time audience reach estimation
 */
export const TargetingEditor: React.FC<TargetingEditorProps> = ({
  campaignId,
  initialTargeting,
  disabled = false,
  platform,
  onChange,
  onError,
  showAISuggestions = true
}) => {
  // State management
  const [targeting, setTargeting] = useState<ITargeting>(initialTargeting);
  const [audienceReach, setAudienceReach] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Partial<ITargeting>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Custom hooks
  const { updateCampaign, getOptimizationRecommendations } = useCampaign();

  // Platform-specific targeting options
  const targetingOptions = useMemo(() => ({
    industries: platform === 'LINKEDIN' ? [
      { value: 'software', label: 'Software & IT' },
      { value: 'finance', label: 'Finance & Banking' },
      { value: 'healthcare', label: 'Healthcare' },
      { value: 'retail', label: 'Retail & Consumer Goods' }
    ] : [
      { value: 'technology', label: 'Technology' },
      { value: 'banking', label: 'Banking' },
      { value: 'medical', label: 'Medical' },
      { value: 'commerce', label: 'Commerce' }
    ],
    companySizes: [
      { value: '1-10', label: '1-10 employees' },
      { value: '11-50', label: '11-50 employees' },
      { value: '51-200', label: '51-200 employees' },
      { value: '201-500', label: '201-500 employees' },
      { value: '501+', label: '501+ employees' }
    ],
    jobTitles: platform === 'LINKEDIN' ? [
      { value: 'ceo', label: 'CEO' },
      { value: 'cto', label: 'CTO' },
      { value: 'director', label: 'Director' },
      { value: 'manager', label: 'Manager' }
    ] : [
      { value: 'executive', label: 'Executive' },
      { value: 'technical', label: 'Technical Lead' },
      { value: 'management', label: 'Management' },
      { value: 'professional', label: 'Professional' }
    ]
  }), [platform]);

  /**
   * Debounced handler for updating audience reach estimation
   */
  const updateAudienceReach = useCallback(
    debounce(async (newTargeting: ITargeting) => {
      try {
        setIsLoading(true);
        const response = await updateCampaign(campaignId, { targeting: newTargeting });
        if (response) {
          const reach = await fetch(`/api/campaigns/${campaignId}/audience-reach`);
          const data = await reach.json();
          setAudienceReach(data.reach);
        }
      } catch (error) {
        onError('Failed to update audience reach estimation');
      } finally {
        setIsLoading(false);
      }
    }, 500),
    [campaignId, updateCampaign, onError]
  );

  /**
   * Fetch AI-powered targeting suggestions
   */
  const fetchAISuggestions = useCallback(async () => {
    if (!showAISuggestions) return;

    try {
      const recommendations = await getOptimizationRecommendations(campaignId);
      const suggestedTargeting = recommendations.reduce((acc, rec) => {
        if (rec.includes('industry')) {
          acc.industries = targetingOptions.industries
            .filter(i => rec.toLowerCase().includes(i.value))
            .map(i => i.value);
        }
        return acc;
      }, {} as Partial<ITargeting>);

      setSuggestions(suggestedTargeting);
    } catch (error) {
      console.error('Failed to fetch AI suggestions:', error);
    }
  }, [campaignId, getOptimizationRecommendations, showAISuggestions, targetingOptions]);

  /**
   * Validate targeting parameters
   */
  const validateTargeting = useCallback((newTargeting: ITargeting): boolean => {
    const errors: Record<string, string> = {};

    if (!newTargeting.locations.length) {
      errors.locations = 'At least one location is required';
    }
    if (!newTargeting.industries.length) {
      errors.industries = 'At least one industry is required';
    }
    if (!newTargeting.companySize.length) {
      errors.companySize = 'At least one company size is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, []);

  /**
   * Handle targeting parameter changes
   */
  const handleTargetingChange = useCallback((
    field: keyof ITargeting,
    values: string[]
  ) => {
    const newTargeting = {
      ...targeting,
      [field]: values
    };

    if (validateTargeting(newTargeting)) {
      setTargeting(newTargeting);
      onChange(newTargeting);
      updateAudienceReach(newTargeting);
    }
  }, [targeting, onChange, updateAudienceReach, validateTargeting]);

  /**
   * Apply AI suggestions to targeting
   */
  const applyAISuggestions = useCallback(() => {
    const newTargeting = {
      ...targeting,
      ...suggestions
    };

    if (validateTargeting(newTargeting)) {
      setTargeting(newTargeting);
      onChange(newTargeting);
      updateAudienceReach(newTargeting);
    }
  }, [targeting, suggestions, onChange, updateAudienceReach, validateTargeting]);

  // Initial setup
  useEffect(() => {
    fetchAISuggestions();
    updateAudienceReach(initialTargeting);
  }, [fetchAISuggestions, updateAudienceReach, initialTargeting]);

  return (
    <div className="space-y-6">
      {/* Locations */}
      <div className="targeting-field">
        <label className="block text-sm font-medium text-gray-700">
          Locations
        </label>
        <Select
          options={[
            { value: 'us', label: 'United States' },
            { value: 'uk', label: 'United Kingdom' },
            { value: 'eu', label: 'European Union' }
          ]}
          value={targeting.locations}
          onChange={(values) => handleTargetingChange('locations', values)}
          error={validationErrors.locations}
          disabled={disabled}
          aria-label="Select target locations"
        />
      </div>

      {/* Industries */}
      <div className="targeting-field">
        <label className="block text-sm font-medium text-gray-700">
          Industries
        </label>
        <Select
          options={targetingOptions.industries}
          value={targeting.industries}
          onChange={(values) => handleTargetingChange('industries', values)}
          error={validationErrors.industries}
          disabled={disabled}
          aria-label="Select target industries"
        />
      </div>

      {/* Company Size */}
      <div className="targeting-field">
        <label className="block text-sm font-medium text-gray-700">
          Company Size
        </label>
        <Select
          options={targetingOptions.companySizes}
          value={targeting.companySize}
          onChange={(values) => handleTargetingChange('companySize', values)}
          error={validationErrors.companySize}
          disabled={disabled}
          aria-label="Select target company sizes"
        />
      </div>

      {/* Job Titles */}
      <div className="targeting-field">
        <label className="block text-sm font-medium text-gray-700">
          Job Titles
        </label>
        <Select
          options={targetingOptions.jobTitles}
          value={targeting.jobTitles}
          onChange={(values) => handleTargetingChange('jobTitles', values)}
          disabled={disabled}
          aria-label="Select target job titles"
        />
      </div>

      {/* AI Suggestions */}
      {showAISuggestions && Object.keys(suggestions).length > 0 && (
        <div className="bg-blue-50 p-4 rounded-md">
          <h4 className="text-sm font-medium text-blue-800">AI Suggestions</h4>
          <p className="text-sm text-blue-600 mt-1">
            We recommend targeting these additional parameters:
          </p>
          <button
            onClick={applyAISuggestions}
            className={classNames(
              "mt-2 px-4 py-2 text-sm font-medium rounded-md",
              "text-white bg-blue-600 hover:bg-blue-700",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            disabled={disabled}
          >
            Apply Suggestions
          </button>
        </div>
      )}

      {/* Audience Reach Estimation */}
      {audienceReach !== null && (
        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <h4 className="text-sm font-medium text-gray-900">
            Estimated Audience Reach
          </h4>
          <p className="text-lg font-semibold text-gray-700">
            {isLoading ? 'Calculating...' : `${audienceReach.toLocaleString()} potential viewers`}
          </p>
        </div>
      )}
    </div>
  );
};

export default TargetingEditor;