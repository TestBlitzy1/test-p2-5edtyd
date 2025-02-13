import React, { useState, useEffect } from 'react';
import { Card, TextField, Button, Alert } from '@mui/material';
import { usePlatform } from '../../hooks/usePlatform';
import { PlatformType, LinkedInAdsConfig } from '../../types/platform';

/**
 * Enhanced LinkedIn Ads integration component with health monitoring
 * @version 1.0.0
 */
export const LinkedInAdsIntegration: React.FC = () => {
    // Platform integration hook
    const {
        connectPlatform,
        disconnectPlatform,
        updateConfig,
        checkHealth,
        verifyApiVersion
    } = usePlatform();

    // Component state
    const [config, setConfig] = useState<LinkedInAdsConfig>({
        accountId: '',
        clientId: '',
        clientSecret: '',
        status: 'INACTIVE',
        capabilities: {
            supportedObjectives: [],
            supportedFormats: [],
            audienceNetworks: [],
            maxBudget: 0,
            minBudget: 0,
            bidStrategies: []
        },
        validationRules: {
            titleMaxLength: 0,
            descriptionMaxLength: 0,
            imageAspectRatios: [],
            allowedMediaTypes: [],
            budgetConstraints: {
                min: 0,
                max: 0,
                currency: 'USD'
            }
        }
    });

    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [healthStatus, setHealthStatus] = useState<{
        status: 'healthy' | 'degraded' | 'down';
        lastChecked: Date;
    }>({
        status: 'healthy',
        lastChecked: new Date()
    });

    /**
     * Handles LinkedIn OAuth authentication with enhanced error handling
     * and API version compatibility checks
     */
    const handleConnect = async () => {
        try {
            setIsConnecting(true);
            setError(null);

            // Verify API version compatibility
            const isCompatible = await verifyApiVersion(PlatformType.LINKEDIN);
            if (!isCompatible) {
                throw new Error('Incompatible LinkedIn Ads API version');
            }

            // Initialize platform connection with health monitoring
            await connectPlatform(PlatformType.LINKEDIN, config, {
                validateApiVersion: true,
                enableHealthMonitoring: true,
                retryAttempts: 3,
                healthCheckInterval: 60000 // 1 minute
            });

            // Start periodic health checks
            initializeHealthMonitoring();
        } catch (err) {
            setError(err.message || 'Failed to connect to LinkedIn Ads');
            console.error('LinkedIn connection error:', err);
        } finally {
            setIsConnecting(false);
        }
    };

    /**
     * Handles LinkedIn platform disconnection with cleanup
     */
    const handleDisconnect = async () => {
        try {
            await disconnectPlatform(PlatformType.LINKEDIN);
            setConfig({
                ...config,
                status: 'INACTIVE'
            });
            setError(null);
        } catch (err) {
            setError(err.message || 'Failed to disconnect from LinkedIn Ads');
            console.error('LinkedIn disconnection error:', err);
        }
    };

    /**
     * Initializes health monitoring for the LinkedIn integration
     */
    const initializeHealthMonitoring = () => {
        const monitorHealth = async () => {
            try {
                const status = await checkHealth(PlatformType.LINKEDIN);
                setHealthStatus({
                    status: status.status,
                    lastChecked: new Date()
                });

                // Handle degraded or down status
                if (status.status !== 'healthy') {
                    console.warn('LinkedIn integration health degraded:', status);
                }
            } catch (err) {
                console.error('Health check failed:', err);
            }
        };

        // Initial check
        monitorHealth();

        // Setup periodic monitoring
        const intervalId = setInterval(monitorHealth, 60000);

        // Cleanup on unmount
        return () => clearInterval(intervalId);
    };

    /**
     * Handles configuration updates with validation
     */
    const handleConfigUpdate = async (field: keyof LinkedInAdsConfig, value: string) => {
        try {
            const updatedConfig = {
                ...config,
                [field]: value
            };
            setConfig(updatedConfig);

            // Update platform configuration if connected
            if (config.status === 'ACTIVE') {
                await updateConfig(PlatformType.LINKEDIN, updatedConfig);
            }
        } catch (err) {
            setError(err.message || 'Failed to update configuration');
            console.error('Configuration update error:', err);
        }
    };

    return (
        <Card className="p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">LinkedIn Ads Integration</h2>

            {error && (
                <Alert severity="error" className="mb-4">
                    {error}
                </Alert>
            )}

            {healthStatus.status !== 'healthy' && (
                <Alert severity="warning" className="mb-4">
                    Integration health: {healthStatus.status}
                    Last checked: {healthStatus.lastChecked.toLocaleString()}
                </Alert>
            )}

            <div className="space-y-4">
                <TextField
                    fullWidth
                    label="Account ID"
                    value={config.accountId}
                    onChange={(e) => handleConfigUpdate('accountId', e.target.value)}
                    disabled={isConnecting || config.status === 'ACTIVE'}
                />

                <TextField
                    fullWidth
                    label="Client ID"
                    value={config.clientId}
                    onChange={(e) => handleConfigUpdate('clientId', e.target.value)}
                    disabled={isConnecting || config.status === 'ACTIVE'}
                />

                <TextField
                    fullWidth
                    type="password"
                    label="Client Secret"
                    value={config.clientSecret}
                    onChange={(e) => handleConfigUpdate('clientSecret', e.target.value)}
                    disabled={isConnecting || config.status === 'ACTIVE'}
                />
            </div>

            <div className="flex justify-end space-x-4 mt-6">
                {config.status === 'ACTIVE' ? (
                    <Button
                        variant="outlined"
                        color="secondary"
                        onClick={handleDisconnect}
                        disabled={isConnecting}
                    >
                        Disconnect
                    </Button>
                ) : (
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleConnect}
                        disabled={isConnecting || !config.accountId || !config.clientId || !config.clientSecret}
                    >
                        {isConnecting ? 'Connecting...' : 'Connect'}
                    </Button>
                )}
            </div>
        </Card>
    );
};

export default LinkedInAdsIntegration;