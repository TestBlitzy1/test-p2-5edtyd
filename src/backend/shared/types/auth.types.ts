// External package imports
// express@^4.18.0 - Express request type extension
import { Request } from 'express';
// jsonwebtoken@^9.0.0 - JWT token payload type definition
import { JwtPayload } from 'jsonwebtoken';

/**
 * Hierarchical user role enumeration for role-based access control
 */
export enum UserRole {
    ADMIN = 'ADMIN',       // Full system access
    MANAGER = 'MANAGER',   // Campaign management access
    ANALYST = 'ANALYST',   // Read-only analytics access
    USER = 'USER'         // Basic user access
}

/**
 * Authentication provider types for multi-provider support
 */
export enum AuthProvider {
    LOCAL = 'LOCAL',       // Local username/password auth
    GOOGLE = 'GOOGLE',     // Google OAuth2 integration
    LINKEDIN = 'LINKEDIN'  // LinkedIn OAuth2 integration
}

/**
 * Core user interface with comprehensive security and audit fields
 */
export interface IUser {
    id: string;                       // Unique user identifier
    email: string;                    // User email address
    password: string | null;          // Hashed password (null for OAuth users)
    role: UserRole;                   // User's assigned role
    provider: AuthProvider;           // Authentication provider
    providerId: string | null;        // External provider user ID
    firstName: string;                // User's first name
    lastName: string;                 // User's last name
    isEmailVerified: boolean;         // Email verification status
    lastLoginAt: Date;                // Last successful login timestamp
    createdAt: Date;                  // Account creation timestamp
    updatedAt: Date;                  // Last update timestamp
}

/**
 * Extended Express Request interface with authentication context
 */
export interface IAuthRequest extends Request {
    user: IUser;                      // Authenticated user details
    token: string;                    // Raw JWT token
    isAuthenticated: boolean;         // Authentication status flag
}

/**
 * OAuth2-compliant authentication token response
 */
export interface IAuthToken {
    accessToken: string;              // JWT access token
    refreshToken: string;             // JWT refresh token
    expiresIn: number;               // Token expiration time in seconds
    tokenType: string;               // Token type (e.g., 'Bearer')
    scope: string[];                 // Granted permission scopes
}

/**
 * Enhanced JWT token payload with security claims
 */
export interface ITokenPayload extends JwtPayload {
    userId: string;                   // User identifier
    email: string;                    // User email
    role: UserRole;                   // User role
    provider: AuthProvider;           // Auth provider
    scope: string[];                  // Permission scopes
    iat: number;                      // Token issued at timestamp
    exp: number;                      // Token expiration timestamp
}