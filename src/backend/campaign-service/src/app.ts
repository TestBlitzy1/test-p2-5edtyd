/**
 * @fileoverview Campaign Service Entry Point
 * Configures and initializes the campaign service with enhanced security,
 * monitoring, and real-time analytics capabilities.
 * @version 1.0.0
 */

// External package imports
import express, { Express, Request, Response, NextFunction } from 'express'; // ^4.18.0
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.1.0
import morgan from 'morgan'; // ^1.10.0
import winston from 'winston'; // ^3.11.0
import compression from 'compression'; // ^1.7.4
import promClient from 'prom-client'; // ^14.2.0
import rateLimit from 'express-rate-limit'; // ^7.1.0
import { createTerminus } from '@godaddy/terminus'; // ^4.12.0

// Internal imports
import { config } from './config';
import { CampaignController } from './controllers/campaign.controller';
import { API_RATE_LIMITS, ERROR_MESSAGES } from '../../shared/constants';

// Initialize Express application
const app: Express = express();

// Initialize Prometheus metrics registry
const metrics = new promClient.Registry();
promClient.collectDefaultMetrics({ register: metrics });

// Initialize Winston logger
const logger = winston.createLogger({
    level: config.service.LOG_LEVEL,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: config.service.SERVICE_NAME },
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

/**
 * Configures and initializes Express middleware stack with enhanced
 * security and monitoring capabilities
 */
const initializeMiddleware = (): void => {
    // Security middleware
    app.use(helmet({
        contentSecurityPolicy: true,
        crossOriginEmbedderPolicy: true,
        crossOriginOpenerPolicy: true,
        crossOriginResourcePolicy: true,
        dnsPrefetchControl: true,
        frameguard: true,
        hidePoweredBy: true,
        hsts: true,
        ieNoOpen: true,
        noSniff: true,
        originAgentCluster: true,
        permittedCrossDomainPolicies: true,
        referrerPolicy: true,
        xssFilter: true
    }));

    // CORS configuration with whitelist
    app.use(cors({
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
        maxAge: 86400
    }));

    // Request logging
    app.use(morgan('combined', {
        stream: { write: message => logger.info(message.trim()) }
    }));

    // Request parsing
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Response compression
    app.use(compression());

    // Rate limiting
    app.use(rateLimit({
        windowMs: API_RATE_LIMITS.RATE_LIMIT_WINDOW,
        max: API_RATE_LIMITS.MAX_REQUESTS_PER_MINUTE,
        message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
        standardHeaders: true,
        legacyHeaders: false
    }));
};

/**
 * Configures API routes with validation and error handling
 */
const setupRoutes = (): void => {
    // Health check endpoint
    app.get('/health', (req: Request, res: Response) => {
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version
        });
    });

    // Metrics endpoint for Prometheus
    app.get('/metrics', async (req: Request, res: Response) => {
        try {
            res.set('Content-Type', metrics.contentType);
            res.end(await metrics.metrics());
        } catch (error) {
            res.status(500).end();
        }
    });

    // Campaign routes
    const campaignController = new CampaignController();
    app.use('/api/campaigns', campaignController);

    // Global error handler
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        logger.error('Unhandled error:', { error: err, path: req.path });
        res.status(500).json({
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    });
};

/**
 * Initializes and starts the Express server with enhanced monitoring
 */
const startServer = async (): Promise<void> => {
    try {
        // Initialize middleware
        initializeMiddleware();

        // Setup routes
        setupRoutes();

        // Create HTTP server with graceful shutdown
        const server = createTerminus(app, {
            timeout: config.service.SHUTDOWN_TIMEOUT,
            signals: ['SIGTERM', 'SIGINT'],
            healthChecks: {
                '/health': async () => {
                    // Add custom health checks here
                    return Promise.resolve();
                }
            },
            onSignal: async () => {
                logger.info('Server is shutting down');
                // Cleanup logic here (close DB connections, etc.)
            },
            onShutdown: async () => {
                logger.info('Cleanup completed, server is shutting down');
            }
        });

        // Start server
        server.listen(config.service.PORT, config.service.HOST, () => {
            logger.info(`Server started on ${config.service.HOST}:${config.service.PORT}`);
            logger.info(`Environment: ${config.service.NODE_ENV}`);
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Start the server
startServer().catch(error => {
    logger.error('Server startup failed:', error);
    process.exit(1);
});

export default app;