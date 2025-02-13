import { Request, Response } from 'express';
import { Controller, Post, Body } from 'routing-controllers';
import { RateLimit } from 'routing-controllers-extended';
import { AuthService } from '../services/auth.service';
import { IUser, IAuthToken, AuthProvider } from '../../../shared/types/auth.types';
import { ERROR_MESSAGES, AUTH_CONFIG, API_RATE_LIMITS } from '../../../shared/constants';

/**
 * Enhanced authentication controller implementing comprehensive security features
 * Provides secure endpoints for user registration, authentication, and MFA management
 * @version 1.0.0
 */
@Controller('/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * User registration with enhanced security features and MFA setup
   * @param userData Registration data including email, password, and optional MFA preferences
   * @returns Authentication tokens and MFA setup data if enabled
   */
  @Post('/register')
  @RateLimit({
    windowMs: API_RATE_LIMITS.RATE_LIMIT_WINDOW,
    max: API_RATE_LIMITS.PER_IP_LIMIT,
    message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED
  })
  async register(@Body() userData: IUser): Promise<IAuthToken> {
    try {
      return await this.authService.register(userData);
    } catch (error) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  /**
   * Enhanced login endpoint with MFA validation and OAuth support
   * @param credentials Login credentials including email, password, MFA token, and optional OAuth provider
   * @returns Authentication tokens with MFA status
   */
  @Post('/login')
  @RateLimit({
    windowMs: API_RATE_LIMITS.RATE_LIMIT_WINDOW,
    max: API_RATE_LIMITS.PER_IP_LIMIT,
    message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED
  })
  async login(
    @Body() credentials: {
      email: string;
      password: string;
      mfaToken?: string;
      provider?: AuthProvider;
      oauthToken?: string;
    }
  ): Promise<IAuthToken> {
    try {
      if (credentials.provider) {
        // Handle OAuth authentication
        return await this.authService.validateOAuthToken(
          credentials.provider,
          credentials.oauthToken!
        );
      }

      return await this.authService.login(
        credentials.email,
        credentials.password,
        credentials.mfaToken
      );
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Secure token refresh with rotation and blacklist validation
   * @param refreshToken Current refresh token
   * @returns New token pair
   */
  @Post('/refresh')
  @RateLimit({
    windowMs: API_RATE_LIMITS.RATE_LIMIT_WINDOW,
    max: API_RATE_LIMITS.MAX_REQUESTS_PER_MINUTE,
    message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED
  })
  async refreshToken(
    @Body() { refreshToken }: { refreshToken: string }
  ): Promise<IAuthToken> {
    try {
      return await this.authService.refreshToken(refreshToken);
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * MFA setup endpoint for enabling two-factor authentication
   * @param userId User ID for MFA setup
   * @returns MFA setup details including secret and QR code
   */
  @Post('/mfa/setup')
  @RateLimit({
    windowMs: API_RATE_LIMITS.RATE_LIMIT_WINDOW,
    max: API_RATE_LIMITS.PER_USER_LIMIT,
    message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED
  })
  async setupMFA(
    @Body() { userId }: { userId: string }
  ): Promise<{ secret: string; qrCode: string }> {
    try {
      return await this.authService.setupMFA(userId);
    } catch (error) {
      throw new Error(`MFA setup failed: ${error.message}`);
    }
  }

  /**
   * MFA validation endpoint for completing two-factor setup
   * @param userId User ID for validation
   * @param token MFA token for verification
   * @returns Validation status
   */
  @Post('/mfa/validate')
  @RateLimit({
    windowMs: API_RATE_LIMITS.RATE_LIMIT_WINDOW,
    max: API_RATE_LIMITS.PER_USER_LIMIT,
    message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED
  })
  async validateMFA(
    @Body() { userId, token }: { userId: string; token: string }
  ): Promise<{ success: boolean }> {
    try {
      const isValid = await this.authService.validateMFA(userId, token);
      return { success: isValid };
    } catch (error) {
      throw new Error(`MFA validation failed: ${error.message}`);
    }
  }

  /**
   * OAuth callback handler for processing provider responses
   * @param provider OAuth provider type
   * @param code Authorization code from provider
   * @returns Authentication tokens
   */
  @Post('/oauth/callback')
  @RateLimit({
    windowMs: API_RATE_LIMITS.RATE_LIMIT_WINDOW,
    max: API_RATE_LIMITS.PER_IP_LIMIT,
    message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED
  })
  async oauthCallback(
    @Body() { provider, code }: { provider: AuthProvider; code: string }
  ): Promise<IAuthToken> {
    try {
      return await this.authService.handleOAuthCallback(provider, code);
    } catch (error) {
      throw new Error(`OAuth callback failed: ${error.message}`);
    }
  }
}