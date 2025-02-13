import { configureStore } from '@reduxjs/toolkit'; // ^2.0.0
import { describe, it, expect, beforeEach, jest } from '@jest/globals'; // ^29.0.0
import {
    reducer,
    actions,
    selectors,
    createCampaign,
    optimizeCampaign,
    updateCampaignStatus
} from '../../src/store/campaignSlice';
import {
    ICampaign,
    CampaignStatus,
    PlatformType,
    CampaignObjective,
    BudgetPeriod
} from '../../src/types/campaign';

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
        period: BudgetPeriod.DAILY
    },
    targeting: {
        locations: ['US', 'UK'],
        industries: ['Technology', 'Marketing'],
        companySize: ['10-50', '51-200'],
        jobTitles: ['Marketing Manager', 'Digital Marketing']
    },
    adGroups: [],
    performanceTargets: [],
    createdAt: new Date(),
    updatedAt: new Date()
};

// Mock store setup
const mockStore = configureStore({
    reducer: {
        campaigns: reducer
    }
});

// Mock API responses
jest.mock('../../src/lib/api', () => ({
    ApiClient: jest.fn().mockImplementation(() => ({
        createCampaign: jest.fn().mockResolvedValue(mockCampaign),
        optimizeCampaign: jest.fn().mockResolvedValue({
            ...mockCampaign,
            status: CampaignStatus.ACTIVE
        }),
        updateCampaignStatus: jest.fn().mockResolvedValue({
            ...mockCampaign,
            status: CampaignStatus.PAUSED
        })
    }))
}));

describe('campaignSlice', () => {
    beforeEach(() => {
        mockStore.dispatch(actions.clearCampaignError());
        jest.clearAllMocks();
    });

    describe('initial state', () => {
        it('should have empty initial state', () => {
            const state = mockStore.getState().campaigns;
            expect(state.campaigns).toEqual({});
            expect(state.loading).toBeFalsy();
            expect(state.error).toBeNull();
            expect(state.optimizationStatus).toEqual({});
            expect(state.selectedCampaignId).toBeNull();
        });
    });

    describe('campaign creation', () => {
        it('should handle createCampaign.pending', () => {
            mockStore.dispatch(createCampaign.pending('', mockCampaign));
            const state = mockStore.getState().campaigns;
            expect(state.loading).toBeTruthy();
            expect(state.error).toBeNull();
        });

        it('should handle createCampaign.fulfilled', async () => {
            await mockStore.dispatch(createCampaign(mockCampaign));
            const state = mockStore.getState().campaigns;
            expect(state.campaigns[mockCampaign.id]).toEqual(mockCampaign);
            expect(state.loading).toBeFalsy();
            expect(state.optimizationStatus[mockCampaign.id]).toBeDefined();
        });

        it('should handle createCampaign.rejected', async () => {
            const error = { code: 'ERROR', message: 'Test error' };
            jest.spyOn(global, 'fetch').mockRejectedValueOnce(error);
            await mockStore.dispatch(createCampaign(mockCampaign));
            const state = mockStore.getState().campaigns;
            expect(state.loading).toBeFalsy();
            expect(state.error).toBeDefined();
        });
    });

    describe('campaign optimization', () => {
        beforeEach(async () => {
            await mockStore.dispatch(createCampaign(mockCampaign));
        });

        it('should handle optimizeCampaign.pending', () => {
            mockStore.dispatch(optimizeCampaign.pending('', mockCampaign.id));
            const state = mockStore.getState().campaigns;
            expect(state.optimizationStatus[mockCampaign.id].inProgress).toBeTruthy();
        });

        it('should handle optimizeCampaign.fulfilled', async () => {
            await mockStore.dispatch(optimizeCampaign(mockCampaign.id));
            const state = mockStore.getState().campaigns;
            expect(state.campaigns[mockCampaign.id].status).toBe(CampaignStatus.ACTIVE);
            expect(state.optimizationStatus[mockCampaign.id].lastOptimized).toBeDefined();
        });

        it('should handle optimizeCampaign.rejected', async () => {
            const error = { code: 'OPTIMIZATION_ERROR', message: 'Optimization failed' };
            jest.spyOn(global, 'fetch').mockRejectedValueOnce(error);
            await mockStore.dispatch(optimizeCampaign(mockCampaign.id));
            const state = mockStore.getState().campaigns;
            expect(state.optimizationStatus[mockCampaign.id].error).toBeDefined();
        });
    });

    describe('campaign status updates', () => {
        beforeEach(async () => {
            await mockStore.dispatch(createCampaign(mockCampaign));
        });

        it('should handle updateCampaignStatus.fulfilled', async () => {
            await mockStore.dispatch(updateCampaignStatus({
                campaignId: mockCampaign.id,
                status: CampaignStatus.PAUSED
            }));
            const state = mockStore.getState().campaigns;
            expect(state.campaigns[mockCampaign.id].status).toBe(CampaignStatus.PAUSED);
        });
    });

    describe('selectors', () => {
        beforeEach(async () => {
            await mockStore.dispatch(createCampaign(mockCampaign));
        });

        it('should select all campaigns', () => {
            const state = mockStore.getState();
            const allCampaigns = selectors.selectAllCampaigns(state);
            expect(allCampaigns).toHaveLength(1);
            expect(allCampaigns[0]).toEqual(mockCampaign);
        });

        it('should select campaign by id', () => {
            const state = mockStore.getState();
            const campaign = selectors.selectCampaignById(state, mockCampaign.id);
            expect(campaign).toEqual(mockCampaign);
        });

        it('should select campaigns by platform', () => {
            const state = mockStore.getState();
            const linkedInCampaigns = selectors.selectCampaignsByPlatform(state, PlatformType.LINKEDIN);
            expect(linkedInCampaigns).toHaveLength(1);
            expect(linkedInCampaigns[0].platform).toBe(PlatformType.LINKEDIN);
        });

        it('should select active campaigns', () => {
            const state = mockStore.getState();
            const activeCampaigns = selectors.selectActiveCampaigns(state);
            expect(activeCampaigns).toHaveLength(0); // Initially draft status
        });

        it('should select campaign optimization status', () => {
            const state = mockStore.getState();
            const optimizationStatus = selectors.selectCampaignOptimizationStatus(state, mockCampaign.id);
            expect(optimizationStatus).toBeDefined();
            expect(optimizationStatus.inProgress).toBeFalsy();
        });
    });

    describe('action creators', () => {
        it('should handle selectCampaign', () => {
            mockStore.dispatch(actions.selectCampaign(mockCampaign.id));
            const state = mockStore.getState().campaigns;
            expect(state.selectedCampaignId).toBe(mockCampaign.id);
        });

        it('should handle clearCampaignError', () => {
            mockStore.dispatch(actions.clearCampaignError());
            const state = mockStore.getState().campaigns;
            expect(state.error).toBeNull();
        });

        it('should handle updateCampaignLocally', () => {
            const updatedCampaign = { ...mockCampaign, name: 'Updated Campaign' };
            mockStore.dispatch(actions.updateCampaignLocally(updatedCampaign));
            const state = mockStore.getState().campaigns;
            expect(state.campaigns[mockCampaign.id].name).toBe('Updated Campaign');
        });

        it('should handle resetOptimizationStatus', () => {
            mockStore.dispatch(actions.resetOptimizationStatus(mockCampaign.id));
            const state = mockStore.getState().campaigns;
            expect(state.optimizationStatus[mockCampaign.id]).toEqual({
                inProgress: false,
                lastOptimized: null,
                error: null
            });
        });
    });
});