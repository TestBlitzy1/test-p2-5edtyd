/**
 * @fileoverview Authentication service main application entry point
 * Initializes Express server with comprehensive security features, middleware configuration,
 * database connection, and authentication routes with OAuth 2.0 support
 * @version 1.0.0
 */

import express from 'express'; // ^4.18.0
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.0.0
import morgan from 'morgan'; // ^1.10.0
import { RateLimiterRedis } from 'rate-limiter-flexible'; // ^2.4.1
import winston from 'winston'; // ^3.8.2
import { useExpressServer } from 'routing-controllers'; // ^0.10.0
import { createConnection } from 'typeorm'; // ^0.3.0

import { config } from './config';
import { AuthController } from './controllers/auth.controller';
import { ERROR_MESSAGES, API_RATE_LIMITS } from '../../shared/constants';

// Initialize Express application
const app = express();

/**
 * Configures security middleware and request handling
 * @param app Express application instance
 */
const initializeMiddleware = (app: express.Application): void => {
  // CORS configuration with strict origin validation
  app.use(cors({
    origin: config.security.cors.allowedOrigins,
    methods: config.security.cors.allowedMethods,
    credentials: true,
    maxAge: 86400 // 24 hours
  }));

  // Helmet security headers with CSP
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'same-site' },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  }));

  // Request logging with security event tracking
  app.use(morgan('combined', {
    skip: (req) => req.url === '/health'
  }));

  // JSON body parsing with size limits
  app.use(express.json({ 
    limit: '10kb',
    type: 'application/json'
  }));

  // URL-encoded body parsing
  app.use(express.urlencoded({ 
    extended: true,
    limit: '10kb'
  }));

  // Rate limiting configuration
  const rateLimiter = new RateLimiterRedis({
    points: API_RATE_LIMITS.MAX_REQUESTS_PER_MINUTE,
    duration: API_RATE_LIMITS.RATE_LIMIT_WINDOW,
    blockDuration: API_RATE_LIMITS.COOLDOWN_PERIOD,
    inmemoryBlockOnConsumed: API_RATE_LIMITS.BURST_LIMIT
  });

  // Apply rate limiting middleware
  app.use(async (req, res, next) => {
    try {
      await rateLimiter.consume(req.ip);
      next();
    } catch {
      res.status(429).json({ 
        error: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED 
      });
    }
  });

  // Security logging configuration
  const logger = winston.createLogger({
    level: config.logLevel,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.File({ 
        filename: 'logs/security.log',
        level: 'error'
      }),
      new winston.transports.File({ 
        filename: 'logs/combined.log' 
      })
    ]
  });

  // Add logger to request context
  app.use((req, res, next) => {
    req.logger = logger;
    next();
  });
};

/**
 * Establishes secure database connection
 * @returns TypeORM connection instance
 */
const initializeDatabase = async () => {
  try {
    const connection = await createConnection({
      type: 'postgres',
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      username: config.database.user,
      password: config.database.password,
      entities: ['src/models/*.ts'],
      migrations: ['src/migrations/*.ts'],
      ssl: config.database.ssl,
      synchronize: false,
      logging: ['error'],
      maxQueryExecutionTime: 1000,
      poolSize: config.database.maxConnections,
      extra: {
        max: config.database.maxConnections,
        idleTimeoutMillis: config.database.idleTimeout,
        ssl: {
          rejectUnauthorized: true
        }
      }
    });

    console.log('Database connection established successfully');
    return connection;
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

/**
 * Initializes and starts the authentication server
 */
const startServer = async (): Promise<void> => {
  try {
    // Initialize middleware
    initializeMiddleware(app);

    // Initialize database connection
    await initializeDatabase();

    // Configure routing-controllers
    useExpressServer(app, {
      controllers: [AuthController],
      defaultErrorHandler: false,
      validation: {
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true
      },
      cors: true
    });

    // Global error handler
    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      req.logger.error('Unhandled error:', { 
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
      });

      res.status(500).json({ 
        error: 'Internal server error' 
      });
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'healthy' });
    });

    // Start server
    app.listen(config.port, () => {
      console.log(`Authentication service running on port ${config.port}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
};

// Initialize server
startServer();

export default app;