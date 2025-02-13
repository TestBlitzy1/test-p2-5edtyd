/**
 * @fileoverview Zod schema definitions for user data validation with comprehensive security features
 * Implements strict validation rules for user authentication, authorization, and management
 * @version 1.0.0
 */

import { z } from 'zod';
import { UserRole, AuthProvider } from '../types/auth.types';
import { AUTH_CONFIG } from '../constants';

// Email validation regex with comprehensive domain checking
const EMAIL_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Password complexity regex requiring minimum complexity
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

/**
 * Base user schema with comprehensive validation rules
 */
export const userSchema = z.object({
  // Required system fields
  id: z.string().uuid(),
  
  // Authentication fields with enhanced validation
  email: z.string()
    .email()
    .regex(EMAIL_REGEX, 'Invalid email format')
    .min(5)
    .max(255),
  
  password: z.string()
    .regex(
      PASSWORD_REGEX,
      'Password must contain at least 12 characters, one uppercase letter, one lowercase letter, one number, and one special character'
    )
    .nullable()
    .optional(),
  
  // Role-based access control
  role: z.nativeEnum(UserRole, {
    errorMap: () => ({ message: 'Invalid user role' })
  }),
  
  // Authentication provider details
  provider: z.nativeEnum(AuthProvider, {
    errorMap: () => ({ message: 'Invalid authentication provider' })
  }),
  
  providerUserId: z.string()
    .nullable()
    .optional(),
  
  // Security and audit fields
  lastLoginAt: z.date(),
  passwordChangedAt: z.date().optional(),
  failedLoginAttempts: z.number()
    .int()
    .min(0)
    .max(AUTH_CONFIG.MAX_LOGIN_ATTEMPTS),
  
  isLocked: z.boolean().default(false),
  
  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Schema for user updates with partial validation
 */
export const userUpdateSchema = z.object({
  email: z.string()
    .email()
    .regex(EMAIL_REGEX, 'Invalid email format')
    .min(5)
    .max(255)
    .optional(),
  
  password: z.string()
    .regex(
      PASSWORD_REGEX,
      'Password must contain at least 12 characters, one uppercase letter, one lowercase letter, one number, and one special character'
    )
    .optional(),
  
  role: z.nativeEnum(UserRole)
    .optional(),
  
  isLocked: z.boolean()
    .optional(),
  
  failedLoginAttempts: z.number()
    .int()
    .min(0)
    .max(AUTH_CONFIG.MAX_LOGIN_ATTEMPTS)
    .optional(),
}).strict();

/**
 * Validates user data against schema with comprehensive security checks
 * @param userData - User data to validate
 * @returns Promise resolving to validation result
 */
export const validateUserSchema = async (userData: unknown): Promise<boolean> => {
  try {
    // Validate base schema
    const validationResult = await userSchema.safeParseAsync(userData);
    
    if (!validationResult.success) {
      return false;
    }
    
    // Additional provider-specific validation
    const data = validationResult.data;
    
    // Ensure local auth users have password
    if (data.provider === AuthProvider.LOCAL && !data.password) {
      return false;
    }
    
    // Ensure OAuth users have provider ID
    if (data.provider !== AuthProvider.LOCAL && !data.providerUserId) {
      return false;
    }
    
    // Validate date consistency
    if (data.passwordChangedAt && data.passwordChangedAt > new Date()) {
      return false;
    }
    
    if (data.lastLoginAt > new Date()) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
};

// Type inference from schema
export type User = z.infer<typeof userSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;