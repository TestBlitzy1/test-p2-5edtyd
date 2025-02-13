import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import useCampaign from '../../src/hooks/useCampaign';
import campaignReducer from '../../src/store/campaignSlice';
import { ICampaign, CampaignStatus, PlatformType, CampaignObjective } from '../../src/types/campaign';

// Mock store configuration
const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      campaigns: campaignReducer
    },
    preloadedState: initialState
  });
};

// Mock campaign data
const mockCampaign: ICampaign = {
  id: 'test-campaign-1',
  userId: 'test-user-1',
  name: 'Test Campaign',
  platform: PlatformType.LINKEDIN,
  objective: CampaignObjective.LEAD_GENERATION,
  status: CampaignStatus.DRAFT,
  budget: {
    amount: 1000,
    currency: 'USD',
    period: 'DAILY'
  },
  targeting: {
    locations: ['US'],
    industries: ['Technology'],
    companySize: ['10-50'],
    jobTitles: ['Software Engineer']
  },
  adGroups: [],
  performanceTargets: [],
  createdAt: new Date(),
  updatedAt: new Date()
};

// Mock optimization recommendations
const mockOptimizationRecommendations = [
  'Increase budget allocation for better-performing ad groups',
  'Optimize targeting parameters based on conversion data',
  'Update ad copy using high-performing keywords'
];

describe('useCampaign Hook', () => {
  let mockStore: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    mockStore = createMockStore();
  });

  it('should create a new campaign with AI optimization', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={mockStore}>{children}</Provider>
    );

    const { result } = renderHook(() => useCampaign(), { wrapper });

    await act(async () => {
      const newCampaign = await result.current.createCampaign({
        name: 'AI Optimized Campaign',
        platform: PlatformType.LINKEDIN,
        objective: CampaignObjective.LEAD_GENERATION
      });

      expect(newCampaign).toBeTruthy();
      expect(newCampaign?.name).toBe('AI Optimized Campaign');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    // Verify optimization status initialization
    expect(result.current.optimizationStatus).toEqual(expect.objectContaining({
      inProgress: false,
      lastOptimized: null,
      error: null
    }));
  });

  it('should handle platform-specific campaign updates', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={mockStore}>{children}</Provider>
    );

    const { result } = renderHook(() => useCampaign(), { wrapper });

    // Create campaigns for both platforms
    await act(async () => {
      await result.current.createCampaign({
        ...mockCampaign,
        platform: PlatformType.LINKEDIN
      });

      await result.current.createCampaign({
        ...mockCampaign,
        id: 'test-campaign-2',
        platform: PlatformType.GOOGLE
      });
    });

    // Test LinkedIn-specific update
    await act(async () => {
      const success = await result.current.updateCampaign('test-campaign-1', {
        targeting: {
          ...mockCampaign.targeting,
          industries: ['Technology', 'Software']
        }
      });

      expect(success).toBe(true);
      expect(result.current.campaigns[0].targeting.industries).toContain('Software');
    });

    // Test Google Ads-specific update
    await act(async () => {
      const success = await result.current.updateCampaign('test-campaign-2', {
        targeting: {
          ...mockCampaign.targeting,
          locations: ['US', 'CA']
        }
      });

      expect(success).toBe(true);
      expect(result.current.campaigns[1].targeting.locations).toContain('CA');
    });
  });

  it('should perform real-time campaign optimization', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={mockStore}>{children}</Provider>
    );

    const { result } = renderHook(() => useCampaign(), { wrapper });

    // Create and activate a campaign
    await act(async () => {
      const campaign = await result.current.createCampaign(mockCampaign);
      await result.current.updateStatus(campaign!.id, CampaignStatus.ACTIVE);
    });

    // Trigger optimization
    await act(async () => {
      const optimized = await result.current.optimizeCampaign(mockCampaign.id);
      expect(optimized).toBe(true);
    });

    // Verify optimization results
    await waitFor(() => {
      expect(result.current.optimizationStatus).toEqual(expect.objectContaining({
        inProgress: false,
        lastOptimized: expect.any(Date),
        error: null
      }));
    });

    // Check optimization recommendations
    const recommendations = await result.current.getOptimizationRecommendations(mockCampaign.id);
    expect(recommendations).toEqual(expect.arrayContaining(mockOptimizationRecommendations));
  });

  it('should handle optimization failures and retries', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={mockStore}>{children}</Provider>
    );

    const { result } = renderHook(() => useCampaign(), { wrapper });

    // Create a campaign
    await act(async () => {
      await result.current.createCampaign(mockCampaign);
    });

    // Simulate optimization failure
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      const optimized = await result.current.optimizeCampaign('invalid-id');
      expect(optimized).toBe(false);
    });

    expect(result.current.error).toEqual(expect.objectContaining({
      code: 'OPTIMIZATION_FAILED',
      message: expect.any(String)
    }));
  });

  it('should maintain platform-specific campaign lists', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={mockStore}>{children}</Provider>
    );

    const { result } = renderHook(() => useCampaign(), { wrapper });

    // Create campaigns for both platforms
    await act(async () => {
      await result.current.createCampaign({
        ...mockCampaign,
        platform: PlatformType.LINKEDIN
      });

      await result.current.createCampaign({
        ...mockCampaign,
        id: 'test-campaign-2',
        platform: PlatformType.GOOGLE
      });
    });

    // Test platform-specific filtering
    const linkedInCampaigns = result.current.getCampaignsByPlatform(PlatformType.LINKEDIN);
    expect(linkedInCampaigns).toHaveLength(1);
    expect(linkedInCampaigns[0].platform).toBe(PlatformType.LINKEDIN);

    const googleCampaigns = result.current.getCampaignsByPlatform(PlatformType.GOOGLE);
    expect(googleCampaigns).toHaveLength(1);
    expect(googleCampaigns[0].platform).toBe(PlatformType.GOOGLE);
  });
});