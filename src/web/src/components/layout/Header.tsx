import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import classNames from 'classnames';
import Button, { ButtonVariant } from '../common/Button';
import Dropdown from '../common/Dropdown';
import { useAuth } from '../../hooks/useAuth';
import { PlatformType } from '../../types/platform';
import { UserRole } from '../../types/auth';

/**
 * Platform status indicator interface
 */
interface PlatformStatus {
  type: PlatformType;
  status: 'healthy' | 'degraded' | 'down';
  lastSyncTime: Date;
}

/**
 * Navigation item interface with role-based access
 */
interface NavigationItem {
  label: string;
  path: string;
  icon?: React.ReactNode;
  requiredRole: UserRole;
  platform?: PlatformType;
}

// Navigation configuration with role-based access control
const navigationItems: NavigationItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    requiredRole: UserRole.USER
  },
  {
    label: 'Campaigns',
    path: '/campaigns',
    requiredRole: UserRole.USER
  },
  {
    label: 'Analytics',
    path: '/analytics',
    requiredRole: UserRole.ANALYST
  },
  {
    label: 'Platform Management',
    path: '/platforms',
    requiredRole: UserRole.MANAGER
  },
  {
    label: 'Admin',
    path: '/admin',
    requiredRole: UserRole.ADMIN
  }
];

/**
 * Header component providing navigation, user profile, and platform status
 */
const Header: React.FC = () => {
  const router = useRouter();
  const { user, logout, validateSession, hasPermission } = useAuth();
  const [platformStatuses, setPlatformStatuses] = useState<PlatformStatus[]>([]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [sessionValid, setSessionValid] = useState(true);

  /**
   * Fetches and updates platform integration statuses
   */
  const updatePlatformStatuses = useCallback(async () => {
    try {
      // Simulated platform status check - replace with actual API call
      const statuses: PlatformStatus[] = Object.values(PlatformType).map(type => ({
        type,
        status: 'healthy',
        lastSyncTime: new Date()
      }));
      setPlatformStatuses(statuses);
    } catch (error) {
      console.error('Failed to fetch platform statuses:', error);
    }
  }, []);

  /**
   * Handles user logout with cleanup
   */
  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  /**
   * Handles navigation with role-based access control
   */
  const handleNavigation = useCallback((path: string) => {
    const navItem = navigationItems.find(item => item.path === path);
    if (navItem && hasPermission(navItem.requiredRole.toString())) {
      router.push(path);
      setIsProfileOpen(false);
    }
  }, [router, hasPermission]);

  // Initialize platform status monitoring
  useEffect(() => {
    updatePlatformStatuses();
    const statusInterval = setInterval(updatePlatformStatuses, 60000);
    return () => clearInterval(statusInterval);
  }, [updatePlatformStatuses]);

  // Validate session periodically
  useEffect(() => {
    const checkSession = async () => {
      const status = await validateSession();
      setSessionValid(status === 'active');
    };
    
    const sessionInterval = setInterval(checkSession, 60000);
    checkSession();
    
    return () => clearInterval(sessionInterval);
  }, [validateSession]);

  if (!user || !sessionValid) {
    router.push('/login');
    return null;
  }

  return (
    <header className="bg-white shadow-md px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo and Navigation */}
        <div className="flex items-center space-x-8">
          <div className="text-xl font-bold text-blue-600">
            Sales Intelligence Platform
          </div>
          
          {/* Main Navigation */}
          <nav className="hidden md:flex space-x-4">
            {navigationItems.map(item => (
              hasPermission(item.requiredRole.toString()) && (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={classNames(
                    'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    router.pathname === item.path
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {item.label}
                </button>
              )
            ))}
          </nav>
        </div>

        {/* Platform Status Indicators */}
        <div className="hidden lg:flex items-center space-x-4">
          {platformStatuses.map(platform => (
            <div
              key={platform.type}
              className="flex items-center space-x-2"
              title={`Last synced: ${platform.lastSyncTime.toLocaleString()}`}
            >
              <div
                className={classNames(
                  'w-2 h-2 rounded-full',
                  {
                    'bg-green-500': platform.status === 'healthy',
                    'bg-yellow-500': platform.status === 'degraded',
                    'bg-red-500': platform.status === 'down'
                  }
                )}
              />
              <span className="text-sm text-gray-600">{platform.type}</span>
            </div>
          ))}
        </div>

        {/* User Profile and Actions */}
        <div className="relative">
          <Dropdown
            options={[
              {
                label: 'Profile Settings',
                value: 'profile',
                description: user.email
              },
              {
                label: 'Role',
                value: 'role',
                description: user.role,
                disabled: true
              },
              {
                label: 'Help & Support',
                value: 'help'
              },
              {
                label: 'Logout',
                value: 'logout',
                description: 'End your session'
              }
            ]}
            value=""
            onChange={(value) => {
              switch (value) {
                case 'profile':
                  handleNavigation('/profile');
                  break;
                case 'help':
                  handleNavigation('/support');
                  break;
                case 'logout':
                  handleLogout();
                  break;
              }
            }}
            className="w-48"
            renderOption={(option) => (
              <div className="px-4 py-2 hover:bg-gray-50 cursor-pointer">
                <div className="font-medium">{option.label}</div>
                {option.description && (
                  <div className="text-sm text-gray-500">{option.description}</div>
                )}
              </div>
            )}
          />
        </div>
      </div>
    </header>
  );
};

export default Header;