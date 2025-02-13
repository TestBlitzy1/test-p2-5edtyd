// External package imports
import { afterAll, afterEach, jest } from 'jest'; // ^29.0.0
import winston from 'winston'; // ^3.0.0

// Internal imports
import { cleanDatabase } from './db.cleaner';
import { MockServer } from './mock.server';

// Constants for timeout and retry configurations
const CLEANUP_TIMEOUT = 30000; // 30 seconds
const MAX_CLEANUP_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Main function to clean up the test environment after all tests complete
 * Handles comprehensive cleanup with error handling and logging
 */
export const teardownTestEnvironment = afterAll(async () => {
    const startTime = Date.now();
    
    try {
        // Log teardown initiation
        globalTestLogger.info('Starting test environment teardown', {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV
        });

        // Database cleanup with retry logic
        let dbCleanupSuccess = false;
        for (let i = 0; i < MAX_CLEANUP_RETRIES && !dbCleanupSuccess; i++) {
            try {
                await Promise.race([
                    cleanDatabase(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Database cleanup timeout')), CLEANUP_TIMEOUT)
                    )
                ]);
                dbCleanupSuccess = true;
            } catch (error) {
                globalTestLogger.warn(`Database cleanup attempt ${i + 1} failed`, { error });
                if (i < MAX_CLEANUP_RETRIES - 1) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                }
            }
        }

        if (!dbCleanupSuccess) {
            throw new Error('Database cleanup failed after maximum retries');
        }

        // Clear mock server state
        if (mockServer) {
            mockServer.clearMockResponses();
        }

        // Reset all jest mocks and timers
        jest.clearAllMocks();
        jest.clearAllTimers();
        jest.useRealTimers();

        // Clear global test state
        await clearGlobalTestState();

        // Verify cleanup completion
        await verifyCleanupCompletion();

        // Log successful teardown
        globalTestLogger.info('Test environment teardown completed successfully', {
            executionTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        globalTestLogger.error('Test environment teardown failed', {
            error,
            timestamp: new Date().toISOString()
        });
        throw error;
    }
}, CLEANUP_TIMEOUT);

/**
 * Resets test state between individual test cases
 * Handles per-test cleanup with verification
 */
export const resetTestState = afterEach(async () => {
    try {
        // Log reset initiation
        globalTestLogger.debug('Starting test state reset');

        // Clear mock responses for clean slate
        if (mockServer) {
            mockServer.clearMockResponses();
        }

        // Reset all jest mocks and spies
        jest.clearAllMocks();
        jest.clearAllTimers();

        // Clear test-specific timeouts and intervals
        clearTestTimers();

        // Reset test-specific event listeners
        clearTestEventListeners();

        // Log successful reset
        globalTestLogger.debug('Test state reset completed successfully');
    } catch (error) {
        globalTestLogger.error('Test state reset failed', { error });
        throw error;
    }
});

/**
 * Clears any global test state, mocks, and configurations
 * Implements comprehensive cleanup of global state
 */
export function clearGlobalTestState(): void {
    try {
        // Clear global mock instances
        if (global.mockServer) {
            delete global.mockServer;
        }

        // Clear global test settings
        if (global.testTimeouts) {
            global.testTimeouts.forEach(timeout => clearTimeout(timeout));
            global.testTimeouts.clear();
        }

        if (global.testIntervals) {
            global.testIntervals.forEach(interval => clearInterval(interval));
            global.testIntervals.clear();
        }

        // Reset environment variables
        process.env.NODE_ENV = 'test';

        // Clear any cached test data
        jest.resetModules();

        globalTestLogger.debug('Global test state cleared successfully');
    } catch (error) {
        globalTestLogger.error('Failed to clear global test state', { error });
        throw error;
    }
}

/**
 * Clears all test-specific timers
 */
function clearTestTimers(): void {
    if (global.testTimeouts) {
        global.testTimeouts.forEach(timeout => clearTimeout(timeout));
        global.testTimeouts.clear();
    }

    if (global.testIntervals) {
        global.testIntervals.forEach(interval => clearInterval(interval));
        global.testIntervals.clear();
    }
}

/**
 * Clears all test-specific event listeners
 */
function clearTestEventListeners(): void {
    // Clear process event listeners
    process.removeAllListeners('unhandledRejection');
    process.removeAllListeners('uncaughtException');

    // Clear any custom event emitters
    if (global.testEventEmitters) {
        global.testEventEmitters.forEach(emitter => emitter.removeAllListeners());
        global.testEventEmitters.clear();
    }
}

/**
 * Verifies that cleanup operations completed successfully
 */
async function verifyCleanupCompletion(): Promise<void> {
    try {
        // Verify database cleanup
        await cleanDatabase();

        // Verify mock server state
        if (mockServer) {
            const app = mockServer.getApp();
            if (app.listening) {
                throw new Error('Mock server still running after cleanup');
            }
        }

        // Verify global state
        if (global.testTimeouts?.size > 0 || global.testIntervals?.size > 0) {
            throw new Error('Test timers not properly cleared');
        }

        globalTestLogger.debug('Cleanup verification completed successfully');
    } catch (error) {
        globalTestLogger.error('Cleanup verification failed', { error });
        throw error;
    }
}