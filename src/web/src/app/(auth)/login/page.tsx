'use client';

import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import LoginForm from '../../../components/auth/LoginForm';
import { useAuth } from '../../../hooks/useAuth';
import { useEffect } from 'react';

// Enhanced metadata configuration for SEO and security
export const metadata: Metadata = {
  title: 'Sign In - Sales Intelligence Platform',
  description: 'Secure access to your Sales Intelligence Platform dashboard',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  openGraph: {
    title: 'Sign In - Sales Intelligence Platform',
    description: 'Secure access to your Sales Intelligence Platform dashboard',
    type: 'website',
    siteName: 'Sales Intelligence Platform',
  },
  other: {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  },
};

/**
 * Secure login page component with comprehensive authentication handling
 * Implements F-008 User Authentication System requirement
 * @version 1.0.0
 */
export default function LoginPage() {
  const { user, loading, sessionStatus, authError } = useAuth();

  // Security-enhanced session validation
  useEffect(() => {
    if (user && sessionStatus === 'active') {
      redirect('/dashboard');
    }
  }, [user, sessionStatus]);

  // Loading state with skeleton UI for better UX
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="animate-pulse">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
              <div className="space-y-6">
                <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto" />
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-10 bg-gray-200 rounded" />
                </div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-10 bg-gray-200 rounded" />
                </div>
                <div className="h-10 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-extrabold text-gray-900 mb-8">
          Sales Intelligence Platform
        </h1>
        
        {/* Error boundary for authentication errors */}
        {authError && (
          <div 
            className="mb-4 bg-red-50 border border-red-200 text-red-800 rounded-md p-4"
            role="alert"
            aria-live="polite"
          >
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm">{authError.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced login form with security features */}
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <LoginForm
            defaultRedirectPath="/dashboard"
            requireMFA={process.env.NEXT_PUBLIC_REQUIRE_MFA === 'true'}
            onLoginSuccess={() => {
              // Audit logging for successful login attempts
              console.info('Login successful', {
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV,
              });
            }}
            onLoginError={(error) => {
              // Enhanced error logging for security monitoring
              console.error('Login failed', {
                timestamp: new Date().toISOString(),
                errorCode: error.code,
                environment: process.env.NODE_ENV,
              });
            }}
          />
        </div>

        {/* Accessibility and security notices */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Protected by enhanced security measures.{' '}
            <a 
              href="/security"
              className="font-medium text-blue-600 hover:text-blue-500"
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn more
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}