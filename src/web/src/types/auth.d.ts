import type { Session } from 'next-auth';

/**
 * User role enumeration for role-based access control
 * @version 1.0.0
 */
export enum UserRole {
    ADMIN = 'ADMIN',
    MANAGER = 'MANAGER',
    ANALYST = 'ANALYST',
    USER = 'USER'
}

/**
 * Authentication provider types for OAuth integration and local authentication
 * @version 1.0.0
 */
export enum AuthProvider {
    LOCAL = 'LOCAL',
    GOOGLE = 'GOOGLE',
    LINKEDIN = 'LINKEDIN'
}

/**
 * Role-based permission mapping
 * Defines access control for different user roles
 * @version 1.0.0
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
    ADMIN: ['*'],
    MANAGER: ['campaign:*', 'analytics:*'],
    ANALYST: ['analytics:read'],
    USER: ['campaign:read']
};

/**
 * User interface type definition for frontend user data management
 * @interface User
 */
export interface User {
    id: string;
    email: string;
    role: UserRole;
    provider: AuthProvider;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Login credentials interface for local authentication
 * @interface LoginCredentials
 */
export interface LoginCredentials {
    email: string;
    password: string;
}

/**
 * Authentication state interface for frontend state management
 * @interface AuthState
 */
export interface AuthState {
    user: User | null;
    loading: boolean;
    error: string | null;
}

/**
 * Authentication token interface for JWT token management
 * @interface AuthToken
 */
export interface AuthToken {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

/**
 * Extended Next.js session interface with custom properties
 * Extends the base Session type from next-auth
 * @interface AuthSession
 */
export interface AuthSession extends Session {
    user: User;
    token: AuthToken;
    expires: Date;
}

/**
 * Type guard to check if a role has specific permission
 * @param role - User role to check
 * @param permission - Permission to verify
 */
export function hasPermission(role: UserRole, permission: string): boolean {
    const permissions = ROLE_PERMISSIONS[role];
    return permissions.includes('*') || permissions.includes(permission);
}

/**
 * Type guard to check if a user object is valid
 * @param user - User object to validate
 */
export function isValidUser(user: any): user is User {
    return (
        user &&
        typeof user.id === 'string' &&
        typeof user.email === 'string' &&
        Object.values(UserRole).includes(user.role) &&
        Object.values(AuthProvider).includes(user.provider) &&
        user.createdAt instanceof Date &&
        user.updatedAt instanceof Date
    );
}

/**
 * Type guard to check if auth token is valid
 * @param token - Token object to validate
 */
export function isValidAuthToken(token: any): token is AuthToken {
    return (
        token &&
        typeof token.accessToken === 'string' &&
        typeof token.refreshToken === 'string' &&
        typeof token.expiresIn === 'number'
    );
}

/**
 * Type guard to check if auth session is valid
 * @param session - Session object to validate
 */
export function isValidAuthSession(session: any): session is AuthSession {
    return (
        session &&
        isValidUser(session.user) &&
        isValidAuthToken(session.token) &&
        session.expires instanceof Date
    );
}