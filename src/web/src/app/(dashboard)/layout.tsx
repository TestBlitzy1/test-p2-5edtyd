'use client';

import React, { useEffect } from 'react';
import { redirect } from 'next/navigation';
import { ErrorBoundary } from 'react-error-boundary';
import DashboardLayout from '../../components/layout/DashboardLayout';
import useAuth from '../../hooks/useAuth';
import LoadingSpinner from '@/components/ui/loading-spinner';

/**
 * Error fallback component for dashboard layout
 */
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <div className="max-w-md w-full space-y-4 text-center">
      <h2 className="text-2xl font-bold text-gray-900">Something went wrong</h2>
      <p className="text-gray-600">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Try again
      </button>
    </div>
  </div>
);

/**
 * Root dashboard layout wrapper with authentication protection and error handling
 * Implements responsive layout management and performance optimizations
 */
const DashboardLayoutWrapper = React.memo(({ children }: { children: React.ReactNode }) => {
  const { user, loading, error } = useAuth();

  // Handle authentication loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Redirect to login if user is not authenticated
  if (!user && !loading) {
    redirect('/login');
    return null;
  }

  // Log authentication errors
  useEffect(() => {
    if (error) {
      console.error('Authentication error:', error);
    }
  }, [error]);

  // Handle error reset
  const handleErrorReset = () => {
    // Clear any error states and retry loading the dashboard
    window.location.reload();
  };

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={handleErrorReset}
      onError={(error) => {
        // Log errors to monitoring service
        console.error('Dashboard error:', error);
      }}
    >
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </ErrorBoundary>
  );
});

// Display name for debugging
DashboardLayoutWrapper.displayName = 'DashboardLayoutWrapper';

export default DashboardLayoutWrapper;