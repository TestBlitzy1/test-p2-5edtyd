import { test, expect, describe, beforeAll, afterAll, beforeEach } from 'jest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  setupTestEnvironment,
  createTestUser,
  createTestCampaign,
  generateTestMetrics
} from '../../utils/test.helpers';
import { AnalyticsDashboard } from '../../../../web/src/components/analytics/AnalyticsDashboard';
import { MetricType, TimeRange } from '../../../../web/src/types/analytics';
import { PlatformType } from '../../../../web/src/types/platform';

// Test data interfaces
interface TestData {
  user: {
    id: string;
    role: string;
  };
  campaign: {
    id: string;
    platform: PlatformType;
  };
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    cost: number;
    revenue: number;
  };
}

// Test environment configuration
const TEST_CONFIG = {
  dbConfig: {
    host: 'localhost',
    port: 5432,
    database: 'test_db',
    user: 'test_user',
    password: 'test_password'
  },
  mockServerPort: 3001,
  simulatedLatency: 100
};

describe('Analytics Dashboard E2E Tests', () => {
  let testData: TestData;
  let testEnv: any;

  // Setup test environment before all tests
  beforeAll(async () => {
    testEnv = await setupTestEnvironment(TEST_CONFIG);
    testData = await setupTestData();
  });

  // Cleanup after all tests
  afterAll(async () => {
    await testEnv.cleanup();
  });

  // Reset test state before each test
  beforeEach(async () => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Dashboard Initial Load', () => {
    test('should render all core components correctly', async () => {
      const { container } = await renderDashboard(testData.campaign.id, TimeRange.LAST_30_DAYS);

      // Verify core components are present
      expect(screen.getByRole('heading', { name: /analytics dashboard/i })).toBeInTheDocument();
      expect(container.querySelector('.performance-chart')).toBeInTheDocument();
      expect(container.querySelector('.roi-calculator')).toBeInTheDocument();
      expect(container.querySelector('.budget-overview')).toBeInTheDocument();
      expect(container.querySelector('.campaign-metrics')).toBeInTheDocument();
    });

    test('should display loading states during initial data fetch', async () => {
      render(<AnalyticsDashboard 
        campaignId={testData.campaign.id}
        timeRange={TimeRange.LAST_30_DAYS}
      />);

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
      });
    });

    test('should handle API errors gracefully', async () => {
      testEnv.mockServer.setMockResponse('analytics/data', null, {
        status: 500,
        errorRate: 1
      });

      render(<AnalyticsDashboard 
        campaignId={testData.campaign.id}
        timeRange={TimeRange.LAST_30_DAYS}
      />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/error loading analytics data/i);
      });
    });
  });

  describe('Real-time Updates', () => {
    test('should update metrics in real-time', async () => {
      const { container } = await renderDashboard(testData.campaign.id, TimeRange.TODAY);
      const initialImpressions = screen.getByText(/impressions/i).textContent;

      // Simulate metric update
      testEnv.mockServer.setMockResponse('analytics/data', {
        ...testData.metrics,
        impressions: testData.metrics.impressions + 1000
      });

      await waitFor(() => {
        const updatedImpressions = screen.getByText(/impressions/i).textContent;
        expect(updatedImpressions).not.toBe(initialImpressions);
      }, { timeout: 5000 });
    });

    test('should indicate stale data state', async () => {
      testEnv.mockServer.setMockResponse('analytics/data', null, {
        delay: 6000 // Delay longer than stale threshold
      });

      const { container } = await renderDashboard(testData.campaign.id, TimeRange.TODAY);

      await waitFor(() => {
        expect(screen.getByText(/data may be stale/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance Forecasting', () => {
    test('should display performance forecasts with confidence intervals', async () => {
      const { container } = await renderDashboard(testData.campaign.id, TimeRange.LAST_30_DAYS);

      await waitFor(() => {
        expect(screen.getByTestId('forecast-chart')).toBeInTheDocument();
        expect(screen.getAllByTestId('confidence-interval')).toHaveLength(4); // For core metrics
      });
    });

    test('should update forecasts based on time range changes', async () => {
      const { container } = await renderDashboard(testData.campaign.id, TimeRange.LAST_7_DAYS);
      const initialForecast = screen.getByTestId('forecast-value').textContent;

      // Change time range
      await userEvent.click(screen.getByRole('button', { name: /time range/i }));
      await userEvent.click(screen.getByRole('option', { name: /last 30 days/i }));

      await waitFor(() => {
        const updatedForecast = screen.getByTestId('forecast-value').textContent;
        expect(updatedForecast).not.toBe(initialForecast);
      });
    });
  });

  describe('Interactive Features', () => {
    test('should allow metric selection and filtering', async () => {
      const { container } = await renderDashboard(testData.campaign.id, TimeRange.LAST_30_DAYS);

      await userEvent.click(screen.getByRole('button', { name: /select metrics/i }));
      await userEvent.click(screen.getByRole('checkbox', { name: /conversions/i }));

      await waitFor(() => {
        expect(screen.getByTestId('performance-chart')).toHaveAttribute(
          'data-metrics',
          expect.stringContaining('CONVERSIONS')
        );
      });
    });

    test('should support data export functionality', async () => {
      const { container } = await renderDashboard(testData.campaign.id, TimeRange.LAST_30_DAYS);
      const mockExport = jest.fn();

      await userEvent.click(screen.getByRole('button', { name: /export data/i }));
      await userEvent.click(screen.getByRole('menuitem', { name: /export as csv/i }));

      await waitFor(() => {
        expect(mockExport).toHaveBeenCalledWith(
          expect.objectContaining({
            format: 'csv',
            timeRange: TimeRange.LAST_30_DAYS
          })
        );
      });
    });
  });
});

// Helper function to setup test data
async function setupTestData(): Promise<TestData> {
  const user = await createTestUser({
    role: 'MANAGER',
    permissions: ['analytics:read']
  });

  const campaign = await createTestCampaign(user.id, PlatformType.LINKEDIN);

  const metrics = await generateTestMetrics(campaign.id, {
    impressions: 10000,
    clicks: 500,
    conversions: 50,
    cost: 1000,
    revenue: 2000
  });

  return { user, campaign, metrics };
}

// Helper function to render dashboard with test providers
async function renderDashboard(campaignId: string, timeRange: TimeRange) {
  return render(
    <AnalyticsDashboard
      campaignId={campaignId}
      timeRange={timeRange}
      refreshInterval={1000}
      className="test-dashboard"
    />
  );
}