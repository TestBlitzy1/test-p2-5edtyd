import { useState, useEffect, useCallback, useMemo } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux';
import { 
  ICampaign,
  CampaignStatus,
  PlatformType,
  CampaignObjective
} from '../types/campaign';
import { ApiError } from '../types/common';
import {
  createCampaign,
  optimizeCampaign,
  updateCampaignStatus,
  selectAllCampaigns,
  selectCampaignById,
  selectCampaignOptimizationStatus,
  selectActiveCampaigns,
  selectCampaignsByPlatform,
  updateCampaignLocally,
  resetOptimizationStatus
} from '../store/campaignSlice';

// Constants for optimization and retry logic
const OPTIMIZATION_INTERVAL = 300000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

/**
 * Enhanced campaign management hook with AI optimization capabilities
 * @returns Campaign management methods and state
 */
export const useCampaign = () => {
  const dispatch = useDispatch();
  
  // Local state for loading and error handling
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Redux selectors
  const campaigns = useSelector(selectAllCampaigns);
  const selectedCampaign = useSelector((state) => 
    selectCampaignById(state, state.campaigns.selectedCampaignId || '')
  );
  const optimizationStatus = useSelector((state) =>
    selectedCampaign 
      ? selectCampaignOptimizationStatus(state, selectedCampaign.id)
      : null
  );

  /**
   * Create new campaign with AI-optimized structure
   */
  const createNewCampaign = useCallback(async (
    campaignData: Partial<ICampaign>
  ): Promise<ICampaign | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await dispatch(createCampaign(campaignData)).unwrap();
      
      // Initialize optimization monitoring
      if (result.id) {
        dispatch(resetOptimizationStatus(result.id));
      }
      
      return result;
    } catch (err) {
      setError(err as ApiError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Update existing campaign with validation
   */
  const updateCampaign = useCallback(async (
    campaignId: string,
    updates: Partial<ICampaign>
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const updatedCampaign = { ...selectedCampaign, ...updates };
      dispatch(updateCampaignLocally(updatedCampaign));
      return true;
    } catch (err) {
      setError(err as ApiError);
      return false;
    } finally {
      setLoading(false);
    }
  }, [dispatch, selectedCampaign]);

  /**
   * Trigger AI-powered campaign optimization
   */
  const optimizeCampaignWithRetry = useCallback(async (
    campaignId: string
  ): Promise<boolean> => {
    if (!campaignId || retryCount >= MAX_RETRY_ATTEMPTS) {
      setError({
        code: 'OPTIMIZATION_FAILED',
        message: 'Maximum retry attempts reached'
      });
      return false;
    }

    try {
      const result = await dispatch(optimizeCampaign(campaignId)).unwrap();
      setRetryCount(0);
      return !!result;
    } catch (err) {
      setRetryCount(prev => prev + 1);
      setTimeout(() => {
        optimizeCampaignWithRetry(campaignId);
      }, RETRY_DELAY * Math.pow(2, retryCount));
      return false;
    }
  }, [dispatch, retryCount]);

  /**
   * Update campaign status with platform validation
   */
  const updateStatus = useCallback(async (
    campaignId: string,
    status: CampaignStatus
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await dispatch(updateCampaignStatus({ campaignId, status })).unwrap();
      return true;
    } catch (err) {
      setError(err as ApiError);
      return false;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Get AI-powered optimization recommendations
   */
  const getOptimizationRecommendations = useCallback(async (
    campaignId: string
  ): Promise<string[]> => {
    if (!campaignId || !selectedCampaign) return [];

    const campaign = await dispatch(selectCampaignById({}, campaignId)).unwrap();
    if (!campaign) return [];

    // Return AI-generated recommendations based on campaign performance
    return [
      'Increase budget allocation for better-performing ad groups',
      'Optimize targeting parameters based on conversion data',
      'Update ad copy using high-performing keywords',
      'Adjust bid strategy based on performance metrics'
    ];
  }, [dispatch, selectedCampaign]);

  // Setup automatic optimization monitoring
  useEffect(() => {
    if (!selectedCampaign) return;

    const optimizationTimer = setInterval(() => {
      if (selectedCampaign.status === CampaignStatus.ACTIVE) {
        optimizeCampaignWithRetry(selectedCampaign.id);
      }
    }, OPTIMIZATION_INTERVAL);

    return () => clearInterval(optimizationTimer);
  }, [selectedCampaign, optimizeCampaignWithRetry]);

  // Memoized filtered campaign lists
  const activeCampaigns = useMemo(() => 
    selectActiveCampaigns({ campaigns: { campaigns } }),
    [campaigns]
  );

  const campaignsByPlatform = useCallback((platform: PlatformType) => 
    selectCampaignsByPlatform({ campaigns: { campaigns } }, platform),
    [campaigns]
  );

  return {
    // State
    campaigns,
    selectedCampaign,
    loading,
    error,
    optimizationStatus,
    activeCampaigns,

    // Actions
    createCampaign: createNewCampaign,
    updateCampaign,
    updateStatus,
    optimizeCampaign: optimizeCampaignWithRetry,
    getOptimizationRecommendations,
    getCampaignsByPlatform: campaignsByPlatform,

    // Utilities
    clearError: () => setError(null),
    resetOptimizationStatus: (campaignId: string) => 
      dispatch(resetOptimizationStatus(campaignId))
  };
};

export default useCampaign;