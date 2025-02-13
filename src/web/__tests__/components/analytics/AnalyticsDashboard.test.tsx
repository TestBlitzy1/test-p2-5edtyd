import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { mock, mockReset } from 'jest-mock-extended';

import AnalyticsDashboard from '../../../src/components/analytics/AnalyticsDashboard';
import { useAnalytics } from '../../../src/hooks/useAnalytics';
import { analyticsSlice } from '../../../src/store/analyticsSlice';
import { MetricType, TimeRange } from '../../../types/analytics';
import { PlatformType } from '../../../types/platform';

// Mock dependencies
jest.mock('../../../src/hooks/useAnalytics');
const mockedUseAnalytics = useAnalytics as jest.MockedFunction<typeof useAnalytics>;

// Test data constants
const TEST_CAMPAIGN_ID = 'test-campaign-123';
const TEST_REFRESH_INTERVAL = 30000;

// Mock analytics data
const mockAnalyticsData = {
  campaignId: TEST_CAMPAIGN_ID,
  metrics: [
    {
      type: MetricType.CTR,
      value: 0.025,
      timestamp: new Date(),
      confidence: 0.95
    },
    {
      type: MetricType.CONVERSIONS,
      value: 150,
      timestamp: new Date(),
      confidence: 0.92
    },
    {
      type: MetricType.ROAS,
      value: 2.5,
      timestamp: new Date(),
      confidence: 0.88
    }
  ],
  timeRange: TimeRange.LAST_30_DAYS,
  lastUpdated: new Date(),
  forecastData: {
    predictions: {
      [MetricType.CTR]: [{ value: 0.028, confidence: { lower: 0.025, upper: 0.031 } }],
      [MetricType.CONVERSIONS]: [{ value: 165, confidence: { lower: 155, upper: 175 } }],
      [MetricType.ROAS]: [{ value: 2.7, confidence: { lower: 2.4, upper: 3.0 } }]
    }
  }
};

// Helper function to render component with Redux store
const renderWithRedux = (
  component: React.ReactElement,
  initialState = {}
) => {
  const store = configureStore({
    reducer: {
      analytics: analyticsSlice.reducer
    },
    preloadedState: initialState
  });

  return {
    ...render(
      <Provider store={store}>
        {component}
      </Provider>
    ),
    store
  };
};

