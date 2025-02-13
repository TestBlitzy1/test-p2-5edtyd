import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn,
  Index
} from 'typeorm';
import { 
  IUser, 
  UserRole, 
  AuthProvider 
} from '../../shared/types/auth.types';
import { validateUserSchema } from '../../shared/schemas/user.schema';
import { AUTH_CONFIG } from '../../shared/constants';

/**
 * Enhanced User entity with comprehensive security features and OAuth support
 * Implements role-based access control and multi-provider authentication
 */
@Entity('users')
@Index(['email'], { unique: true })
@Index(['provider', 'providerUserId'], { unique: true })
export class User implements Partial<IUser> {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  email: string;

  @Column({ nullable: true, select: false })
  password: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: AuthProvider,
    default: AuthProvider.LOCAL
  })
  provider: AuthProvider;

  @Column({ nullable: true })
  providerUserId: string | null;

  @Column({ default: 0 })
  failedLoginAttempts: number;

  @Column({ default: false })
  isLocked: boolean;

  @Column({ nullable: true })
  passwordChangedAt: Date | null;

  @Column({ nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Creates a new User instance with enhanced security initialization
   * @param userData - Partial user data for initialization
   */
  constructor(userData?: Partial<IUser>) {
    if (userData) {
      Object.assign(this, {
        ...userData,
        role: userData.role || UserRole.USER,
        provider: userData.provider || AuthProvider.LOCAL,
        failedLoginAttempts: 0,
        isLocked: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  /**
   * Converts user object to JSON representation excluding sensitive data
   * @returns Sanitized user data object
   */
  toJSON(): Omit<IUser, 'password' | 'failedLoginAttempts'> {
    const user = { ...this };
    delete user.password;
    delete user.failedLoginAttempts;
    return user;
  }

  /**
   * Enhanced user data validation with security checks
   * @returns Promise resolving to validation result
   */
  async validateUser(): Promise<boolean> {
    try {
      // Basic schema validation
      const isValid = await validateUserSchema(this);
      if (!isValid) return false;

      // Provider-specific validation
      if (this.provider === AuthProvider.LOCAL && !this.password) {
        return false;
      }

      if (this.provider !== AuthProvider.LOCAL && !this.providerUserId) {
        return false;
      }

      // Security validation
      if (this.failedLoginAttempts > AUTH_CONFIG.MAX_LOGIN_ATTEMPTS) {
        return false;
      }

      // Date validation
      if (this.passwordChangedAt && this.passwordChangedAt > new Date()) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Handles failed login attempt tracking and account locking
   * @returns Promise resolving after update
   */
  async incrementFailedLogin(): Promise<void> {
    this.failedLoginAttempts += 1;
    
    if (this.failedLoginAttempts >= AUTH_CONFIG.MAX_LOGIN_ATTEMPTS) {
      this.isLocked = true;
      // Account will be automatically unlocked after lockout duration
      setTimeout(() => {
        this.isLocked = false;
        this.failedLoginAttempts = 0;
      }, AUTH_CONFIG.LOGIN_LOCKOUT_DURATION);
    }
    
    this.updatedAt = new Date();
  }
}