'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ErrorBoundary } from '@sentry/react';
import Tabs from '@/components/common/Tabs';
import useAuth from '@/hooks/useAuth';

// Settings tabs configuration with icons and required permissions
const SETTINGS_TABS = [
  {
    label: 'Profile',
    icon: 'user',
    permission: 'profile.view',
    testId: 'profile-tab'
  },
  {
    label: 'Integrations',
    icon: 'connection',
    permission: 'integrations.view',
    testId: 'integrations-tab'
  },
  {
    label: 'Billing',
    icon: 'credit-card',
    permission: 'billing.view',
    testId: 'billing-tab'
  }
] as const;

// Auto-refresh interval for platform connection status (5 minutes)
const REFRESH_INTERVAL = 300000;

/**
 * Enhanced error fallback component for settings page
 */
const SettingsErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div className="p-6 bg-red-50 rounded-lg" role="alert">
    <h2 className="text-lg font-semibold text-red-700">Settings Error</h2>
    <p className="mt-2 text-red-600">{error.message}</p>
    <button 
      onClick={() => window.location.reload()}
      className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
    >
      Reload Page
    </button>
  </div>
);

/**
 * Enhanced settings page component with security, accessibility, and responsive features
 */
const SettingsPage: React.FC = () => {
  // Hooks initialization
  const searchParams = useSearchParams();
  const { user, hasPermission, validateSession, refreshSession } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Initialize active tab from URL params
  useEffect(() => {
    const tabIndex = parseInt(searchParams.get('tab') || '0');
    if (
      !isNaN(tabIndex) && 
      tabIndex >= 0 && 
      tabIndex < SETTINGS_TABS.length &&
      hasPermission(SETTINGS_TABS[tabIndex].permission)
    ) {
      setActiveTab(tabIndex);
    }
  }, [searchParams, hasPermission]);

  // Validate session and refresh tokens periodically
  useEffect(() => {
    const validateAndRefresh = async () => {
      try {
        const sessionStatus = await validateSession();
        if (sessionStatus === 'active') {
          await refreshSession();
        }
      } catch (err) {
        setError('Session validation failed. Please try again.');
      }
    };

    validateAndRefresh();
    const interval = setInterval(validateAndRefresh, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [validateSession, refreshSession]);

  /**
   * Enhanced tab change handler with permission validation
   */
  const handleTabChange = useCallback(async (index: number) => {
    try {
      // Validate permissions for selected tab
      if (!hasPermission(SETTINGS_TABS[index].permission)) {
        throw new Error('Insufficient permissions to access this section');
      }

      // Update URL with new tab index
      const params = new URLSearchParams(window.location.search);
      params.set('tab', index.toString());
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}?${params.toString()}`
      );

      setActiveTab(index);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change tab');
    }
  }, [hasPermission]);

  // Render error state if user is not authenticated
  if (!user) {
    return (
      <div className="p-6 bg-yellow-50 rounded-lg" role="alert">
        <p className="text-yellow-700">
          Please sign in to access settings.
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary fallback={SettingsErrorFallback}>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Settings
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your account settings and preferences
          </p>
        </header>

        {error && (
          <div 
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"
            role="alert"
          >
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <Tabs
          items={SETTINGS_TABS.map(tab => ({
            label: tab.label,
            icon: tab.icon,
            disabled: !hasPermission(tab.permission),
            'data-testid': tab.testId
          }))}
          activeIndex={activeTab}
          onChange={handleTabChange}
          orientation="horizontal"
          animated={true}
          ariaLabel="Settings navigation"
        >
          {/* Profile Settings Tab */}
          <section
            role="tabpanel"
            aria-labelledby="profile-tab"
            className="space-y-6"
          >
            {activeTab === 0 && hasPermission('profile.view') && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900">
                  Profile Information
                </h2>
                {/* Profile settings content */}
              </div>
            )}
          </section>

          {/* Platform Integrations Tab */}
          <section
            role="tabpanel"
            aria-labelledby="integrations-tab"
            className="space-y-6"
          >
            {activeTab === 1 && hasPermission('integrations.view') && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900">
                  Platform Integrations
                </h2>
                {/* Integration settings content */}
              </div>
            )}
          </section>

          {/* Billing Settings Tab */}
          <section
            role="tabpanel"
            aria-labelledby="billing-tab"
            className="space-y-6"
          >
            {activeTab === 2 && hasPermission('billing.view') && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900">
                  Billing & Subscription
                </h2>
                {/* Billing settings content */}
              </div>
            )}
          </section>
        </Tabs>
      </div>
    </ErrorBoundary>
  );
};

export default SettingsPage;