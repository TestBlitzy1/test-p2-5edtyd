import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { RateLimiter } from '../utils/rate-limiter';
import { ApiError } from './error.middleware';
import { IAuthRequest } from '../../../shared/types/auth.types';
import { ERROR_MESSAGES, API_RATE_LIMITS } from '../../../shared/constants';

// Initialize Redis-backed rate limiter with cluster mode for multi-region support
const rateLimiter = new RateLimiter({
  windowMs: API_RATE_LIMITS.RATE_LIMIT_WINDOW,
  maxRequestsAuthenticated: API_RATE_LIMITS.PER_USER_LIMIT,
  maxRequestsUnauthenticated: API_RATE_LIMITS.PER_IP_LIMIT,
  strategy: 'token-bucket',
  clusterMode: true
});

// Local cache for performance optimization
const localCache = new Map<string, {
  remaining: number;
  reset: number;
  total: number;
  timestamp: number;
}>();

// Cache TTL in milliseconds
const LOCAL_CACHE_TTL = 60000; // 1 minute

/**
 * Generates a unique rate limit key based on user ID or IP address
 * @param req Express request object
 * @returns Environment-prefixed unique identifier for rate limiting
 */
const getRateLimitKey = (req: IAuthRequest): string => {
  const prefix = `${process.env.NODE_ENV || 'development'}:ratelimit:`;
  
  // Use user ID for authenticated requests
  if (req.user?.id) {
    return `${prefix}user:${req.user.id}`;
  }
  
  // Normalize and validate IP address
  let clientIp = req.ip;
  if (clientIp.substr(0, 7) === '::ffff:') {
    clientIp = clientIp.substr(7);
  }
  
  return `${prefix}ip:${clientIp}`;
};

/**
 * Express middleware for distributed rate limiting with performance optimization
 * @param req Express request object
 * @param res Express response object
 * @param next Express next function
 */
export const rateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as IAuthRequest;
    const key = getRateLimitKey(authReq);
    const isAuthenticated = !!authReq.user;

    // Check local cache first for performance
    const now = Date.now();
    const cachedInfo = localCache.get(key);
    if (cachedInfo && (now - cachedInfo.timestamp) < LOCAL_CACHE_TTL) {
      if (cachedInfo.remaining > 0) {
        // Update remaining count in cache
        cachedInfo.remaining--;
        localCache.set(key, {
          ...cachedInfo,
          remaining: cachedInfo.remaining
        });

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', cachedInfo.total);
        res.setHeader('X-RateLimit-Remaining', cachedInfo.remaining);
        res.setHeader('X-RateLimit-Reset', cachedInfo.reset);
        
        return next();
      } else if (now < cachedInfo.reset) {
        // Rate limit exceeded
        const retryAfter = Math.ceil((cachedInfo.reset - now) / 1000);
        res.setHeader('Retry-After', retryAfter);
        throw new ApiError(
          StatusCodes.TOO_MANY_REQUESTS,
          ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
          {
            retryAfter,
            limit: cachedInfo.total,
            windowMs: API_RATE_LIMITS.RATE_LIMIT_WINDOW
          }
        );
      }
    }

    // Check distributed rate limit
    const rateLimitInfo = await rateLimiter.checkRateLimit(key, isAuthenticated);

    // Update local cache
    localCache.set(key, {
      remaining: rateLimitInfo.remaining,
      reset: rateLimitInfo.reset,
      total: rateLimitInfo.total,
      timestamp: now
    });

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', rateLimitInfo.total);
    res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remaining);
    res.setHeader('X-RateLimit-Reset', rateLimitInfo.reset);

    // Check if rate limit exceeded
    if (rateLimitInfo.remaining <= 0) {
      res.setHeader('Retry-After', rateLimitInfo.retryAfter);
      throw new ApiError(
        StatusCodes.TOO_MANY_REQUESTS,
        ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
        {
          retryAfter: rateLimitInfo.retryAfter,
          limit: rateLimitInfo.total,
          windowMs: API_RATE_LIMITS.RATE_LIMIT_WINDOW
        }
      );
    }

    // Clean up expired cache entries periodically
    if (Math.random() < 0.01) { // 1% chance to run cleanup
      const expiredTime = now - LOCAL_CACHE_TTL;
      for (const [cacheKey, value] of localCache.entries()) {
        if (value.timestamp < expiredTime) {
          localCache.delete(cacheKey);
        }
      }
    }

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.PLATFORM_ERROR,
        { error: error.message }
      ));
    }
  }
};