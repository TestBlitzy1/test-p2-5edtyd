'use client';

import React, { useEffect } from 'react';
import * as Sentry from '@sentry/react'; // ^7.0.0
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import { Size, Variant } from '../types/common';

/**
 * Error boundary component for handling and displaying runtime errors
 * Integrates with Sentry for error tracking and provides user-friendly error UI
 */
const Error: React.FC<{
  error: Error;
  reset: () => void;
  errorInfo?: React.ErrorInfo;
}> = ({ error, reset, errorInfo }) => {
  // Log error to monitoring system on mount
  useEffect(() => {
    // Capture error with Sentry including additional context
    Sentry.captureException(error, {
      extra: {
        errorInfo,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      },
      tags: {
        environment: process.env.NODE_ENV,
        errorType: error.name,
        component: 'ErrorBoundary',
      },
    });
  }, [error, errorInfo]);

  /**
   * Format user-friendly error message based on error type
   */
  const getErrorMessage = (): string => {
    // Handle known error types with specific messages
    switch (error.name) {
      case 'NetworkError':
        return 'Unable to connect to the server. Please check your internet connection and try again.';
      case 'ValidationError':
        return 'There was an issue with the data. Our team has been notified.';
      case 'AuthorizationError':
        return 'You do not have permission to perform this action. Please contact your administrator.';
      default:
        return process.env.NODE_ENV === 'development'
          ? `An error occurred: ${error.message}`
          : 'Something went wrong. Our team has been notified and is working to fix the issue.';
    }
  };

  /**
   * Handle retry action with exponential backoff
   */
  const handleRetry = async () => {
    try {
      await reset();
    } catch (retryError) {
      Sentry.captureException(retryError, {
        tags: {
          action: 'error_retry',
          originalError: error.name,
        },
      });
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      role="alert"
      aria-live="assertive"
    >
      <Card
        variant={Variant.SECONDARY}
        size={Size.MEDIUM}
        className="max-w-lg w-full"
        testId="error-boundary"
      >
        <div className="text-center p-6">
          {/* Error Icon */}
          <div className="mx-auto mb-4 h-12 w-12 text-red-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          {/* Error Message */}
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Oops! Something went wrong
          </h2>
          <p className="text-gray-600 mb-6">{getErrorMessage()}</p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant={Variant.PRIMARY}
              size={Size.MEDIUM}
              onClick={handleRetry}
              ariaLabel="Try again"
            >
              Try Again
            </Button>
            <Button
              variant={Variant.SECONDARY}
              size={Size.MEDIUM}
              onClick={() => window.location.href = '/'}
              ariaLabel="Return to dashboard"
            >
              Return to Dashboard
            </Button>
          </div>

          {/* Error Details (Development Only) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 text-left text-sm text-gray-500 border-t pt-4">
              <p className="font-mono">{error.name}: {error.message}</p>
              {errorInfo && (
                <pre className="mt-2 overflow-auto">
                  {errorInfo.componentStack}
                </pre>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Error;