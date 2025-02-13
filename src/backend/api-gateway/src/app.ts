/**
 * @fileoverview Main API Gateway application configuration with enhanced security,
 * monitoring, and cloud-native features for the Sales Intelligence Platform.
 * @version 1.0.0
 */

import express, { Express, Request, Response, NextFunction } from 'express'; // ^4.18.2
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.0.0
import compression from 'compression'; // ^1.7.4
import morgan from 'morgan'; // ^1.10.0
import { trace, context, SpanStatusCode } from '@opentelemetry/api'; // ^1.4.1
import { RateLimiterRedis } from 'rate-limiter-flexible'; // ^2.4.1
import { CircuitBreaker } from 'circuit-breaker-js'; // ^0.0.1

// Internal imports
import analyticsRouter from './routes/analytics.routes';
import authRouter from './routes/auth.routes';
import campaignRouter from './routes/campaign.routes';
import { errorHandler } from './middleware/error.middleware';
import { Logger } from '../../shared/utils/logger';
import config from './config';

// Initialize Express application
const app: Express = express();

// Initialize logger
const logger = new Logger('APIGateway');

// Initialize OpenTelemetry tracer
const tracer = trace.getTracer('api-gateway');

/**
 * Configures global middleware with enhanced security and monitoring
 * @param app Express application instance
 */
const configureMiddleware = (app: Express): void => {
  // Request correlation ID
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.headers['x-correlation-id'] = req.headers['x-correlation-id'] || 
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    next();
  });

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", config.services.auth.url, config.services.campaign.url]
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: true,
    frameguard: { action: "deny" },
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true
  }));

  // CORS configuration
  app.use(cors({
    origin: config.cors.origin,
    methods: config.cors.methods,
    allowedHeaders: config.cors.allowedHeaders,
    exposedHeaders: config.cors.exposedHeaders,
    credentials: config.cors.credentials,
    maxAge: config.cors.maxAge
  }));

  // Request parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Response compression
  app.use(compression());

  // Request logging
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim())
    }
  }));

  // Performance monitoring
  app.use((req: Request, res: Response, next: NextFunction) => {
    const span = tracer.startSpan(`${req.method} ${req.path}`);
    context.with(trace.setSpan(context.active(), span), () => {
      res.on('finish', () => {
        span.setAttributes({
          'http.method': req.method,
          'http.url': req.url,
          'http.status_code': res.statusCode
        });
        span.end();
      });
      next();
    });
  });
};

/**
 * Configures API routes with security and monitoring
 * @param app Express application instance
 */
const configureRoutes = (app: Express): void => {
  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version
    });
  });

  // API documentation endpoint
  app.get('/api-docs', (req: Request, res: Response) => {
    res.redirect('/swagger-ui');
  });

  // Mount service routes
  app.use('/api/auth', authRouter);
  app.use('/api/campaigns', campaignRouter);
  app.use('/api/analytics', analyticsRouter);

  // 404 handler
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.status(404).json({
      error: 'Not Found',
      path: req.path
    });
  });

  // Global error handler
  app.use(errorHandler);
};

/**
 * Initializes and starts the Express server
 * @param app Express application instance
 */
const startServer = async (app: Express): Promise<void> => {
  try {
    // Configure middleware
    configureMiddleware(app);

    // Configure routes
    configureRoutes(app);

    // Start server
    const port = config.port;
    app.listen(port, () => {
      logger.info(`API Gateway started on port ${port}`, {
        environment: config.env,
        nodeVersion: process.version
      });
    });

    // Graceful shutdown handler
    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM signal, initiating graceful shutdown');
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start API Gateway', error as Error);
    process.exit(1);
  }
};

// Initialize application
startServer(app);

export default app;