import { EventEmitter } from 'events';
import { Logger } from '../../../shared/utils/logger';
import { ApiError } from '../middleware/error.middleware';
import { PLATFORM_CONFIG } from '../../../shared/constants';

// Initialize logger
const logger = new Logger('CircuitBreaker');

// Circuit breaker states
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

// Circuit breaker configuration interface
interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  halfOpenTimeout?: number;
  maxRetries?: number;
  monitoringEnabled?: boolean;
  healthCheckEndpoint?: string;
}

// Request context interface
interface RequestContext {
  correlationId?: string;
  userId?: string;
  serviceName: string;
  operationName: string;
}

// Performance metrics interface
interface PerformanceMetrics {
  totalCalls: number;
  failedCalls: number;
  successRate: number;
  averageResponseTime: number;
  lastFailureTimestamp?: Date;
  consecutiveFailures: number;
}

/**
 * Enhanced CircuitBreaker class with cloud monitoring and performance tracking
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime?: Date;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly halfOpenTimeout: number;
  private readonly eventEmitter: EventEmitter;
  private readonly metrics: PerformanceMetrics;
  private readonly serviceName: string;
  private resetTimeoutId?: NodeJS.Timeout;

  constructor(serviceName: string, options: CircuitBreakerOptions = {}) {
    this.serviceName = serviceName;
    this.failureThreshold = options.failureThreshold || Number(process.env.CIRCUIT_FAILURE_THRESHOLD) || 5;
    this.resetTimeout = options.resetTimeout || Number(process.env.CIRCUIT_RESET_TIMEOUT) || 60000;
    this.halfOpenTimeout = options.halfOpenTimeout || Number(process.env.CIRCUIT_HALF_OPEN_TIMEOUT) || 30000;
    this.eventEmitter = new EventEmitter();
    this.metrics = {
      totalCalls: 0,
      failedCalls: 0,
      successRate: 100,
      averageResponseTime: 0,
      consecutiveFailures: 0
    };

    // Set up monitoring events
    this.setupMonitoring();
  }

  /**
   * Checks if the circuit is currently open
   */
  public isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  /**
   * Trips the circuit breaker with enhanced monitoring
   */
  public trip(context: RequestContext): void {
    this.state = CircuitState.OPEN;
    this.lastFailureTime = new Date();
    this.metrics.consecutiveFailures++;
    this.metrics.lastFailureTimestamp = this.lastFailureTime;

    // Emit circuit open event with context
    this.eventEmitter.emit('circuitOpen', {
      serviceName: this.serviceName,
      context,
      metrics: this.metrics,
      timestamp: this.lastFailureTime
    });

    // Schedule reset timeout
    this.scheduleReset();

    // Log circuit trip with enhanced context
    logger.warn('Circuit breaker tripped', {
      serviceName: this.serviceName,
      context,
      metrics: this.metrics,
      state: this.state
    });
  }

  /**
   * Resets the circuit breaker with monitoring update
   */
  public reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.metrics.consecutiveFailures = 0;
    
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = undefined;
    }

    // Emit circuit close event
    this.eventEmitter.emit('circuitClose', {
      serviceName: this.serviceName,
      timestamp: new Date(),
      metrics: this.metrics
    });

    logger.info('Circuit breaker reset', {
      serviceName: this.serviceName,
      state: this.state,
      metrics: this.metrics
    });
  }

  /**
   * Returns current circuit breaker metrics
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Handles successful calls with metrics update
   */
  private handleSuccess(): void {
    this.failureCount = 0;
    this.metrics.consecutiveFailures = 0;
    this.metrics.totalCalls++;
    this.updateSuccessRate();
  }

  /**
   * Handles failed calls with enhanced error tracking
   */
  private handleFailure(error: Error, context: RequestContext): void {
    this.failureCount++;
    this.metrics.failedCalls++;
    this.metrics.consecutiveFailures++;
    this.updateSuccessRate();

    if (this.failureCount >= this.failureThreshold) {
      this.trip(context);
    }

    // Log failure with context
    logger.error('Service call failed', error, {
      serviceName: this.serviceName,
      context,
      metrics: this.metrics
    });
  }

  /**
   * Updates success rate metrics
   */
  private updateSuccessRate(): void {
    this.metrics.successRate = ((this.metrics.totalCalls - this.metrics.failedCalls) / this.metrics.totalCalls) * 100;
  }

  /**
   * Schedules circuit breaker reset
   */
  private scheduleReset(): void {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.resetTimeoutId = setTimeout(() => {
      this.state = CircuitState.HALF_OPEN;
      this.eventEmitter.emit('circuitHalfOpen', {
        serviceName: this.serviceName,
        timestamp: new Date(),
        metrics: this.metrics
      });
    }, this.resetTimeout);
  }

  /**
   * Sets up monitoring and event handling
   */
  private setupMonitoring(): void {
    this.eventEmitter.on('circuitOpen', (data) => {
      logger.warn('Circuit opened', data);
    });

    this.eventEmitter.on('circuitHalfOpen', (data) => {
      logger.info('Circuit half-open', data);
    });

    this.eventEmitter.on('circuitClose', (data) => {
      logger.info('Circuit closed', data);
    });
  }
}

/**
 * Executes a function with circuit breaker protection
 */
export async function executeWithCircuitBreaker<T>(
  fn: () => Promise<T>,
  circuitBreaker: CircuitBreaker,
  context: RequestContext
): Promise<T> {
  if (circuitBreaker.isOpen()) {
    throw new ApiError(
      503,
      'Service temporarily unavailable',
      {
        serviceName: context.serviceName,
        retryAfter: PLATFORM_CONFIG.RETRY_DELAY
      }
    );
  }

  const startTime = Date.now();

  try {
    const result = await fn();
    circuitBreaker['handleSuccess']();
    return result;
  } catch (error) {
    circuitBreaker['handleFailure'](error as Error, context);
    throw error;
  } finally {
    // Update response time metrics
    const responseTime = Date.now() - startTime;
    const metrics = circuitBreaker.getMetrics();
    metrics.averageResponseTime = 
      (metrics.averageResponseTime * (metrics.totalCalls - 1) + responseTime) / metrics.totalCalls;
  }
}