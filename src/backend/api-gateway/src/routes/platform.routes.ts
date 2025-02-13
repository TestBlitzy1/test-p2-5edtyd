// External imports
import { Router } from 'express'; // ^4.18.2
import compression from 'compression'; // ^1.7.4
import helmet from 'helmet'; // ^7.0.0
import { body, param } from 'express-validator'; // ^7.0.0
import rateLimit from 'express-rate-limit'; // ^6.7.0

// Internal imports
import { GoogleAdsController } from '../../../platform-integration/src/controllers/google.controller';
import { LinkedInController } from '../../../platform-integration/src/controllers/linkedin.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { errorHandler } from '../middleware/error.middleware';
import { UserRole } from '../../../shared/types/auth.types';
import { CAMPAIGN_LIMITS, API_RATE_LIMITS } from '../../../shared/constants';

// Initialize router
const router = Router();

// Common campaign validation rules
const campaignValidationRules = [
    body('name').isString().trim().isLength({ min: 3, max: 100 }),
    body('budget.amount')
        .isNumeric()
        .custom(value => value >= CAMPAIGN_LIMITS.MIN_BUDGET_AMOUNT && value <= CAMPAIGN_LIMITS.MAX_BUDGET_AMOUNT),
    body('budget.currency').isString().isLength({ min: 3, max: 3 }),
    body('targeting.locations').isArray().notEmpty(),
    body('targeting.industries').optional().isArray(),
    body('targeting.companySize').optional().isArray(),
    param('campaignId').optional().isString().trim()
];

/**
 * Initializes Google Ads platform routes with comprehensive middleware stack
 * @param controller Google Ads controller instance
 */
const initializeGoogleRoutes = (controller: GoogleAdsController) => {
    // Apply common middleware
    router.use('/google', [
        compression(),
        helmet(),
        rateLimit({
            windowMs: API_RATE_LIMITS.RATE_LIMIT_WINDOW,
            max: API_RATE_LIMITS.MAX_REQUESTS_PER_MINUTE,
            message: 'Too many requests from this IP for Google Ads API'
        })
    ]);

    // Campaign creation
    router.post('/google/campaigns',
        authenticate,
        authorize([UserRole.ADMIN, UserRole.MANAGER]),
        campaignValidationRules,
        controller.createCampaign
    );

    // Campaign update
    router.put('/google/campaigns/:campaignId',
        authenticate,
        authorize([UserRole.ADMIN, UserRole.MANAGER]),
        campaignValidationRules,
        controller.updateCampaign
    );

    // Campaign performance metrics
    router.get('/google/campaigns/:campaignId/performance',
        authenticate,
        authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.ANALYST]),
        param('campaignId').isString().trim(),
        controller.getCampaignPerformance
    );

    // Pause campaign
    router.post('/google/campaigns/:campaignId/pause',
        authenticate,
        authorize([UserRole.ADMIN, UserRole.MANAGER]),
        param('campaignId').isString().trim(),
        controller.pauseCampaign
    );
};

/**
 * Initializes LinkedIn platform routes with comprehensive middleware stack
 * @param controller LinkedIn controller instance
 */
const initializeLinkedInRoutes = (controller: LinkedInController) => {
    // Apply common middleware
    router.use('/linkedin', [
        compression(),
        helmet(),
        rateLimit({
            windowMs: API_RATE_LIMITS.RATE_LIMIT_WINDOW,
            max: API_RATE_LIMITS.MAX_REQUESTS_PER_MINUTE,
            message: 'Too many requests from this IP for LinkedIn API'
        })
    ]);

    // Campaign creation
    router.post('/linkedin/campaigns',
        authenticate,
        authorize([UserRole.ADMIN, UserRole.MANAGER]),
        [
            ...campaignValidationRules,
            body('platformConfig.linkedin').isObject(),
            body('platformConfig.linkedin.campaignType').isString(),
            body('platformConfig.linkedin.objectiveType').isString()
        ],
        controller.createCampaign
    );

    // Campaign update
    router.put('/linkedin/campaigns/:campaignId',
        authenticate,
        authorize([UserRole.ADMIN, UserRole.MANAGER]),
        campaignValidationRules,
        controller.updateCampaign
    );

    // Get campaign details
    router.get('/linkedin/campaigns/:campaignId',
        authenticate,
        authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.ANALYST]),
        param('campaignId').isString().trim(),
        controller.getCampaign
    );

    // Delete campaign
    router.delete('/linkedin/campaigns/:campaignId',
        authenticate,
        authorize([UserRole.ADMIN, UserRole.MANAGER]),
        param('campaignId').isString().trim(),
        controller.deleteCampaign
    );

    // Pause campaign
    router.post('/linkedin/campaigns/:campaignId/pause',
        authenticate,
        authorize([UserRole.ADMIN, UserRole.MANAGER]),
        param('campaignId').isString().trim(),
        controller.pauseCampaign
    );
};

// Initialize platform routes
const googleAdsController = new GoogleAdsController();
const linkedInController = new LinkedInController();

initializeGoogleRoutes(googleAdsController);
initializeLinkedInRoutes(linkedInController);

// Apply error handling middleware
router.use(errorHandler);

export default router;