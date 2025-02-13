import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { usePlatform } from '../../hooks/usePlatform';
import { PlatformType } from '../../types/platform';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Size, Variant, DateRange } from '../../types/common';

/**
 * Interface for Google Ads integration component props
 */
interface GoogleAdsIntegrationProps {
  className?: string;
  onStatusChange?: (isConnected: boolean) => void;
  initialDateRange?: DateRange;
}

/**
 * Interface for platform health monitoring state
 */
interface HealthMonitoringState {
  status: 'healthy' | 'degraded' | 'down';
  lastChecked: Date;
  responseTime: number;
  availabilityScore: number;
}

/**
 * Error fallback component for error boundary
 */
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <Card
    variant={Variant.SECONDARY}
    className="p-4 bg-red-50 border border-red-200"
    testId="google-ads-error"
  >
    <h3 className="text-red-800 font-medium">Connection Error</h3>
    <p className="text-red-600 mt-2">{error.message}</p>
    <Button
      variant={Variant.PRIMARY}
      size={Size.SMALL}
      onClick={resetErrorBoundary}
      className="mt-4"
    >
      Retry Connection
    </Button>
  </Card>
);

/**
 * Google Ads platform integration component with enhanced monitoring and error handling
 */
export const GoogleAdsIntegration: React.FC<GoogleAdsIntegrationProps> = ({
  className,
  onStatusChange,
  initialDateRange
}) => {
  // Platform integration hooks
  const {
    isConnected,
    connectPlatform,
    disconnectPlatform,
    getPlatformMetrics,
    checkApiVersion,
    monitorPlatformHealth
  } = usePlatform();

  // Component state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [healthStatus, setHealthStatus] = useState<HealthMonitoringState>({
    status: 'healthy',
    lastChecked: new Date(),
    responseTime: 0,
    availabilityScore: 1
  });

  // Memoized configuration
  const platformConfig = useMemo(() => ({
    validateApiVersion: true,
    enableHealthMonitoring: true,
    retryAttempts: 3,
    healthCheckInterval: 60000 // 1 minute
  }), []);

  /**
   * Handles platform connection with enhanced error handling
   */
  const handleConnect = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Validate API version compatibility
      const apiVersion = await checkApiVersion(PlatformType.GOOGLE);
      
      // Initialize platform connection
      await connectPlatform(PlatformType.GOOGLE, {}, platformConfig);
      
      // Start health monitoring
      const healthMonitor = monitorPlatformHealth(PlatformType.GOOGLE);
      
      onStatusChange?.(true);
      
      // Fetch initial metrics
      if (initialDateRange) {
        const initialMetrics = await getPlatformMetrics(PlatformType.GOOGLE, initialDateRange);
        setMetrics(initialMetrics);
      }

      return () => {
        healthMonitor.stop();
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to Google Ads';
      setError(errorMessage);
      onStatusChange?.(false);
    } finally {
      setLoading(false);
    }
  }, [connectPlatform, checkApiVersion, monitorPlatformHealth, initialDateRange, onStatusChange]);

  /**
   * Handles platform disconnection with cleanup
   */
  const handleDisconnect = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await disconnectPlatform(PlatformType.GOOGLE);
      setMetrics(null);
      onStatusChange?.(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect from Google Ads';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [disconnectPlatform, onStatusChange]);

  /**
   * Updates platform health status
   */
  const updateHealthStatus = useCallback((status: HealthMonitoringState) => {
    setHealthStatus(status);
  }, []);

  /**
   * Effect for initializing health monitoring
   */
  useEffect(() => {
    if (isConnected) {
      const healthMonitor = monitorPlatformHealth(PlatformType.GOOGLE);
      healthMonitor.subscribe(updateHealthStatus);

      return () => {
        healthMonitor.unsubscribe(updateHealthStatus);
      };
    }
  }, [isConnected, monitorPlatformHealth, updateHealthStatus]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={handleConnect}
      resetKeys={[isConnected]}
    >
      <Card
        title="Google Ads Integration"
        variant={Variant.PRIMARY}
        className={className}
        testId="google-ads-integration"
      >
        <div className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  healthStatus.status === 'healthy'
                    ? 'bg-green-500'
                    : healthStatus.status === 'degraded'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
              />
              <span className="font-medium">
                Status: {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <Button
              variant={isConnected ? Variant.SECONDARY : Variant.PRIMARY}
              size={Size.MEDIUM}
              onClick={isConnected ? handleDisconnect : handleConnect}
              isLoading={loading}
              disabled={loading}
              ariaLabel={isConnected ? 'Disconnect from Google Ads' : 'Connect to Google Ads'}
            >
              {isConnected ? 'Disconnect' : 'Connect'}
            </Button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Platform Metrics */}
          {isConnected && metrics && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-md">
                <h4 className="text-sm font-medium text-gray-500">Impressions</h4>
                <p className="mt-1 text-2xl font-semibold">{metrics.impressions}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-md">
                <h4 className="text-sm font-medium text-gray-500">Clicks</h4>
                <p className="mt-1 text-2xl font-semibold">{metrics.clicks}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-md">
                <h4 className="text-sm font-medium text-gray-500">CTR</h4>
                <p className="mt-1 text-2xl font-semibold">{metrics.ctr}%</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-md">
                <h4 className="text-sm font-medium text-gray-500">Conversions</h4>
                <p className="mt-1 text-2xl font-semibold">{metrics.conversions}</p>
              </div>
            </div>
          )}

          {/* Health Monitoring */}
          {isConnected && (
            <div className="mt-4 p-4 bg-gray-50 rounded-md">
              <h4 className="text-sm font-medium text-gray-500">Platform Health</h4>
              <div className="mt-2 space-y-2">
                <p className="text-sm">
                  Status: <span className="font-medium">{healthStatus.status}</span>
                </p>
                <p className="text-sm">
                  Response Time: <span className="font-medium">{healthStatus.responseTime}ms</span>
                </p>
                <p className="text-sm">
                  Availability: <span className="font-medium">{healthStatus.availabilityScore * 100}%</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </ErrorBoundary>
  );
};

export default GoogleAdsIntegration;