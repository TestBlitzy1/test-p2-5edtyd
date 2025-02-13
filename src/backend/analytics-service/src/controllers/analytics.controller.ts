import { Request, Response } from 'express';  // ^4.18.2
import { StatsD } from 'hot-shots';  // ^9.3.0
import { RateLimit } from 'express-rate-limit';  // ^7.1.0
import { validate } from 'class-validator';  // ^0.14.0

import { AnalyticsService } from '../services/analytics.service';
import { 
    MetricType, 
    TimeGranularity, 
    IMetric, 
    IAnalytics,
    IPerformanceReport,
    IForecast 
} from '../../../shared/types/analytics.types';
import { Logger } from '../../../shared/utils/logger';
import { ANALYTICS_CONFIG, ERROR_MESSAGES } from '../../../shared/constants';
import { metricSchema, analyticsSchema } from '../../../shared/schemas/analytics.schema';

/**
 * Controller handling analytics endpoints with comprehensive error handling,
 * rate limiting, and performance monitoring
 */
export class AnalyticsController {
    private readonly logger: Logger;

    constructor(
        private readonly analyticsService: AnalyticsService,
        private readonly statsdClient: StatsD,
        private readonly cacheManager: any,
        private readonly rateLimiter: any
    ) {
        this.logger = new Logger('AnalyticsController', {
            cloudMetadata: {
                service: 'analytics-service'
            }
        });
    }

    /**
     * Track new campaign metrics with validation and rate limiting
     * @route POST /api/analytics/metrics/:campaignId
     */
    @RateLimit({
        windowMs: ANALYTICS_CONFIG.RATE_LIMIT_WINDOW,
        max: 100
    })
    public async trackCampaignMetrics(req: Request, res: Response): Promise<void> {
        const timer = this.statsdClient.startTimer('analytics.track_metrics');
        const { campaignId } = req.params;
        
        try {
            // Validate request body
            const metrics: IMetric[] = req.body.metrics;
            await Promise.all(metrics.map(metric => metricSchema.parseAsync(metric)));

            // Track metrics
            await this.analyticsService.trackMetrics(metrics, campaignId);

            timer.end();
            this.statsdClient.increment('analytics.metrics.tracked', metrics.length);

            res.status(200).json({
                success: true,
                message: 'Metrics tracked successfully',
                count: metrics.length
            });
        } catch (error) {
            timer.end();
            this.statsdClient.increment('analytics.metrics.error');
            await this.logger.error('Failed to track metrics', error as Error, {
                campaignId,
                requestId: req.id
            });

            res.status(400).json({
                success: false,
                error: ERROR_MESSAGES.VALIDATION_ERROR,
                details: (error as Error).message
            });
        }
    }

    /**
     * Retrieve campaign performance report with caching
     * @route GET /api/analytics/report/:campaignId
     */
    @RateLimit({
        windowMs: ANALYTICS_CONFIG.RATE_LIMIT_WINDOW,
        max: 50
    })
    public async getPerformanceReport(req: Request, res: Response): Promise<void> {
        const timer = this.statsdClient.startTimer('analytics.get_report');
        const { campaignId } = req.params;
        const { startDate, endDate, granularity } = req.query;

        try {
            const cacheKey = `report:${campaignId}:${startDate}:${endDate}:${granularity}`;
            const cachedReport = await this.cacheManager.get(cacheKey);

            if (cachedReport) {
                this.statsdClient.increment('analytics.cache.hit');
                res.status(200).json(cachedReport);
                return;
            }

            const report = await this.analyticsService.getPerformanceReport(
                campaignId,
                new Date(startDate as string),
                new Date(endDate as string),
                granularity as TimeGranularity
            );

            await this.cacheManager.set(cacheKey, report, ANALYTICS_CONFIG.METRICS_CACHE_TTL);

            timer.end();
            this.statsdClient.increment('analytics.report.generated');

            res.status(200).json(report);
        } catch (error) {
            timer.end();
            this.statsdClient.increment('analytics.report.error');
            await this.logger.error('Failed to generate report', error as Error, {
                campaignId,
                requestId: req.id
            });

            res.status(500).json({
                success: false,
                error: ERROR_MESSAGES.PLATFORM_ERROR
            });
        }
    }

    /**
     * Get real-time campaign metrics
     * @route GET /api/analytics/realtime/:campaignId
     */
    @RateLimit({
        windowMs: ANALYTICS_CONFIG.RATE_LIMIT_WINDOW,
        max: 300
    })
    public async getRealtimeMetrics(req: Request, res: Response): Promise<void> {
        const timer = this.statsdClient.startTimer('analytics.realtime');
        const { campaignId } = req.params;

        try {
            const metrics = await this.analyticsService.getRealtimeMetrics(campaignId);

            timer.end();
            this.statsdClient.increment('analytics.realtime.success');

            res.status(200).json({
                success: true,
                metrics,
                timestamp: new Date()
            });
        } catch (error) {
            timer.end();
            this.statsdClient.increment('analytics.realtime.error');
            await this.logger.error('Failed to get realtime metrics', error as Error, {
                campaignId,
                requestId: req.id
            });

            res.status(500).json({
                success: false,
                error: ERROR_MESSAGES.PLATFORM_ERROR
            });
        }
    }

    /**
     * Generate campaign performance forecast
     * @route GET /api/analytics/forecast/:campaignId
     */
    @RateLimit({
        windowMs: ANALYTICS_CONFIG.RATE_LIMIT_WINDOW,
        max: 50
    })
    public async getMetricsForecast(req: Request, res: Response): Promise<void> {
        const timer = this.statsdClient.startTimer('analytics.forecast');
        const { campaignId } = req.params;
        const { days } = req.query;

        try {
            const forecast = await this.analyticsService.getForecast(
                campaignId,
                parseInt(days as string, 10)
            );

            timer.end();
            this.statsdClient.increment('analytics.forecast.generated');

            res.status(200).json({
                success: true,
                forecast
            });
        } catch (error) {
            timer.end();
            this.statsdClient.increment('analytics.forecast.error');
            await this.logger.error('Failed to generate forecast', error as Error, {
                campaignId,
                requestId: req.id,
                forecastDays: days
            });

            res.status(500).json({
                success: false,
                error: ERROR_MESSAGES.PLATFORM_ERROR
            });
        }
    }
}