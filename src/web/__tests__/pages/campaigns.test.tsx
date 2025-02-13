import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { useRouter } from 'next/navigation';

// Component imports
import CampaignsPage from '../../src/app/(dashboard)/campaigns/page';

// Hook imports
import { useCampaign } from '../../src/hooks/useCampaign';

// Mock data utilities
import { mockCampaignData } from '../../../test/mocks/campaign.mock';
import { PlatformType, CampaignStatus } from '../../src/types/campaign';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn()
}));

// Mock useCampaign hook
jest.mock('../../src/hooks/useCampaign', () => ({
  useCampaign: jest.fn()
}));

describe('CampaignsPage', () => {
  // Common test setup
  const mockRouter = {
    push: jest.fn()
  };

  const mockCampaigns = [
    mockCampaignData.generateMockCampaign({}, PlatformType.LINKEDIN),
    mockCampaignData.generateMockCampaign({}, PlatformType.GOOGLE),
    mockCampaignData.generateMockCampaign({
      status: CampaignStatus.PAUSED
    }, PlatformType.LINKEDIN)
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useCampaign as jest.Mock).mockReturnValue({
      campaigns: [],
      loading: false,
      error: null,
      optimizationStatus: {},
      createCampaign: jest.fn(),
      updateCampaign: jest.fn(),
      optimizeCampaign: jest.fn()
    });
  });

  it('renders loading state correctly', () => {
    // Mock loading state
    (useCampaign as jest.Mock).mockReturnValue({
      campaigns: [],
      loading: true,
      error: null
    });

    render(<CampaignsPage />);

    // Verify loading skeleton is displayed
    const loadingSkeletons = screen.getAllByRole('generic').filter(
      element => element.className.includes('animate-pulse')
    );
    expect(loadingSkeletons).toHaveLength(3);
  });

  it('renders campaign list correctly', async () => {
    // Mock campaigns data
    (useCampaign as jest.Mock).mockReturnValue({
      campaigns: mockCampaigns,
      loading: false,
      error: null,
      optimizationStatus: {}
    });

    render(<CampaignsPage />);

    // Verify campaign cards are rendered
    await waitFor(() => {
      mockCampaigns.forEach(campaign => {
        expect(screen.getByText(campaign.name)).toBeInTheDocument();
      });
    });

    // Verify platform badges
    const linkedInBadges = screen.getAllByText('LINKEDIN');
    const googleBadges = screen.getAllByText('GOOGLE');
    expect(linkedInBadges).toHaveLength(2);
    expect(googleBadges).toHaveLength(1);
  });

  it('handles create campaign navigation correctly', async () => {
    render(<CampaignsPage />);

    // Click create campaign button
    const createButton = screen.getByRole('button', { name: /create campaign/i });
    fireEvent.click(createButton);

    // Verify navigation
    expect(mockRouter.push).toHaveBeenCalledWith('/campaigns/new');
  });

  it('handles keyboard shortcuts correctly', () => {
    render(<CampaignsPage />);

    // Simulate Alt+N keyboard shortcut
    fireEvent.keyDown(window, { key: 'n', altKey: true });

    // Verify navigation
    expect(mockRouter.push).toHaveBeenCalledWith('/campaigns/new');
  });

  it('displays optimization status correctly', async () => {
    // Mock optimization status
    const optimizationStatus = {
      [mockCampaigns[0].id]: {
        inProgress: true,
        lastOptimized: new Date(),
        error: null
      }
    };

    (useCampaign as jest.Mock).mockReturnValue({
      campaigns: mockCampaigns,
      loading: false,
      error: null,
      optimizationStatus
    });

    render(<CampaignsPage />);

    // Verify optimization status banner
    await waitFor(() => {
      expect(screen.getByText(/optimizing campaign/i)).toBeInTheDocument();
    });
  });

  it('handles error states correctly', () => {
    // Mock error state
    const error = {
      code: 'FETCH_ERROR',
      message: 'Failed to fetch campaigns'
    };

    (useCampaign as jest.Mock).mockReturnValue({
      campaigns: [],
      loading: false,
      error
    });

    render(<CampaignsPage />);

    // Verify error message
    expect(screen.getByText(error.message)).toBeInTheDocument();

    // Verify retry button
    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();

    // Click retry button
    fireEvent.click(retryButton);
    expect(window.location.reload).toHaveBeenCalled();
  });

  it('displays empty state correctly', () => {
    // Mock empty campaigns list
    (useCampaign as jest.Mock).mockReturnValue({
      campaigns: [],
      loading: false,
      error: null
    });

    render(<CampaignsPage />);

    // Verify empty state message
    expect(screen.getByText(/no campaigns found/i)).toBeInTheDocument();
    expect(screen.getByText(/create your first campaign/i)).toBeInTheDocument();

    // Verify create campaign button
    const createButton = screen.getByRole('button', { name: /create campaign/i });
    expect(createButton).toBeInTheDocument();
  });

  it('handles campaign filtering correctly', async () => {
    // Mock filtered campaigns
    const filteredCampaigns = mockCampaigns.filter(
      campaign => campaign.platform === PlatformType.LINKEDIN
    );

    (useCampaign as jest.Mock).mockReturnValue({
      campaigns: filteredCampaigns,
      loading: false,
      error: null
    });

    render(<CampaignsPage />);

    // Verify filtered results
    await waitFor(() => {
      filteredCampaigns.forEach(campaign => {
        expect(screen.getByText(campaign.name)).toBeInTheDocument();
      });
      expect(screen.queryByText('GOOGLE')).not.toBeInTheDocument();
    });
  });
});