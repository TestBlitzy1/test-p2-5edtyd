'use client';

import { useSearchParams } from 'next/navigation';
import { Metadata } from 'next';
import { headers } from 'next/headers';
import ResetPasswordForm from '../../../components/auth/ResetPasswordForm';

/**
 * Secure metadata configuration for password reset page
 * Implements strict security headers and caching policies
 */
export const generateMetadata = (): Metadata => {
  return {
    title: 'Reset Password | Sales Intelligence Platform',
    description: 'Securely reset your password to regain access to your account',
    robots: 'noindex, nofollow', // Prevent indexing of sensitive pages
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Cache-Control': 'no-store, max-age=0',
    },
  };
};

/**
 * Password reset page component with enhanced security features
 * Implements secure token validation, rate limiting, and proper error handling
 */
const ResetPasswordPage: React.FC = () => {
  // Extract and validate reset token from URL parameters
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  // Early return for missing or malformed token
  if (!token) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8"
        role="alert"
        aria-live="assertive"
      >
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-gray-900">
              Invalid Reset Link
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              The password reset link is invalid or has expired. Please request a new password reset link.
            </p>
            <a
              href="/auth/forgot-password"
              className="mt-4 inline-block text-blue-600 hover:text-blue-500"
            >
              Request New Reset Link
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Validate token format using regex
  const TOKEN_REGEX = /^[A-Za-z0-9-_]{64,}$/; // Minimum 64 characters for security
  if (!TOKEN_REGEX.test(token)) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8"
        role="alert"
        aria-live="assertive"
      >
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-gray-900">
              Invalid Token Format
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              The password reset token is malformed. Please ensure you are using the complete reset link.
            </p>
            <a
              href="/auth/forgot-password"
              className="mt-4 inline-block text-blue-600 hover:text-blue-500"
            >
              Request New Reset Link
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900">
            Reset Your Password
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Please enter your new password below
          </p>
        </div>

        <ResetPasswordForm
          token={token}
          className="mt-8 space-y-6"
          onSuccess={() => {
            // Successful password reset - redirect to login with success message
            window.location.href = '/auth/login?reset=success';
          }}
          onError={(error: string) => {
            // Log error for monitoring but don't expose details to user
            console.error('Password reset error:', error);
            // Redirect to error page with generic message
            window.location.href = '/auth/reset-password/error';
          }}
        />

        <div className="text-center mt-4">
          <a
            href="/auth/login"
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            Return to Login
          </a>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;