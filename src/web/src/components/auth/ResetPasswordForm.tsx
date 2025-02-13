import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/router';
import zxcvbn from 'zxcvbn';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useAuth } from '../../hooks/useAuth';
import { Size, Variant } from '../../types/common';

// Password validation constants
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
const MAX_RESET_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT = 15 * 60 * 1000; // 15 minutes

interface ResetPasswordFormProps {
  token: string;
  className?: string;
}

interface FormData {
  password: string;
  confirmPassword: string;
}

/**
 * Password reset form component with enhanced security and accessibility features
 */
export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ token, className }) => {
  const router = useRouter();
  const { loading, error, resetPassword, validateToken } = useAuth();
  const [passwordScore, setPasswordScore] = useState<number>(0);
  const [resetAttempts, setResetAttempts] = useState<number>(0);
  const [lastAttemptTime, setLastAttemptTime] = useState<number>(0);
  const [tokenValid, setTokenValid] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
    trigger
  } = useForm<FormData>({
    mode: 'onChange',
    defaultValues: {
      password: '',
      confirmPassword: ''
    }
  });

  // Validate token on mount
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const isValid = await validateToken(token);
        setTokenValid(isValid);
      } catch (err) {
        setTokenValid(false);
      }
    };
    verifyToken();
  }, [token, validateToken]);

  // Password strength evaluation
  const evaluatePasswordStrength = useCallback((password: string) => {
    const result = zxcvbn(password);
    setPasswordScore(result.score);
    return result;
  }, []);

  // Password validation rules
  const validatePassword = useCallback((value: string) => {
    if (!value) {
      return 'Password is required';
    }
    if (value.length < PASSWORD_MIN_LENGTH) {
      return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
    }
    if (value.length > PASSWORD_MAX_LENGTH) {
      return `Password must be less than ${PASSWORD_MAX_LENGTH} characters`;
    }
    if (!PASSWORD_PATTERN.test(value)) {
      return 'Password must contain uppercase, lowercase, number, and special character';
    }
    const strength = evaluatePasswordStrength(value);
    if (strength.score < 3) {
      return 'Password is too weak. Please choose a stronger password.';
    }
    return true;
  }, [evaluatePasswordStrength]);

  // Form submission handler
  const onSubmit = useCallback(async (data: FormData) => {
    try {
      // Check rate limiting
      const now = Date.now();
      if (resetAttempts >= MAX_RESET_ATTEMPTS && 
          now - lastAttemptTime < ATTEMPT_TIMEOUT) {
        throw new Error('Too many reset attempts. Please try again later.');
      }

      // Validate token
      if (!tokenValid) {
        throw new Error('Invalid or expired reset token');
      }

      // Verify passwords match
      if (data.password !== data.confirmPassword) {
        setError('confirmPassword', {
          type: 'manual',
          message: 'Passwords do not match'
        });
        return;
      }

      // Reset password
      await resetPassword(token, data.password);
      
      // Update attempt tracking
      setResetAttempts(0);
      setLastAttemptTime(0);

      // Redirect to login
      router.push('/auth/login?reset=success');
      
    } catch (err) {
      setResetAttempts(prev => prev + 1);
      setLastAttemptTime(Date.now());
      setError('root', {
        type: 'manual',
        message: err instanceof Error ? err.message : 'Password reset failed'
      });
    }
  }, [token, tokenValid, resetAttempts, lastAttemptTime, resetPassword, router, setError]);

  if (!tokenValid) {
    return (
      <div className="text-center text-red-600" role="alert">
        Invalid or expired reset token. Please request a new password reset.
      </div>
    );
  }

  return (
    <form 
      onSubmit={handleSubmit(onSubmit)} 
      className={className}
      noValidate
    >
      <div className="space-y-6">
        {/* Password field */}
        <div>
          <Input
            type="password"
            {...register('password', {
              validate: validatePassword
            })}
            error={errors.password?.message}
            placeholder="New password"
            autoComplete="new-password"
            aria-label="New password"
            required
          />
          
          {/* Password strength indicator */}
          {watch('password') && (
            <div 
              className="mt-2" 
              role="status" 
              aria-live="polite"
            >
              <div className="flex items-center space-x-2">
                <div className="h-2 flex-1 rounded-full bg-gray-200">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      passwordScore >= 4 ? 'bg-green-500' :
                      passwordScore >= 3 ? 'bg-blue-500' :
                      passwordScore >= 2 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${(passwordScore / 4) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600">
                  {passwordScore >= 4 ? 'Very strong' :
                   passwordScore >= 3 ? 'Strong' :
                   passwordScore >= 2 ? 'Fair' :
                   'Weak'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Confirm password field */}
        <div>
          <Input
            type="password"
            {...register('confirmPassword', {
              validate: value => value === watch('password') || 'Passwords do not match'
            })}
            error={errors.confirmPassword?.message}
            placeholder="Confirm password"
            autoComplete="new-password"
            aria-label="Confirm password"
            required
          />
        </div>

        {/* Error message */}
        {errors.root && (
          <div 
            className="text-red-600 text-sm" 
            role="alert"
          >
            {errors.root.message}
          </div>
        )}

        {/* Submit button */}
        <Button
          type="submit"
          variant={Variant.PRIMARY}
          size={Size.MEDIUM}
          isLoading={isSubmitting || loading}
          isDisabled={isSubmitting || loading || !tokenValid}
          className="w-full"
        >
          Reset Password
        </Button>
      </div>

      {/* Password requirements */}
      <div className="mt-4 text-sm text-gray-600">
        <h3 className="font-medium">Password requirements:</h3>
        <ul className="list-disc list-inside mt-2">
          <li>At least 8 characters long</li>
          <li>Contains uppercase and lowercase letters</li>
          <li>Contains numbers and special characters</li>
          <li>Must not be a commonly used password</li>
        </ul>
      </div>
    </form>
  );
};

export default ResetPasswordForm;