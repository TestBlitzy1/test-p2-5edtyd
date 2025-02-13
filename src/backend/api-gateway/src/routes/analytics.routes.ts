/**
 * @fileoverview Analytics API routes with real-time performance tracking and forecasting
 * Implements comprehensive analytics functionality with security, monitoring, and caching
 * @version 1.0.0
 */

import { Router } from 'express'; // ^4.18.2
import { authenticate, authorize } from '../middleware/auth.middleware';
import { ServiceProxy } from '../services/proxy.service';
import { IAnalytics } from '../../../shared/types/analytics.types';
import { UserRole } from '../../../shared/types/auth.types';
import { ANALYTICS_CONFIG } from '../../../shared/constants';
import { Logger } from '../../../shared/utils/logger';

// Initialize logger
const logger = new Logger('AnalyticsRoutes');

// Initialize analytics router
const analyticsRouter = Router();

// Configure analytics service proxy with enhanced monitoring
const analyticsProxy = new ServiceProxy({
  target: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3003',
  timeout: ANALYTICS_CONFIG.REAL_TIME_UPDATE_INTERVAL,
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 30000,
    halfOpenTimeout: 15000
  },
  rateLimit: {
    windowMs: 60000,
    maxRequestsAuthenticated: 1000,
    maxRequestsUnauthenticated: 100
  },
  tracing: {
    enabled: true,
    serviceName: 'analytics-service'
  },
  platformSpecific: {
    transformResponse: true,
    customHeaders: {
      'x-analytics-version': '1.0'
    }
  }
});

/**
 * GET /api/analytics/campaigns/:campaignId
 * Retrieve real-time analytics data for a specific campaign
 */
analyticsRouter.get(
  '/campaigns/:campaignId',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.ANALYST]),
  analyticsProxy.createProxyMiddleware('analytics')
);

/**
 * GET /api/analytics/campaigns/:campaignId/performance
 * Get detailed performance report with metrics and trends
 */
analyticsRouter.get(
  '/campaigns/:campaignId/performance',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.ANALYST]),
  analyticsProxy.createProxyMiddleware('analytics')
);

/**
 * GET /api/analytics/campaigns/:campaignId/forecast
 * Get AI-driven performance forecast for a campaign
 */
analyticsRouter.get(
  '/campaigns/:campaignId/forecast',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  analyticsProxy.createProxyMiddleware('analytics')
);

/**
 * GET /api/analytics/dashboard
 * Get aggregated analytics dashboard data
 */
analyticsRouter.get(
  '/dashboard',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.ANALYST]),
  analyticsProxy.createProxyMiddleware('analytics')
);

/**
 * GET /api/analytics/health
 * Health check endpoint for monitoring system status
 */
analyticsRouter.get('/health', async (req, res) => {
  try {
    const healthStatus = await analyticsProxy.proxyRequest({
      method: 'GET',
      path: '/health',
      headers: {
        'x-correlation-id': req.headers['x-correlation-id']
      }
    });
    res.json(healthStatus);
  } catch (error) {
    logger.error('Health check failed', error as Error);
    res.status(503).json({ status: 'error', message: 'Service unavailable' });
  }
});

// Error handling middleware
analyticsRouter.use((err: any, req: any, res: any, next: any) => {
  logger.error('Analytics route error', err, {
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });
  next(err);
});

export default analyticsRouter;