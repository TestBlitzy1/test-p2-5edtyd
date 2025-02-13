// External imports
import express, { Express, Request, Response, NextFunction } from 'express'; // ^4.18.0
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.1.0
import morgan from 'morgan'; // ^1.10.0
import winston from 'winston'; // ^3.11.0
import rateLimit from 'express-rate-limit'; // ^7.1.0
import compression from 'compression'; // ^1.7.4

// Internal imports
import { config, api } from './config';
import { GoogleAdsController } from './controllers/google.controller';
import { LinkedInController } from './controllers/linkedin.controller';
import { PlatformType } from '../../shared/types/campaign.types';
import { IAuthRequest } from '../../shared/types/auth.types';

// Initialize Express application
const app: Express = express();
const PORT = process.env.PORT || 3002;

// Initialize logger
const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: 'platform-integration' },
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

// Configure security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'https://api.linkedin.com', 'https://googleads.googleapis.com']
        }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
}));

// Configure CORS
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'X-Correlation-Id'],
    exposedHeaders: ['X-Rate-Limit-Remaining'],
    credentials: true,
    maxAge: 600 // 10 minutes
}));

// Configure request logging
app.use(morgan('combined', {
    stream: {
        write: (message: string) => logger.info(message.trim())
    }
}));

// Configure global rate limiting
const limiter = rateLimit({
    windowMs: api.rateLimiting.windowMs,
    max: api.rateLimiting.maxRequests,
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});
app.use(limiter);

// Configure request parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Enable response compression
app.use(compression());

// Initialize platform controllers
const googleAdsController = new GoogleAdsController(/* inject dependencies */);
const linkedInController = new LinkedInController(/* inject dependencies */);

// Configure platform-specific routes
app.use('/api/google', async (req: IAuthRequest, res: Response, next: NextFunction) => {
    req.headers['x-platform'] = PlatformType.GOOGLE;
    next();
}, googleAdsController.getRateLimiter());

app.post('/api/google/campaigns', async (req: IAuthRequest, res: Response) => {
    await googleAdsController.createCampaign(req, res);
});

app.patch('/api/google/campaigns/:campaignId', async (req: IAuthRequest, res: Response) => {
    await googleAdsController.updateCampaign(req, res);
});

app.get('/api/google/campaigns/:campaignId/performance', async (req: IAuthRequest, res: Response) => {
    await googleAdsController.getCampaignPerformance(req, res);
});

app.post('/api/google/campaigns/:campaignId/pause', async (req: IAuthRequest, res: Response) => {
    await googleAdsController.pauseCampaign(req, res);
});

app.use('/api/linkedin', async (req: IAuthRequest, res: Response, next: NextFunction) => {
    req.headers['x-platform'] = PlatformType.LINKEDIN;
    next();
});

app.post('/api/linkedin/campaigns', async (req: IAuthRequest, res: Response) => {
    await linkedInController.createCampaign(req, res);
});

app.patch('/api/linkedin/campaigns/:campaignId', async (req: IAuthRequest, res: Response) => {
    await linkedInController.updateCampaign(req, res);
});

app.get('/api/linkedin/campaigns/:campaignId', async (req: IAuthRequest, res: Response) => {
    await linkedInController.getCampaign(req, res);
});

app.delete('/api/linkedin/campaigns/:campaignId', async (req: IAuthRequest, res: Response) => {
    await linkedInController.deleteCampaign(req, res);
});

app.post('/api/linkedin/campaigns/:campaignId/pause', async (req: IAuthRequest, res: Response) => {
    await linkedInController.pauseCampaign(req, res);
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version
    });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });

    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Starting graceful shutdown...');
    // Close server and database connections
    process.exit(0);
});

// Export configured Express app
export default app;