// Helper function to setup analytics mocks
const setupMockAnalytics = (
  data = mockAnalyticsData,
  options = { loading: false, error: null, isStale: false }
) => {
  mockedUseAnalytics.mockReturnValue({
    data,
    loading: options.loading,
    error: options.error,
    isStale: options.isStale,
    lastUpdated: new Date(),
    refetch: jest.fn()
  });
};

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    mockReset(mockedUseAnalytics);
    setupMockAnalytics();
  });

  describe('Real-time Analytics Display', () => {
    it('should render initial analytics data correctly', async () => {
      renderWithRedux(
        <AnalyticsDashboard
          campaignId={TEST_CAMPAIGN_ID}
          timeRange={TimeRange.LAST_30_DAYS}
          refreshInterval={TEST_REFRESH_INTERVAL}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /campaign performance chart/i })).toBeInTheDocument();
      });

      // Verify metrics display
      mockAnalyticsData.metrics.forEach(metric => {
        expect(screen.getByText(new RegExp(metric.type, 'i'))).toBeInTheDocument();
      });
    });

    it('should handle data staleness indication', async () => {
      setupMockAnalytics(mockAnalyticsData, { isStale: true });

      renderWithRedux(
        <AnalyticsDashboard
          campaignId={TEST_CAMPAIGN_ID}
          timeRange={TimeRange.LAST_30_DAYS}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/data may be stale/i);
      });
    });

    it('should trigger refresh on manual refresh action', async () => {
      const mockRefetch = jest.fn();
      mockedUseAnalytics.mockReturnValue({
        ...mockAnalyticsData,
        refetch: mockRefetch
      });

      renderWithRedux(
        <AnalyticsDashboard
          campaignId={TEST_CAMPAIGN_ID}
          timeRange={TimeRange.LAST_30_DAYS}
        />
      );

      const refreshButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(refreshButton);

      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('Performance Forecasting', () => {
    it('should display forecast data with confidence intervals', async () => {
      renderWithRedux(
        <AnalyticsDashboard
          campaignId={TEST_CAMPAIGN_ID}
          timeRange={TimeRange.LAST_30_DAYS}
        />
      );

      await waitFor(() => {
        const chart = screen.getByRole('img', { name: /campaign performance chart/i });
        expect(chart).toBeInTheDocument();
        
        // Verify forecast elements
        Object.keys(mockAnalyticsData.forecastData.predictions).forEach(metric => {
          expect(screen.getByText(new RegExp(`${metric}.*forecast`, 'i'))).toBeInTheDocument();
        });
      });
    });

    it('should update forecast on time range change', async () => {
      const mockRefetch = jest.fn();
      mockedUseAnalytics.mockReturnValue({
        ...mockAnalyticsData,
        refetch: mockRefetch
      });

      renderWithRedux(
        <AnalyticsDashboard
          campaignId={TEST_CAMPAIGN_ID}
          timeRange={TimeRange.LAST_7_DAYS}
        />
      );

      // Simulate time range change
      const timeRangeSelect = screen.getByRole('combobox', { name: /time range/i });
      await userEvent.selectOptions(timeRangeSelect, TimeRange.LAST_30_DAYS);

      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('Budget Optimization', () => {
    it('should display budget metrics and recommendations', async () => {
      renderWithRedux(
        <AnalyticsDashboard
          campaignId={TEST_CAMPAIGN_ID}
          timeRange={TimeRange.LAST_30_DAYS}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/roi calculator/i)).toBeInTheDocument();
        expect(screen.getByText(/budget overview/i)).toBeInTheDocument();
      });
    });

    it('should show platform-specific budget breakdowns', async () => {
      const budgetData = {
        ...mockAnalyticsData,
        platformBreakdown: {
          [PlatformType.LINKEDIN]: 5000,
          [PlatformType.GOOGLE]: 3000
        }
      };

      setupMockAnalytics(budgetData);

      renderWithRedux(
        <AnalyticsDashboard
          campaignId={TEST_CAMPAIGN_ID}
          timeRange={TimeRange.LAST_30_DAYS}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(PlatformType.LINKEDIN)).toBeInTheDocument();
        expect(screen.getByText(PlatformType.GOOGLE)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Compliance', () => {
    it('should have proper ARIA labels and roles', async () => {
      renderWithRedux(
        <AnalyticsDashboard
          campaignId={TEST_CAMPAIGN_ID}
          timeRange={TimeRange.LAST_30_DAYS}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /campaign performance chart/i }))
          .toHaveAttribute('aria-label', 'Campaign performance chart');
        
        // Verify alert roles for error states
        const alerts = screen.queryAllByRole('alert');
        alerts.forEach(alert => {
          expect(alert).toHaveAttribute('aria-live', 'polite');
        });
      });
    });

    it('should support keyboard navigation', async () => {
      renderWithRedux(
        <AnalyticsDashboard
          campaignId={TEST_CAMPAIGN_ID}
          timeRange={TimeRange.LAST_30_DAYS}
        />
      );

      const user = userEvent.setup();
      
      // Tab through interactive elements
      await user.tab();
      expect(screen.getByRole('button', { name: /retry/i })).toHaveFocus();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when analytics fetch fails', async () => {
      const testError = 'Failed to fetch analytics data';
      setupMockAnalytics(null, { error: testError });

      renderWithRedux(
        <AnalyticsDashboard
          campaignId={TEST_CAMPAIGN_ID}
          timeRange={TimeRange.LAST_30_DAYS}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(testError);
      });
    });

    it('should handle recovery from error state', async () => {
      const mockRefetch = jest.fn();
      setupMockAnalytics(null, { error: 'Initial error' });

      renderWithRedux(
        <AnalyticsDashboard
          campaignId={TEST_CAMPAIGN_ID}
          timeRange={TimeRange.LAST_30_DAYS}
        />
      );

      // Simulate successful recovery
      setupMockAnalytics(mockAnalyticsData);
      
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });
});