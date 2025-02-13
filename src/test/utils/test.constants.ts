// Internal imports
import { UserRole } from '../../backend/shared/types/auth.types';
import { PlatformType } from '../../backend/shared/types/campaign.types';
import { MetricType } from '../../backend/shared/types/analytics.types';
import jwt from 'jsonwebtoken'; // @types/jsonwebtoken@^9.0.0

// Global test constants
export const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
export const TEST_CAMPAIGN_ID = '7b8e6a50-d6a3-4bd2-a4e3-aa456789bbcc';
export const TEST_JWT_SECRET = 'test-jwt-secret-key';
export const TEST_API_KEY = 'test-api-key-12345';

// Mock user data for authentication testing
export const TEST_USER = {
    id: TEST_USER_ID,
    email: 'test@example.com',
    role: UserRole.ADMIN,
    firstName: 'Test',
    lastName: 'User',
    isEmailVerified: true,
    lastLoginAt: new Date('2024-01-01T00:00:00Z'),
    preferences: {
        timezone: 'UTC',
        notifications: true,
        language: 'en'
    }
} as const;

// Mock campaign data for campaign testing
export const TEST_CAMPAIGN = {
    id: TEST_CAMPAIGN_ID,
    name: 'Test Campaign',
    platform: PlatformType.LINKEDIN,
    objective: 'LEAD_GENERATION',
    status: 'ACTIVE',
    budget: {
        amount: 1000,
        currency: 'USD',
        period: 'DAILY'
    },
    targeting: {
        locations: [{
            id: 'us-1',
            country: 'United States',
            region: 'California'
        }],
        industries: ['Technology', 'Marketing'],
        companySize: ['11-50', '51-200'],
        jobTitles: ['Marketing Manager', 'Digital Marketing Specialist']
    },
    creatives: [{
        id: 'creative-1',
        type: 'IMAGE',
        url: 'https://test-cdn.example.com/image1.jpg',
        headline: 'Test Headline',
        description: 'Test Description'
    }]
} as const;

// Mock metrics data for analytics testing
export const TEST_METRICS = {
    campaignId: TEST_CAMPAIGN_ID,
    metrics: [
        {
            type: MetricType.IMPRESSIONS,
            value: 10000,
            timestamp: new Date('2024-01-01T00:00:00Z')
        },
        {
            type: MetricType.CTR,
            value: 2.5,
            timestamp: new Date('2024-01-01T00:00:00Z')
        },
        {
            type: MetricType.CONVERSION_RATE,
            value: 3.2,
            timestamp: new Date('2024-01-01T00:00:00Z')
        }
    ],
    dimensions: {
        timeGranularity: 'DAILY',
        platform: PlatformType.LINKEDIN
    }
} as const;

// Mock authorization headers for API testing
export const TEST_AUTH_HEADERS = {
    Authorization: `Bearer ${generateTestToken(TEST_USER_ID, UserRole.ADMIN, '1h')}`,
    'Content-Type': 'application/json',
    'X-API-Key': TEST_API_KEY
} as const;

/**
 * Generates a test JWT token for authentication testing
 * @param userId - User identifier
 * @param role - User role
 * @param expiresIn - Token expiration time
 * @returns Signed JWT token string
 */
export function generateTestToken(
    userId: string,
    role: UserRole,
    expiresIn: string
): string {
    if (!userId || !role) {
        throw new Error('userId and role are required for token generation');
    }

    const payload = {
        userId,
        role,
        email: TEST_USER.email,
        scope: ['read', 'write']
    };

    return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn });
}

/**
 * Creates a test campaign object with default values
 * @param platform - Advertising platform type
 * @param overrides - Optional campaign property overrides
 * @returns Test campaign object
 */
export function createTestCampaign(
    platform: PlatformType,
    overrides: Partial<typeof TEST_CAMPAIGN> = {}
) {
    if (!Object.values(PlatformType).includes(platform)) {
        throw new Error('Invalid platform type');
    }

    return {
        ...TEST_CAMPAIGN,
        id: `test-campaign-${Date.now()}`,
        platform,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
}