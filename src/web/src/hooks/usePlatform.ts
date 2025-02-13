import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ApiClient } from '../lib/api';
import { PlatformType } from '../types/platform';
import {
    setConfig,
    setConnectionStatus,
    resetPlatformState,
    updateApiVersion,
    setPlatformSpecificSettings,
    selectPlatformConfig,
    selectConnectionStatus,
    selectApiVersion,
    selectLastSyncTime
} from '../store/platformSlice';

// API version compatibility constants
const MINIMUM_API_VERSIONS = {
    [PlatformType.LINKEDIN]: '202401',
    [PlatformType.GOOGLE]: '15.0'
};

// Health check configuration
const HEALTH_CHECK_INTERVAL = 60000; // 1 minute
const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds

/**
 * Enhanced platform connection options interface
 */
interface PlatformConnectionOptions {
    validateApiVersion?: boolean;
    enableHealthMonitoring?: boolean;
    retryAttempts?: number;
    healthCheckInterval?: number;
}

/**
 * Custom hook for managing platform integrations with comprehensive error handling
 * and health monitoring capabilities
 */
export const usePlatform = () => {
    const dispatch = useDispatch();
    const apiClient = new ApiClient(process.env.NEXT_PUBLIC_API_URL);

    /**
     * Platform connection handler with enhanced error handling and health monitoring
     */
    const connectPlatform = useCallback(async (
        platformType: PlatformType,
        credentials: any,
        options: PlatformConnectionOptions = {}
    ) => {
        try {
            // Validate API version compatibility if enabled
            if (options.validateApiVersion) {
                const apiVersion = await apiClient.checkApiVersion(platformType);
                const minimumVersion = MINIMUM_API_VERSIONS[platformType];
                
                if (apiVersion < minimumVersion) {
                    throw new Error(`Unsupported API version. Minimum required: ${minimumVersion}`);
                }
                
                dispatch(updateApiVersion({ platform: platformType, version: apiVersion }));
            }

            // Attempt platform connection
            const connectionResult = await apiClient.connectPlatform(platformType, credentials);
            
            // Update platform configuration
            dispatch(setConfig({
                platform: platformType,
                config: connectionResult.config
            }));

            // Update connection status
            dispatch(setConnectionStatus({
                platform: platformType,
                status: {
                    isConnected: true,
                    lastSyncTime: new Date(),
                    error: null,
                    rateLimitStatus: connectionResult.rateLimitStatus,
                    healthStatus: connectionResult.healthStatus
                }
            }));

            // Initialize health monitoring if enabled
            if (options.enableHealthMonitoring) {
                initializeHealthMonitoring(platformType, options.healthCheckInterval);
            }

            return connectionResult;
        } catch (error) {
            const errorDetails = {
                code: error.code || 'CONNECTION_ERROR',
                message: error.message || 'Failed to connect to platform',
                details: error.details || {}
            };

            dispatch(setConnectionStatus({
                platform: platformType,
                status: {
                    isConnected: false,
                    error: errorDetails,
                    lastSyncTime: null,
                    rateLimitStatus: {
                        remaining: 0,
                        limit: 0,
                        resetAt: new Date(),
                        isThrottled: false
                    },
                    healthStatus: {
                        status: 'down',
                        lastChecked: new Date(),
                        responseTime: 0,
                        availabilityScore: 0
                    }
                }
            }));

            throw errorDetails;
        }
    }, [dispatch, apiClient]);

    /**
     * Platform disconnection handler with cleanup
     */
    const disconnectPlatform = useCallback(async (platformType: PlatformType) => {
        try {
            await apiClient.disconnectPlatform(platformType);
            dispatch(resetPlatformState(platformType));
        } catch (error) {
            console.error(`Failed to disconnect ${platformType}:`, error);
            throw error;
        }
    }, [dispatch, apiClient]);

    /**
     * Platform health monitoring initialization
     */
    const initializeHealthMonitoring = useCallback((
        platformType: PlatformType,
        interval: number = HEALTH_CHECK_INTERVAL
    ) => {
        const checkHealth = async () => {
            try {
                const healthStatus = await apiClient.validatePlatformHealth(
                    platformType,
                    { timeout: HEALTH_CHECK_TIMEOUT }
                );

                dispatch(setConnectionStatus({
                    platform: platformType,
                    status: {
                        ...selectConnectionStatus({ platform: { connectionStatus: {} } }, platformType),
                        healthStatus
                    }
                }));
            } catch (error) {
                console.error(`Health check failed for ${platformType}:`, error);
            }
        };

        // Initial health check
        checkHealth();

        // Setup periodic health monitoring
        const monitoringInterval = setInterval(checkHealth, interval);

        // Cleanup function
        return () => clearInterval(monitoringInterval);
    }, [dispatch, apiClient]);

    /**
     * Platform configuration update handler
     */
    const updatePlatformConfig = useCallback(async (
        platformType: PlatformType,
        config: any
    ) => {
        try {
            dispatch(setPlatformSpecificSettings({
                platform: platformType,
                settings: config
            }));
        } catch (error) {
            console.error(`Failed to update ${platformType} config:`, error);
            throw error;
        }
    }, [dispatch]);

    // Selectors for platform state
    const platformConfig = useCallback((platformType: PlatformType) => 
        useSelector(state => selectPlatformConfig(state, platformType)), []);
    
    const connectionStatus = useCallback((platformType: PlatformType) =>
        useSelector(state => selectConnectionStatus(state, platformType)), []);
    
    const apiVersion = useCallback((platformType: PlatformType) =>
        useSelector(state => selectApiVersion(state, platformType)), []);
    
    const lastSyncTime = useCallback((platformType: PlatformType) =>
        useSelector(state => selectLastSyncTime(state, platformType)), []);

    return {
        connectPlatform,
        disconnectPlatform,
        updatePlatformConfig,
        platformConfig,
        connectionStatus,
        apiVersion,
        lastSyncTime
    };
};

export default usePlatform;