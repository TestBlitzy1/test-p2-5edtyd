// External imports
import { Request, Response } from 'express'; // ^4.18.0
import winston from 'winston'; // ^3.11.0
import rateLimit from 'express-rate-limit'; // ^7.1.0
import { validationResult, body } from 'express-validator'; // ^7.0.0

// Internal imports
import { GoogleAdsService } from '../services/google.service';
import { handleApiError } from '../utils/api.utils';
import { ICampaign, PlatformType, CampaignStatus } from '../../../shared/types/campaign.types';
import { IAuthRequest } from '../../../shared/types/auth.types';
import { config } from '../config';

/**
 * Controller class for handling Google Ads platform integration requests
 * with comprehensive validation and error handling
 */
export class GoogleAdsController {
    private readonly googleAdsService: GoogleAdsService;
    private readonly logger: winston.Logger;
    private readonly rateLimiter: any;

    constructor(googleAdsService: GoogleAdsService) {
        this.googleAdsService = googleAdsService;

        // Initialize structured logging
        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'google-controller' },
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'google-controller-error.log', level: 'error' })
            ]
        });

        // Configure rate limiter based on Google Ads API quotas
        this.rateLimiter = rateLimit({
            windowMs: 60 * 1000, // 1 minute window
            max: config.platforms[PlatformType.GOOGLE].rateLimits.requestsPerMinute,
            message: 'Too many requests from this IP, please try again later'
        });
    }

    /**
     * Handles campaign creation requests for Google Ads with comprehensive validation
     * @param req Express request object with campaign data
     * @param res Express response object
     */
    public async createCampaign(req: IAuthRequest, res: Response): Promise<void> {
        const startTime = Date.now();
        const correlationId = req.headers['x-correlation-id'] || Date.now().toString();

        try {
            // Validate request body
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                this.logger.error('Campaign validation failed', {
                    correlationId,
                    errors: errors.array()
                });
                res.status(400).json({ errors: errors.array() });
                return;
            }

            // Extract and validate campaign data
            const campaign: ICampaign = {
                ...req.body,
                userId: req.user.id,
                platform: PlatformType.GOOGLE,
                status: CampaignStatus.DRAFT,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Check API quota before proceeding
            await this.googleAdsService.checkApiQuota();

            // Validate campaign structure
            await this.googleAdsService.validateCampaignStructure(campaign);

            // Create campaign
            const campaignId = await this.googleAdsService.createCampaign(campaign);

            // Calculate creation time for SLA monitoring
            const processingTime = Date.now() - startTime;

            this.logger.info('Campaign created successfully', {
                correlationId,
                campaignId,
                processingTime,
                userId: req.user.id
            });

            res.status(201).json({
                campaignId,
                processingTime,
                status: CampaignStatus.DRAFT
            });

        } catch (error) {
            this.logger.error('Campaign creation failed', {
                correlationId,
                error,
                userId: req.user.id
            });

            const apiError = await handleApiError(error as Error, PlatformType.GOOGLE);
            res.status(apiError.statusCode || 500).json({
                error: apiError.message,
                code: apiError.errorCode
            });
        }
    }

    /**
     * Handles campaign update requests with validation
     * @param req Express request object with update data
     * @param res Express response object
     */
    public async updateCampaign(req: IAuthRequest, res: Response): Promise<void> {
        const correlationId = req.headers['x-correlation-id'] || Date.now().toString();
        const campaignId = req.params.campaignId;

        try {
            // Validate request body
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                this.logger.error('Update validation failed', {
                    correlationId,
                    campaignId,
                    errors: errors.array()
                });
                res.status(400).json({ errors: errors.array() });
                return;
            }

            // Extract and validate update data
            const updates: Partial<ICampaign> = {
                ...req.body,
                updatedAt: new Date()
            };

            // Update campaign
            await this.googleAdsService.updateCampaign(campaignId, updates);

            this.logger.info('Campaign updated successfully', {
                correlationId,
                campaignId,
                userId: req.user.id
            });

            res.status(200).json({
                message: 'Campaign updated successfully',
                campaignId
            });

        } catch (error) {
            this.logger.error('Campaign update failed', {
                correlationId,
                error,
                campaignId,
                userId: req.user.id
            });

            const apiError = await handleApiError(error as Error, PlatformType.GOOGLE);
            res.status(apiError.statusCode || 500).json({
                error: apiError.message,
                code: apiError.errorCode
            });
        }
    }

    /**
     * Retrieves and processes campaign performance metrics
     * @param req Express request object
     * @param res Express response object
     */
    public async getCampaignPerformance(req: IAuthRequest, res: Response): Promise<void> {
        const correlationId = req.headers['x-correlation-id'] || Date.now().toString();
        const campaignId = req.params.campaignId;

        try {
            // Get performance metrics
            const performance = await this.googleAdsService.getCampaignPerformance(campaignId);

            this.logger.info('Performance data retrieved successfully', {
                correlationId,
                campaignId,
                userId: req.user.id
            });

            res.status(200).json(performance);

        } catch (error) {
            this.logger.error('Performance data retrieval failed', {
                correlationId,
                error,
                campaignId,
                userId: req.user.id
            });

            const apiError = await handleApiError(error as Error, PlatformType.GOOGLE);
            res.status(apiError.statusCode || 500).json({
                error: apiError.message,
                code: apiError.errorCode
            });
        }
    }

    /**
     * Pauses an active campaign
     * @param req Express request object
     * @param res Express response object
     */
    public async pauseCampaign(req: IAuthRequest, res: Response): Promise<void> {
        const correlationId = req.headers['x-correlation-id'] || Date.now().toString();
        const campaignId = req.params.campaignId;

        try {
            await this.googleAdsService.pauseCampaign(campaignId);

            this.logger.info('Campaign paused successfully', {
                correlationId,
                campaignId,
                userId: req.user.id
            });

            res.status(200).json({
                message: 'Campaign paused successfully',
                campaignId
            });

        } catch (error) {
            this.logger.error('Campaign pause failed', {
                correlationId,
                error,
                campaignId,
                userId: req.user.id
            });

            const apiError = await handleApiError(error as Error, PlatformType.GOOGLE);
            res.status(apiError.statusCode || 500).json({
                error: apiError.message,
                code: apiError.errorCode
            });
        }
    }

    /**
     * Returns the configured rate limiter middleware
     */
    public getRateLimiter(): any {
        return this.rateLimiter;
    }
}