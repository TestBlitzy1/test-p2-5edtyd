import { describe, it, expect, beforeEach } from 'jest';
import { 
  User,
  IUser,
  UserRole,
  AuthProvider
} from '../../../backend/auth-service/src/models/user.model';
import { createTestUser } from '../../fixtures/user.fixture';
import { AUTH_CONFIG } from '../../../backend/shared/constants';

describe('User Model', () => {
  let testUser: User;
  let testUserData: IUser;

  beforeEach(() => {
    // Reset test state with fresh user instance
    testUserData = createTestUser(UserRole.USER, AuthProvider.LOCAL);
    testUser = new User(testUserData);
  });

  describe('Constructor', () => {
    it('should create a valid user instance with default values', () => {
      expect(testUser).toBeInstanceOf(User);
      expect(testUser.id).toBeDefined();
      expect(testUser.email).toBe(testUserData.email);
      expect(testUser.role).toBe(UserRole.USER);
      expect(testUser.provider).toBe(AuthProvider.LOCAL);
      expect(testUser.failedLoginAttempts).toBe(0);
      expect(testUser.isLocked).toBe(false);
    });

    it('should initialize security fields correctly', () => {
      expect(testUser.failedLoginAttempts).toBe(0);
      expect(testUser.isLocked).toBe(false);
      expect(testUser.lastLoginAt).toBeInstanceOf(Date);
      expect(testUser.createdAt).toBeInstanceOf(Date);
      expect(testUser.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle OAuth provider initialization', () => {
      const oauthUser = new User({
        ...testUserData,
        provider: AuthProvider.GOOGLE,
        password: null,
        providerUserId: 'google123'
      });

      expect(oauthUser.provider).toBe(AuthProvider.GOOGLE);
      expect(oauthUser.password).toBeNull();
      expect(oauthUser.providerUserId).toBe('google123');
    });
  });

  describe('Data Validation', () => {
    it('should validate a valid user object', async () => {
      const isValid = await testUser.validateUser();
      expect(isValid).toBe(true);
    });

    it('should reject invalid email formats', async () => {
      testUser.email = 'invalid-email';
      const isValid = await testUser.validateUser();
      expect(isValid).toBe(false);
    });

    it('should require password for local authentication', async () => {
      testUser.password = null;
      const isValid = await testUser.validateUser();
      expect(isValid).toBe(false);
    });

    it('should require providerUserId for OAuth users', async () => {
      testUser.provider = AuthProvider.GOOGLE;
      testUser.providerUserId = null;
      const isValid = await testUser.validateUser();
      expect(isValid).toBe(false);
    });
  });

  describe('Security Features', () => {
    it('should track failed login attempts', async () => {
      await testUser.incrementFailedLogin();
      expect(testUser.failedLoginAttempts).toBe(1);
    });

    it('should lock account after max failed attempts', async () => {
      for (let i = 0; i < AUTH_CONFIG.MAX_LOGIN_ATTEMPTS; i++) {
        await testUser.incrementFailedLogin();
      }
      expect(testUser.isLocked).toBe(true);
    });

    it('should handle account unlocking after lockout duration', async () => {
      // Set up locked account
      for (let i = 0; i < AUTH_CONFIG.MAX_LOGIN_ATTEMPTS; i++) {
        await testUser.incrementFailedLogin();
      }
      
      // Fast-forward past lockout duration
      jest.advanceTimersByTime(AUTH_CONFIG.LOGIN_LOCKOUT_DURATION + 1000);
      
      expect(testUser.isLocked).toBe(false);
      expect(testUser.failedLoginAttempts).toBe(0);
    });

    it('should exclude sensitive data in JSON representation', () => {
      const userJson = testUser.toJSON();
      expect(userJson.password).toBeUndefined();
      expect(userJson.failedLoginAttempts).toBeUndefined();
    });
  });

  describe('Role-Based Access', () => {
    it('should initialize with correct role hierarchy', () => {
      const adminUser = new User({ ...testUserData, role: UserRole.ADMIN });
      const managerUser = new User({ ...testUserData, role: UserRole.MANAGER });
      const userUser = new User({ ...testUserData, role: UserRole.USER });

      expect(adminUser.role).toBe(UserRole.ADMIN);
      expect(managerUser.role).toBe(UserRole.MANAGER);
      expect(userUser.role).toBe(UserRole.USER);
    });

    it('should default to USER role when not specified', () => {
      const defaultUser = new User({
        ...testUserData,
        role: undefined
      });
      expect(defaultUser.role).toBe(UserRole.USER);
    });

    it('should validate role assignments', async () => {
      testUser.role = 'INVALID_ROLE' as UserRole;
      const isValid = await testUser.validateUser();
      expect(isValid).toBe(false);
    });
  });

  describe('Authentication Providers', () => {
    it('should handle local authentication configuration', () => {
      const localUser = new User({
        ...testUserData,
        provider: AuthProvider.LOCAL,
        password: 'SecurePass123!'
      });
      expect(localUser.provider).toBe(AuthProvider.LOCAL);
      expect(localUser.password).toBeDefined();
      expect(localUser.providerUserId).toBeNull();
    });

    it('should handle Google OAuth configuration', () => {
      const googleUser = new User({
        ...testUserData,
        provider: AuthProvider.GOOGLE,
        password: null,
        providerUserId: 'google123'
      });
      expect(googleUser.provider).toBe(AuthProvider.GOOGLE);
      expect(googleUser.password).toBeNull();
      expect(googleUser.providerUserId).toBe('google123');
    });

    it('should handle LinkedIn OAuth configuration', () => {
      const linkedInUser = new User({
        ...testUserData,
        provider: AuthProvider.LINKEDIN,
        password: null,
        providerUserId: 'linkedin123'
      });
      expect(linkedInUser.provider).toBe(AuthProvider.LINKEDIN);
      expect(linkedInUser.password).toBeNull();
      expect(linkedInUser.providerUserId).toBe('linkedin123');
    });
  });

  describe('Audit Trail', () => {
    it('should track creation and update timestamps', () => {
      expect(testUser.createdAt).toBeInstanceOf(Date);
      expect(testUser.updatedAt).toBeInstanceOf(Date);
    });

    it('should update timestamps on security events', async () => {
      const originalUpdate = testUser.updatedAt;
      await testUser.incrementFailedLogin();
      expect(testUser.updatedAt.getTime()).toBeGreaterThan(originalUpdate.getTime());
    });

    it('should track last login timestamp', () => {
      const loginDate = new Date();
      testUser.lastLoginAt = loginDate;
      expect(testUser.lastLoginAt).toEqual(loginDate);
    });
  });
});