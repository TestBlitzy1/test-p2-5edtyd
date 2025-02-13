import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { ERROR_MESSAGES } from '../constants';

// Environment configuration with defaults
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_FILE_PATH = process.env.LOG_FILE_PATH || 'logs';
const MAX_LOG_SIZE = process.env.MAX_LOG_SIZE || '10m';
const MAX_LOG_FILES = process.env.MAX_LOG_FILES || '7d';
const ENABLE_CONSOLE_LOGGING = process.env.ENABLE_CONSOLE_LOGGING !== 'false';
const LOG_FORMAT = process.env.LOG_FORMAT || 'json';

// Cloud metadata interface
interface CloudMetadata {
  provider?: string;
  region?: string;
  instanceId?: string;
  availabilityZone?: string;
}

// Logger options interface
interface LoggerOptions {
  level?: string;
  enableConsole?: boolean;
  filePath?: string;
  format?: string;
  cloudMetadata?: CloudMetadata;
}

// Log metadata interface
interface LogMetadata {
  correlationId?: string;
  requestId?: string;
  userId?: string;
  [key: string]: any;
}

/**
 * Creates and configures Winston transport instances
 * @param options - Logger configuration options
 * @returns Array of configured Winston transports
 */
const createLoggerTransports = (options: LoggerOptions): winston.transport[] => {
  const transports: winston.transport[] = [];

  // JSON formatter for structured logging
  const jsonFormatter = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  );

  // Console transport with color coding
  if (options.enableConsole !== false) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      })
    );
  }

  // Daily rotate file transport for general logs
  transports.push(
    new DailyRotateFile({
      filename: `${options.filePath || LOG_FILE_PATH}/application-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: MAX_LOG_SIZE,
      maxFiles: MAX_LOG_FILES,
      format: jsonFormatter,
    })
  );

  // Separate transport for error logs
  transports.push(
    new DailyRotateFile({
      filename: `${options.filePath || LOG_FILE_PATH}/error-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: MAX_LOG_SIZE,
      maxFiles: MAX_LOG_FILES,
      level: 'error',
      format: jsonFormatter,
    })
  );

  return transports;
};

/**
 * Formats log messages with enhanced metadata
 * @param info - Log information object
 * @returns Formatted log message
 */
const formatLogMessage = (info: any): string => {
  const {
    timestamp,
    level,
    message,
    correlationId,
    requestId,
    ...metadata
  } = info;

  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    correlationId,
    requestId,
    ...metadata,
  });
};

/**
 * Enhanced logger class with cloud-native support and advanced error tracking
 */
export class Logger {
  private logger: winston.Logger;
  private serviceName: string;
  private contextMap: Map<string, any>;
  private cloudMetadata: CloudMetadata;

  /**
   * Creates a new Logger instance
   * @param serviceName - Name of the service using the logger
   * @param options - Logger configuration options
   */
  constructor(serviceName: string, options: LoggerOptions = {}) {
    this.serviceName = serviceName;
    this.contextMap = new Map();
    this.cloudMetadata = options.cloudMetadata || {};

    this.logger = winston.createLogger({
      level: options.level || LOG_LEVEL,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: serviceName,
        ...this.cloudMetadata,
      },
      transports: createLoggerTransports(options),
    });

    // Handle uncaught exceptions
    this.logger.exceptions.handle(
      new DailyRotateFile({
        filename: `${options.filePath || LOG_FILE_PATH}/exceptions-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        maxSize: MAX_LOG_SIZE,
        maxFiles: MAX_LOG_FILES,
      })
    );
  }

  /**
   * Sets context data for subsequent log messages
   * @param key - Context key
   * @param value - Context value
   */
  public setContext(key: string, value: any): void {
    this.contextMap.set(key, value);
  }

  /**
   * Clears all context data
   */
  public clearContext(): void {
    this.contextMap.clear();
  }

  /**
   * Logs an info message
   * @param message - Log message
   * @param meta - Additional metadata
   */
  public async info(message: string, meta: LogMetadata = {}): Promise<void> {
    const context = Object.fromEntries(this.contextMap);
    this.logger.info(message, { ...context, ...meta });
  }

  /**
   * Logs an error message with enhanced tracking
   * @param message - Error message
   * @param error - Error object
   * @param meta - Additional metadata
   */
  public async error(
    message: string,
    error?: Error,
    meta: LogMetadata = {}
  ): Promise<void> {
    const context = Object.fromEntries(this.contextMap);
    const errorMeta = {
      ...context,
      ...meta,
      errorMessage: error?.message || ERROR_MESSAGES.PLATFORM_ERROR,
      stackTrace: error?.stack,
      timestamp: new Date().toISOString(),
    };

    this.logger.error(message, errorMeta);
  }

  /**
   * Logs a warning message
   * @param message - Warning message
   * @param meta - Additional metadata
   */
  public async warn(message: string, meta: LogMetadata = {}): Promise<void> {
    const context = Object.fromEntries(this.contextMap);
    this.logger.warn(message, { ...context, ...meta });
  }

  /**
   * Logs a debug message
   * @param message - Debug message
   * @param meta - Additional metadata
   */
  public async debug(message: string, meta: LogMetadata = {}): Promise<void> {
    const context = Object.fromEntries(this.contextMap);
    this.logger.debug(message, { ...context, ...meta });
  }
}