import { describe, it, beforeAll, afterAll } from 'jest';
import { request } from 'supertest';
import { MockOAuthProvider } from 'jest-mock-oauth2-server';
import { UserRole } from '@types/user-interfaces';

// Internal imports
import { setupTestEnvironment, cleanDatabase } from '../../utils/test.helpers';
import { TEST_USER, TEST_AUTH_HEADERS } from '../../utils/test.constants';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_TIMEOUT = 30000;

describe('Authentication E2E Tests', () => {
  let testEnv: any;
  let mockOAuth: MockOAuthProvider;

  beforeAll(async () => {
    // Setup test environment
    testEnv = await setupTestEnvironment({
      dbConfig: {
        host: process.env.TEST_DB_HOST || 'localhost',
        port: parseInt(process.env.TEST_DB_PORT || '5432'),
        database: 'test_db',
        user: 'test_user',
        password: 'test_password'
      },
      mockServerPort: 3001
    });

    // Initialize mock OAuth provider
    mockOAuth = new MockOAuthProvider({
      port: 3002,
      accessTokenLifetime: 3600
    });

    await mockOAuth.start();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await cleanDatabase(testEnv.dbPool);
    await mockOAuth.stop();
    await testEnv.cleanup();
  });

  describe('User Registration', () => {
    it('should successfully register a new user with valid data', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'StrongP@ssw0rd123',
          firstName: 'New',
          lastName: 'User',
          role: UserRole.USER
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe('newuser@example.com');
      expect(response.body.isEmailVerified).toBe(false);
    });

    it('should reject registration with duplicate email', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/auth/register')
        .send({
          email: TEST_USER.email,
          password: 'StrongP@ssw0rd123',
          firstName: 'Duplicate',
          lastName: 'User',
          role: UserRole.USER
        });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate password requirements', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/auth/register')
        .send({
          email: 'weakpass@example.com',
          password: 'weak',
          firstName: 'Weak',
          lastName: 'Password',
          role: UserRole.USER
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('password requirements');
    });
  });

  describe('User Login', () => {
    it('should authenticate user with valid credentials', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/auth/login')
        .send({
          email: TEST_USER.email,
          password: TEST_USER.password
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.tokenType).toBe('Bearer');
    });

    it('should handle OAuth2 login flow', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/auth/oauth/google')
        .query({
          code: 'mock_auth_code',
          state: 'mock_state'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
    });

    it('should block login after multiple failures', async () => {
      for (let i = 0; i < 5; i++) {
        await request(API_BASE_URL)
          .post('/api/auth/login')
          .send({
            email: TEST_USER.email,
            password: 'wrong_password'
          });
      }

      const response = await request(API_BASE_URL)
        .post('/api/auth/login')
        .send({
          email: TEST_USER.email,
          password: TEST_USER.password
        });

      expect(response.status).toBe(429);
      expect(response.body.error).toContain('account locked');
    });
  });

  describe('Token Management', () => {
    it('should refresh access token with valid refresh token', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/auth/token/refresh')
        .send({
          refreshToken: TEST_AUTH_HEADERS.Authorization.split(' ')[1]
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.tokenType).toBe('Bearer');
    });

    it('should revoke refresh token', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/auth/token/revoke')
        .set(TEST_AUTH_HEADERS)
        .send({
          refreshToken: TEST_AUTH_HEADERS.Authorization.split(' ')[1]
        });

      expect(response.status).toBe(200);
    });

    it('should handle expired tokens appropriately', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/auth/profile')
        .set({
          ...TEST_AUTH_HEADERS,
          Authorization: 'Bearer expired.token.here'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('token expired');
    });
  });

  describe('Role-Based Access Control', () => {
    it('should enforce admin-only endpoint access', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/admin/users')
        .set({
          ...TEST_AUTH_HEADERS,
          Authorization: `Bearer ${TEST_USER.role !== UserRole.ADMIN}`
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('insufficient permissions');
    });

    it('should allow role-appropriate access to resources', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/campaigns/analytics')
        .set(TEST_AUTH_HEADERS);

      expect(response.status).toBe(200);
    });

    it('should handle role elevation requests', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/auth/role/elevate')
        .set(TEST_AUTH_HEADERS)
        .send({
          targetRole: UserRole.MANAGER,
          justification: 'Need access to manage team campaigns'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('pendingApproval');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle network timeouts gracefully', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/auth/login')
        .timeout(100)
        .send({
          email: TEST_USER.email,
          password: TEST_USER.password
        });

      expect(response.status).toBe(504);
    });

    it('should enforce rate limiting', async () => {
      const requests = Array(20).fill(null).map(() =>
        request(API_BASE_URL)
          .post('/api/auth/login')
          .send({
            email: TEST_USER.email,
            password: TEST_USER.password
          })
      );

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.some(r => r.status === 429);
      expect(tooManyRequests).toBe(true);
    });

    it('should validate security headers', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/auth/profile')
        .set(TEST_AUTH_HEADERS);

      expect(response.headers).toHaveProperty('strict-transport-security');
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
    });
  });
});