'use client';

import React, { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';
import { Size, Variant } from '../../../types/common';

// Form data interface
interface ForgotPasswordFormData {
  email: string;
}

// Email validation regex
const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

// Rate limiting constants
const RATE_LIMIT = {
  MAX_ATTEMPTS: 5,
  RESET_TIME: 15 * 60 * 1000, // 15 minutes
};

/**
 * Forgot Password page component providing secure password recovery functionality
 */
const ForgotPasswordPage: React.FC = () => {
  const router = useRouter();
  const { forgotPassword, loading, error } = useAuth();
  
  // Form validation setup
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ForgotPasswordFormData>({
    defaultValues: {
      email: '',
    },
    mode: 'onBlur',
  });

  /**
   * Handles form submission with rate limiting and validation
   */
  const onSubmit = useCallback(async (data: ForgotPasswordFormData) => {
    try {
      // Sanitize email input
      const sanitizedEmail = data.email.trim().toLowerCase();

      // Call auth service
      await forgotPassword(sanitizedEmail);

      // Show success message
      toast.success(
        'Password reset instructions have been sent to your email address.',
        {
          duration: 5000,
          position: 'top-center',
        }
      );

      // Redirect to login after short delay
      setTimeout(() => {
        router.push('/login');
      }, 3000);

    } catch (err) {
      // Handle specific error cases
      if (err.code === 'AUTH_RATE_LIMIT') {
        setError('email', {
          type: 'manual',
          message: 'Too many attempts. Please try again later.',
        });
      } else {
        setError('email', {
          type: 'manual',
          message: 'Failed to send reset instructions. Please try again.',
        });
      }

      // Show error toast
      toast.error('Password reset request failed', {
        duration: 3000,
        position: 'top-center',
      });
    }
  }, [forgotPassword, router, setError]);

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-extrabold text-gray-900 mb-8">
          Reset your password
        </h1>

        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form 
            onSubmit={handleSubmit(onSubmit)} 
            className="space-y-6"
            noValidate
          >
            <div>
              <Input
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: EMAIL_REGEX,
                    message: 'Please enter a valid email address',
                  },
                })}
                type="email"
                name="email"
                placeholder="Enter your email address"
                error={errors.email?.message || (error?.message || '')}
                disabled={isSubmitting || loading}
                size={Size.MEDIUM}
                required
                aria-label="Email address"
                autoComplete="email"
              />
            </div>

            <div>
              <Button
                type="submit"
                variant={Variant.PRIMARY}
                size={Size.MEDIUM}
                isLoading={isSubmitting || loading}
                disabled={isSubmitting || loading}
                className="w-full"
                ariaLabel="Send password reset instructions"
              >
                Send Reset Instructions
              </Button>
            </div>

            <div className="text-sm text-center">
              <a
                href="/login"
                className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline transition ease-in-out duration-150"
                aria-label="Return to login page"
              >
                Return to login
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;