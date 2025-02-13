import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Logger } from '../../../shared/utils/logger';
import { ERROR_MESSAGES } from '../../../shared/constants';

// Initialize logger with service name
const logger = new Logger('ErrorMiddleware');

/**
 * Custom API Error class with enhanced cloud context support
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details: Record<string, any>;
  public readonly correlationId: string;
  public readonly cloudContext: Record<string, any>;
  public readonly timestamp: string;

  constructor(
    statusCode: number,
    message: string,
    details?: Record<string, any>,
    cloudContext?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details || {};
    this.correlationId = `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.cloudContext = cloudContext || {};
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handles validation errors with detailed field-level information
 * @param error Validation error object
 * @returns Formatted validation error response
 */
const handleValidationError = (error: any) => {
  const fieldErrors: Record<string, string[]> = {};
  
  if (error.errors) {
    Object.keys(error.errors).forEach(field => {
      fieldErrors[field] = [error.errors[field].message];
    });
  }

  return {
    type: 'ValidationError',
    message: ERROR_MESSAGES.VALIDATION_ERROR,
    details: {
      fields: fieldErrors,
      validationContext: error.validationContext || 'request',
      suggestions: error.suggestions || []
    }
  };
};

/**
 * Handles database errors with recovery options
 * @param error Database error object
 * @returns Formatted database error response
 */
const handleDatabaseError = (error: any) => {
  const dbErrorResponse = {
    type: 'DatabaseError',
    message: ERROR_MESSAGES.PLATFORM_ERROR,
    details: {
      code: error.code,
      retryable: error.retryable || false
    }
  };

  if (error.retryable) {
    dbErrorResponse.details = {
      ...dbErrorResponse.details,
      retryAfter: 5000,
      maxRetries: 3
    };
  }

  return dbErrorResponse;
};

/**
 * Enhanced error handling middleware with cloud context support
 * @param error Error object
 * @param req Express request object
 * @param res Express response object
 * @param next Express next function
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Extract cloud context metadata
  const cloudContext = {
    region: process.env.AWS_REGION || 'unknown',
    availabilityZone: process.env.AWS_AVAILABILITY_ZONE,
    instanceId: process.env.AWS_INSTANCE_ID,
    requestId: req.headers['x-request-id'] || 'unknown'
  };

  // Initialize error response
  let errorResponse: any = {
    success: false,
    error: {
      message: error.message || ERROR_MESSAGES.PLATFORM_ERROR,
      correlationId: `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    }
  };

  // Set default status code
  let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;

  // Handle different error types
  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    errorResponse.error = {
      ...errorResponse.error,
      ...error,
      cloudContext
    };
  } else if (error.name === 'ValidationError') {
    statusCode = StatusCodes.BAD_REQUEST;
    errorResponse.error = {
      ...errorResponse.error,
      ...handleValidationError(error),
      cloudContext
    };
  } else if (error.name === 'DatabaseError') {
    statusCode = StatusCodes.SERVICE_UNAVAILABLE;
    errorResponse.error = {
      ...errorResponse.error,
      ...handleDatabaseError(error),
      cloudContext
    };
  }

  // Enhanced error logging with context
  logger.error('API Error occurred', error, {
    statusCode,
    correlationId: errorResponse.error.correlationId,
    path: req.path,
    method: req.method,
    cloudContext,
    userId: req.user?.id,
    ipAddress: req.ip
  });

  // Remove sensitive information from error response
  delete errorResponse.error.stack;
  delete errorResponse.error.cloudContext.instanceId;

  // Add performance tracking header
  res.setHeader('X-Error-Time', Date.now() - (req.startTime || Date.now()));

  // Send error response
  res.status(statusCode).json(errorResponse);
};