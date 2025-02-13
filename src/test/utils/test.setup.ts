// External package imports
import { jest } from '@jest/globals';
import dotenv from 'dotenv'; // ^16.0.0
import winston from 'winston'; // ^3.0.0

// Internal imports
import { TEST_USER } from './test.constants';
import { MockServer } from './mock.server';
import { cleanDatabase } from './db.cleaner';

// Initialize mock server instance
export const mockServer = new MockServer(3001, {
    simulatedLatency: 50,
    enableLogging: true,
    defaultErrorRate: 0
});

// Configure test logger
export const globalTestLogger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        new winston.transports.File({
            filename: 'test-execution.log',
            dirname: './logs'
        })
    ]
});

// Test environment metrics tracking
export const testEnvironmentMetrics = {
    startTime: 0,
    totalTests: 0,
    failedTests: 0,
    skippedTests: 0,
    totalDuration: 0
};

/**
 * Initializes the test environment with comprehensive setup of all required components
 */
export async function setupTestEnvironment(): Promise<void> {
    try {
        // Load test environment variables
        dotenv.config({ path: '.env.test' });

        globalTestLogger.info('Starting test environment setup');

        // Validate required environment variables
        const requiredEnvVars = ['TEST_DB_URL', 'TEST_JWT_SECRET', 'TEST_API_KEY'];
        for (const envVar of requiredEnvVars) {
            if (!process.env[envVar]) {
                throw new Error(`Missing required environment variable: ${envVar}`);
            }
        }

        // Configure global test timeouts
        jest.setTimeout(30000);

        // Setup mock server routes
        mockServer.setupAuthRoutes();
        mockServer.setupCampaignRoutes();
        mockServer.setupAnalyticsRoutes();

        // Clean test database
        await cleanDatabase();

        // Initialize test metrics
        testEnvironmentMetrics.startTime = Date.now();
        testEnvironmentMetrics.totalTests = 0;
        testEnvironmentMetrics.failedTests = 0;
        testEnvironmentMetrics.skippedTests = 0;

        // Configure memory leak detection
        if (global.gc) {
            global.gc();
        }

        globalTestLogger.info('Test environment setup completed successfully');
    } catch (error) {
        globalTestLogger.error('Test environment setup failed:', error);
        throw error;
    }
}

/**
 * Performs comprehensive cleanup of test environment and resources
 */
export async function teardownTestEnvironment(): Promise<void> {
    try {
        globalTestLogger.info('Starting test environment teardown');

        // Clean test database
        await cleanDatabase();

        // Clear mock server
        mockServer.clearMockResponses();

        // Clear all mocks
        jest.clearAllMocks();

        // Calculate test metrics
        testEnvironmentMetrics.totalDuration = Date.now() - testEnvironmentMetrics.startTime;

        // Log test execution summary
        globalTestLogger.info('Test Execution Summary', {
            totalTests: testEnvironmentMetrics.totalTests,
            failedTests: testEnvironmentMetrics.failedTests,
            skippedTests: testEnvironmentMetrics.skippedTests,
            duration: testEnvironmentMetrics.totalDuration
        });

        // Close logger transports
        await Promise.all(
            globalTestLogger.transports.map(t => new Promise(resolve => t.on('finish', resolve)))
        );

        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }

        globalTestLogger.info('Test environment teardown completed successfully');
    } catch (error) {
        globalTestLogger.error('Test environment teardown failed:', error);
        throw error;
    }
}

/**
 * Resets test state between individual test cases with enhanced cleanup
 */
export async function resetTestState(): Promise<void> {
    try {
        globalTestLogger.debug('Starting test state reset');

        // Reset mock server state
        mockServer.clearMockResponses();

        // Restore all mocks
        jest.restoreAllMocks();

        // Reset test user context
        mockServer.setMockResponse('auth/profile', TEST_USER);

        // Clear test-specific environment variables
        process.env.TEST_OVERRIDE = undefined;

        globalTestLogger.debug('Test state reset completed successfully');
    } catch (error) {
        globalTestLogger.error('Test state reset failed:', error);
        throw error;
    }
}

// Configure global test hooks
beforeAll(async () => {
    await setupTestEnvironment();
});

afterAll(async () => {
    await teardownTestEnvironment();
});

beforeEach(async () => {
    await resetTestState();
});

// Export enhanced mock server instance with utility functions
export { mockServer };