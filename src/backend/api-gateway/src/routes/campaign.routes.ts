/**
 * Campaign management routes with enhanced security, performance monitoring,
 * and platform-specific integrations.
 * @version 1.0.0
 */

import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { ServiceProxy } from '../services/proxy.service';
import { ICampaign, CampaignStatus, PlatformType } from '../../../shared/types/campaign.types';
import { UserRole } from '../../../shared/types/auth.types';
import { CAMPAIGN_LIMITS } from '../../../shared/constants';
import { trace } from '@opentelemetry/api';

// Initialize router
const router = Router();

// Initialize tracer
const tracer = trace.getTracer('campaign-routes');

// Configure campaign service proxy with enhanced features
const campaignServiceProxy = new ServiceProxy({
  target: 'http://campaign-service:3000',
  timeout: 30000,
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 30000,
    halfOpenTimeout: 15000
  },
  rateLimit: {
    windowMs: 60000,
    maxRequestsAuthenticated: 100,
    maxRequestsUnauthenticated: 20
  },
  tracing: {
    enabled: true,
    serviceName: 'campaign-service'
  }
});

/**
 * GET /api/campaigns
 * List campaigns with pagination and filtering
 */
router.get('/campaigns',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(Object.values(CampaignStatus)),
  query('platform').optional().isIn(Object.values(PlatformType)),
  campaignServiceProxy.createProxyMiddleware('campaigns')
);

/**
 * GET /api/campaigns/:id
 * Get campaign by ID with detailed metrics
 */
router.get('/campaigns/:id',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  param('id').isUUID(),
  campaignServiceProxy.createProxyMiddleware('campaign')
);

/**
 * POST /api/campaigns
 * Create new campaign with AI-powered optimization
 */
router.post('/campaigns',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  body('name').isString().trim().isLength({ min: 3, max: 100 }),
  body('platform').isIn(Object.values(PlatformType)),
  body('objective').isString(),
  body('budget.amount')
    .isFloat({ min: CAMPAIGN_LIMITS.MIN_BUDGET_AMOUNT, max: CAMPAIGN_LIMITS.MAX_BUDGET_AMOUNT }),
  body('budget.currency').isString().isLength({ min: 3, max: 3 }),
  body('targeting').isObject(),
  body('aiOptimization').optional().isObject(),
  campaignServiceProxy.createProxyMiddleware('campaign')
);

/**
 * PUT /api/campaigns/:id
 * Update existing campaign
 */
router.put('/campaigns/:id',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  param('id').isUUID(),
  body('name').optional().isString().trim().isLength({ min: 3, max: 100 }),
  body('status').optional().isIn(Object.values(CampaignStatus)),
  body('budget').optional().isObject(),
  body('targeting').optional().isObject(),
  campaignServiceProxy.createProxyMiddleware('campaign')
);

/**
 * DELETE /api/campaigns/:id
 * Archive campaign (soft delete)
 */
router.delete('/campaigns/:id',
  authenticate,
  authorize([UserRole.ADMIN]),
  param('id').isUUID(),
  campaignServiceProxy.createProxyMiddleware('campaign')
);

/**
 * POST /api/campaigns/:id/optimize
 * Trigger AI optimization for campaign
 */
router.post('/campaigns/:id/optimize',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  param('id').isUUID(),
  body('optimizationGoals').isArray(),
  campaignServiceProxy.createProxyMiddleware('campaign-optimization')
);

/**
 * POST /api/campaigns/:id/preview
 * Generate AI-powered campaign preview
 */
router.post('/campaigns/:id/preview',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  param('id').isUUID(),
  campaignServiceProxy.createProxyMiddleware('campaign-preview')
);

/**
 * GET /api/campaigns/:id/performance
 * Get campaign performance metrics
 */
router.get('/campaigns/:id/performance',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  param('id').isUUID(),
  query('startDate').isISO8601(),
  query('endDate').isISO8601(),
  campaignServiceProxy.createProxyMiddleware('campaign-performance')
);

/**
 * POST /api/campaigns/:id/sync
 * Sync campaign with ad platform
 */
router.post('/campaigns/:id/sync',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  param('id').isUUID(),
  campaignServiceProxy.createProxyMiddleware('campaign-sync')
);

/**
 * GET /api/campaigns/health
 * Campaign service health check endpoint
 */
router.get('/campaigns/health',
  campaignServiceProxy.createProxyMiddleware('health')
);

export default router;