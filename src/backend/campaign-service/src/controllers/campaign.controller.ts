// External package imports
import { Router, Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { RateLimit } from 'express-rate-limit';
import { CircuitBreaker } from 'opossum';
import { Logger } from 'winston';
import { MetricsService } from '@company/metrics';

// Internal imports
import { CampaignService } from '../services/campaign.service';
import { validateLinkedInCampaign, validateGoogleCampaign } from '../utils/validation.utils';
import { 
    ICampaign, 
    PlatformType,
    CampaignStatus,
    IAdGroup 
} from '../../../shared/types/campaign.types';
import { IAuthRequest } from '../../../shared/types/auth.types';
import { MetricType } from '../../../shared/types/analytics.types';

/**
 * Controller handling campaign management operations with enhanced security,
 * validation, and monitoring capabilities
 */
@Controller('campaigns')
@UseGuards(RoleGuard)
@UseInterceptors(LoggingInterceptor, CacheInterceptor)
export class CampaignController {
    private readonly circuitBreaker: CircuitBreaker;
    private readonly rateLimiter: RateLimit;

    constructor(
        private readonly campaignService: CampaignService,
        private readonly logger: Logger,
        private readonly metricsService: MetricsService
    ) {
        // Initialize circuit breaker
        this.circuitBreaker = new CircuitBreaker(this.campaignService.createCampaign, {
            timeout: 10000,
            errorThresholdPercentage: 50,
            resetTimeout: 30000
        });

        // Initialize rate limiter
        this.rateLimiter = new RateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: 100 // limit each IP to 100 requests per windowMs
        });
    }

    /**
     * Creates a new advertising campaign with comprehensive validation
     */
    @Post('/')
    @UseGuards(RoleGuard)
    @RateLimit({ windowMs: 60000, max: 100 })
    @asyncHandler
    public async createCampaign(
        @Req() req: IAuthRequest,
        @Res() res: Response
    ): Promise<Response> {
        const startTime = Date.now();
        this.logger.info('Campaign creation initiated', { userId: req.user.id });

        try {
            const campaignData: ICampaign = req.body;

            // Platform-specific validation
            const isValid = campaignData.platform === PlatformType.LINKEDIN
                ? await validateLinkedInCampaign(campaignData)
                : await validateGoogleCampaign(campaignData);

            if (!isValid) {
                return res.status(400).json({
                    success: false,
                    error: 'Campaign validation failed'
                });
            }

            // Create campaign using circuit breaker
            const campaign = await this.circuitBreaker.fire({
                ...campaignData,
                userId: req.user.id,
                status: CampaignStatus.DRAFT
            });

            // Track metrics
            this.metricsService.incrementCounter('campaign_creation_total', {
                platform: campaign.platform,
                userId: req.user.id
            });

            this.metricsService.recordTiming('campaign_creation_duration', Date.now() - startTime);

            return res.status(201).json({
                success: true,
                data: campaign
            });

        } catch (error) {
            this.logger.error('Campaign creation failed', {
                error,
                userId: req.user.id
            });

            return res.status(500).json({
                success: false,
                error: 'Campaign creation failed'
            });
        }
    }

    /**
     * Updates an existing campaign with validation and optimization
     */
    @Put('/:id')
    @UseGuards(RoleGuard)
    @RateLimit({ windowMs: 60000, max: 100 })
    @asyncHandler
    public async updateCampaign(
        @Param('id') campaignId: string,
        @Req() req: IAuthRequest,
        @Res() res: Response
    ): Promise<Response> {
        const startTime = Date.now();
        this.logger.info('Campaign update initiated', { campaignId, userId: req.user.id });

        try {
            const updateData: Partial<ICampaign> = req.body;

            // Validate update permissions
            const campaign = await this.campaignService.updateCampaign(
                campaignId,
                updateData
            );

            // Track metrics
            this.metricsService.incrementCounter('campaign_update_total', {
                platform: campaign.platform,
                userId: req.user.id
            });

            this.metricsService.recordTiming('campaign_update_duration', Date.now() - startTime);

            return res.status(200).json({
                success: true,
                data: campaign
            });

        } catch (error) {
            this.logger.error('Campaign update failed', {
                error,
                campaignId,
                userId: req.user.id
            });

            return res.status(500).json({
                success: false,
                error: 'Campaign update failed'
            });
        }
    }

    /**
     * Triggers AI optimization for a campaign with performance tracking
     */
    @Post('/:id/optimize')
    @UseGuards(RoleGuard)
    @UseCircuitBreaker()
    @asyncHandler
    public async optimizeCampaign(
        @Param('id') campaignId: string,
        @Req() req: IAuthRequest,
        @Res() res: Response
    ): Promise<Response> {
        const startTime = Date.now();
        this.logger.info('Campaign optimization initiated', { campaignId, userId: req.user.id });

        try {
            const optimizationResult = await this.campaignService.optimizeCampaign(campaignId);

            // Track optimization metrics
            this.metricsService.recordGauge('campaign_optimization_confidence', 
                optimizationResult.confidence, {
                    campaignId,
                    platform: optimizationResult.platform
                }
            );

            this.metricsService.recordTiming('campaign_optimization_duration', 
                Date.now() - startTime
            );

            return res.status(200).json({
                success: true,
                data: optimizationResult
            });

        } catch (error) {
            this.logger.error('Campaign optimization failed', {
                error,
                campaignId,
                userId: req.user.id
            });

            return res.status(500).json({
                success: false,
                error: 'Campaign optimization failed'
            });
        }
    }

    /**
     * Pauses an active campaign with validation
     */
    @Post('/:id/pause')
    @UseGuards(RoleGuard)
    @RateLimit({ windowMs: 60000, max: 100 })
    @asyncHandler
    public async pauseCampaign(
        @Param('id') campaignId: string,
        @Req() req: IAuthRequest,
        @Res() res: Response
    ): Promise<Response> {
        this.logger.info('Campaign pause initiated', { campaignId, userId: req.user.id });

        try {
            const campaign = await this.campaignService.pauseCampaign(campaignId);

            // Track state change
            this.metricsService.incrementCounter('campaign_pause_total', {
                platform: campaign.platform,
                userId: req.user.id
            });

            return res.status(200).json({
                success: true,
                data: campaign
            });

        } catch (error) {
            this.logger.error('Campaign pause failed', {
                error,
                campaignId,
                userId: req.user.id
            });

            return res.status(500).json({
                success: false,
                error: 'Campaign pause failed'
            });
        }
    }

    /**
     * Deletes a campaign with proper cleanup
     */
    @Delete('/:id')
    @UseGuards(RoleGuard)
    @RateLimit({ windowMs: 60000, max: 50 })
    @asyncHandler
    public async deleteCampaign(
        @Param('id') campaignId: string,
        @Req() req: IAuthRequest,
        @Res() res: Response
    ): Promise<Response> {
        this.logger.info('Campaign deletion initiated', { campaignId, userId: req.user.id });

        try {
            await this.campaignService.deleteCampaign(campaignId);

            // Track deletion
            this.metricsService.incrementCounter('campaign_deletion_total', {
                userId: req.user.id
            });

            return res.status(204).send();

        } catch (error) {
            this.logger.error('Campaign deletion failed', {
                error,
                campaignId,
                userId: req.user.id
            });

            return res.status(500).json({
                success: false,
                error: 'Campaign deletion failed'
            });
        }
    }
}

export default CampaignController;