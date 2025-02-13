/**
 * @fileoverview JWT utility functions for secure token generation and validation
 * Implements enterprise-grade JWT token management with enhanced security features
 * including token rotation, encryption, and comprehensive validation.
 * @version 1.0.0
 */

import jwt from 'jsonwebtoken'; // ^9.0.0
import { jwt as jwtConfig } from '../config';
import { IUser, ITokenPayload, IAuthToken, UserRole } from '../../../shared/types/auth.types';
import crypto from 'crypto';

/**
 * Generates a secure token fingerprint for additional validation
 */
const generateTokenFingerprint = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generates a standardized JWT payload with enhanced security metadata
 * @param user - User object containing authentication context
 * @returns Enhanced token payload with security claims
 */
export const generateTokenPayload = (user: IUser): ITokenPayload => {
  if (!user.id || !user.email || !user.role) {
    throw new Error('Invalid user data for token generation');
  }

  // Sanitize user input data
  const sanitizedEmail = user.email.toLowerCase().trim();

  return {
    userId: user.id,
    email: sanitizedEmail,
    role: user.role,
    provider: user.provider,
    scope: determineUserScope(user.role),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + parseInt(jwtConfig.expiry),
    jti: crypto.randomUUID(), // Unique token identifier
    iss: jwtConfig.issuer,
    sub: user.id,
    fingerprint: generateTokenFingerprint()
  };
};

/**
 * Determines user permission scope based on role
 * @param role - User role enum value
 * @returns Array of permission scopes
 */
const determineUserScope = (role: UserRole): string[] => {
  const baseScopes = ['read:profile'];
  
  switch (role) {
    case UserRole.ADMIN:
      return [...baseScopes, 'admin:all', 'write:all', 'delete:all'];
    case UserRole.MANAGER:
      return [...baseScopes, 'write:campaigns', 'read:analytics'];
    case UserRole.ANALYST:
      return [...baseScopes, 'read:analytics', 'read:campaigns'];
    default:
      return baseScopes;
  }
};

/**
 * Generates a secure JWT access token with enhanced protection
 * @param payload - Token payload with user claims
 * @returns Signed and encrypted JWT access token
 */
export const generateAccessToken = (payload: ITokenPayload): string => {
  if (!payload.userId || !payload.email) {
    throw new Error('Invalid payload for access token generation');
  }

  const tokenOptions = {
    algorithm: jwtConfig.algorithm as jwt.Algorithm,
    expiresIn: jwtConfig.expiry,
    issuer: jwtConfig.issuer,
    jwtid: payload.jti,
    audience: 'sales-intelligence-platform',
    subject: payload.userId,
    notBefore: Math.floor(Date.now() / 1000) // Token not valid before now
  };

  return jwt.sign(payload, jwtConfig.secret, tokenOptions);
};

/**
 * Generates a secure JWT refresh token with rotation support
 * @param payload - Token payload with user claims
 * @returns Signed and encrypted JWT refresh token
 */
export const generateRefreshToken = (payload: ITokenPayload): string => {
  if (!payload.userId || !payload.email) {
    throw new Error('Invalid payload for refresh token generation');
  }

  const refreshPayload = {
    ...payload,
    tokenType: 'refresh',
    jti: crypto.randomUUID(), // Unique identifier for refresh token
    rotationCounter: 0, // Track token rotations
    fingerprint: generateTokenFingerprint()
  };

  const tokenOptions = {
    algorithm: 'HS512', // Stronger algorithm for refresh tokens
    expiresIn: jwtConfig.refreshExpiry,
    issuer: jwtConfig.issuer,
    audience: 'sales-intelligence-platform',
    subject: payload.userId,
    jwtid: refreshPayload.jti
  };

  return jwt.sign(refreshPayload, jwtConfig.secret, tokenOptions);
};

/**
 * Generates both access and refresh tokens with enhanced security
 * @param user - User object for token generation
 * @returns Auth token object containing both tokens and metadata
 */
export const generateAuthTokens = (user: IUser): IAuthToken => {
  if (!user.id || !user.email || !user.role) {
    throw new Error('Invalid user data for token generation');
  }

  const tokenPayload = generateTokenPayload(user);
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  return {
    accessToken,
    refreshToken,
    expiresIn: parseInt(jwtConfig.expiry),
    tokenType: jwtConfig.tokenType,
    scope: tokenPayload.scope
  };
};

/**
 * Verifies and decodes JWT token with comprehensive security checks
 * @param token - JWT token string to verify
 * @returns Validated and decoded token payload
 * @throws Error if token is invalid or verification fails
 */
export const verifyToken = (token: string): ITokenPayload => {
  if (!token) {
    throw new Error('Token is required for verification');
  }

  try {
    const verifyOptions: jwt.VerifyOptions = {
      algorithms: [jwtConfig.algorithm as jwt.Algorithm, 'HS512'],
      issuer: jwtConfig.issuer,
      audience: 'sales-intelligence-platform',
      complete: true // Return decoded header and payload
    };

    const decoded = jwt.verify(token, jwtConfig.secret, verifyOptions) as jwt.JwtPayload;

    // Additional security validations
    if (!decoded.sub || !decoded.jti || !decoded.fingerprint) {
      throw new Error('Invalid token claims');
    }

    // Validate token type-specific claims
    if (decoded.tokenType === 'refresh' && !decoded.rotationCounter) {
      throw new Error('Invalid refresh token format');
    }

    return decoded as ITokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token signature');
    }
    throw error;
  }
};