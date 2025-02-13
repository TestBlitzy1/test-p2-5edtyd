import { jest } from '@jest/globals';
import { IUser, IAuthToken, UserRole, AuthProvider } from '../../../backend/shared/types/auth.types';

// Enhanced mock user data with complete authentication profiles
export const mockUsers: Record<string, IUser> = {
    adminUser: {
        id: 'admin-123',
        email: 'admin@example.com',
        password: '$2b$10$hashed_password_admin',
        role: UserRole.ADMIN,
        provider: AuthProvider.LOCAL,
        providerId: null,
        firstName: 'Admin',
        lastName: 'User',
        isEmailVerified: true,
        lastLoginAt: new Date('2024-01-01T00:00:00Z'),
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
    },
    managerUser: {
        id: 'manager-456',
        email: 'manager@example.com',
        password: null,
        role: UserRole.MANAGER,
        provider: AuthProvider.GOOGLE,
        providerId: 'google-user-123',
        firstName: 'Manager',
        lastName: 'User',
        isEmailVerified: true,
        lastLoginAt: new Date('2024-01-01T00:00:00Z'),
        createdAt: new Date('2023-06-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
    },
    analystUser: {
        id: 'analyst-789',
        email: 'analyst@example.com',
        password: null,
        role: UserRole.ANALYST,
        provider: AuthProvider.LINKEDIN,
        providerId: 'linkedin-user-456',
        firstName: 'Analyst',
        lastName: 'User',
        isEmailVerified: true,
        lastLoginAt: new Date('2024-01-01T00:00:00Z'),
        createdAt: new Date('2023-09-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
    }
};

// OAuth-compliant mock tokens with various states
export const mockTokens: Record<string, IAuthToken> = {
    validToken: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh',
        expiresIn: 3600,
        tokenType: 'Bearer',
        scope: ['read:campaigns', 'write:campaigns', 'read:analytics']
    },
    expiredToken: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh',
        expiresIn: 0,
        tokenType: 'Bearer',
        scope: ['read:campaigns']
    },
    refreshToken: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh.new',
        expiresIn: 3600,
        tokenType: 'Bearer',
        scope: ['read:campaigns', 'write:campaigns']
    }
};

/**
 * Returns an enhanced mock user object with complete authentication profile
 * @param role - User role to retrieve
 * @param provider - Authentication provider
 * @returns Enhanced mock user object
 */
export const getMockUser = (role: string, provider: string = AuthProvider.LOCAL): IUser => {
    const validRoles = Object.values(UserRole);
    if (!validRoles.includes(role as UserRole)) {
        throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
    }

    const user = Object.values(mockUsers).find(u => u.role === role && u.provider === provider);
    if (!user) {
        throw new Error(`No mock user found for role ${role} and provider ${provider}`);
    }

    return {
        ...user,
        lastLoginAt: new Date(),
        updatedAt: new Date()
    };
};

/**
 * Generates OAuth-compliant mock authentication tokens
 * @param userId - User identifier
 * @param scopes - Permission scopes
 * @param tokenType - Token type (default: 'Bearer')
 * @returns OAuth-compliant mock token
 */
export const getMockToken = (
    userId: string,
    scopes: string[] = ['read:campaigns'],
    tokenType: string = 'Bearer'
): IAuthToken => {
    const user = Object.values(mockUsers).find(u => u.id === userId);
    if (!user) {
        throw new Error(`No mock user found with ID: ${userId}`);
    }

    return {
        accessToken: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${userId}`,
        refreshToken: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh.${userId}`,
        expiresIn: 3600,
        tokenType,
        scope: scopes
    };
};

/**
 * Creates a comprehensive mock authentication service with enhanced security features
 * @returns Enhanced mock auth service
 */
export const mockAuthService = () => ({
    register: jest.fn().mockImplementation((email: string, password: string) => {
        const user = { ...mockUsers.analystUser, email, password };
        return Promise.resolve(user);
    }),

    login: jest.fn().mockImplementation((email: string, password: string) => {
        const user = Object.values(mockUsers).find(u => u.email === email);
        if (!user) {
            return Promise.reject(new Error('User not found'));
        }
        return Promise.resolve({
            user,
            token: mockTokens.validToken
        });
    }),

    refreshToken: jest.fn().mockImplementation((token: string) => {
        return Promise.resolve(mockTokens.refreshToken);
    }),

    validateUser: jest.fn().mockImplementation((token: string) => {
        const user = mockUsers.adminUser;
        return Promise.resolve(user);
    }),

    resetPassword: jest.fn().mockImplementation((email: string) => {
        return Promise.resolve({ success: true });
    }),

    verifyEmail: jest.fn().mockImplementation((token: string) => {
        return Promise.resolve({ success: true });
    }),

    validateOAuthProvider: jest.fn().mockImplementation((provider: string) => {
        return Promise.resolve(true);
    })
});