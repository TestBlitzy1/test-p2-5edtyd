import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // ^2.0.0
import { ICampaign, CampaignStatus, CampaignObjective, PlatformType } from '../types/campaign';
import { ApiClient } from '../lib/api';
import { ApiError } from '../types/common';

// Initialize API client with environment variable
const apiClient = new ApiClient(process.env.NEXT_PUBLIC_API_URL || '');

// State interface definition
interface CampaignState {
    campaigns: Record<string, ICampaign>;
    loading: boolean;
    error: ApiError | null;
    optimizationStatus: Record<string, {
        inProgress: boolean;
        lastOptimized: Date | null;
        error: ApiError | null;
    }>;
    selectedCampaignId: string | null;
}

// Initial state
const initialState: CampaignState = {
    campaigns: {},
    loading: false,
    error: null,
    optimizationStatus: {},
    selectedCampaignId: null
};

// Async thunks for campaign operations
export const createCampaign = createAsyncThunk<
    ICampaign,
    Partial<ICampaign>,
    { rejectValue: ApiError }
>(
    'campaigns/create',
    async (campaign, { rejectWithValue }) => {
        try {
            const response = await apiClient.createCampaign(campaign);
            return response;
        } catch (error) {
            return rejectWithValue(error as ApiError);
        }
    }
);

export const optimizeCampaign = createAsyncThunk<
    ICampaign,
    string,
    { rejectValue: ApiError }
>(
    'campaigns/optimize',
    async (campaignId, { rejectWithValue }) => {
        try {
            const response = await apiClient.optimizeCampaign(campaignId);
            return response;
        } catch (error) {
            return rejectWithValue(error as ApiError);
        }
    }
);

export const updateCampaignStatus = createAsyncThunk<
    ICampaign,
    { campaignId: string; status: CampaignStatus },
    { rejectValue: ApiError }
>(
    'campaigns/updateStatus',
    async ({ campaignId, status }, { rejectWithValue }) => {
        try {
            const response = await apiClient.updateCampaignStatus(campaignId, status);
            return response;
        } catch (error) {
            return rejectWithValue(error as ApiError);
        }
    }
);

// Campaign slice
const campaignSlice = createSlice({
    name: 'campaigns',
    initialState,
    reducers: {
        selectCampaign: (state, action: PayloadAction<string>) => {
            state.selectedCampaignId = action.payload;
        },
        clearCampaignError: (state) => {
            state.error = null;
        },
        updateCampaignLocally: (state, action: PayloadAction<ICampaign>) => {
            const campaign = action.payload;
            state.campaigns[campaign.id] = campaign;
        },
        resetOptimizationStatus: (state, action: PayloadAction<string>) => {
            const campaignId = action.payload;
            if (state.optimizationStatus[campaignId]) {
                state.optimizationStatus[campaignId] = {
                    inProgress: false,
                    lastOptimized: null,
                    error: null
                };
            }
        }
    },
    extraReducers: (builder) => {
        // Create campaign reducers
        builder.addCase(createCampaign.pending, (state) => {
            state.loading = true;
            state.error = null;
        });
        builder.addCase(createCampaign.fulfilled, (state, action) => {
            state.loading = false;
            state.campaigns[action.payload.id] = action.payload;
            state.optimizationStatus[action.payload.id] = {
                inProgress: false,
                lastOptimized: null,
                error: null
            };
        });
        builder.addCase(createCampaign.rejected, (state, action) => {
            state.loading = false;
            state.error = action.payload || {
                code: 'UNKNOWN_ERROR',
                message: 'An unknown error occurred'
            };
        });

        // Optimize campaign reducers
        builder.addCase(optimizeCampaign.pending, (state, action) => {
            const campaignId = action.meta.arg;
            state.optimizationStatus[campaignId] = {
                ...state.optimizationStatus[campaignId],
                inProgress: true,
                error: null
            };
        });
        builder.addCase(optimizeCampaign.fulfilled, (state, action) => {
            const campaign = action.payload;
            state.campaigns[campaign.id] = campaign;
            state.optimizationStatus[campaign.id] = {
                inProgress: false,
                lastOptimized: new Date(),
                error: null
            };
        });
        builder.addCase(optimizeCampaign.rejected, (state, action) => {
            const campaignId = action.meta.arg;
            state.optimizationStatus[campaignId] = {
                ...state.optimizationStatus[campaignId],
                inProgress: false,
                error: action.payload || {
                    code: 'OPTIMIZATION_ERROR',
                    message: 'Campaign optimization failed'
                }
            };
        });

        // Update campaign status reducers
        builder.addCase(updateCampaignStatus.fulfilled, (state, action) => {
            const campaign = action.payload;
            state.campaigns[campaign.id] = campaign;
        });
    }
});

// Selectors
export const selectAllCampaigns = (state: { campaigns: CampaignState }) =>
    Object.values(state.campaigns.campaigns);

export const selectCampaignById = (state: { campaigns: CampaignState }, id: string) =>
    state.campaigns.campaigns[id];

export const selectCampaignOptimizationStatus = (
    state: { campaigns: CampaignState },
    campaignId: string
) => state.campaigns.optimizationStatus[campaignId];

export const selectActiveCampaigns = (state: { campaigns: CampaignState }) =>
    Object.values(state.campaigns.campaigns).filter(
        (campaign) => campaign.status === CampaignStatus.ACTIVE
    );

export const selectCampaignsByPlatform = (
    state: { campaigns: CampaignState },
    platform: PlatformType
) =>
    Object.values(state.campaigns.campaigns).filter(
        (campaign) => campaign.platform === platform
    );

// Export actions and reducer
export const {
    selectCampaign,
    clearCampaignError,
    updateCampaignLocally,
    resetOptimizationStatus
} = campaignSlice.actions;

export default campaignSlice.reducer;