import type { Config } from '@jest/types';
import { defaults as tsjPreset } from 'ts-jest/presets';

// @jest/types: ^29.6.0
// ts-jest: ^29.1.0

const config: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Set Node.js as the test environment
  testEnvironment: 'node',

  // Define root directory for tests
  roots: ['<rootDir>/src'],

  // Test file patterns for different services
  testMatch: [
    '**/auth-service/**/*.spec.ts',
    '**/campaign-service/**/*.spec.ts',
    '**/analytics-service/**/*.spec.ts',
    '**/platform-integration/**/*.spec.ts',
    '**/shared/**/*.spec.ts'
  ],

  // TypeScript transformation configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },

  // Module path aliases
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/src/shared/$1'
  },

  // Code coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Paths to ignore during testing
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],

  // Test setup file
  setupFilesAfterEnv: [
    '<rootDir>/src/test/utils/test.setup.ts'
  ],

  // File extensions to consider
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],

  // Additional configuration options
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  detectOpenHandles: true,
  forceExit: true,

  // Global settings
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json'
    },
    testTimeout: 30000,
    maxWorkers: '50%'
  },

  // Multi-project configuration for different services
  projects: [
    {
      displayName: 'auth-service',
      testMatch: ['<rootDir>/src/auth-service/**/*.spec.ts']
    },
    {
      displayName: 'campaign-service',
      testMatch: ['<rootDir>/src/campaign-service/**/*.spec.ts']
    },
    {
      displayName: 'analytics-service',
      testMatch: ['<rootDir>/src/analytics-service/**/*.spec.ts']
    },
    {
      displayName: 'platform-integration',
      testMatch: ['<rootDir>/src/platform-integration/**/*.spec.ts']
    },
    {
      displayName: 'shared',
      testMatch: ['<rootDir>/src/shared/**/*.spec.ts']
    }
  ]
};

export default config;