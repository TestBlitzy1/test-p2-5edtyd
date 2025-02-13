import { useDispatch, useSelector } from 'react-redux';
import { useCallback, useEffect, useRef } from 'react';
import { 
  User, 
  LoginCredentials, 
  AuthState, 
  UserRole, 
  AuthProvider,
  isValidUser,
  isValidAuthToken,
  hasPermission as checkPermission
} from '../types/auth';

// Constants for auth configuration
const AUTH_CONFIG = {
  TOKEN_REFRESH_INTERVAL: 4 * 60 * 1000, // 4 minutes
  SESSION_CHECK_INTERVAL: 60 * 1000, // 1 minute
  MAX_LOGIN_ATTEMPTS: 5,
  ATTEMPT_RESET_TIME: 15 * 60 * 1000, // 15 minutes
};

// Enhanced error types
interface AuthError {
  code: string;
  message: string;
  timestamp: Date;
}

// Session status types
type SessionStatus = 'active' | 'expired' | 'invalid' | 'locked';

/**
 * Enhanced authentication hook with comprehensive security features
 * @version 1.0.0
 */
export function useAuth() {
  const dispatch = useDispatch();
  const authState = useSelector((state: { auth: AuthState }) => state.auth);
  
  // Refs for tracking auth attempts and intervals
  const loginAttemptsRef = useRef<{ count: number; lastAttempt: number }>({
    count: 0,
    lastAttempt: 0,
  });
  const refreshTokenIntervalRef = useRef<NodeJS.Timeout>();
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout>();

  /**
   * Generates a device fingerprint for enhanced security
   */
  const generateDeviceFingerprint = useCallback(async (): Promise<string> => {
    const userAgent = window.navigator.userAgent;
    const screenResolution = `${window.screen.width}x${window.screen.height}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const fingerprintData = `${userAgent}-${screenResolution}-${timezone}`;
    
    // Create SHA-256 hash of the fingerprint data
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprintData);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }, []);

  /**
   * Enhanced login handler with rate limiting and security features
   */
  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    try {
      // Check rate limiting
      const now = Date.now();
      if (
        loginAttemptsRef.current.count >= AUTH_CONFIG.MAX_LOGIN_ATTEMPTS &&
        now - loginAttemptsRef.current.lastAttempt < AUTH_CONFIG.ATTEMPT_RESET_TIME
      ) {
        throw {
          code: 'AUTH_RATE_LIMIT',
          message: 'Too many login attempts. Please try again later.',
          timestamp: new Date(),
        };
      }

      // Generate device fingerprint
      const deviceFingerprint = await generateDeviceFingerprint();
      
      // Dispatch login action with enhanced credentials
      const response = await dispatch({
        type: 'auth/login',
        payload: {
          ...credentials,
          deviceFingerprint,
          timestamp: new Date().toISOString(),
        },
      });

      // Update login attempts tracking
      loginAttemptsRef.current = {
        count: response.success ? 0 : loginAttemptsRef.current.count + 1,
        lastAttempt: now,
      };

      // Set up token refresh interval
      setupTokenRefresh();
      
      // Broadcast login event to other tabs
      broadcastAuthEvent('login');
      
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }, [dispatch, generateDeviceFingerprint]);

  /**
   * Enhanced logout handler with complete cleanup
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      // Clear intervals
      if (refreshTokenIntervalRef.current) {
        clearInterval(refreshTokenIntervalRef.current);
      }
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }

      // Revoke tokens
      await dispatch({ type: 'auth/revokeTokens' });

      // Clear session storage
      sessionStorage.removeItem('authState');
      localStorage.removeItem('deviceFingerprint');

      // Dispatch logout action
      await dispatch({ type: 'auth/logout' });

      // Broadcast logout event
      broadcastAuthEvent('logout');

    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }, [dispatch]);

  /**
   * Enhanced permission checker with role hierarchy
   */
  const hasPermission = useCallback((permission: string, resource?: string): boolean => {
    const { user } = authState;
    if (!user || !isValidUser(user)) {
      return false;
    }

    const resourcePermission = resource ? `${resource}:${permission}` : permission;
    return checkPermission(user.role, resourcePermission);
  }, [authState]);

  /**
   * Token refresh handler
   */
  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      const deviceFingerprint = await generateDeviceFingerprint();
      await dispatch({
        type: 'auth/refreshToken',
        payload: { deviceFingerprint },
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      await logout();
    }
  }, [dispatch, generateDeviceFingerprint, logout]);

  /**
   * Session validation handler
   */
  const validateSession = useCallback(async (): Promise<SessionStatus> => {
    const { user } = authState;
    if (!user || !isValidUser(user)) {
      return 'invalid';
    }

    try {
      const deviceFingerprint = await generateDeviceFingerprint();
      const response = await dispatch({
        type: 'auth/validateSession',
        payload: { deviceFingerprint },
      });

      return response.status;
    } catch (error) {
      console.error('Session validation error:', error);
      return 'invalid';
    }
  }, [authState, dispatch, generateDeviceFingerprint]);

  /**
   * Sets up token refresh interval
   */
  const setupTokenRefresh = useCallback(() => {
    if (refreshTokenIntervalRef.current) {
      clearInterval(refreshTokenIntervalRef.current);
    }
    refreshTokenIntervalRef.current = setInterval(
      refreshSession,
      AUTH_CONFIG.TOKEN_REFRESH_INTERVAL
    );
  }, [refreshSession]);

  /**
   * Broadcasts auth events across tabs
   */
  const broadcastAuthEvent = (event: 'login' | 'logout'): void => {
    localStorage.setItem('authEvent', JSON.stringify({
      type: event,
      timestamp: new Date().toISOString(),
    }));
  };

  // Set up session check interval and storage event listener
  useEffect(() => {
    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key === 'authEvent') {
        const authEvent = JSON.parse(event.newValue || '{}');
        if (authEvent.type === 'logout') {
          logout();
        }
      }
    };

    sessionCheckIntervalRef.current = setInterval(
      validateSession,
      AUTH_CONFIG.SESSION_CHECK_INTERVAL
    );

    window.addEventListener('storage', handleStorageEvent);

    return () => {
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [logout, validateSession]);

  return {
    user: authState.user,
    loading: authState.loading,
    error: authState.error,
    login,
    logout,
    hasPermission,
    refreshSession,
    validateSession,
  };
}