// External package imports
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'; // ^1.4.0
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware'; // ^2.0.6
import { trace, context, SpanStatusCode } from '@opentelemetry/api'; // ^1.4.0
import { Counter, Histogram } from 'prom-client'; // ^14.0.0

// Internal imports
import { services, platformConfig } from '../config';
import { CloudAwareCircuitBreaker, executeWithCircuitBreaker } from '../utils/circuit-breaker';
import { DistributedRateLimiter } from '../utils/rate-limiter';
import { ApiError } from '../middleware/error.middleware';
import { Logger } from '../../../shared/utils/logger';

// Initialize logger
const logger = new Logger('ProxyService');

// Performance metrics
const requestDurationHistogram = new Histogram({
  name: 'api_gateway_request_duration_seconds',
  help: 'Duration of API Gateway requests',
  labelNames: ['service', 'endpoint', 'method']
});

const requestCounter = new Counter({
  name: 'api_gateway_requests_total',
  help: 'Total number of API Gateway requests',
  labelNames: ['service', 'status']
});

/**
 * Enhanced configuration options for service proxy
 */
export interface IProxyOptions {
  target: string;
  timeout: number;
  circuitBreaker: {
    failureThreshold: number;
    resetTimeout: number;
    halfOpenTimeout: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequestsAuthenticated: number;
    maxRequestsUnauthenticated: number;
  };
  tracing: {
    enabled: boolean;
    serviceName: string;
  };
  platformSpecific?: {
    transformRequest?: boolean;
    transformResponse?: boolean;
    customHeaders?: Record<string, string>;
  };
}

/**
 * Enhanced service proxy with cloud-native capabilities
 */
export class ServiceProxy {
  private readonly axiosInstance: AxiosInstance;
  private readonly circuitBreaker: CloudAwareCircuitBreaker;
  private readonly rateLimiter: DistributedRateLimiter;
  private readonly options: IProxyOptions;
  private readonly tracer = trace.getTracer('api-gateway');

  constructor(options: IProxyOptions) {
    this.options = options;

    // Initialize Axios instance with enhanced configuration
    this.axiosInstance = axios.create({
      baseURL: options.target,
      timeout: options.timeout,
      headers: {
        'X-Service-Name': options.tracing.serviceName,
        ...options.platformSpecific?.customHeaders
      }
    });

    // Initialize circuit breaker
    this.circuitBreaker = new CloudAwareCircuitBreaker(options.tracing.serviceName, {
      failureThreshold: options.circuitBreaker.failureThreshold,
      resetTimeout: options.circuitBreaker.resetTimeout,
      halfOpenTimeout: options.circuitBreaker.halfOpenTimeout
    });

    // Initialize rate limiter
    this.rateLimiter = new DistributedRateLimiter({
      windowMs: options.rateLimit.windowMs,
      maxRequestsAuthenticated: options.rateLimit.maxRequestsAuthenticated,
      maxRequestsUnauthenticated: options.rateLimit.maxRequestsUnauthenticated,
      clusterMode: true
    });

    // Setup request interceptors
    this.setupInterceptors();
  }

  /**
   * Enhanced proxy request handler with monitoring
   */
  public async proxyRequest(req: any, res: any): Promise<void> {
    const startTime = Date.now();
    const span = this.tracer.startSpan(`${this.options.tracing.serviceName}_request`);
    const ctx = trace.setSpan(context.active(), span);

    try {
      // Check rate limit
      const rateLimitKey = req.user?.id || req.ip;
      const rateLimitInfo = await this.rateLimiter.checkRateLimit(
        rateLimitKey,
        !!req.user
      );

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', rateLimitInfo.total);
      res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remaining);
      res.setHeader('X-RateLimit-Reset', rateLimitInfo.reset);

      if (rateLimitInfo.remaining === 0) {
        throw new ApiError(429, 'Rate limit exceeded', {
          retryAfter: rateLimitInfo.retryAfter
        });
      }

      // Execute request with circuit breaker
      const response = await executeWithCircuitBreaker(
        async () => this.axiosInstance({
          method: req.method,
          url: req.path,
          data: req.body,
          headers: this.getForwardHeaders(req),
          params: req.query
        }),
        this.circuitBreaker,
        {
          correlationId: req.headers['x-correlation-id'],
          userId: req.user?.id,
          serviceName: this.options.tracing.serviceName,
          operationName: `${req.method} ${req.path}`
        }
      );

      // Record metrics
      const duration = (Date.now() - startTime) / 1000;
      requestDurationHistogram.observe(
        { service: this.options.tracing.serviceName, endpoint: req.path, method: req.method },
        duration
      );
      requestCounter.inc({ service: this.options.tracing.serviceName, status: response.status });

      // Transform response if needed
      const responseData = this.options.platformSpecific?.transformResponse
        ? await this.transformResponse(response.data)
        : response.data;

      // Send response
      res.status(response.status).json(responseData);
      span.setStatus({ code: SpanStatusCode.OK });

    } catch (error: any) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Creates enhanced Express middleware with monitoring
   */
  public createProxyMiddleware(serviceName: string): RequestHandler {
    return createProxyMiddleware({
      target: this.options.target,
      changeOrigin: true,
      pathRewrite: this.getPathRewrite(),
      onProxyReq: this.handleProxyRequest.bind(this),
      onProxyRes: this.handleProxyResponse.bind(this),
      onError: this.handleProxyError.bind(this)
    });
  }

  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const span = trace.getSpan(context.active());
        if (span && config.headers) {
          config.headers['traceparent'] = span.spanContext().traceId;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  private getForwardHeaders(req: any): Record<string, string> {
    const headers: Record<string, string> = {
      'x-correlation-id': req.headers['x-correlation-id'] || `${Date.now()}-${Math.random()}`,
      'x-forwarded-for': req.ip,
      'x-original-url': req.originalUrl
    };

    if (req.user) {
      headers['x-user-id'] = req.user.id;
      headers['x-user-role'] = req.user.role;
    }

    return headers;
  }

  private getPathRewrite(): { [key: string]: string } {
    return {
      [`^/${this.options.tracing.serviceName}`]: ''
    };
  }

  private async transformResponse(data: any): Promise<any> {
    // Implement platform-specific response transformations
    return data;
  }

  private handleProxyRequest(proxyReq: any, req: any, res: any): void {
    if (this.options.platformSpecific?.transformRequest) {
      // Implement request transformation logic
    }
  }

  private handleProxyResponse(proxyRes: any, req: any, res: any): void {
    proxyRes.headers['x-service'] = this.options.tracing.serviceName;
  }

  private handleProxyError(err: Error, req: any, res: any): void {
    logger.error('Proxy error occurred', err, {
      service: this.options.tracing.serviceName,
      path: req.path,
      method: req.method
    });

    throw new ApiError(502, 'Bad Gateway', {
      service: this.options.tracing.serviceName,
      originalError: err.message
    });
  }
}