/**
 * @fileoverview Analytics Service Entry Point
 * Implements a high-performance Express server with real-time analytics capabilities,
 * comprehensive monitoring, and scalable architecture for campaign performance tracking.
 * @version 1.0.0
 */

// External package imports
import express, { Express, Request, Response, NextFunction } from 'express'; // ^4.18.2
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.0.0
import compression from 'compression'; // ^1.7.4
import Redis from 'ioredis'; // ^5.3.0
import { StatsD } from 'hot-shots'; // ^9.3.0
import rateLimit from 'express-rate-limit'; // ^6.7.0
import CircuitBreaker from 'opossum'; // ^7.1.0

// Internal imports
import { config } from './config';
import { AnalyticsController } from './controllers/analytics.controller';
import { Logger } from '../../shared/utils/logger';

// Initialize logger
const logger = new Logger('AnalyticsService', {
    cloudMetadata: {
        service: 'analytics-service',
        region: process.env.AWS_REGION
    }
});

// Initialize Express app
const app: Express = express();

/**
 * Configures Express middleware stack with security, monitoring, and performance features
 * @param app - Express application instance
 */
const initializeMiddleware = (app: Express): void => {
    // Security middleware
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'https:'],
            },
        },
        crossOriginEmbedderPolicy: true,
        crossOriginOpenerPolicy: true,
        crossOriginResourcePolicy: { policy: "cross-origin" }
    }));

    // CORS configuration
    app.use(cors({
        origin: config.service.environment === 'production' 
            ? process.env.ALLOWED_ORIGINS?.split(',') 
            : '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
        maxAge: 86400 // 24 hours
    }));

    // Performance middleware
    app.use(compression());
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Request tracking
    app.use((req: Request, res: Response, next: NextFunction) => {
        req.id = req.headers['x-request-id'] as string || crypto.randomUUID();
        res.setHeader('X-Request-ID', req.id);
        next();
    });

    // Rate limiting
    app.use(rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 100, // limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later',
        standardHeaders: true,
        legacyHeaders: false
    }));
};

/**
 * Configures API routes with validation, caching, and monitoring
 * @param app - Express application instance
 * @param controller - Analytics controller instance
 */
const setupRoutes = (app: Express, controller: AnalyticsController): void => {
    // Health check endpoint
    app.get('/health', async (req: Request, res: Response) => {
        try {
            // Deep health check
            const redisHealth = await new Promise((resolve) => {
                const timeout = setTimeout(() => resolve(false), 1000);
                redisClient.ping().then(() => {
                    clearTimeout(timeout);
                    resolve(true);
                });
            });

            res.status(200).json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                redis: redisHealth ? 'connected' : 'disconnected',
                version: process.env.npm_package_version
            });
        } catch (error) {
            res.status(503).json({ status: 'unhealthy', error: error.message });
        }
    });

    // Analytics endpoints
    const analyticsRouter = express.Router();
    
    analyticsRouter.post('/metrics/:campaignId', controller.trackCampaignMetrics.bind(controller));
    analyticsRouter.get('/report/:campaignId', controller.getPerformanceReport.bind(controller));
    analyticsRouter.get('/realtime/:campaignId', controller.getRealtimeMetrics.bind(controller));
    analyticsRouter.get('/forecast/:campaignId', controller.getMetricsForecast.bind(controller));

    app.use('/api/analytics', analyticsRouter);

    // Error handling
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        logger.error('Unhandled error', err, { requestId: req.id });
        res.status(500).json({
            error: 'Internal server error',
            requestId: req.id
        });
    });
};

/**
 * Initializes and starts the Express server with all dependencies
 * @param app - Express application instance
 */
const startServer = async (app: Express): Promise<void> => {
    try {
        // Initialize Redis client
        const redisClient = new Redis({
            ...config.redis,
            retryStrategy: (times: number) => Math.min(times * 200, 2000),
            enableOfflineQueue: true
        });

        // Initialize StatsD client
        const statsdClient = new StatsD({
            host: process.env.STATSD_HOST,
            port: parseInt(process.env.STATSD_PORT || '8125', 10),
            prefix: 'analytics_service.',
            errorHandler: (error) => logger.error('StatsD error', error)
        });

        // Initialize controller with dependencies
        const controller = new AnalyticsController(
            analyticsService,
            statsdClient,
            redisClient,
            rateLimit
        );

        // Configure middleware and routes
        initializeMiddleware(app);
        setupRoutes(app, controller);

        // Start server
        const server = app.listen(config.service.port, config.service.host, () => {
            logger.info(`Analytics service started`, {
                port: config.service.port,
                environment: config.service.environment
            });
        });

        // Graceful shutdown
        const shutdown = async () => {
            logger.info('Shutting down analytics service...');
            
            server.close(async () => {
                await redisClient.quit();
                await statsdClient.close();
                process.exit(0);
            });

            // Force shutdown after timeout
            setTimeout(() => {
                logger.error('Forced shutdown due to timeout');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

    } catch (error) {
        logger.error('Failed to start analytics service', error);
        process.exit(1);
    }
};

// Start the application
startServer(app);

export default app;