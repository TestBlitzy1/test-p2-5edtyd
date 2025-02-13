'use client';

import React, { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Metadata } from 'next';
import { RegisterForm } from '../../components/auth/RegisterForm';
import { useAuth } from '../../hooks/useAuth';
import { AuthProvider } from '../../../types/auth';

/**
 * Metadata configuration for the registration page
 * @version 1.0.0
 */
export const generateMetadata = (): Metadata => {
  return {
    title: 'Register - Sales Intelligence Platform',
    description: 'Create your account to access the AI-powered advertising campaign platform',
    robots: 'noindex, nofollow',
    alternates: {
      canonical: '/register'
    },
    openGraph: {
      title: 'Register - Sales Intelligence Platform',
      description: 'Create your account to access the AI-powered advertising campaign platform',
      type: 'website',
      siteName: 'Sales Intelligence Platform'
    },
    twitter: {
      card: 'summary',
      title: 'Register - Sales Intelligence Platform',
      description: 'Create your account to access the AI-powered advertising campaign platform'
    },
    other: {
      'csrf-token': '{{csrf_token}}',
      'x-frame-options': 'DENY',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
    }
  };
};

/**
 * Registration page component with enhanced security features
 * @version 1.0.0
 */
const Register: React.FC = () => {
  const router = useRouter();
  const { loading, registerWithEmail, registerWithOAuth } = useAuth();

  /**
   * Handles successful registration
   */
  const handleRegistrationSuccess = useCallback(() => {
    // Redirect to onboarding or dashboard based on registration completion
    router.push('/onboarding');
  }, [router]);

  /**
   * Handles registration validation errors
   * @param errors - Array of validation errors
   */
  const handleValidationError = useCallback((errors: Array<{ field: string; message: string }>) => {
    console.error('Registration validation errors:', errors);
    // Additional error handling logic can be implemented here
  }, []);

  /**
   * Handles OAuth provider selection
   * @param provider - Selected OAuth provider
   */
  const handleOAuthSelect = useCallback(async (provider: AuthProvider) => {
    try {
      await registerWithOAuth(provider);
      handleRegistrationSuccess();
    } catch (error) {
      console.error('OAuth registration error:', error);
    }
  }, [registerWithOAuth, handleRegistrationSuccess]);

  // Set up security headers and CSP
  useEffect(() => {
    // Ensure secure headers are set
    if (typeof window !== 'undefined') {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';";
      document.head.appendChild(meta);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Create your account
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Join the AI-powered advertising platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <RegisterForm
            onSuccess={handleRegistrationSuccess}
            onValidationError={handleValidationError}
            onOAuthSelect={handleOAuthSelect}
            enableMFA={true}
            allowedOAuthProviders={[AuthProvider.GOOGLE, AuthProvider.LINKEDIN]}
            className="space-y-6"
          />
          
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Already have an account?
                </span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => router.push('/login')}
                className="text-blue-600 hover:text-blue-500 font-medium"
                disabled={loading}
              >
                Sign in to your account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;