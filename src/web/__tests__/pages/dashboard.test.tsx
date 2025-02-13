import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { jest, describe, beforeAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import { axe } from '@axe-core/react';
import DashboardPage from '../../src/app/(dashboard)/page';
import { TimeRange, MetricType } from '../../types/analytics';
import { PlatformType } from '../../types/platform';

// Mock hooks and components
jest.mock('../../src/hooks/useAuth', () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock('../../src/hooks/useAnalytics', () => ({
  __esModule: true,
  default: jest.fn()
}));

// Mock ResizeObserver for chart components
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe('DashboardPage', () => {
  // Mock data
  const mockUser = {
    id: '123',
    email: 'test@example.com',
    role: 'MANAGER'
  };

  const mockAnalyticsData = {
    metrics: [
      { type: MetricType.CTR, value: 0.025, timestamp: new Date() },
      { type: MetricType.CONVERSIONS, value: 150, timestamp: new Date() },
      { type: MetricType.ROAS, value: 2.5, timestamp: new Date() }
    ],
    timeRange: TimeRange.LAST_30_DAYS,
    campaignId: 'all'
  };

  // Setup mocks before each test
  beforeEach(() => {
    // Mock useAuth hook
    require('../../src/hooks/useAuth').default.mockImplementation(() => ({
      user: mockUser,
      hasPermission: jest.fn().mockReturnValue(true)
    }));

    // Mock useAnalytics hook
    require('../../src/hooks/useAnalytics').default.mockImplementation(() => ({
      data: mockAnalyticsData,
      loading: false,
      error: null,
      isStale: false,
      refetch: jest.fn()
    }));
  });

  // Cleanup after each test
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders dashboard with authenticated user', async () => {
    render(<DashboardPage />);

    // Verify welcome message
    expect(screen.getByText(`Welcome back, ${mockUser.email}`)).toBeInTheDocument();
    expect(screen.getByText(/overview of your campaign performance/i)).toBeInTheDocument();
  });

  it('displays analytics dashboard with correct metrics', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // Verify CTR metric
      expect(screen.getByText('2.50%')).toBeInTheDocument();
      // Verify Conversions metric
      expect(screen.getByText('150')).toBeInTheDocument();
      // Verify ROAS metric
      expect(screen.getByText('2.5x')).toBeInTheDocument();
    });
  });

  it('handles analytics error state correctly', async () => {
    const errorMessage = 'Failed to load analytics data';
    require('../../src/hooks/useAnalytics').default.mockImplementation(() => ({
      data: null,
      loading: false,
      error: errorMessage,
      isStale: false
    }));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching data', async () => {
    require('../../src/hooks/useAnalytics').default.mockImplementation(() => ({
      data: null,
      loading: true,
      error: null,
      isStale: false
    }));

    render(<DashboardPage />);

    expect(screen.getByTestId('loading-fallback')).toBeInTheDocument();
  });

  it('handles campaign optimization requests', async () => {
    const mockOptimize = jest.fn();
    require('../../src/hooks/useAuth').default.mockImplementation(() => ({
      user: mockUser,
      hasPermission: jest.fn().mockReturnValue(true)
    }));

    render(<DashboardPage />);

    const optimizeButton = screen.getByRole('button', { name: /optimize/i });
    await userEvent.click(optimizeButton);

    expect(mockOptimize).toHaveBeenCalled();
  });

  it('updates data on refresh interval', async () => {
    jest.useFakeTimers();
    const mockRefetch = jest.fn();
    require('../../src/hooks/useAnalytics').default.mockImplementation(() => ({
      data: mockAnalyticsData,
      loading: false,
      error: null,
      isStale: false,
      refetch: mockRefetch
    }));

    render(<DashboardPage />);

    // Fast-forward 30 seconds
    jest.advanceTimersByTime(30000);

    expect(mockRefetch).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('handles platform-specific data filtering', async () => {
    render(<DashboardPage />);

    const platformFilter = screen.getByRole('combobox', { name: /platform/i });
    await userEvent.selectOptions(platformFilter, PlatformType.LINKEDIN);

    await waitFor(() => {
      expect(screen.getByText(/linkedin campaigns/i)).toBeInTheDocument();
    });
  });

  it('maintains responsive layout at different viewport sizes', async () => {
    const { container } = render(<DashboardPage />);

    // Test mobile viewport
    window.innerWidth = 375;
    fireEvent(window, new Event('resize'));
    expect(container.querySelector('.mobile-layout')).toBeInTheDocument();

    // Test desktop viewport
    window.innerWidth = 1200;
    fireEvent(window, new Event('resize'));
    expect(container.querySelector('.desktop-layout')).toBeInTheDocument();
  });

  it('meets accessibility standards', async () => {
    const { container } = render(<DashboardPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('handles real-time updates correctly', async () => {
    const mockUpdateData = {
      ...mockAnalyticsData,
      metrics: [
        { type: MetricType.CTR, value: 0.030, timestamp: new Date() }
      ]
    };

    const { rerender } = render(<DashboardPage />);

    // Simulate real-time update
    require('../../src/hooks/useAnalytics').default.mockImplementation(() => ({
      data: mockUpdateData,
      loading: false,
      error: null,
      isStale: false
    }));

    rerender(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('3.00%')).toBeInTheDocument();
    });
  });

  it('handles session expiry and redirects to login', async () => {
    require('../../src/hooks/useAuth').default.mockImplementation(() => ({
      user: null,
      hasPermission: jest.fn().mockReturnValue(false)
    }));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/auth/login');
    });
  });
});