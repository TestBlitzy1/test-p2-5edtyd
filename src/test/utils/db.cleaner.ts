// External package imports
import { Pool } from 'pg'; // ^8.0.0
import { logger } from 'winston'; // ^3.0.0

// Internal imports
import { TEST_USER } from './test.constants';

// Database tables in order of dependency (for proper cleanup)
const DB_TABLES = [
    'forecasts',
    'metrics',
    'performance_reports',
    'analytics',
    'creatives',
    'ad_groups',
    'campaigns'
] as const;

/**
 * Configuration for the database connection pool
 */
const poolConfig = {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

/**
 * Safely truncates a single database table with proper constraint handling
 * @param tableName - Name of the table to truncate
 * @param pool - Database connection pool
 */
export async function truncateTable(tableName: string, pool: Pool): Promise<void> {
    try {
        logger.debug(`Starting truncation of table: ${tableName}`);
        
        // Exclude system user data from cleanup
        const excludeClause = tableName === 'users' 
            ? `WHERE id != '${TEST_USER.id}'` 
            : '';

        // TRUNCATE with CASCADE to handle foreign key constraints
        await pool.query(`
            TRUNCATE TABLE ${tableName} 
            CASCADE 
            ${excludeClause}
        `);

        logger.debug(`Successfully truncated table: ${tableName}`);
    } catch (error) {
        logger.error(`Error truncating table ${tableName}:`, error);
        throw new Error(`Failed to truncate table ${tableName}: ${error.message}`);
    }
}

/**
 * Resets all database sequences to initial values
 * @param pool - Database connection pool
 */
export async function resetSequences(pool: Pool): Promise<void> {
    try {
        logger.debug('Starting sequence reset operation');

        // Query to get all sequences in the database
        const sequencesQuery = `
            SELECT sequence_name 
            FROM information_schema.sequences 
            WHERE sequence_schema = 'public'
        `;

        const { rows } = await pool.query(sequencesQuery);

        // Reset each sequence to 1
        for (const row of rows) {
            const sequenceName = row.sequence_name;
            
            // Skip sequences used by excluded data
            if (sequenceName.includes('user_')) continue;

            await pool.query(`ALTER SEQUENCE ${sequenceName} RESTART WITH 1`);
            logger.debug(`Reset sequence: ${sequenceName}`);
        }

        logger.debug('Successfully reset all sequences');
    } catch (error) {
        logger.error('Error resetting sequences:', error);
        throw new Error(`Failed to reset sequences: ${error.message}`);
    }
}

/**
 * Main function to clean all test data from the database while preserving system data
 * Implements transaction support for atomic operations
 */
export async function cleanDatabase(): Promise<void> {
    const pool = new Pool(poolConfig);
    const client = await pool.connect();

    try {
        logger.info('Starting database cleanup operation');
        
        // Begin transaction
        await client.query('BEGIN');

        // Truncate tables in reverse order to handle dependencies
        for (const table of DB_TABLES) {
            await truncateTable(table, pool);
        }

        // Reset sequences after data cleanup
        await resetSequences(pool);

        // Commit transaction
        await client.query('COMMIT');
        
        logger.info('Successfully completed database cleanup');
    } catch (error) {
        // Rollback transaction on error
        await client.query('ROLLBACK');
        
        logger.error('Database cleanup failed:', error);
        throw new Error(`Database cleanup failed: ${error.message}`);
    } finally {
        // Release client back to pool
        client.release();
        
        // Close pool
        await pool.end();
        
        logger.debug('Cleanup: Released database connections');
    }
}