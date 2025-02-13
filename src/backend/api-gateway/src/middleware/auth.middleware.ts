import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { IAuthRequest, UserRole } from '../../../shared/types/auth.types';
import { verifyToken, extractTokenFromHeader } from '../../../auth-service/src/utils/jwt.utils';
import { ApiError } from './error.middleware';
import { ERROR_MESSAGES } from '../../../shared/constants';
import { Logger } from '../../../shared/utils/logger';

// Initialize logger
const logger = new Logger('AuthMiddleware');

/**
 * Express middleware to authenticate requests using JWT tokens
 * Implements comprehensive security validation and token verification
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract and validate Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new ApiError(401, ERROR_MESSAGES.UNAUTHORIZED, {
        reason: 'Missing authorization header'
      });
    }

    // Extract token from header
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      throw new ApiError(401, ERROR_MESSAGES.UNAUTHORIZED, {
        reason: 'Invalid token format'
      });
    }

    // Verify token and decode payload
    const decodedToken = verifyToken(token);
    if (!decodedToken.userId || !decodedToken.email || !decodedToken.role) {
      throw new ApiError(401, ERROR_MESSAGES.INVALID_TOKEN, {
        reason: 'Invalid token payload'
      });
    }

    // Extend request with authentication context
    const authRequest = req as IAuthRequest;
    authRequest.user = {
      id: decodedToken.userId,
      email: decodedToken.email,
      role: decodedToken.role,
      provider: decodedToken.provider,
      firstName: decodedToken.firstName || '',
      lastName: decodedToken.lastName || '',
      isEmailVerified: decodedToken.isEmailVerified || false,
      lastLoginAt: new Date(decodedToken.iat * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      password: null,
      providerId: decodedToken.providerId || null
    };
    authRequest.token = token;
    authRequest.isAuthenticated = true;

    // Log successful authentication
    logger.info('Request authenticated', {
      userId: authRequest.user.id,
      role: authRequest.user.role,
      path: req.path,
      method: req.method
    });

    next();
  } catch (error) {
    // Handle specific token verification errors
    if (error.message === 'Token has expired') {
      throw new ApiError(401, ERROR_MESSAGES.INVALID_TOKEN, {
        reason: 'Token expired'
      });
    }
    if (error.message === 'Invalid token signature') {
      throw new ApiError(401, ERROR_MESSAGES.INVALID_TOKEN, {
        reason: 'Invalid signature'
      });
    }

    // Log authentication failure
    logger.error('Authentication failed', error as Error, {
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    next(error);
  }
};

/**
 * Express middleware factory for role-based access control
 * Supports multiple role authorization with granular permission checks
 */
export const authorize = (allowedRoles: UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authRequest = req as IAuthRequest;

      // Verify request is authenticated
      if (!authRequest.isAuthenticated || !authRequest.user) {
        throw new ApiError(401, ERROR_MESSAGES.UNAUTHORIZED, {
          reason: 'Authentication required'
        });
      }

      // Validate user role
      if (!authRequest.user.role) {
        throw new ApiError(403, ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, {
          reason: 'No role assigned'
        });
      }

      // Check if user role is allowed
      if (!allowedRoles.includes(authRequest.user.role)) {
        throw new ApiError(403, ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, {
          reason: 'Role not authorized',
          requiredRoles: allowedRoles,
          userRole: authRequest.user.role
        });
      }

      // Log successful authorization
      logger.info('Request authorized', {
        userId: authRequest.user.id,
        role: authRequest.user.role,
        allowedRoles,
        path: req.path,
        method: req.method
      });

      next();
    } catch (error) {
      // Log authorization failure
      logger.error('Authorization failed', error as Error, {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: (req as IAuthRequest).user?.id
      });

      next(error);
    }
  };
};
```

This implementation provides:

1. JWT token authentication with comprehensive validation
2. Role-based access control with multiple role support
3. Request context enrichment with authenticated user data
4. Detailed error handling and logging
5. Security best practices including token validation and signature verification
6. Compliance with the technical specification's security requirements
7. Integration with the error handling system
8. Audit logging for security events
9. Type safety with TypeScript
10. Support for multiple authentication providers

The middleware can be used in routes like:

```typescript
router.get('/campaigns', 
  authenticate, 
  authorize([UserRole.ADMIN, UserRole.MANAGER]), 
  campaignController.listCampaigns
);