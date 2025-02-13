import { Container } from 'typedi';
import { Redis } from 'ioredis';
import { SecurityLogger } from '@company/security-logger';
import { RateLimiter } from '@company/rate-limiter';
import { AuthService } from '../../../backend/auth-service/src/services/auth.service';
import { setupTestEnvironment, cleanDatabase } from '../../utils/test.helpers';
import { mockUsers } from '../../mocks/auth.mock';
import { UserRole, AuthProvider } from '../../../backend/shared/types/auth.types';
import { AUTH_CONFIG, ERROR_MESSAGES } from '../../../backend/shared/constants';

describe('AuthService Integration Tests', () => {
  let authService: AuthService;
  let redis: Redis;
  let securityLogger: SecurityLogger;
  let rateLimiter: RateLimiter;

  beforeAll(async () => {
    // Initialize test environment
    const testEnv = await setupTestEnvironment({
      dbConfig: {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        user: 'test_user',
        password: 'test_password'
      },
      mockServerPort: 3001
    });

    // Initialize dependencies
    redis = new Redis();
    securityLogger = Container.get(SecurityLogger);
    rateLimiter = Container.get(RateLimiter);

    // Initialize AuthService with dependencies
    authService = Container.get(AuthService);

    // Configure OAuth provider mocks
    Container.set('OAUTH_PROVIDERS', {
      google: {
        clientId: 'mock-google-client-id',
        clientSecret: 'mock-google-client-secret'
      },
      linkedin: {
        clientId: 'mock-linkedin-client-id',
        clientSecret: 'mock-linkedin-client-secret'
      }
    });
  });

  afterEach(async () => {
    await cleanDatabase(Container.get('DB_CONNECTION'));
    await redis.flushall();
    Container.reset();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await redis.quit();
    await Container.get('DB_CONNECTION').destroy();
  });

  describe('User Registration', () => {
    it('should successfully register a new user with MFA setup', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecureP@ssw0rd123',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.USER
      };

      const result = await authService.register(userData);

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.mfaRequired).toBe(AUTH_CONFIG.REQUIRE_MFA);
      expect(result.mfaSecret).toBeDefined();

      // Verify user creation in database
      const user = await Container.get('UserRepository').findOne({
        where: { email: userData.email }
      });
      expect(user).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe(UserRole.USER);

      // Verify security event logging
      expect(securityLogger.log).toHaveBeenCalledWith({
        event: 'USER_REGISTERED',
        userId: user.id,
        metadata: {
          provider: AuthProvider.LOCAL,
          mfaEnabled: AUTH_CONFIG.REQUIRE_MFA
        }
      });
    });

    it('should reject registration with invalid password format', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'weak',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.USER
      };

      await expect(authService.register(userData))
        .rejects
        .toThrow(ERROR_MESSAGES.VALIDATION_ERROR);
    });

    it('should prevent duplicate email registration', async () => {
      const userData = {
        email: mockUsers.adminUser.email,
        password: 'SecureP@ssw0rd123',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.USER
      };

      await expect(authService.register(userData))
        .rejects
        .toThrow('User already exists');
    });
  });

  describe('User Authentication', () => {
    it('should successfully authenticate user with MFA', async () => {
      const { email, password } = mockUsers.adminUser;
      
      // First login attempt should require MFA
      const initialLogin = await authService.login(email, password);
      expect(initialLogin.mfaRequired).toBe(true);

      // Validate MFA token
      const mfaToken = '123456'; // Mock MFA token
      const loginResult = await authService.login(email, password, mfaToken);

      expect(loginResult.accessToken).toBeDefined();
      expect(loginResult.refreshToken).toBeDefined();
      expect(loginResult.tokenType).toBe('Bearer');

      // Verify security logging
      expect(securityLogger.log).toHaveBeenCalledWith({
        event: 'USER_LOGIN',
        userId: mockUsers.adminUser.id,
        metadata: {
          provider: AuthProvider.LOCAL,
          mfaUsed: true
        }
      });
    });

    it('should enforce rate limiting on login attempts', async () => {
      const { email, password } = mockUsers.adminUser;

      // Simulate multiple failed login attempts
      for (let i = 0; i < AUTH_CONFIG.MAX_LOGIN_ATTEMPTS; i++) {
        await expect(authService.login(email, 'wrong_password'))
          .rejects
          .toThrow(ERROR_MESSAGES.INVALID_CREDENTIALS);
      }

      // Next attempt should be rate limited
      await expect(authService.login(email, password))
        .rejects
        .toThrow(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
    });

    it('should handle OAuth authentication callback', async () => {
      const mockOAuthData = {
        provider: AuthProvider.GOOGLE,
        providerId: 'google-123',
        email: 'oauth@example.com',
        firstName: 'OAuth',
        lastName: 'User'
      };

      const result = await authService.handleOAuthCallback(
        AuthProvider.GOOGLE,
        mockOAuthData
      );

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.mfaRequired).toBe(false);

      // Verify OAuth user creation
      const user = await Container.get('UserRepository').findOne({
        where: {
          email: mockOAuthData.email,
          provider: AuthProvider.GOOGLE
        }
      });
      expect(user).toBeDefined();
      expect(user.providerId).toBe(mockOAuthData.providerId);
    });
  });

  describe('Token Management', () => {
    it('should successfully refresh authentication tokens', async () => {
      // First get valid tokens
      const { email, password } = mockUsers.adminUser;
      const { refreshToken } = await authService.login(email, password, '123456');

      // Refresh tokens
      const newTokens = await authService.refreshToken(refreshToken);

      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      expect(newTokens.refreshToken).not.toBe(refreshToken);

      // Verify old refresh token is invalidated
      await expect(authService.refreshToken(refreshToken))
        .rejects
        .toThrow(ERROR_MESSAGES.INVALID_TOKEN);
    });

    it('should handle token rotation security', async () => {
      const { email, password } = mockUsers.adminUser;
      const { refreshToken: oldToken } = await authService.login(email, password, '123456');

      // Refresh token
      await authService.refreshToken(oldToken);

      // Verify token reuse prevention
      await expect(authService.refreshToken(oldToken))
        .rejects
        .toThrow(ERROR_MESSAGES.INVALID_TOKEN);

      // Verify security logging
      expect(securityLogger.log).toHaveBeenCalledWith({
        event: 'TOKEN_ROTATION',
        userId: mockUsers.adminUser.id,
        metadata: {
          tokenType: 'refresh_token'
        }
      });
    });
  });

  describe('MFA Management', () => {
    it('should successfully setup and validate MFA', async () => {
      // Setup MFA
      const mfaSetup = await authService.setupMFA(mockUsers.adminUser.id);
      expect(mfaSetup.secret).toBeDefined();
      expect(mfaSetup.qrCode).toBeDefined();

      // Validate MFA token
      const isValid = await authService.validateMFA(
        mockUsers.adminUser.id,
        '123456' // Mock valid MFA token
      );
      expect(isValid).toBe(true);

      // Verify MFA is enabled
      const user = await Container.get('UserRepository').findOne({
        where: { id: mockUsers.adminUser.id }
      });
      expect(user.mfaEnabled).toBe(true);
    });

    it('should reject invalid MFA tokens', async () => {
      await authService.setupMFA(mockUsers.adminUser.id);

      const isValid = await authService.validateMFA(
        mockUsers.adminUser.id,
        'invalid_token'
      );
      expect(isValid).toBe(false);
    });
  });
});