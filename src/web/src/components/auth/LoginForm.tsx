import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/router';
import * as yup from 'yup';
import { SecurityUtils } from '@auth0/security-utils';
import { LoginCredentials } from '../../types/auth';
import { useAuth } from '../../hooks/useAuth';

// Form validation schema with enhanced security requirements
const loginSchema = yup.object().shape({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required')
    .max(255, 'Email must not exceed 255 characters'),
  password: yup
    .string()
    .required('Password is required')
    .min(12, 'Password must be at least 12 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  mfaToken: yup.string().optional(),
});

interface LoginFormProps {
  defaultRedirectPath?: string;
  requireMFA?: boolean;
  onLoginSuccess?: () => void;
  onLoginError?: (error: any) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  defaultRedirectPath = '/dashboard',
  requireMFA = false,
  onLoginSuccess,
  onLoginError,
}) => {
  const router = useRouter();
  const { login, loading, error, validateSession } = useAuth();
  const [showMFA, setShowMFA] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutEndTime, setLockoutEndTime] = useState<Date | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm({
    mode: 'onChange',
    resolver: yup.reach(loginSchema),
  });

  // Security constants
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  const FINGERPRINT_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const sessionStatus = await validateSession();
      if (sessionStatus === 'active') {
        router.push(defaultRedirectPath);
      }
    };
    checkSession();
  }, [validateSession, router, defaultRedirectPath]);

  // Handle account lockout
  useEffect(() => {
    if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      setIsLocked(true);
      const endTime = new Date(Date.now() + LOCKOUT_DURATION);
      setLockoutEndTime(endTime);
      
      const unlockTimer = setTimeout(() => {
        setIsLocked(false);
        setLoginAttempts(0);
        setLockoutEndTime(null);
      }, LOCKOUT_DURATION);

      return () => clearTimeout(unlockTimer);
    }
  }, [loginAttempts]);

  // Generate device fingerprint with refresh
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');
  
  const generateFingerprint = useCallback(async () => {
    const fingerprint = await SecurityUtils.generateDeviceFingerprint({
      screen: true,
      userAgent: true,
      timezone: true,
      language: true,
      canvas: true,
    });
    setDeviceFingerprint(fingerprint);
  }, []);

  useEffect(() => {
    generateFingerprint();
    const fingerprintInterval = setInterval(generateFingerprint, FINGERPRINT_REFRESH_INTERVAL);
    return () => clearInterval(fingerprintInterval);
  }, [generateFingerprint]);

  // Handle form submission with enhanced security
  const onSubmit = async (data: LoginCredentials) => {
    try {
      if (isLocked) {
        return;
      }

      clearErrors();
      
      // Sanitize inputs
      const sanitizedData = {
        email: SecurityUtils.sanitizeInput(data.email.toLowerCase().trim()),
        password: data.password,
        deviceFingerprint,
        mfaToken: data.mfaToken,
      };

      // Attempt login
      await login(sanitizedData);
      
      if (requireMFA && !showMFA) {
        setShowMFA(true);
        return;
      }

      // Handle successful login
      setLoginAttempts(0);
      onLoginSuccess?.();
      router.push(defaultRedirectPath);

    } catch (err: any) {
      setLoginAttempts(prev => prev + 1);
      
      if (err.code === 'AUTH_RATE_LIMIT') {
        setIsLocked(true);
        setError('root', { message: 'Account temporarily locked. Please try again later.' });
      } else {
        setError('root', { message: 'Invalid email or password' });
      }

      onLoginError?.(err);
    }
  };

  // Handle OAuth login
  const handleOAuthLogin = async (provider: 'GOOGLE' | 'LINKEDIN') => {
    try {
      const state = SecurityUtils.generateRandomString(32);
      sessionStorage.setItem('oauth_state', state);

      const oauthUrl = SecurityUtils.generateOAuthUrl(provider, {
        state,
        deviceFingerprint,
        redirectUri: `${window.location.origin}/auth/callback/${provider.toLowerCase()}`,
      });

      window.location.href = oauthUrl;
    } catch (err) {
      console.error('OAuth login error:', err);
      setError('root', { message: 'Failed to initiate OAuth login' });
    }
  };

  return (
    <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Sign In</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded" role="alert">
          {error}
        </div>
      )}

      {isLocked && lockoutEndTime && (
        <div className="mb-4 p-3 bg-yellow-100 text-yellow-700 rounded" role="alert">
          Account temporarily locked. Please try again after{' '}
          {new Date(lockoutEndTime).toLocaleTimeString()}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            {...register('email')}
            type="email"
            id="email"
            autoComplete="email"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            disabled={isLocked || loading}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            {...register('password')}
            type="password"
            id="password"
            autoComplete="current-password"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            disabled={isLocked || loading}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
          )}
        </div>

        {showMFA && (
          <div>
            <label htmlFor="mfaToken" className="block text-sm font-medium text-gray-700">
              MFA Code
            </label>
            <input
              {...register('mfaToken')}
              type="text"
              id="mfaToken"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              disabled={isLocked || loading}
            />
            {errors.mfaToken && (
              <p className="mt-1 text-sm text-red-600">{errors.mfaToken.message}</p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isLocked || loading}
          className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or continue with</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => handleOAuthLogin('GOOGLE')}
            disabled={isLocked || loading}
            className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white hover:bg-gray-50"
          >
            Google
          </button>
          <button
            onClick={() => handleOAuthLogin('LINKEDIN')}
            disabled={isLocked || loading}
            className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white hover:bg-gray-50"
          >
            LinkedIn
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;