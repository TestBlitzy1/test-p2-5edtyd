import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { Button } from '../common/Button';
import { UI_CONSTANTS } from '../../lib/constants';
import { useAuth } from '../../hooks/useAuth';
import { Size, Variant } from '../../types/common';
import { UserRole } from '../../types/auth';

// Navigation item interface
interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  requiredRole?: UserRole;
  requiredPermission?: string;
}

// Sidebar props interface
interface SidebarProps {
  className?: string;
  defaultCollapsed?: boolean;
}

// Navigation items configuration
const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: '📊',
    requiredPermission: 'dashboard:view'
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    path: '/campaigns',
    icon: '🎯',
    requiredPermission: 'campaign:view'
  },
  {
    id: 'analytics',
    label: 'Analytics',
    path: '/analytics',
    icon: '📈',
    requiredPermission: 'analytics:view'
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: '⚙️',
    requiredPermission: 'settings:view'
  }
];

/**
 * Responsive sidebar navigation component with role-based access control
 * and responsive behavior for desktop, tablet, and mobile views.
 */
export const Sidebar: React.FC<SidebarProps> = ({
  className,
  defaultCollapsed = false
}) => {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Local storage key for sidebar state
  const STORAGE_KEY = 'sidebar_collapsed_state';

  /**
   * Generates CSS classes for navigation items based on active state and collapse state
   */
  const getNavItemClasses = useCallback((path: string): string => {
    const isActive = router.pathname === path;
    
    return clsx(
      'flex items-center px-4 py-3 mb-2 rounded-lg transition-all duration-200',
      'hover:bg-blue-50 dark:hover:bg-blue-900',
      'focus:outline-none focus:ring-2 focus:ring-blue-500',
      {
        'bg-blue-100 dark:bg-blue-800': isActive,
        'justify-center': isCollapsed,
        'justify-start': !isCollapsed,
        'text-blue-600 dark:text-blue-300': isActive,
        'text-gray-700 dark:text-gray-300': !isActive
      }
    );
  }, [isCollapsed, router.pathname]);

  /**
   * Handles sidebar collapse state with animation and persistence
   */
  const handleToggleCollapse = useCallback(() => {
    requestAnimationFrame(() => {
      setIsCollapsed(prev => {
        const newState = !prev;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        } catch (error) {
          console.error('Failed to persist sidebar state:', error);
        }
        return newState;
      });

      // Dispatch resize event for layout adjustments
      window.dispatchEvent(new Event('resize'));
    });
  }, []);

  /**
   * Initializes responsive behavior and state persistence
   */
  useEffect(() => {
    // Initialize collapse state from storage
    try {
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState !== null) {
        setIsCollapsed(JSON.parse(savedState));
      }
    } catch (error) {
      console.error('Failed to restore sidebar state:', error);
    }

    // Initialize resize observer for responsive behavior
    resizeObserverRef.current = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width && width < UI_CONSTANTS.BREAKPOINTS.TABLET) {
        setIsCollapsed(true);
      }
    });

    if (sidebarRef.current) {
      resizeObserverRef.current.observe(sidebarRef.current);
    }

    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, []);

  /**
   * Renders navigation items with permission checks
   */
  const renderNavItems = useCallback(() => {
    return NAV_ITEMS.filter(item => {
      if (!user) return false;
      if (item.requiredRole && user.role !== item.requiredRole) return false;
      if (item.requiredPermission && !hasPermission(item.requiredPermission)) return false;
      return true;
    }).map(item => (
      <Link
        key={item.id}
        href={item.path}
        className={getNavItemClasses(item.path)}
        aria-label={isCollapsed ? item.label : undefined}
      >
        <span className="text-xl">{item.icon}</span>
        {!isCollapsed && (
          <span className="ml-3 text-sm font-medium">{item.label}</span>
        )}
      </Link>
    ));
  }, [user, hasPermission, getNavItemClasses, isCollapsed]);

  return (
    <aside
      ref={sidebarRef}
      className={clsx(
        'flex flex-col',
        'h-screen sticky top-0',
        'bg-white dark:bg-gray-900',
        'border-r border-gray-200 dark:border-gray-800',
        'transition-all duration-300 ease-in-out',
        {
          'w-64': !isCollapsed,
          'w-20': isCollapsed
        },
        className
      )}
      aria-label="Sidebar Navigation"
      role="navigation"
    >
      {/* Logo and collapse toggle */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        {!isCollapsed && (
          <div className="flex items-center">
            <span className="text-xl font-bold text-blue-600 dark:text-blue-300">
              SIP
            </span>
          </div>
        )}
        <Button
          size={Size.SMALL}
          variant={Variant.SECONDARY}
          onClick={handleToggleCollapse}
          className="ml-auto"
          ariaLabel={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? '→' : '←'}
        </Button>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 overflow-y-auto p-4">
        {renderNavItems()}
      </nav>

      {/* User profile section */}
      {user && (
        <div className={clsx(
          'p-4 border-t border-gray-200 dark:border-gray-800',
          'flex items-center',
          { 'justify-center': isCollapsed }
        )}>
          <Link
            href="/profile"
            className="flex items-center hover:text-blue-600 dark:hover:text-blue-300"
          >
            <span className="text-xl">👤</span>
            {!isCollapsed && (
              <span className="ml-3 text-sm font-medium truncate">
                {user.email}
              </span>
            )}
          </Link>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;