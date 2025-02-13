import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // ^2.0.0
import { User, AuthState, AuthProvider } from '../types/auth';
import { AuthService } from '../lib/auth';
import { ApiError } from '../types/common';

// Constants for auth management
const TOKEN_REFRESH_INTERVAL = 60000; // 1 minute in milliseconds
const SESSION_TIMEOUT = 3600000; // 1 hour in milliseconds
const FINGERPRINT_KEY = 'device_fingerprint_v2';

// Refresh token status type
type RefreshStatus = 'idle' | 'pending' | 'success' | 'error';

// Enhanced AuthState with additional security features
interface EnhancedAuthState extends AuthState {
  tokenRefreshStatus: RefreshStatus;
  sessionExpiryTime: number;
  deviceFingerprint: string;
}

// Initial state with enhanced security features
const initialState: EnhancedAuthState = {
  user: null,
  loading: false,
  error: null,
  tokenRefreshStatus: 'idle',
  sessionExpiryTime: 0,
  deviceFingerprint: ''
};

// Generate secure device fingerprint
const generateDeviceFingerprint = (): string => {
  const userAgent = window.navigator.userAgent;
  const screenResolution = `${window.screen.width}x${window.screen.height}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const fingerprint = `${userAgent}|${screenResolution}|${timezone}|${Date.now()}`;
  return btoa(fingerprint);
};

// Login thunk with enhanced security
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password, provider = AuthProvider.LOCAL }: {
    email: string;
    password: string;
    provider?: AuthProvider;
  }, { rejectWithValue }) => {
    try {
      const deviceFingerprint = generateDeviceFingerprint();
      localStorage.setItem(FINGERPRINT_KEY, deviceFingerprint);

      const authService = new AuthService();
      const response = await authService.login(email, password, provider);

      // Validate response structure
      if (!response.user || !response.user.id) {
        throw new Error('Invalid authentication response');
      }

      return {
        user: response.user,
        deviceFingerprint,
        sessionExpiryTime: Date.now() + SESSION_TIMEOUT
      };
    } catch (error) {
      const apiError = error as ApiError;
      return rejectWithValue({
        code: apiError.code || 'AUTH_ERROR',
        message: apiError.message || 'Authentication failed'
      });
    }
  }
);

// Logout thunk with cleanup
export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { dispatch }) => {
    try {
      const authService = new AuthService();
      await authService.logout();
      
      // Clear security-sensitive data
      localStorage.removeItem(FINGERPRINT_KEY);
      
      // Clear any running token refresh intervals
      if (window.tokenRefreshInterval) {
        clearInterval(window.tokenRefreshInterval);
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Continue with logout even if API call fails
    }
  }
);

// Token refresh thunk
export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: EnhancedAuthState };
      const storedFingerprint = localStorage.getItem(FINGERPRINT_KEY);

      // Validate device fingerprint
      if (state.auth.deviceFingerprint !== storedFingerprint) {
        throw new Error('Invalid device fingerprint');
      }

      const authService = new AuthService();
      await authService.refreshToken();

      return {
        sessionExpiryTime: Date.now() + SESSION_TIMEOUT
      };
    } catch (error) {
      const apiError = error as ApiError;
      return rejectWithValue({
        code: apiError.code || 'REFRESH_ERROR',
        message: apiError.message || 'Token refresh failed'
      });
    }
  }
);

// Auth slice with enhanced security features
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    updateSessionExpiry: (state, action: PayloadAction<number>) => {
      state.sessionExpiryTime = action.payload;
    },
    validateSession: (state) => {
      const storedFingerprint = localStorage.getItem(FINGERPRINT_KEY);
      if (!storedFingerprint || storedFingerprint !== state.deviceFingerprint) {
        state.user = null;
        state.error = {
          code: 'SESSION_INVALID',
          message: 'Invalid session detected'
        };
      }
    }
  },
  extraReducers: (builder) => {
    // Login reducers
    builder.addCase(login.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(login.fulfilled, (state, action) => {
      state.loading = false;
      state.user = action.payload.user;
      state.deviceFingerprint = action.payload.deviceFingerprint;
      state.sessionExpiryTime = action.payload.sessionExpiryTime;
      state.error = null;

      // Setup token refresh interval
      if (window.tokenRefreshInterval) {
        clearInterval(window.tokenRefreshInterval);
      }
      window.tokenRefreshInterval = setInterval(() => {
        if (Date.now() < state.sessionExpiryTime) {
          refreshToken();
        }
      }, TOKEN_REFRESH_INTERVAL);
    });
    builder.addCase(login.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as ApiError;
    });

    // Logout reducers
    builder.addCase(logout.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(logout.fulfilled, (state) => {
      return { ...initialState };
    });
    builder.addCase(logout.rejected, (state) => {
      return { ...initialState };
    });

    // Token refresh reducers
    builder.addCase(refreshToken.pending, (state) => {
      state.tokenRefreshStatus = 'pending';
    });
    builder.addCase(refreshToken.fulfilled, (state, action) => {
      state.tokenRefreshStatus = 'success';
      state.sessionExpiryTime = action.payload.sessionExpiryTime;
    });
    builder.addCase(refreshToken.rejected, (state, action) => {
      state.tokenRefreshStatus = 'error';
      state.error = action.payload as ApiError;
      state.user = null;
    });
  }
});

// Export actions and reducer
export const { clearError, updateSessionExpiry, validateSession } = authSlice.actions;
export default authSlice.reducer;

// Selector for auth state
export const selectAuthState = (state: { auth: EnhancedAuthState }) => state.auth;

// Declare global window interface for token refresh interval
declare global {
  interface Window {
    tokenRefreshInterval?: NodeJS.Timeout;
  }
}