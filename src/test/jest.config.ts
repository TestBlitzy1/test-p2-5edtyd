import type { Config } from '@jest/types';

// Global test timeout in milliseconds
const TEST_TIMEOUT = 30000;

const createJestConfig = (): Config.InitialOptions => ({
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Root directory configuration
  roots: ['<rootDir>'],

  // Setup files to run before tests
  setupFilesAfterEnv: ['<rootDir>/utils/test.setup.ts'],

  // Module name mapping for import aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
    '^@fixtures/(.*)$': '<rootDir>/fixtures/$1',
    '^@mocks/(.*)$': '<rootDir>/mocks/$1',
  },

  // Configure separate test projects for different test types
  projects: [
    {
      displayName: 'unit-tests',
      testMatch: ['<rootDir>/unit/**/*.spec.ts'],
      testEnvironment: 'node',
    },
    {
      displayName: 'integration-tests',
      testMatch: ['<rootDir>/integration/**/*.spec.ts'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/utils/test.setup.ts'],
    },
    {
      displayName: 'e2e-tests',
      testMatch: ['<rootDir>/e2e/**/*.spec.ts'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/utils/test.setup.ts'],
    },
    {
      displayName: 'security-tests',
      testMatch: ['<rootDir>/security/**/*.spec.ts'],
      testEnvironment: 'node',
    },
    {
      displayName: 'performance-tests',
      testMatch: ['<rootDir>/performance/**/*.spec.ts'],
      testEnvironment: 'node',
    },
  ],

  // Coverage collection configuration
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'clover', 'json'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // TypeScript configuration
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json',
    },
  },

  // Performance configuration
  maxWorkers: '50%',
  testTimeout: TEST_TIMEOUT,
  verbose: true,

  // Reporters configuration for CI/CD integration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'coverage',
      outputName: 'junit.xml',
    }],
  ],
});

// Export the configuration
const jestConfig = createJestConfig();
export default jestConfig;