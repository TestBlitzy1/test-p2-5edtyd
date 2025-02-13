/**
 * @fileoverview Authentication service configuration module
 * Manages environment variables, security settings, and service configurations
 * with comprehensive validation and type safety.
 * @version 1.0.0
 */

import dotenv from 'dotenv'; // ^16.0.0
import { AUTH_CONFIG } from '../../../shared/constants';
import { AuthProvider } from '../../../shared/types/auth.types';

/**
 * Custom error class for configuration validation failures
 */
class ConfigurationError extends Error {
  constructor(message: string) {
    super(`Configuration Error: ${message}`);
    this.name = 'ConfigurationError';
  }
}

/**
 * Database configuration interface
 */
interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
  idleTimeout: number;
}

/**
 * JWT configuration interface
 */
interface JWTConfig {
  secret: string;
  expiry: string;
  refreshExpiry: string;
  tokenType: string;
  algorithm: string;
  issuer: string;
}

/**
 * OAuth provider configuration interface
 */
interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  scopes: string[];
  responseType: string;
}

/**
 * Security configuration interface
 */
interface SecurityConfig {
  passwordSaltRounds: number;
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  cors: {
    allowedOrigins: string[];
    allowedMethods: string[];
  };
}

/**
 * Loads environment variables based on current NODE_ENV
 */
const loadEnvironment = (): void => {
  const envFile = process.env.NODE_ENV === 'production' 
    ? '.env.production'
    : process.env.NODE_ENV === 'staging' 
      ? '.env.staging' 
      : '.env.development';

  const result = dotenv.config({ path: envFile });
  
  if (result.error) {
    throw new ConfigurationError(`Failed to load environment file ${envFile}`);
  }
};

/**
 * Validates all configuration settings
 */
const validateConfig = (): void => {
  // Validate environment
  const validEnvs = ['development', 'staging', 'production'];
  if (!validEnvs.includes(process.env.NODE_ENV || '')) {
    throw new ConfigurationError('Invalid NODE_ENV specified');
  }

  // Validate JWT configuration
  if (!process.env.JWT_SECRET) {
    throw new ConfigurationError('JWT_SECRET is required');
  }

  // Validate database configuration
  const requiredDbVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  for (const dbVar of requiredDbVars) {
    if (!process.env[dbVar]) {
      throw new ConfigurationError(`Missing required database configuration: ${dbVar}`);
    }
  }

  // Validate port number
  const port = parseInt(process.env.AUTH_SERVICE_PORT || '4001', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new ConfigurationError('Invalid port number specified');
  }

  // Validate OAuth configurations if enabled
  if (process.env.ENABLE_GOOGLE_AUTH === 'true') {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new ConfigurationError('Google OAuth credentials are required when Google auth is enabled');
    }
  }

  if (process.env.ENABLE_LINKEDIN_AUTH === 'true') {
    if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
      throw new ConfigurationError('LinkedIn OAuth credentials are required when LinkedIn auth is enabled');
    }
  }
};

// Load environment variables
loadEnvironment();

// Validate configuration
validateConfig();

/**
 * Database configuration
 */
const database: DatabaseConfig = {
  host: process.env.DB_HOST!,
  port: parseInt(process.env.DB_PORT!, 10),
  name: process.env.DB_NAME!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  ssl: process.env.DB_SSL === 'true',
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
  idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10)
};

/**
 * JWT configuration
 */
const jwt: JWTConfig = {
  secret: process.env.JWT_SECRET!,
  expiry: AUTH_CONFIG.JWT_EXPIRY,
  refreshExpiry: AUTH_CONFIG.REFRESH_TOKEN_EXPIRY,
  tokenType: AUTH_CONFIG.TOKEN_TYPE,
  algorithm: process.env.JWT_ALGORITHM || 'HS256',
  issuer: process.env.JWT_ISSUER || 'sales-intelligence-platform'
};

/**
 * OAuth configuration
 */
const oauth = {
  [AuthProvider.GOOGLE]: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
    scopes: ['profile', 'email'],
    responseType: 'code'
  } as OAuthProviderConfig,
  
  [AuthProvider.LINKEDIN]: {
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    callbackUrl: process.env.LINKEDIN_CALLBACK_URL,
    scopes: ['r_liteprofile', 'r_emailaddress'],
    responseType: 'code'
  } as OAuthProviderConfig
};

/**
 * Security configuration
 */
const security: SecurityConfig = {
  passwordSaltRounds: AUTH_CONFIG.PASSWORD_SALT_ROUNDS,
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
  },
  cors: {
    allowedOrigins: process.env.CORS_ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  }
};

/**
 * Exported configuration object
 */
export const config = Object.freeze({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.AUTH_SERVICE_PORT || '4001', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  database,
  jwt,
  oauth,
  security
});