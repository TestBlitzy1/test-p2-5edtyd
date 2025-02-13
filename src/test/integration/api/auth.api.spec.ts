import supertest from 'supertest';
import { setupTestEnvironment, cleanDatabase } from '../../utils/test.helpers';
import { mockUsers, mockTokens } from '../../mocks/auth.mock';
import nock from 'nock';
import { UserRole, AuthProvider } from '../../../backend/shared/types/auth.types';

describe('Authentication API Integration Tests', () => {
  let app: supertest.SuperTest<supertest.Test>;
  let testEnv: any;

  // Setup test environment before all tests
  beforeAll(async () => {
    testEnv = await setupTestEnvironment({
      dbConfig: {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        user: 'test_user',
        password: 'test_password'
      },
      mockServerPort: 3001
    });
    app = supertest(testEnv.mockServer.getApp());

    // Setup OAuth mock servers
    nock('https://accounts.google.com')
      .persist()
      .post('/oauth2/token')
      .reply(200, {
        access_token: 'google-mock-token',
        token_type: 'Bearer',
        expires_in: 3600
      });

    nock('https://api.linkedin.com')
      .persist()
      .post('/oauth/v2/accessToken')
      .reply(200, {
        access_token: 'linkedin-mock-token',
        token_type: 'Bearer',
        expires_in: 3600
      });
  });

  // Clean database after each test
  afterEach(async () => {
    await cleanDatabase(testEnv.dbPool);
    jest.clearAllMocks();
  });

  // Close connections after all tests
  afterAll(async () => {
    await testEnv.cleanup();
    nock.cleanAll();
  });

  describe('User Registration', () => {
    it('should successfully register a new user with valid data', async () => {
      const response = await app
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
      expect(response.body).not.toHaveProperty('password');
      expect(response.body.isEmailVerified).toBe(false);
    });

    it('should enforce password strength requirements', async () => {
      const response = await app
        .post('/api/auth/register')
        .send({
          email: 'weak@example.com',
          password: 'weak',
          firstName: 'Weak',
          lastName: 'Password'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/password strength/i);
    });

    it('should prevent duplicate email registration', async () => {
      // First registration
      await app.post('/api/auth/register').send({
        email: mockUsers.adminUser.email,
        password: 'StrongP@ssw0rd123',
        firstName: 'Duplicate',
        lastName: 'User'
      });

      // Duplicate registration attempt
      const response = await app
        .post('/api/auth/register')
        .send({
          email: mockUsers.adminUser.email,
          password: 'StrongP@ssw0rd123',
          firstName: 'Duplicate',
          lastName: 'User'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toMatch(/email already exists/i);
    });
  });

  describe('User Login', () => {
    it('should successfully login with valid credentials', async () => {
      const response = await app
        .post('/api/auth/login')
        .send({
          email: mockUsers.adminUser.email,
          password: 'StrongP@ssw0rd123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.tokenType).toBe('Bearer');
      expect(response.body.expiresIn).toBeGreaterThan(0);
    });

    it('should handle MFA validation when enabled', async () => {
      // First login attempt should return MFA challenge
      const loginResponse = await app
        .post('/api/auth/login')
        .send({
          email: mockUsers.managerUser.email,
          password: 'StrongP@ssw0rd123'
        });

      expect(loginResponse.status).toBe(202);
      expect(loginResponse.body).toHaveProperty('mfaToken');

      // Validate MFA code
      const mfaResponse = await app
        .post('/api/auth/mfa/validate')
        .send({
          mfaToken: loginResponse.body.mfaToken,
          code: '123456'
        });

      expect(mfaResponse.status).toBe(200);
      expect(mfaResponse.body).toHaveProperty('accessToken');
    });

    it('should implement rate limiting for failed attempts', async () => {
      // Multiple failed login attempts
      for (let i = 0; i < 5; i++) {
        await app
          .post('/api/auth/login')
          .send({
            email: mockUsers.adminUser.email,
            password: 'WrongPassword'
          });
      }

      // Next attempt should be rate limited
      const response = await app
        .post('/api/auth/login')
        .send({
          email: mockUsers.adminUser.email,
          password: 'WrongPassword'
        });

      expect(response.status).toBe(429);
      expect(response.body.error).toMatch(/too many attempts/i);
    });
  });

  describe('Token Management', () => {
    it('should successfully refresh access token', async () => {
      const response = await app
        .post('/api/auth/token/refresh')
        .send({
          refreshToken: mockTokens.validToken.refreshToken
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.accessToken).not.toBe(mockTokens.validToken.accessToken);
    });

    it('should handle token rotation security', async () => {
      // Use refresh token
      const firstRefresh = await app
        .post('/api/auth/token/refresh')
        .send({
          refreshToken: mockTokens.validToken.refreshToken
        });

      // Attempt to reuse the same refresh token
      const secondRefresh = await app
        .post('/api/auth/token/refresh')
        .send({
          refreshToken: mockTokens.validToken.refreshToken
        });

      expect(secondRefresh.status).toBe(401);
      expect(secondRefresh.body.error).toMatch(/token reuse detected/i);
    });
  });

  describe('OAuth Integration', () => {
    it('should handle Google OAuth authentication', async () => {
      const response = await app
        .post('/api/auth/oauth/google')
        .send({
          code: 'mock-google-auth-code',
          redirectUri: 'http://localhost:3000/oauth/callback'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.provider).toBe(AuthProvider.GOOGLE);
    });

    it('should handle LinkedIn OAuth authentication', async () => {
      const response = await app
        .post('/api/auth/oauth/linkedin')
        .send({
          code: 'mock-linkedin-auth-code',
          redirectUri: 'http://localhost:3000/oauth/callback'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.provider).toBe(AuthProvider.LINKEDIN);
    });
  });

  describe('Security Features', () => {
    it('should validate security headers', async () => {
      const response = await app.get('/api/auth/profile')
        .set('Authorization', `Bearer ${mockTokens.validToken.accessToken}`);

      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('should implement CSRF protection', async () => {
      const response = await app
        .post('/api/auth/login')
        .send({
          email: mockUsers.adminUser.email,
          password: 'StrongP@ssw0rd123'
        })
        .set('x-csrf-token', 'invalid-token');

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/invalid csrf token/i);
    });

    it('should log security audit events', async () => {
      await app
        .post('/api/auth/login')
        .send({
          email: mockUsers.adminUser.email,
          password: 'WrongPassword'
        });

      const auditLogs = await testEnv.dbPool.query(
        'SELECT * FROM security_audit_logs WHERE user_email = $1',
        [mockUsers.adminUser.email]
      );

      expect(auditLogs.rows).toHaveLength(1);
      expect(auditLogs.rows[0].event_type).toBe('FAILED_LOGIN_ATTEMPT');
    });
  });
});