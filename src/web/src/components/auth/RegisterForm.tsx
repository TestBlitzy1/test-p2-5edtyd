import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/router';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { validateLoginCredentials } from '../../lib/validation';
import { AuthProvider, UserRole } from '../../types/auth';
import { Size, Variant } from '../../types/common';

// Registration form field types
interface RegistrationFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  company?: string;
  role?: UserRole;
}

interface RegisterFormProps {
  onSuccess?: () => void;
  className?: string;
  enableMFA?: boolean;
  allowedOAuthProviders?: AuthProvider[];
}

// Device fingerprinting interface
interface DeviceInfo {
  fingerprint: string;
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
}

/**
 * Enhanced registration form component with security features
 * @version 1.0.0
 */
export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  className,
  enableMFA = true,
  allowedOAuthProviders = [AuthProvider.GOOGLE, AuthProvider.LINKEDIN]
}) => {
  const router = useRouter();
  const { register: authRegister, registerWithOAuth, loading, initiateMFA } = useAuth();
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [registrationAttempts, setRegistrationAttempts] = useState<number>(0);
  const [lastAttemptTime, setLastAttemptTime] = useState<number>(0);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
    clearErrors
  } = useForm<RegistrationFormData>();

  // Watch password field for confirmation validation
  const password = watch('password');

  /**
   * Generate device fingerprint for security tracking
   */
  const generateDeviceFingerprint = useCallback(async () => {
    const screenRes = `${window.screen.width}x${window.screen.height}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const language = navigator.language;
    
    // Create fingerprint hash
    const fingerprintData = `${navigator.userAgent}-${screenRes}-${timezone}-${language}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprintData);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fingerprint = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    setDeviceInfo({
      fingerprint,
      userAgent: navigator.userAgent,
      screenResolution: screenRes,
      timezone,
      language
    });
  }, []);

  /**
   * Check rate limiting for registration attempts
   */
  const checkRateLimit = useCallback((): boolean => {
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
    const now = Date.now();

    if (registrationAttempts >= MAX_ATTEMPTS && 
        now - lastAttemptTime < LOCKOUT_DURATION) {
      return false;
    }
    return true;
  }, [registrationAttempts, lastAttemptTime]);

  /**
   * Enhanced form submission handler with security features
   */
  const onSubmit = useCallback(async (formData: RegistrationFormData) => {
    try {
      // Check rate limiting
      if (!checkRateLimit()) {
        throw new Error('Too many registration attempts. Please try again later.');
      }

      // Validate credentials
      const validationResult = await validateLoginCredentials({
        email: formData.email,
        password: formData.password
      });

      if (!validationResult.isValid) {
        validationResult.errors.forEach(error => {
          setError(error.field as keyof RegistrationFormData, {
            type: 'validation',
            message: error.message
          });
        });
        return;
      }

      // Verify password confirmation
      if (formData.password !== formData.confirmPassword) {
        setError('confirmPassword', {
          type: 'validation',
          message: 'Passwords do not match'
        });
        return;
      }

      // Register user with enhanced security data
      const registrationData = {
        ...formData,
        deviceInfo,
        timestamp: new Date().toISOString()
      };

      const result = await authRegister(registrationData);

      // Handle MFA setup if enabled
      if (enableMFA && validationResult.requiresMFA) {
        await initiateMFA();
      }

      // Update rate limiting tracking
      setRegistrationAttempts(prev => prev + 1);
      setLastAttemptTime(Date.now());

      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/dashboard');
      }

    } catch (error) {
      console.error('Registration error:', error);
      setError('root', {
        type: 'submit',
        message: 'Registration failed. Please try again.'
      });
    }
  }, [authRegister, checkRateLimit, deviceInfo, enableMFA, initiateMFA, onSuccess, router, setError]);

  /**
   * Handle OAuth registration
   */
  const handleOAuthRegister = async (provider: AuthProvider) => {
    try {
      if (!checkRateLimit()) {
        throw new Error('Too many registration attempts. Please try again later.');
      }

      await registerWithOAuth(provider, { deviceInfo });
      
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('OAuth registration error:', error);
      setError('root', {
        type: 'submit',
        message: 'OAuth registration failed. Please try again.'
      });
    }
  };

  // Initialize device fingerprinting
  useEffect(() => {
    generateDeviceFingerprint();
  }, [generateDeviceFingerprint]);

  return (
    <div className={className}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Input
          type="email"
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address'
            }
          })}
          error={errors.email?.message}
          placeholder="Email address"
          aria-label="Email address"
        />

        <Input
          type="password"
          {...register('password', {
            required: 'Password is required',
            minLength: {
              value: 12,
              message: 'Password must be at least 12 characters'
            }
          })}
          error={errors.password?.message}
          placeholder="Password"
          aria-label="Password"
        />

        <Input
          type="password"
          {...register('confirmPassword', {
            required: 'Please confirm your password',
            validate: value => value === password || 'Passwords do not match'
          })}
          error={errors.confirmPassword?.message}
          placeholder="Confirm password"
          aria-label="Confirm password"
        />

        <Input
          type="text"
          {...register('firstName', { required: 'First name is required' })}
          error={errors.firstName?.message}
          placeholder="First name"
          aria-label="First name"
        />

        <Input
          type="text"
          {...register('lastName', { required: 'Last name is required' })}
          error={errors.lastName?.message}
          placeholder="Last name"
          aria-label="Last name"
        />

        <Input
          type="text"
          {...register('company')}
          error={errors.company?.message}
          placeholder="Company (optional)"
          aria-label="Company"
        />

        <Button
          type="submit"
          size={Size.LARGE}
          variant={Variant.PRIMARY}
          isLoading={isSubmitting || loading}
          className="w-full"
        >
          Register
        </Button>

        {errors.root && (
          <div className="text-red-500 text-sm" role="alert">
            {errors.root.message}
          </div>
        )}
      </form>

      {allowedOAuthProviders.length > 0 && (
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">
                Or continue with
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {allowedOAuthProviders.includes(AuthProvider.GOOGLE) && (
              <Button
                type="button"
                variant={Variant.SECONDARY}
                onClick={() => handleOAuthRegister(AuthProvider.GOOGLE)}
                className="w-full"
              >
                Google
              </Button>
            )}
            {allowedOAuthProviders.includes(AuthProvider.LINKEDIN) && (
              <Button
                type="button"
                variant={Variant.SECONDARY}
                onClick={() => handleOAuthRegister(AuthProvider.LINKEDIN)}
                className="w-full"
              >
                LinkedIn
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RegisterForm;