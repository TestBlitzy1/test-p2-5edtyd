import type { Config } from '@jest/types';
import setupFilePath from './jest.setup';

/**
 * Production-grade Jest configuration for the Sales Intelligence Platform web application
 * Configures comprehensive test environment settings for React/Next.js testing
 * @version Jest 29.0.0
 */
const config: Config.InitialOptions = {
  // Use jsdom environment for browser-like testing
  testEnvironment: 'jsdom',

  // Setup files to run before tests
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Paths to ignore during testing
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/out/',
    '<rootDir>/coverage/'
  ],

  // Module name mapping for absolute imports
  moduleNameMapper: {
    // Core application paths
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@store/(.*)$': '<rootDir>/src/store/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@contexts/(.*)$': '<rootDir>/src/contexts/$1'
  },

  // Transform settings for TypeScript and CSS modules
  transform: {
    // TypeScript files
    '^.+\\.(ts|tsx)$': ['babel-jest', {
      presets: ['next/babel']
    }],
    // CSS modules
    '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy'
  },

  // Files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/**/index.{ts,tsx}',
    '!src/types/**/*'
  ],

  // Coverage thresholds for CI/CD pipeline
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.spec.[jt]s?(x)',
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],

  // Supported file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],

  // Watch plugins for improved developer experience
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Mock settings
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Test timeout in milliseconds
  testTimeout: 10000,

  // Verbose output for detailed test results
  verbose: true,

  // TypeScript configuration
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.jest.json'
    }
  }
};

export default config;