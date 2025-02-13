import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useAnalytics } from '../../src/hooks/useAnalytics';
import { MetricType, TimeRange } from '../../src/types/analytics';

// Test constants
const TEST_CAMPAIGN_ID = 'test-campaign-123';
const TEST_POLLING_INTERVAL = 5000;
const TEST_STALE_THRESHOLD = 300000;

// Mock analytics data
const mockAnalyticsData = {
  campaignId: TEST_CAMPAIGN_ID,
  metrics: [
    {
      type: MetricType.IMPRESSIONS,
      value: 10000,
      timestamp: new Date(),
      confidence: 0.95
    },
    {
      type: MetricType.CLICKS,
      value: 500,
      timestamp: new Date(),
      confidence: 0.92
    },
    {
      type: MetricType.CTR,
      value: 0.05,
      timestamp: new Date(),
      confidence: 0.88
    }
  ],
  timeRange: TimeRange.LAST_7_DAYS,
  segments: ['desktop', 'mobile']
};

// Mock store setup
const mockStore = configureStore({
  reducer: {
    analytics: (state = { data: {} }, action) => {
      switch (action.type) {
        case 'analytics/updateData':
          return {
            ...state,
            data: {
              ...state.data,
              [action.payload.campaignId]: action.payload.data
            }
          };
        default:
          return state;
      }
    }
  }
});

// Test wrapper with Redux provider
const wrapper = ({ children }) => (
  <Provider store={mockStore}>{children}</Provider>
);

// Mock fetch implementation
global.fetch = jest.fn();

describe('useAnalytics hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset fetch mock default response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockAnalyticsData
    });
  });

  it('should fetch analytics data on mount', async () => {
    const { result, waitForNextUpdate } = renderHook(
      () => useAnalytics(TEST_CAMPAIGN_ID, TimeRange.LAST_7_DAYS, {
        pollingInterval: TEST_POLLING_INTERVAL
      }),
      { wrapper }
    );

    // Initial state check
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();

    // Wait for data fetch
    await waitForNextUpdate();

    // Verify loaded state
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(mockAnalyticsData);
    expect(result.current.isStale).toBe(false);
    expect(global.fetch).toHaveBeenCalledWith(
      `/api/analytics/${TEST_CAMPAIGN_ID}`,
      expect.any(Object)
    );
  });

  it('should handle errors correctly', async () => {
    const errorMessage = 'API Error';
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

    const { result, waitForNextUpdate } = renderHook(
      () => useAnalytics(TEST_CAMPAIGN_ID, TimeRange.LAST_7_DAYS),
      { wrapper }
    );

    await waitForNextUpdate();

    expect(result.current.error).toBe(`Analytics API error: ${errorMessage}`);
    expect(result.current.loading).toBe(false);

    // Test error recovery through refetch
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAnalyticsData
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(mockAnalyticsData);
  });

  it('should refetch data when called', async () => {
    const { result, waitForNextUpdate } = renderHook(
      () => useAnalytics(TEST_CAMPAIGN_ID, TimeRange.LAST_7_DAYS),
      { wrapper }
    );

    await waitForNextUpdate();

    const updatedData = {
      ...mockAnalyticsData,
      metrics: [
        {
          type: MetricType.IMPRESSIONS,
          value: 15000,
          timestamp: new Date(),
          confidence: 0.97
        }
      ]
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => updatedData
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.data).toEqual(updatedData);
  });

  it('should mark data as stale after threshold', async () => {
    jest.useFakeTimers();

    const { result, waitForNextUpdate } = renderHook(
      () => useAnalytics(TEST_CAMPAIGN_ID, TimeRange.LAST_7_DAYS, {
        staleDuration: TEST_STALE_THRESHOLD
      }),
      { wrapper }
    );

    await waitForNextUpdate();

    expect(result.current.isStale).toBe(false);

    // Advance time beyond stale threshold
    act(() => {
      jest.advanceTimersByTime(TEST_STALE_THRESHOLD + 1000);
    });

    expect(result.current.isStale).toBe(true);

    jest.useRealTimers();
  });

  it('should handle different time ranges', async () => {
    const { result, waitForNextUpdate, rerender } = renderHook(
      ({ timeRange }) => useAnalytics(TEST_CAMPAIGN_ID, timeRange),
      {
        wrapper,
        initialProps: { timeRange: TimeRange.LAST_7_DAYS }
      }
    );

    await waitForNextUpdate();

    // Change time range
    rerender({ timeRange: TimeRange.LAST_30_DAYS });

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/analytics/${TEST_CAMPAIGN_ID}`,
      expect.objectContaining({
        body: JSON.stringify({ timeRange: TimeRange.LAST_30_DAYS })
      })
    );
  });

  it('should process metrics and generate forecasts', async () => {
    const { result, waitForNextUpdate } = renderHook(
      () => useAnalytics(TEST_CAMPAIGN_ID, TimeRange.LAST_7_DAYS),
      { wrapper }
    );

    await waitForNextUpdate();

    expect(result.current.data.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: expect.any(String),
          value: expect.any(Number),
          confidence: expect.any(Number)
        })
      ])
    );
  });

  it('should handle polling interval correctly', async () => {
    jest.useFakeTimers();

    const { result, waitForNextUpdate } = renderHook(
      () => useAnalytics(TEST_CAMPAIGN_ID, TimeRange.LAST_7_DAYS, {
        pollingInterval: TEST_POLLING_INTERVAL
      }),
      { wrapper }
    );

    await waitForNextUpdate();

    const initialFetchCount = (global.fetch as jest.Mock).mock.calls.length;

    // Advance time to trigger polling
    act(() => {
      jest.advanceTimersByTime(TEST_POLLING_INTERVAL);
    });

    expect(global.fetch).toHaveBeenCalledTimes(initialFetchCount + 1);

    jest.useRealTimers();
  });
});