import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { 
    PlatformType, 
    PlatformCredentials, 
    PlatformIntegrationStatus,
    LinkedInAdsConfig,
    GoogleAdsConfig
} from '../types/platform';
import { ApiError } from '../types/common';

/**
 * Platform state interface with enhanced error tracking and API version management
 * @version 1.0.0
 */
interface PlatformState {
    linkedInConfig: LinkedInAdsConfig | null;
    googleAdsConfig: GoogleAdsConfig | null;
    connectionStatus: Record<PlatformType, PlatformIntegrationStatus>;
    lastSyncTime: Record<PlatformType, Date | null>;
    platformSpecificSettings: Record<PlatformType, Record<string, any>>;
    apiVersions: Record<PlatformType, string | null>;
    syncRetryConfig: {
        maxRetries: number;
        retryDelay: number;
        retryBackoffMultiplier: number;
    };
}

/**
 * Initial platform state with default values
 */
const initialState: PlatformState = {
    linkedInConfig: null,
    googleAdsConfig: null,
    connectionStatus: {
        [PlatformType.LINKEDIN]: {
            isConnected: false,
            error: null,
            lastSyncTime: null,
            rateLimitStatus: {
                remaining: 0,
                limit: 0,
                resetAt: new Date(),
                isThrottled: false
            },
            healthStatus: {
                status: 'healthy',
                lastChecked: new Date(),
                responseTime: 0,
                availabilityScore: 1
            }
        },
        [PlatformType.GOOGLE]: {
            isConnected: false,
            error: null,
            lastSyncTime: null,
            rateLimitStatus: {
                remaining: 0,
                limit: 0,
                resetAt: new Date(),
                isThrottled: false
            },
            healthStatus: {
                status: 'healthy',
                lastChecked: new Date(),
                responseTime: 0,
                availabilityScore: 1
            }
        }
    },
    lastSyncTime: {
        [PlatformType.LINKEDIN]: null,
        [PlatformType.GOOGLE]: null
    },
    platformSpecificSettings: {},
    apiVersions: {
        [PlatformType.LINKEDIN]: null,
        [PlatformType.GOOGLE]: null
    },
    syncRetryConfig: {
        maxRetries: 3,
        retryDelay: 1000,
        retryBackoffMultiplier: 1.5
    }
};

/**
 * Platform Redux slice with enhanced error handling and version management
 */
const platformSlice = createSlice({
    name: 'platform',
    initialState,
    reducers: {
        setConfig: (state, action: PayloadAction<{
            config: LinkedInAdsConfig | GoogleAdsConfig;
            platform: PlatformType;
        }>) => {
            const { config, platform } = action.payload;
            if (platform === PlatformType.LINKEDIN) {
                state.linkedInConfig = config as LinkedInAdsConfig;
            } else {
                state.googleAdsConfig = config as GoogleAdsConfig;
            }
            // Reset any previous configuration errors
            state.connectionStatus[platform].error = null;
            // Update API version tracking
            state.apiVersions[platform] = config.apiVersion;
        },

        setConnectionStatus: (state, action: PayloadAction<{
            status: PlatformIntegrationStatus;
            platform: PlatformType;
        }>) => {
            const { status, platform } = action.payload;
            state.connectionStatus[platform] = {
                ...state.connectionStatus[platform],
                ...status
            };
            
            if (status.isConnected) {
                state.lastSyncTime[platform] = new Date();
            }
        },

        updateApiVersion: (state, action: PayloadAction<{
            platform: PlatformType;
            version: string;
        }>) => {
            const { platform, version } = action.payload;
            state.apiVersions[platform] = version;
        },

        setSyncRetryConfig: (state, action: PayloadAction<{
            maxRetries?: number;
            retryDelay?: number;
            retryBackoffMultiplier?: number;
        }>) => {
            state.syncRetryConfig = {
                ...state.syncRetryConfig,
                ...action.payload
            };
        },

        setPlatformSpecificSettings: (state, action: PayloadAction<{
            platform: PlatformType;
            settings: Record<string, any>;
        }>) => {
            const { platform, settings } = action.payload;
            state.platformSpecificSettings[platform] = {
                ...state.platformSpecificSettings[platform],
                ...settings
            };
        },

        resetPlatformState: (state, action: PayloadAction<PlatformType | undefined>) => {
            const platform = action.payload;
            if (platform) {
                // Reset specific platform
                if (platform === PlatformType.LINKEDIN) {
                    state.linkedInConfig = null;
                } else {
                    state.googleAdsConfig = null;
                }
                state.connectionStatus[platform] = initialState.connectionStatus[platform];
                state.lastSyncTime[platform] = null;
                state.apiVersions[platform] = null;
                delete state.platformSpecificSettings[platform];
            } else {
                // Reset all platforms
                return initialState;
            }
        }
    }
});

// Export actions
export const {
    setConfig,
    setConnectionStatus,
    updateApiVersion,
    setSyncRetryConfig,
    setPlatformSpecificSettings,
    resetPlatformState
} = platformSlice.actions;

// Selectors with memoization
export const selectPlatformConfig = (state: { platform: PlatformState }, platform: PlatformType) =>
    platform === PlatformType.LINKEDIN ? state.platform.linkedInConfig : state.platform.googleAdsConfig;

export const selectConnectionStatus = (state: { platform: PlatformState }, platform: PlatformType) =>
    state.platform.connectionStatus[platform];

export const selectApiVersion = (state: { platform: PlatformState }, platform: PlatformType) =>
    state.platform.apiVersions[platform];

export const selectLastSyncTime = (state: { platform: PlatformState }, platform: PlatformType) =>
    state.platform.lastSyncTime[platform];

export const selectPlatformSpecificSettings = (state: { platform: PlatformState }, platform: PlatformType) =>
    state.platform.platformSpecificSettings[platform] || {};

// Export reducer
export default platformSlice.reducer;