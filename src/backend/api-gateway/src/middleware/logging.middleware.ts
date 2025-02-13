import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../shared/utils/logger';
import { calculateCPC } from '../../shared/utils/metrics';

// Initialize logger with service name
const logger = new Logger(SERVICE_NAME, {
    cloudMetadata: {
        provider: process.env.CLOUD_PROVIDER || 'aws',
        region: process.env.AWS_REGION || 'us-east-1'
    }
});

// Constants
const SERVICE_NAME = 'api-gateway';
const LOG_SAMPLING_RATE = 0.1; // 10% sampling rate for high-traffic scenarios

/**
 * Express middleware for comprehensive request/response logging with performance tracking
 * and distributed tracing capabilities.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
    try {
        // Generate correlation ID for request tracing
        const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
        req.headers['x-correlation-id'] = correlationId;

        // Set logger context with correlation ID and cloud metadata
        logger.setContext('correlationId', correlationId);
        logger.setContext('requestId', req.headers['x-request-id'] || uuidv4());
        logger.setContext('userAgent', req.headers['user-agent']);
        logger.setContext('clientIp', req.ip);

        // Record request start time for duration calculation
        const startTime = Date.now();

        // Log request details with sampling for high-traffic scenarios
        if (Math.random() < LOG_SAMPLING_RATE) {
            logger.info('Incoming request', {
                method: req.method,
                path: req.path,
                query: req.query,
                headers: sanitizeHeaders(req.headers),
                body: sanitizeBody(req.body)
            });
        }

        // Intercept response to log completion details
        const originalEnd = res.end;
        res.end = function (chunk?: any, encoding?: any, callback?: any): any {
            res.end = originalEnd;
            const result = res.end.call(this, chunk, encoding, callback);
            logResponse(req, res, startTime);
            return result;
        };

        next();
    } catch (error) {
        // Log error and continue processing
        logger.error('Error in request logging middleware', error as Error);
        next();
    }
};

/**
 * Helper function to log response details with performance metrics
 */
const logResponse = (req: Request, res: Response, startTime: number): void => {
    try {
        const duration = Date.now() - startTime;
        const responseSize = parseInt(res.getHeader('content-length') as string) || 0;
        const status = res.statusCode;

        // Calculate performance metrics
        const cpc = calculateCPC(duration, 1); // Use duration as cost proxy

        // Prepare response metadata
        const responseMetadata = {
            method: req.method,
            path: req.path,
            status,
            duration,
            responseSize,
            cpc,
            correlationId: req.headers['x-correlation-id'],
            userAgent: req.headers['user-agent'],
            clientIp: req.ip
        };

        // Log based on response status
        if (status >= 500) {
            logger.error('Request failed', {
                ...responseMetadata,
                error: res.locals.error
            });
        } else if (status >= 400) {
            logger.warn('Request error', responseMetadata);
        } else {
            // Apply sampling for successful responses
            if (Math.random() < LOG_SAMPLING_RATE) {
                logger.info('Request completed', responseMetadata);
            }
        }

        // Clear logger context
        logger.clearContext();
    } catch (error) {
        logger.error('Error logging response', error as Error);
    }
};

/**
 * Sanitizes request headers to remove sensitive information
 */
const sanitizeHeaders = (headers: Record<string, any>): Record<string, any> => {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    
    sensitiveHeaders.forEach(header => {
        if (sanitized[header]) {
            sanitized[header] = '[REDACTED]';
        }
    });

    return sanitized;
};

/**
 * Sanitizes request body to remove sensitive information
 */
const sanitizeBody = (body: Record<string, any>): Record<string, any> => {
    if (!body) return {};
    
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
    
    Object.keys(sanitized).forEach(key => {
        if (sensitiveFields.includes(key.toLowerCase())) {
            sanitized[key] = '[REDACTED]';
        }
    });

    return sanitized;
};