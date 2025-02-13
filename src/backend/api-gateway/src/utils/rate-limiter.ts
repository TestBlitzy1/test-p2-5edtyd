// External package imports
import Redis from 'ioredis'; // ^5.3.0
import ms from 'ms'; // ^2.1.3

// Internal imports
import { rateLimiting } from '../config';

/**
 * Configuration options for rate limiter
 */
export interface IRateLimiterOptions {
  windowMs: number;
  maxRequestsAuthenticated: number;
  maxRequestsUnauthenticated: number;
  strategy: 'token-bucket' | 'leaky-bucket';
  clusterMode: boolean;
}

/**
 * Rate limit status information
 */
export interface IRateLimitInfo {
  remaining: number;
  reset: number;
  total: number;
  retryAfter: number;
}

/**
 * Enterprise-grade distributed rate limiter with Redis cluster support
 */
export class RateLimiter {
  private readonly redisClient: Redis;
  private readonly options: IRateLimiterOptions;
  private readonly localCache: Map<string, IRateLimitInfo>;
  private readonly lockPrefix = 'ratelimit:lock:';
  private readonly counterPrefix = 'ratelimit:counter:';
  private readonly windowPrefix = 'ratelimit:window:';
  private readonly lockTTL = 1000; // 1 second lock timeout

  /**
   * Initialize rate limiter with Redis connection and options
   */
  constructor(options: Partial<IRateLimiterOptions> = {}) {
    // Initialize Redis client with cluster support if enabled
    this.redisClient = options.clusterMode ? 
      new Redis.Cluster([
        { host: process.env.REDIS_HOST || 'localhost', port: Number(process.env.REDIS_PORT) || 6379 }
      ], {
        redisOptions: {
          enableReadyCheck: true,
          maxRetriesPerRequest: 3
        }
      }) :
      new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3
      });

    // Set rate limiting options with defaults from config
    this.options = {
      windowMs: options.windowMs || rateLimiting.authenticated.windowMs,
      maxRequestsAuthenticated: options.maxRequestsAuthenticated || rateLimiting.authenticated.maxRequests,
      maxRequestsUnauthenticated: options.maxRequestsUnauthenticated || rateLimiting.unauthenticated.maxRequests,
      strategy: options.strategy || 'token-bucket',
      clusterMode: options.clusterMode || false
    };

    // Initialize local cache for performance optimization
    this.localCache = new Map();

    // Setup health check monitoring
    this.setupHealthCheck();
  }

  /**
   * Check if request is within rate limits using specified algorithm
   */
  public async checkRateLimit(key: string, isAuthenticated: boolean): Promise<IRateLimitInfo> {
    const maxRequests = isAuthenticated ? 
      this.options.maxRequestsAuthenticated : 
      this.options.maxRequestsUnauthenticated;

    // Check local cache first for performance
    const cachedInfo = this.localCache.get(key);
    if (cachedInfo && Date.now() < cachedInfo.reset) {
      if (cachedInfo.remaining > 0) {
        cachedInfo.remaining--;
        this.localCache.set(key, cachedInfo);
        return cachedInfo;
      }
      return cachedInfo;
    }

    // Acquire distributed lock
    const lockKey = this.lockPrefix + key;
    const locked = await this.acquireLock(lockKey);
    if (!locked) {
      throw new Error('Rate limit lock acquisition failed');
    }

    try {
      const counterKey = this.counterPrefix + key;
      const windowKey = this.windowPrefix + key;

      // Get current count and window from Redis
      const [count, windowStart] = await Promise.all([
        this.redisClient.get(counterKey),
        this.redisClient.get(windowKey)
      ]);

      const now = Date.now();
      const currentWindow = Number(windowStart) || now;
      const currentCount = Number(count) || 0;

      // Apply rate limiting strategy
      let newCount: number;
      if (this.options.strategy === 'token-bucket') {
        newCount = this.applyTokenBucket(currentCount, currentWindow, now, maxRequests);
      } else {
        newCount = this.applyLeakyBucket(currentCount, currentWindow, now, maxRequests);
      }

      // Calculate next reset time
      const reset = currentWindow + this.options.windowMs;
      const remaining = Math.max(0, maxRequests - newCount);
      const retryAfter = remaining > 0 ? 0 : Math.ceil((reset - now) / 1000);

      // Update Redis atomically
      const multi = this.redisClient.multi();
      multi.set(counterKey, newCount.toString(), 'PX', this.options.windowMs);
      multi.set(windowKey, currentWindow.toString(), 'PX', this.options.windowMs);
      await multi.exec();

      // Update local cache
      const limitInfo: IRateLimitInfo = {
        remaining,
        reset,
        total: maxRequests,
        retryAfter
      };
      this.localCache.set(key, limitInfo);

      return limitInfo;
    } finally {
      // Release distributed lock
      await this.releaseLock(lockKey);
    }
  }

  /**
   * Reset rate limit counter for a key
   */
  public async resetRateLimit(key: string): Promise<void> {
    const lockKey = this.lockPrefix + key;
    const locked = await this.acquireLock(lockKey);
    if (!locked) {
      throw new Error('Rate limit lock acquisition failed');
    }

    try {
      const multi = this.redisClient.multi();
      multi.del(this.counterPrefix + key);
      multi.del(this.windowPrefix + key);
      await multi.exec();
      this.localCache.delete(key);
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  /**
   * Cleanup resources on shutdown
   */
  public async shutdown(): Promise<void> {
    this.localCache.clear();
    await this.redisClient.quit();
  }

  /**
   * Apply token bucket algorithm for rate limiting
   */
  private applyTokenBucket(
    currentCount: number,
    windowStart: number,
    now: number,
    maxRequests: number
  ): number {
    const elapsedTime = now - windowStart;
    if (elapsedTime >= this.options.windowMs) {
      return 1; // New window starts with 1 request
    }
    return Math.min(currentCount + 1, maxRequests);
  }

  /**
   * Apply leaky bucket algorithm for rate limiting
   */
  private applyLeakyBucket(
    currentCount: number,
    windowStart: number,
    now: number,
    maxRequests: number
  ): number {
    const elapsedTime = now - windowStart;
    const leakRate = maxRequests / this.options.windowMs;
    const leaked = Math.floor(elapsedTime * leakRate);
    return Math.max(0, Math.min(currentCount - leaked + 1, maxRequests));
  }

  /**
   * Acquire distributed lock using Redis
   */
  private async acquireLock(lockKey: string): Promise<boolean> {
    const token = Math.random().toString(36);
    const acquired = await this.redisClient.set(
      lockKey,
      token,
      'PX',
      this.lockTTL,
      'NX'
    );
    return acquired === 'OK';
  }

  /**
   * Release distributed lock
   */
  private async releaseLock(lockKey: string): Promise<void> {
    await this.redisClient.del(lockKey);
  }

  /**
   * Setup Redis health check monitoring
   */
  private setupHealthCheck(): void {
    this.redisClient.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    this.redisClient.on('ready', () => {
      console.log('Redis connection established');
    });

    // Periodic health check
    setInterval(async () => {
      try {
        await this.redisClient.ping();
      } catch (error) {
        console.error('Redis health check failed:', error);
      }
    }, 30000); // Check every 30 seconds
  }
}