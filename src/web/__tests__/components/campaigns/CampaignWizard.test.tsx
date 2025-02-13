import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { act } from 'react-dom/test-utils';
import CampaignWizard from '@/components/campaigns/CampaignWizard';
import { useCampaign } from '@/hooks/useCampaign';
import { PlatformType, CampaignObjective, CampaignStatus } from '../../../types/campaign';
import campaignReducer from '../../../store/campaignSlice';
import analyticsReducer from '../../../store/analyticsSlice';
import platformReducer from '../../../store/platformSlice';

// Mock the custom hooks and API calls
jest.mock('@/hooks/useCampaign');
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Test data constants
const mockCampaignData = {
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
    companySize: ['11-50'],
    jobTitles: ['Marketing Manager']
  },
  adGroups: [{
    ads: [{
      headline: 'Test Ad',
      description: 'Test Description',
      imageUrl: 'https://example.com/image.jpg',
      destinationUrl: 'https://example.com'
    }]
  }]
};

// Mock store setup
const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      campaigns: campaignReducer,
      analytics: analyticsReducer,
      platform: platformReducer
    },
    preloadedState: initialState
  });
};

describe('CampaignWizard', () => {
  let mockStore;
  let mockCreateCampaign;
  let mockUpdateCampaign;

  beforeEach(() => {
    mockCreateCampaign = jest.fn().mockResolvedValue(mockCampaignData);
    mockUpdateCampaign = jest.fn().mockResolvedValue(true);

    (useCampaign as jest.Mock).mockReturnValue({
      createCampaign: mockCreateCampaign,
      updateCampaign: mockUpdateCampaign,
      loading: false,
      error: null
    });

    mockStore = createMockStore();

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('renders all wizard steps correctly', () => {
    render(
      <Provider store={mockStore}>
        <CampaignWizard
          onComplete={jest.fn()}
          onCancel={jest.fn()}
        />
      </Provider>
    );

    expect(screen.getByText('Campaign Details')).toBeInTheDocument();
    expect(screen.getByText('Audience Targeting')).toBeInTheDocument();
    expect(screen.getByText('Ad Creatives')).toBeInTheDocument();
    expect(screen.getByText('Review & Launch')).toBeInTheDocument();
  });

  it('validates campaign details step', async () => {
    render(
      <Provider store={mockStore}>
        <CampaignWizard
          onComplete={jest.fn()}
          onCancel={jest.fn()}
        />
      </Provider>
    );

    // Try to proceed without filling required fields
    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByText('Campaign name is required')).toBeInTheDocument();
      expect(screen.getByText('Platform selection is required')).toBeInTheDocument();
    });
  });

  it('handles platform-specific validation rules', async () => {
    render(
      <Provider store={mockStore}>
        <CampaignWizard
          onComplete={jest.fn()}
          onCancel={jest.fn()}
        />
      </Provider>
    );

    // Fill in LinkedIn-specific details
    fireEvent.change(screen.getByLabelText(/campaign name/i), {
      target: { value: 'Test Campaign' }
    });
    fireEvent.change(screen.getByLabelText(/platform/i), {
      target: { value: PlatformType.LINKEDIN }
    });

    // Proceed to targeting step
    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByText(/company size/i)).toBeInTheDocument();
      expect(screen.getByText(/job titles/i)).toBeInTheDocument();
    });
  });

  it('integrates with AI optimization suggestions', async () => {
    render(
      <Provider store={mockStore}>
        <CampaignWizard
          onComplete={jest.fn()}
          onCancel={jest.fn()}
          initialData={mockCampaignData}
        />
      </Provider>
    );

    // Navigate to targeting step
    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByText(/ai suggestions/i)).toBeInTheDocument();
    });

    // Apply AI suggestions
    fireEvent.click(screen.getByText('Apply Suggestions'));

    await waitFor(() => {
      expect(mockUpdateCampaign).toHaveBeenCalled();
    });
  });

  it('completes campaign creation within time requirement', async () => {
    const onComplete = jest.fn();
    const startTime = Date.now();

    render(
      <Provider store={mockStore}>
        <CampaignWizard
          onComplete={onComplete}
          onCancel={jest.fn()}
        />
      </Provider>
    );

    // Fill in all required fields
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/campaign name/i), {
        target: { value: mockCampaignData.name }
      });
      fireEvent.change(screen.getByLabelText(/platform/i), {
        target: { value: mockCampaignData.platform }
      });
      fireEvent.click(screen.getByText('Next'));

      // Fill targeting
      jest.advanceTimersByTime(1000);
      fireEvent.click(screen.getByText('Next'));

      // Fill creatives
      jest.advanceTimersByTime(1000);
      fireEvent.click(screen.getByText('Next'));

      // Launch campaign
      fireEvent.click(screen.getByText('Launch Campaign'));
    });

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
      expect(Date.now() - startTime).toBeLessThan(900000); // 15 minutes in milliseconds
    });
  });

  it('handles validation errors gracefully', async () => {
    mockCreateCampaign.mockRejectedValueOnce(new Error('Validation failed'));

    render(
      <Provider store={mockStore}>
        <CampaignWizard
          onComplete={jest.fn()}
          onCancel={jest.fn()}
          initialData={mockCampaignData}
        />
      </Provider>
    );

    // Navigate to final step
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByText('Next'));
      await waitFor(() => jest.advanceTimersByTime(1000));
    }

    // Attempt to launch campaign
    fireEvent.click(screen.getByText('Launch Campaign'));

    await waitFor(() => {
      expect(screen.getByText('Validation failed')).toBeInTheDocument();
    });
  });

  it('preserves data between step navigation', async () => {
    render(
      <Provider store={mockStore}>
        <CampaignWizard
          onComplete={jest.fn()}
          onCancel={jest.fn()}
          initialData={mockCampaignData}
        />
      </Provider>
    );

    // Navigate forward and back
    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => jest.advanceTimersByTime(1000));
    fireEvent.click(screen.getByText('Previous'));

    // Verify data persistence
    await waitFor(() => {
      expect(screen.getByDisplayValue(mockCampaignData.name)).toBeInTheDocument();
    });
  });

  it('supports platform-specific creative requirements', async () => {
    render(
      <Provider store={mockStore}>
        <CampaignWizard
          onComplete={jest.fn()}
          onCancel={jest.fn()}
          platform={PlatformType.LINKEDIN}
        />
      </Provider>
    );

    // Navigate to creatives step
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByText(/headline/i)).toBeInTheDocument();
      expect(screen.getByText(/description/i)).toBeInTheDocument();
    });
  });
});