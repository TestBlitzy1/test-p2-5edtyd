import React, { useState, useEffect, useCallback, useRef } from 'react';
import clsx from 'clsx';
import { useResizeObserver } from 'use-resize-observer';
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';
import { UI_CONSTANTS } from '../../lib/constants';
import useAnalytics from '../../hooks/useAnalytics';

// Layout state interface
interface ResponsiveState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

// Props interface
interface DashboardLayoutProps {
  children: React.ReactNode;
  className?: string;
  disableSidebar?: boolean;
  hideFooter?: boolean;
}

/**
 * Generates responsive CSS classes for the main layout container
 */
const getLayoutClasses = (
  className?: string,
  isSidebarCollapsed?: boolean,
  responsiveState?: ResponsiveState
): string => {
  return clsx(
    // Base layout classes
    'flex',
    'h-screen',
    'bg-gray-50',
    'dark:bg-gray-900',
    'transition-all',
    'duration-300',
    'ease-in-out',
    
    // Responsive classes
    {
      'flex-col': responsiveState?.isMobile,
      'flex-row': !responsiveState?.isMobile,
      'overflow-hidden': !responsiveState?.isMobile,
    },
    
    // Sidebar state classes
    {
      'pl-64': !isSidebarCollapsed && !responsiveState?.isMobile,
      'pl-20': isSidebarCollapsed && !responsiveState?.isMobile,
    },
    
    // Custom classes
    className
  );
};

/**
 * DashboardLayout component providing the main application structure
 * with responsive behavior and state management
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  className,
  disableSidebar = false,
  hideFooter = false,
}) => {
  // State management
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [responsiveState, setResponsiveState] = useState<ResponsiveState>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
  });

  // Refs for element measurements
  const containerRef = useRef<HTMLDivElement>(null);

  // Analytics hook for tracking layout interactions
  const analytics = useAnalytics('dashboard_layout', 'REALTIME');

  /**
   * Handle responsive state updates based on container size
   */
  const { ref: resizeRef } = useResizeObserver({
    onResize: useCallback(({ width = 0 }) => {
      const newState = {
        isMobile: width < UI_CONSTANTS.BREAKPOINTS.TABLET,
        isTablet: width >= UI_CONSTANTS.BREAKPOINTS.TABLET && width < UI_CONSTANTS.BREAKPOINTS.DESKTOP,
        isDesktop: width >= UI_CONSTANTS.BREAKPOINTS.DESKTOP,
      };
      setResponsiveState(newState);

      // Auto-collapse sidebar on mobile
      if (newState.isMobile && !isSidebarCollapsed) {
        setIsSidebarCollapsed(true);
      }
    }, [isSidebarCollapsed])
  });

  /**
   * Handle sidebar toggle with state persistence
   */
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const newState = !prev;
      try {
        localStorage.setItem(UI_CONSTANTS.LAYOUT_STORAGE_KEY, JSON.stringify({
          sidebarCollapsed: newState,
          timestamp: new Date().toISOString(),
        }));
      } catch (error) {
        console.error('Failed to persist layout state:', error);
      }
      return newState;
    });
  }, []);

  /**
   * Initialize layout state and handle storage sync
   */
  useEffect(() => {
    // Restore layout state from storage
    try {
      const savedState = localStorage.getItem(UI_CONSTANTS.LAYOUT_STORAGE_KEY);
      if (savedState) {
        const { sidebarCollapsed } = JSON.parse(savedState);
        setIsSidebarCollapsed(sidebarCollapsed);
      }
    } catch (error) {
      console.error('Failed to restore layout state:', error);
    }

    // Handle cross-tab synchronization
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === UI_CONSTANTS.LAYOUT_STORAGE_KEY && event.newValue) {
        try {
          const { sidebarCollapsed } = JSON.parse(event.newValue);
          setIsSidebarCollapsed(sidebarCollapsed);
        } catch (error) {
          console.error('Failed to sync layout state:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Combine refs for resize observation
  const combinedRef = useCallback((element: HTMLDivElement) => {
    containerRef.current = element;
    resizeRef(element);
  }, [resizeRef]);

  return (
    <div
      ref={combinedRef}
      className={getLayoutClasses(className, isSidebarCollapsed, responsiveState)}
      data-testid="dashboard-layout"
    >
      {/* Header */}
      <Header
        onUserMenuClick={() => {
          analytics.refetch();
        }}
        onNotificationsClick={() => {
          analytics.refetch();
        }}
      />

      {/* Main content area with sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {!disableSidebar && (
          <Sidebar
            isCollapsed={isSidebarCollapsed}
            onToggle={handleSidebarToggle}
            activeRoute={window.location.pathname}
          />
        )}

        {/* Main content */}
        <main
          className={clsx(
            'flex-1',
            'overflow-auto',
            'bg-gray-50',
            'dark:bg-gray-900',
            'transition-all',
            'duration-300',
            'ease-in-out',
            'p-4',
            'md:p-6',
            'lg:p-8'
          )}
        >
          {children}
        </main>
      </div>

      {/* Footer */}
      {!hideFooter && <Footer />}
    </div>
  );
};

export default DashboardLayout;