import { describe, it, beforeEach, expect } from 'jest';
import { User, UserRole, AuthProvider } from '../../../backend/auth-service/src/models/user.model';
import { cleanDatabase, createTestUser } from '../../utils/test.helpers';
import { AUTH_CONFIG } from '../../../backend/shared/constants';

// Set test timeout to 30 seconds for database operations
jest.setTimeout(30000);

describe('User Database Integration Tests', () => {
  // Clean database before each test
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('User Creation', () => {
    it('should successfully create a user with valid data', async () => {
      // Create test user with complete data
      const userData = {
        email: 'test@example.com',
        password: 'Test@Password123!',
        role: UserRole.USER,
        provider: AuthProvider.LOCAL,
        failedLoginAttempts: 0,
        isLocked: false,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const user = new User(userData);
      await user.validateUser();

      expect(user.id).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe(UserRole.USER);
      expect(user.provider).toBe(AuthProvider.LOCAL);
      expect(user.password).not.toBe(userData.password); // Password should be hashed
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.isLocked).toBe(false);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should enforce unique email constraint', async () => {
      const email = 'duplicate@example.com';
      
      // Create first user
      const user1 = new User({
        email,
        password: 'Test@Password123!',
        role: UserRole.USER,
        provider: AuthProvider.LOCAL
      });
      await user1.validateUser();

      // Attempt to create second user with same email
      const user2 = new User({
        email,
        password: 'Different@Password123!',
        role: UserRole.USER,
        provider: AuthProvider.LOCAL
      });

      await expect(user2.validateUser()).rejects.toThrow();
    });

    it('should validate password complexity requirements', async () => {
      const invalidPasswords = [
        'short', // Too short
        'nouppercase123!', // No uppercase
        'NOLOWERCASE123!', // No lowercase
        'NoSpecialChar123', // No special character
        'No@Numbers!', // No numbers
      ];

      for (const password of invalidPasswords) {
        const user = new User({
          email: 'test@example.com',
          password,
          role: UserRole.USER,
          provider: AuthProvider.LOCAL
        });

        await expect(user.validateUser()).rejects.toThrow();
      }
    });
  });

  describe('User Data Validation', () => {
    it('should validate email format', async () => {
      const invalidEmails = [
        'invalid',
        'invalid@',
        '@invalid.com',
        'invalid@.com',
        'invalid@com.',
        'invalid@.com.'
      ];

      for (const email of invalidEmails) {
        const user = new User({
          email,
          password: 'Valid@Password123!',
          role: UserRole.USER,
          provider: AuthProvider.LOCAL
        });

        await expect(user.validateUser()).rejects.toThrow();
      }
    });

    it('should validate role assignment rules', async () => {
      const user = new User({
        email: 'test@example.com',
        password: 'Valid@Password123!',
        role: 'INVALID_ROLE' as UserRole,
        provider: AuthProvider.LOCAL
      });

      await expect(user.validateUser()).rejects.toThrow();
    });

    it('should validate provider-specific requirements', async () => {
      // Local provider requires password
      const localUser = new User({
        email: 'test@example.com',
        role: UserRole.USER,
        provider: AuthProvider.LOCAL
        // Missing password
      });

      await expect(localUser.validateUser()).rejects.toThrow();

      // OAuth provider requires providerId
      const oauthUser = new User({
        email: 'test@example.com',
        role: UserRole.USER,
        provider: AuthProvider.GOOGLE
        // Missing providerId
      });

      await expect(oauthUser.validateUser()).rejects.toThrow();
    });
  });

  describe('User Updates', () => {
    it('should successfully update user properties', async () => {
      const user = await createTestUser();
      const newEmail = 'updated@example.com';

      user.email = newEmail;
      user.updatedAt = new Date();
      await user.validateUser();

      expect(user.email).toBe(newEmail);
      expect(user.updatedAt).toBeInstanceOf(Date);
      expect(user.updatedAt).not.toEqual(user.createdAt);
    });

    it('should handle failed login attempts correctly', async () => {
      const user = await createTestUser();

      // Simulate multiple failed login attempts
      for (let i = 0; i < AUTH_CONFIG.MAX_LOGIN_ATTEMPTS; i++) {
        await user.incrementFailedLogin();
      }

      expect(user.failedLoginAttempts).toBe(AUTH_CONFIG.MAX_LOGIN_ATTEMPTS);
      expect(user.isLocked).toBe(true);
    });

    it('should prevent updates to locked accounts', async () => {
      const user = await createTestUser();
      user.isLocked = true;
      await user.validateUser();

      user.email = 'new@example.com';
      await expect(user.validateUser()).rejects.toThrow();
    });
  });

  describe('User Deletion', () => {
    it('should handle soft deletion', async () => {
      const user = await createTestUser();
      
      // Simulate soft delete
      user.isLocked = true;
      user.updatedAt = new Date();
      await user.validateUser();

      expect(user.isLocked).toBe(true);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should prevent authentication after deletion', async () => {
      const user = await createTestUser();
      
      // Simulate deletion
      user.isLocked = true;
      await user.validateUser();

      // Attempt to update after deletion
      user.email = 'new@example.com';
      await expect(user.validateUser()).rejects.toThrow();
    });
  });

  describe('Security Features', () => {
    it('should track password changes', async () => {
      const user = await createTestUser();
      const originalPasswordChangedAt = user.passwordChangedAt;

      user.password = 'NewValid@Password123!';
      user.passwordChangedAt = new Date();
      await user.validateUser();

      expect(user.passwordChangedAt).not.toEqual(originalPasswordChangedAt);
    });

    it('should enforce login attempt limits', async () => {
      const user = await createTestUser();

      // Simulate failed login attempts
      for (let i = 0; i <= AUTH_CONFIG.MAX_LOGIN_ATTEMPTS; i++) {
        await user.incrementFailedLogin();
      }

      expect(user.isLocked).toBe(true);
      expect(user.failedLoginAttempts).toBeGreaterThan(AUTH_CONFIG.MAX_LOGIN_ATTEMPTS);
    });

    it('should validate authentication provider settings', async () => {
      const user = new User({
        email: 'test@example.com',
        password: 'Valid@Password123!',
        role: UserRole.USER,
        provider: AuthProvider.LOCAL
      });

      // Attempt to change provider without required fields
      user.provider = AuthProvider.GOOGLE;
      await expect(user.validateUser()).rejects.toThrow();
    });
  });
});