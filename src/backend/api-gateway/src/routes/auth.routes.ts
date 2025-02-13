/**
 * @fileoverview Authentication routes configuration with enhanced security features
 * Implements comprehensive authentication endpoints with MFA, OAuth support, and advanced security
 * @version 1.0.0
 */

import { Router } from 'express'; // ^4.18.2
import rateLimit from 'express-rate-limit'; // ^6.7.0
import helmet from 'helmet'; // ^7.0.0
import { authenticate, authorize } from '../middleware/auth.middleware';
import { AuthController } from '../../../auth-service/src/controllers/auth.controller';
import { UserRole } from '../../../shared/types/auth.types';
import { API_RATE_LIMITS, ERROR_MESSAGES } from '../../../shared/constants';

// Initialize router with security defaults
const router = Router();

// Apply security headers
router.use(helmet());

// Configure rate limiting for authentication endpoints
const authRateLimiter = rateLimit({
  windowMs: API_RATE_LIMITS.RATE_LIMIT_WINDOW,
  max: API_RATE_LIMITS.PER_IP_LIMIT,
  message: { error: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for sensitive endpoints
const sensitiveRateLimiter = rateLimit({
  windowMs: API_RATE_LIMITS.RATE_LIMIT_WINDOW,
  max: Math.floor(API_RATE_LIMITS.PER_IP_LIMIT / 2),
  message: { error: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Initializes authentication routes with comprehensive security features
 * @param authController - Authentication controller instance
 * @returns Configured Express router
 */
const initializeAuthRoutes = (authController: AuthController): Router => {
  // User registration endpoint
  router.post(
    '/register',
    authRateLimiter,
    async (req, res, next) => {
      try {
        const result = await authController.register(req.body);
        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  // Enhanced login endpoint with MFA support
  router.post(
    '/login',
    authRateLimiter,
    async (req, res, next) => {
      try {
        const result = await authController.login(req.body);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  // Secure logout endpoint
  router.post(
    '/logout',
    authenticate,
    async (req, res, next) => {
      try {
        await authController.logout(req.body);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  // Token refresh endpoint with rotation
  router.post(
    '/refresh-token',
    sensitiveRateLimiter,
    async (req, res, next) => {
      try {
        const result = await authController.refreshToken(req.body);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  // Session verification endpoint
  router.get(
    '/verify',
    authenticate,
    async (req, res, next) => {
      try {
        const result = await authController.verifySession(req);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  // MFA setup endpoint
  router.post(
    '/mfa/setup',
    authenticate,
    sensitiveRateLimiter,
    async (req, res, next) => {
      try {
        const result = await authController.setupMFA(req.body);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  // MFA validation endpoint
  router.post(
    '/mfa/validate',
    authenticate,
    sensitiveRateLimiter,
    async (req, res, next) => {
      try {
        const result = await authController.validateMFA(req.body);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  // OAuth initiation endpoints
  router.get(
    '/oauth/:provider',
    authRateLimiter,
    async (req, res, next) => {
      try {
        const { provider } = req.params;
        const result = await authController.initiateOAuth(provider);
        res.redirect(result.authorizationUrl);
      } catch (error) {
        next(error);
      }
    }
  );

  // OAuth callback endpoint
  router.post(
    '/oauth/callback',
    authRateLimiter,
    async (req, res, next) => {
      try {
        const result = await authController.handleOAuthCallback(req.body);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  // Password reset request endpoint
  router.post(
    '/password/reset-request',
    authRateLimiter,
    async (req, res, next) => {
      try {
        await authController.requestPasswordReset(req.body);
        res.status(202).send();
      } catch (error) {
        next(error);
      }
    }
  );

  // Password reset confirmation endpoint
  router.post(
    '/password/reset',
    sensitiveRateLimiter,
    async (req, res, next) => {
      try {
        await authController.resetPassword(req.body);
        res.status(200).send();
      } catch (error) {
        next(error);
      }
    }
  );

  // Admin-only user management endpoints
  router.get(
    '/users',
    authenticate,
    authorize([UserRole.ADMIN]),
    async (req, res, next) => {
      try {
        const result = await authController.listUsers(req.query);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
};

// Export configured router
export default initializeAuthRoutes;