import { Service, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { authenticator } from 'otplib';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

import { User } from '../models/user.model';
import { IUser, IAuthToken, UserRole, AuthProvider } from '../../../shared/types/auth.types';
import { AUTH_CONFIG, ERROR_MESSAGES } from '../../../shared/constants';
import { validateUserSchema } from '../../../shared/schemas/user.schema';

/**
 * Enhanced authentication service with comprehensive security features
 * Implements secure user authentication, MFA, token rotation, and monitoring
 */
@Service()
@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: Repository<User>,
    private readonly rateLimiter: RateLimiterRedis,
    private readonly tokenRotationService: TokenRotationService,
    private readonly mfaService: MFAService,
    private readonly securityLogger: SecurityLogger
  ) {}

  /**
   * Register new user with enhanced security features
   * @param userData User registration data
   * @returns Authentication tokens and MFA setup status
   */
  async register(userData: IUser): Promise<IAuthToken> {
    try {
      // Validate user data against schema
      const isValid = await validateUserSchema(userData);
      if (!isValid) {
        throw new Error(ERROR_MESSAGES.VALIDATION_ERROR);
      }

      // Check for existing user
      const existingUser = await this.userRepository.findOne({
        where: { email: userData.email }
      });
      if (existingUser) {
        throw new Error('User already exists');
      }

      // Generate MFA secret if enabled
      const mfaSecret = AUTH_CONFIG.REQUIRE_MFA ? 
        authenticator.generateSecret() : null;

      // Hash password with enhanced security
      const hashedPassword = await bcrypt.hash(
        userData.password,
        AUTH_CONFIG.PASSWORD_SALT_ROUNDS
      );

      // Create user with security features
      const user = new User({
        ...userData,
        password: hashedPassword,
        provider: AuthProvider.LOCAL,
        role: UserRole.USER,
        mfaSecret,
        mfaEnabled: AUTH_CONFIG.REQUIRE_MFA,
        failedLoginAttempts: 0,
        lastLoginAttempt: new Date()
      });

      await this.userRepository.save(user);

      // Generate secure tokens
      const tokens = await this.tokenRotationService.generateTokenPair(user);

      // Log security event
      await this.securityLogger.log({
        event: 'USER_REGISTERED',
        userId: user.id,
        metadata: {
          provider: AuthProvider.LOCAL,
          mfaEnabled: AUTH_CONFIG.REQUIRE_MFA
        }
      });

      return {
        ...tokens,
        mfaRequired: AUTH_CONFIG.REQUIRE_MFA,
        mfaSecret: mfaSecret
      };
    } catch (error) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  /**
   * Authenticate user with enhanced security checks
   * @param email User email
   * @param password User password
   * @param mfaToken MFA token if enabled
   * @returns Authenticated tokens
   */
  async login(
    email: string,
    password: string,
    mfaToken?: string
  ): Promise<IAuthToken> {
    try {
      // Check rate limiting
      await this.rateLimiter.consume(email);

      // Find and validate user
      const user = await this.userRepository.findOne({
        where: { email, provider: AuthProvider.LOCAL }
      });

      if (!user) {
        throw new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
      }

      // Check account lockout
      if (user.isLocked) {
        throw new Error('Account is locked. Please try again later');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        await user.incrementFailedLogin();
        await this.userRepository.save(user);
        throw new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
      }

      // Validate MFA if enabled
      if (user.mfaEnabled) {
        if (!mfaToken) {
          throw new Error('MFA token required');
        }
        const isMfaValid = await this.mfaService.validateToken(
          user.mfaSecret,
          mfaToken
        );
        if (!isMfaValid) {
          throw new Error('Invalid MFA token');
        }
      }

      // Reset failed login attempts
      user.failedLoginAttempts = 0;
      user.lastLoginAttempt = new Date();
      await this.userRepository.save(user);

      // Generate rotated tokens
      const tokens = await this.tokenRotationService.generateTokenPair(user);

      // Log security event
      await this.securityLogger.log({
        event: 'USER_LOGIN',
        userId: user.id,
        metadata: {
          provider: AuthProvider.LOCAL,
          mfaUsed: user.mfaEnabled
        }
      });

      return tokens;
    } catch (error) {
      if (error.name === 'RateLimiterError') {
        throw new Error(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
      }
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Set up MFA for user account
   * @param userId User ID
   * @returns MFA setup details
   */
  async setupMFA(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const secret = authenticator.generateSecret();
    const qrCode = await this.mfaService.generateQRCode(user.email, secret);

    user.mfaSecret = secret;
    user.mfaEnabled = false; // Requires validation before enabling
    await this.userRepository.save(user);

    return { secret, qrCode };
  }

  /**
   * Validate and enable MFA for user account
   * @param userId User ID
   * @param token MFA token for validation
   * @returns Success status
   */
  async validateMFA(userId: string, token: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.mfaSecret) {
      throw new Error('Invalid MFA setup');
    }

    const isValid = await this.mfaService.validateToken(user.mfaSecret, token);
    if (isValid) {
      user.mfaEnabled = true;
      await this.userRepository.save(user);
      
      await this.securityLogger.log({
        event: 'MFA_ENABLED',
        userId: user.id
      });
    }

    return isValid;
  }
}