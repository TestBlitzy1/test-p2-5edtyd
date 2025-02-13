import { jest } from '@jest/globals';
import supertest from 'supertest';
import { ZAProxyAPI } from 'zaproxy';
import { setupTestEnvironment, cleanDatabase } from '../../utils/test.helpers';
import { mockAuthService, getMockUser } from '../../mocks/auth.mock';
import { AuthService } from '../../../backend/auth-service/src/services/auth.service';
import { UserRole, AuthProvider } from '../../../backend/shared/types/auth.types';
import { AUTH_CONFIG, API_RATE_LIMITS, ERROR_MESSAGES } from '../../../backend/shared/constants';

describe('Authentication System Penetration Tests', () => {
  let testEnv: any;
  let authService: AuthService;
  let zap: ZAProxyAPI;

  beforeAll(async () => {
    // Initialize test environment with security configurations
    testEnv = await setupTestEnvironment({
      dbConfig: {
        host: 'localhost',
        port: 5432,
        database: 'test_auth_db',
        user: 'test_user',
        password: 'test_password'
      },
      mockServerPort: 3001,
      simulatedLatency: 100
    });

    // Initialize OWASP ZAP
    zap = new ZAProxyAPI({
      apiKey: process.env.ZAP_API_KEY,
      proxy: 'http://localhost:8080'
    });

    authService = mockAuthService();
  });

  afterAll(async () => {
    await cleanDatabase(testEnv.dbPool);
    await testEnv.cleanup();
  });

  describe('Brute Force Protection Tests', () => {
    it('should enforce rate limiting on login attempts', async () => {
      const maxAttempts = AUTH_CONFIG.MAX_LOGIN_ATTEMPTS;
      const testUser = getMockUser(UserRole.USER);

      // Attempt rapid successive login requests
      for (let i = 0; i < maxAttempts + 1; i++) {
        const response = await supertest(testEnv.mockServer.getApp())
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'invalid_password'
          });

        if (i < maxAttempts) {
          expect(response.status).toBe(401);
          expect(response.body.message).toBe(ERROR_MESSAGES.INVALID_CREDENTIALS);
        } else {
          expect(response.status).toBe(429);
          expect(response.body.message).toBe(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
        }
      }

      // Verify account lockout
      const lockedUser = await authService.login(testUser.email, 'correct_password');
      expect(lockedUser).toThrow(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
    });

    it('should implement IP-based rate limiting', async () => {
      const ipLimit = API_RATE_LIMITS.PER_IP_LIMIT;
      const requests = Array(ipLimit + 1).fill(null);

      const responses = await Promise.all(
        requests.map(() =>
          supertest(testEnv.mockServer.getApp())
            .post('/api/auth/login')
            .set('X-Forwarded-For', '192.168.1.1')
            .send({
              email: 'test@example.com',
              password: 'password123'
            })
        )
      );

      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.status).toBe(429);
      expect(lastResponse.headers['retry-after']).toBeDefined();
    });
  });

  describe('Password Security Tests', () => {
    it('should enforce password complexity requirements', async () => {
      const weakPasswords = [
        'short',
        'nouppercaseornumbers',
        'NoSpecialChars123',
        'no_numbers_here',
        'Common_password_123'
      ];

      for (const password of weakPasswords) {
        const response = await supertest(testEnv.mockServer.getApp())
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password,
            firstName: 'Test',
            lastName: 'User'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Password must contain');
      }
    });

    it('should prevent password reuse', async () => {
      const testUser = getMockUser(UserRole.USER);
      const oldPassword = 'Old_Password_123!';
      const newPassword = 'New_Password_123!';

      // Change password multiple times
      await authService.login(testUser.email, oldPassword);
      await supertest(testEnv.mockServer.getApp())
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${testUser.token}`)
        .send({
          currentPassword: oldPassword,
          newPassword
        });

      // Attempt to reuse old password
      const response = await supertest(testEnv.mockServer.getApp())
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${testUser.token}`)
        .send({
          currentPassword: newPassword,
          newPassword: oldPassword
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Password previously used');
    });
  });

  describe('Token Security Tests', () => {
    it('should validate JWT token structure and claims', async () => {
      const testUser = getMockUser(UserRole.USER);
      const response = await authService.login(testUser.email, 'valid_password');

      expect(response.token).toMatch(/^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/);
      
      // Verify token claims
      const [header, payload] = response.token.split('.');
      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());

      expect(decodedPayload).toHaveProperty('userId');
      expect(decodedPayload).toHaveProperty('role');
      expect(decodedPayload).toHaveProperty('exp');
      expect(decodedPayload.exp).toBeGreaterThan(Date.now() / 1000);
    });

    it('should handle token rotation securely', async () => {
      const testUser = getMockUser(UserRole.USER);
      const initialResponse = await authService.login(testUser.email, 'valid_password');
      const initialToken = initialResponse.token;

      // Use refresh token to get new access token
      const refreshResponse = await supertest(testEnv.mockServer.getApp())
        .post('/api/auth/refresh')
        .send({ refreshToken: initialResponse.refreshToken });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.token).not.toBe(initialToken);

      // Verify old token is invalidated
      const oldTokenResponse = await supertest(testEnv.mockServer.getApp())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${initialToken}`);

      expect(oldTokenResponse.status).toBe(401);
    });
  });

  describe('OAuth Security Tests', () => {
    it('should validate OAuth state parameter', async () => {
      const response = await supertest(testEnv.mockServer.getApp())
        .get('/api/auth/oauth/google')
        .query({ state: 'invalid_state' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid state parameter');
    });

    it('should prevent CSRF attacks in OAuth flow', async () => {
      const csrfToken = 'valid_csrf_token';
      
      // Initialize OAuth flow with CSRF token
      const initResponse = await supertest(testEnv.mockServer.getApp())
        .post('/api/auth/oauth/init')
        .send({ provider: AuthProvider.GOOGLE });

      expect(initResponse.status).toBe(200);
      expect(initResponse.body.csrf_token).toBeDefined();

      // Attempt callback with invalid CSRF token
      const callbackResponse = await supertest(testEnv.mockServer.getApp())
        .get('/api/auth/oauth/callback')
        .query({
          code: 'valid_code',
          state: 'invalid_csrf_token'
        });

      expect(callbackResponse.status).toBe(400);
      expect(callbackResponse.body.message).toContain('CSRF token mismatch');
    });
  });

  describe('Session Management Tests', () => {
    it('should enforce session timeout', async () => {
      const testUser = getMockUser(UserRole.USER);
      const loginResponse = await authService.login(testUser.email, 'valid_password');

      // Fast-forward time beyond session timeout
      jest.advanceTimersByTime(AUTH_CONFIG.SESSION_TIMEOUT + 1000);

      const response = await supertest(testEnv.mockServer.getApp())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${loginResponse.token}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Session expired');
    });

    it('should prevent session fixation', async () => {
      const testUser = getMockUser(UserRole.USER);
      
      // Initial login
      const initialSession = await authService.login(testUser.email, 'valid_password');
      
      // Re-authentication should generate new session identifier
      const newSession = await authService.login(testUser.email, 'valid_password');
      
      expect(newSession.token).not.toBe(initialSession.token);
      expect(newSession.refreshToken).not.toBe(initialSession.refreshToken);
    });
  });
});