// External imports
import { Request, Response } from 'express'; // ^4.18.0
import { rateLimit } from 'express-rate-limit'; // ^7.1.0
import helmet from 'helmet'; // ^7.1.0
import winston from 'winston'; // ^3.11.0
import Joi from 'joi'; // ^17.11.0

// Internal imports
import { LinkedInService } from '../services/linkedin.service';
import { handleApiError } from '../utils/api.utils';
import { ICampaign, PlatformType, CampaignStatus } from '../../../shared/types/campaign.types';
import { IAuthRequest } from '../../../shared/types/auth.types';
import { platforms, api } from '../config';

/**
 * Campaign request validation schema
 */
const campaignSchema = Joi.object({
    name: Joi.string().required().min(3).max(100),
    objective: Joi.string().required(),
    budget: Joi.object({
        amount: Joi.number().required().min(10),
        currency: Joi.string().required().length(3),
        period: Joi.string().required(),
        startDate: Joi.date().required(),
        endDate: Joi.date().greater(Joi.ref('startDate'))
    }).required(),
    targeting: Joi.object({
        locations: Joi.array().min(1).required(),
        industries: Joi.array(),
        companySize: Joi.array(),
        jobTitles: Joi.array(),
        platformSpecific: Joi.object({
            linkedin: Joi.object({
                skills: Joi.array(),
                groups: Joi.array(),
                schools: Joi.array()
            })
        })
    }).required(),
    platformConfig: Joi.object({
        linkedin: Joi.object({
            campaignType: Joi.string().required(),
            objectiveType: Joi.string().required(),
            audienceExpansion: Joi.boolean(),
            enabledNetworks: Joi.array()
        }).required()
    }).required()
});

/**
 * Controller handling LinkedIn Ads platform integration with comprehensive security,
 * validation, and monitoring features
 */
export class LinkedInController {
    private readonly logger: winston.Logger;
    private readonly rateLimiter: any;

    constructor(private readonly linkedInService: LinkedInService) {
        // Initialize logger
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.json(),
            defaultMeta: { service: 'linkedin-controller' },
            transports: [
                new winston.transports.File({ filename: 'error.log', level: 'error' }),
                new winston.transports.File({ filename: 'combined.log' })
            ]
        });

        // Configure rate limiter
        this.rateLimiter = rateLimit({
            windowMs: api.rateLimiting.windowMs,
            max: api.rateLimiting.maxRequests,
            message: 'Too many requests from this IP, please try again later.'
        });
    }

    /**
     * Creates a new LinkedIn advertising campaign
     */
    async createCampaign(req: IAuthRequest, res: Response): Promise<void> {
        try {
            // Apply security headers
            helmet()(req, res, () => {});

            // Apply rate limiting
            this.rateLimiter(req, res, () => {});

            // Log request
            this.logger.info('Create campaign request received', {
                userId: req.user.id,
                timestamp: new Date().toISOString()
            });

            // Validate request body
            const { error, value } = campaignSchema.validate(req.body);
            if (error) {
                this.logger.warn('Campaign validation failed', { error: error.details });
                res.status(400).json({
                    error: 'Invalid campaign data',
                    details: error.details
                });
                return;
            }

            // Create campaign
            const campaign: ICampaign = {
                ...value,
                userId: req.user.id,
                platform: PlatformType.LINKEDIN,
                status: CampaignStatus.DRAFT,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const campaignId = await this.linkedInService.createCampaign(campaign);

            // Log success
            this.logger.info('Campaign created successfully', {
                campaignId,
                userId: req.user.id
            });

            res.status(201).json({
                message: 'Campaign created successfully',
                campaignId
            });
        } catch (error) {
            const apiError = await handleApiError(error as Error, PlatformType.LINKEDIN);
            
            // Log error
            this.logger.error('Campaign creation failed', {
                error: apiError,
                userId: req.user.id
            });

            res.status(apiError.statusCode || 500).json({
                error: apiError.message,
                code: apiError.errorCode
            });
        }
    }

    /**
     * Updates an existing LinkedIn campaign
     */
    async updateCampaign(req: IAuthRequest, res: Response): Promise<void> {
        try {
            const { campaignId } = req.params;

            // Validate campaign ID
            if (!campaignId) {
                res.status(400).json({ error: 'Campaign ID is required' });
                return;
            }

            // Validate request body
            const { error, value } = campaignSchema.validate(req.body);
            if (error) {
                res.status(400).json({
                    error: 'Invalid campaign data',
                    details: error.details
                });
                return;
            }

            await this.linkedInService.updateCampaign(campaignId, value);

            res.status(200).json({
                message: 'Campaign updated successfully'
            });
        } catch (error) {
            const apiError = await handleApiError(error as Error, PlatformType.LINKEDIN);
            res.status(apiError.statusCode || 500).json({
                error: apiError.message,
                code: apiError.errorCode
            });
        }
    }

    /**
     * Retrieves campaign details
     */
    async getCampaign(req: IAuthRequest, res: Response): Promise<void> {
        try {
            const { campaignId } = req.params;

            if (!campaignId) {
                res.status(400).json({ error: 'Campaign ID is required' });
                return;
            }

            const campaign = await this.linkedInService.getCampaign(campaignId);
            res.status(200).json(campaign);
        } catch (error) {
            const apiError = await handleApiError(error as Error, PlatformType.LINKEDIN);
            res.status(apiError.statusCode || 500).json({
                error: apiError.message,
                code: apiError.errorCode
            });
        }
    }

    /**
     * Deletes a LinkedIn campaign
     */
    async deleteCampaign(req: IAuthRequest, res: Response): Promise<void> {
        try {
            const { campaignId } = req.params;

            if (!campaignId) {
                res.status(400).json({ error: 'Campaign ID is required' });
                return;
            }

            await this.linkedInService.deleteCampaign(campaignId);
            res.status(200).json({
                message: 'Campaign deleted successfully'
            });
        } catch (error) {
            const apiError = await handleApiError(error as Error, PlatformType.LINKEDIN);
            res.status(apiError.statusCode || 500).json({
                error: apiError.message,
                code: apiError.errorCode
            });
        }
    }

    /**
     * Pauses an active LinkedIn campaign
     */
    async pauseCampaign(req: IAuthRequest, res: Response): Promise<void> {
        try {
            const { campaignId } = req.params;

            if (!campaignId) {
                res.status(400).json({ error: 'Campaign ID is required' });
                return;
            }

            await this.linkedInService.pauseCampaign(campaignId);
            res.status(200).json({
                message: 'Campaign paused successfully'
            });
        } catch (error) {
            const apiError = await handleApiError(error as Error, PlatformType.LINKEDIN);
            res.status(apiError.statusCode || 500).json({
                error: apiError.message,
                code: apiError.errorCode
            });
        }
    }
}