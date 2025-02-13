import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // ^2.0.0
import { 
  IAnalyticsData, 
  TimeRange, 
  MetricType,
  IMetric,
  IPerformanceReport
} from '../types/analytics';
import { ApiClient } from '../lib/api';
import { ApiError } from '../types/common';

// Analytics state interface
interface AnalyticsState {
  data: IAnalyticsData | null;
  loading: boolean;
  error: ApiError | null;
  selectedTimeRange: TimeRange;
  forecast: IPerformanceReport | null;
  realtimeStatus: {
    enabled: boolean;
    lastUpdate: Date | null;
    pollingInterval: number;
  };
  cache: Map<string, {
    data: IAnalyticsData;
    timestamp: number;
  }>;
  confidenceIntervals: Record<MetricType, {
    lower: number;
    upper: number;
  }> | null;
}

// Initial state
const initialState: AnalyticsState = {
  data: null,
  loading: false,
  error: null,
  selectedTimeRange: TimeRange.LAST_7_DAYS,
  forecast: null,
  realtimeStatus: {
    enabled: false,
    lastUpdate: null,
    pollingInterval: 30000, // 30 seconds default
  },
  cache: new Map(),
  confidenceIntervals: null,
};

// Cache configuration
const CACHE_DURATION = 300000; // 5 minutes

// Create API client instance
const apiClient = new ApiClient(process.env.NEXT_PUBLIC_API_URL || '');

// Async thunk for fetching analytics data
export const fetchAnalytics = createAsyncThunk(
  'analytics/fetchAnalytics',
  async (params: {
    campaignId: string;
    timeRange: TimeRange;
    metrics?: MetricType[];
    enablePolling?: boolean;
    pollInterval?: number;
  }, { dispatch, rejectWithValue }) => {
    const cacheKey = `${params.campaignId}-${params.timeRange}`;
    const cachedData = initialState.cache.get(cacheKey);

    // Check cache validity
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      return cachedData.data;
    }

    try {
      const data = await apiClient.getCampaignAnalytics(
        params.campaignId,
        params.timeRange,
        params.metrics
      );

      // Setup polling if enabled
      if (params.enablePolling) {
        const interval = setInterval(() => {
          dispatch(fetchAnalytics({
            ...params,
            enablePolling: false
          }));
        }, params.pollInterval || initialState.realtimeStatus.pollingInterval);

        // Cleanup on component unmount
        return () => clearInterval(interval);
      }

      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// Analytics slice
const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    setTimeRange(state, action: PayloadAction<TimeRange>) {
      state.selectedTimeRange = action.payload;
    },
    setRealtimeStatus(state, action: PayloadAction<{ enabled: boolean; interval?: number }>) {
      state.realtimeStatus.enabled = action.payload.enabled;
      if (action.payload.interval) {
        state.realtimeStatus.pollingInterval = action.payload.interval;
      }
    },
    updateMetric(state, action: PayloadAction<IMetric>) {
      if (state.data?.metrics) {
        const index = state.data.metrics.findIndex(
          m => m.type === action.payload.type
        );
        if (index !== -1) {
          state.data.metrics[index] = action.payload;
        } else {
          state.data.metrics.push(action.payload);
        }
      }
    },
    clearCache(state) {
      state.cache.clear();
    },
    updateConfidenceIntervals(state, action: PayloadAction<Record<MetricType, { lower: number; upper: number }>>) {
      state.confidenceIntervals = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAnalytics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAnalytics.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
        state.realtimeStatus.lastUpdate = new Date();
        
        // Update cache
        const cacheKey = `${action.payload.campaignId}-${state.selectedTimeRange}`;
        state.cache.set(cacheKey, {
          data: action.payload,
          timestamp: Date.now()
        });
      })
      .addCase(fetchAnalytics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as ApiError;
      });
  }
});

// Export actions and reducer
export const {
  setTimeRange,
  setRealtimeStatus,
  updateMetric,
  clearCache,
  updateConfidenceIntervals
} = analyticsSlice.actions;

export default analyticsSlice.reducer;

// Selectors
export const selectAnalytics = (state: { analytics: AnalyticsState }) => ({
  data: state.analytics.data,
  loading: state.analytics.loading,
  error: state.analytics.error,
  timeRange: state.analytics.selectedTimeRange,
  forecast: state.analytics.forecast,
  realtimeStatus: state.analytics.realtimeStatus,
  confidenceIntervals: state.analytics.confidenceIntervals
});

export const selectMetricValue = (state: { analytics: AnalyticsState }, metricType: MetricType) => 
  state.analytics.data?.metrics.find(m => m.type === metricType)?.value;

export const selectMetricTrend = (state: { analytics: AnalyticsState }, metricType: MetricType) => {
  const metrics = state.analytics.data?.metrics.filter(m => m.type === metricType) || [];
  if (metrics.length < 2) return null;
  
  const sorted = [...metrics].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  return {
    current: sorted[0].value,
    previous: sorted[1].value,
    change: ((sorted[0].value - sorted[1].value) / sorted[1].value) * 100
  };
};