import { configureStore, combineReducers, ThunkAction, Action } from '@reduxjs/toolkit'; // ^2.0.0
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist'; // ^6.0.0
import storage from 'redux-persist/lib/storage'; // ^6.0.0
import { createLogger } from 'redux-logger'; // ^3.0.6
import { Middleware } from 'redux';

// Import reducers
import analyticsReducer from './analyticsSlice';
import campaignReducer from './campaignSlice';
import authReducer from './authSlice';
import platformReducer from './platformSlice';

// Performance monitoring middleware
const performanceMiddleware: Middleware = store => next => action => {
  const start = performance.now();
  const result = next(action);
  const end = performance.now();
  const duration = end - start;

  // Log slow actions (over 100ms)
  if (duration > 100) {
    console.warn(`Slow action detected: ${action.type} took ${duration.toFixed(2)}ms`);
  }

  return result;
};

// Error tracking middleware
const errorMiddleware: Middleware = () => next => action => {
  try {
    return next(action);
  } catch (error) {
    console.error('Action error:', {
      action,
      error,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

// Redux persist configuration
const persistConfig = {
  key: 'root',
  version: 1,
  storage,
  whitelist: ['auth'], // Only persist auth state
  blacklist: ['analytics'], // Never persist analytics state
  serialize: true,
  deserialize: true,
  timeout: 10000, // 10 seconds
  writeFailHandler: (error: Error) => {
    console.error('Redux persist write failed:', error);
  }
};

// Combine reducers with type safety
const rootReducer = combineReducers({
  analytics: analyticsReducer,
  campaign: campaignReducer,
  auth: authReducer,
  platform: platformReducer
});

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure development tools and middleware
const isDevelopment = process.env.NODE_ENV === 'development';

// Logger middleware configuration
const loggerMiddleware = createLogger({
  collapsed: true,
  duration: true,
  timestamp: false,
  colors: {
    title: () => '#139BFE',
    prevState: () => '#9E9E9E',
    action: () => '#149945',
    nextState: () => '#A47104',
    error: () => '#FF0000',
  },
  predicate: () => isDevelopment
});

// Configure store with all middleware and enhancements
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    serializableCheck: {
      ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      warnAfter: 128
    },
    thunk: {
      extraArgument: undefined
    },
    immutableCheck: {
      warnAfter: 128
    }
  }).concat(
    performanceMiddleware,
    errorMiddleware,
    isDevelopment ? loggerMiddleware : []
  ),
  devTools: {
    name: 'Sales Intelligence Platform',
    maxAge: 50,
    latency: 250,
    trace: true,
    traceLimit: 25,
    shouldHotReload: true,
    shouldCatchErrors: true,
    features: {
      pause: true,
      lock: true,
      persist: true,
      export: true,
      import: 'custom',
      jump: true,
      skip: true,
      reorder: true,
      dispatch: true,
      test: true
    }
  }
});

// Create persistor for redux-persist
export const persistor = persistStore(store, null, () => {
  console.log('Redux store rehydration complete');
});

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;

// Export store instance
export default store;

// Type guards for state slices
export const isAnalyticsState = (state: unknown): state is RootState['analytics'] =>
  state !== null && typeof state === 'object' && 'data' in state;

export const isCampaignState = (state: unknown): state is RootState['campaign'] =>
  state !== null && typeof state === 'object' && 'campaigns' in state;

export const isAuthState = (state: unknown): state is RootState['auth'] =>
  state !== null && typeof state === 'object' && 'user' in state;

export const isPlatformState = (state: unknown): state is RootState['platform'] =>
  state !== null && typeof state === 'object' && 'connectionStatus' in state;