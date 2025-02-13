// External package imports
import { Pool } from 'pg'; // @types/pg@^8.0.0
import { Request } from 'supertest'; // @types/supertest@^6.0.0
import { IUser } from '@types/user'; // @types/user@^1.0.0
import { ICampaign, PlatformType, CampaignStatus } from '@types/campaign'; // @types/campaign@^1.0.0

// Internal imports
import { TEST_USER } from './test.constants';
import { createMockServer } from './mock.server';

/**
 * Configuration interface for test environment setup
 */
interface TestConfig {
  dbConfig: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  mockServerPort: number;
  simulatedLatency?: number;
}

/**
 * Test environment context interface
 */
interface TestEnvironment {
  dbPool: Pool;
  mockServer: ReturnType<typeof createMockServer>;
  cleanup: () => Promise<void>;
}

/**
 * Cleans up the test database by truncating all test tables
 * Uses a transaction to ensure atomic cleanup
 */
export async function cleanDatabase(pool: Pool): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Disable foreign key constraints temporarily
    await client.query('SET CONSTRAINTS ALL DEFERRED');
    
    // Truncate all test tables in dependency order
    const truncateQueries = [
      'TRUNCATE TABLE analytics CASCADE',
      'TRUNCATE TABLE campaign_metrics CASCADE',
      'TRUNCATE TABLE ad_groups CASCADE',
      'TRUNCATE TABLE campaigns CASCADE',
      'TRUNCATE TABLE user_preferences CASCADE',
      'TRUNCATE TABLE users CASCADE'
    ];
    
    for (const query of truncateQueries) {
      await client.query(query);
    }
    
    // Reset all sequences
    await client.query(`
      SELECT setval(c.oid, 1, false)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'S' AND n.nspname = 'public'
    `);
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database cleanup failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Sets up an isolated test environment with database connection and mock server
 */
export async function setupTestEnvironment(config: TestConfig): Promise<TestEnvironment> {
  // Initialize database connection pool
  const dbPool = new Pool(config.dbConfig);
  
  // Clean database before setup
  await cleanDatabase(dbPool);
  
  // Initialize mock server
  const mockServer = createMockServer(config.mockServerPort, {
    simulatedLatency: config.simulatedLatency,
    enableLogging: false,
    defaultErrorRate: 0
  });
  
  // Return environment with cleanup function
  return {
    dbPool,
    mockServer,
    cleanup: async () => {
      await cleanDatabase(dbPool);
      await dbPool.end();
      mockServer.clearMockResponses();
    }
  };
}

/**
 * Creates a test campaign with platform-specific configurations
 */
export async function createTestCampaign(
  userId: string,
  platform: PlatformType,
  config: Partial<ICampaign> = {}
): Promise<ICampaign> {
  const defaultCampaign: ICampaign = {
    id: `test-campaign-${Date.now()}`,
    userId,
    name: `Test Campaign ${Date.now()}`,
    platform,
    status: CampaignStatus.DRAFT,
    budget: {
      amount: 1000,
      currency: 'USD',
      period: 'DAILY',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    },
    targeting: {
      locations: [{
        id: 'us-1',
        country: 'United States',
        region: 'California'
      }],
      industries: ['Technology'],
      companySize: ['11-50'],
      jobTitles: ['Marketing Manager'],
      interests: ['Digital Marketing'],
      platformSpecific: {
        linkedin: platform === PlatformType.LINKEDIN ? {
          skills: ['Digital Marketing'],
          groups: [],
          schools: [],
          degrees: [],
          fieldOfStudy: []
        } : undefined,
        google: platform === PlatformType.GOOGLE ? {
          keywords: ['digital marketing'],
          topics: [],
          placements: [],
          audiences: []
        } : undefined
      }
    },
    adGroups: [],
    performanceTargets: [],
    aiOptimization: {
      enabled: true,
      optimizationGoals: [],
      autoOptimize: true,
      minBudgetAdjustment: -20,
      maxBudgetAdjustment: 50,
      optimizationFrequency: 24
    },
    platformConfig: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...config
  };

  return defaultCampaign;
}

/**
 * Advanced factory class for generating comprehensive test datasets
 */
export class TestDataFactory {
  private dbPool: Pool;
  private mockServer: ReturnType<typeof createMockServer>;

  constructor(
    dbPool: Pool,
    mockServer: ReturnType<typeof createMockServer>
  ) {
    this.dbPool = dbPool;
    this.mockServer = mockServer;
  }

  /**
   * Creates a complete test dataset with proper relationships
   */
  async createTestData(userId: string = TEST_USER.id): Promise<{
    user: IUser;
    campaigns: ICampaign[];
  }> {
    const client = await this.dbPool.connect();
    
    try {
      await client.query('BEGIN');

      // Create test user
      const user: IUser = {
        ...TEST_USER,
        id: userId
      };

      // Create test campaigns for both platforms
      const campaigns = await Promise.all([
        createTestCampaign(userId, PlatformType.LINKEDIN),
        createTestCampaign(userId, PlatformType.GOOGLE)
      ]);

      await client.query('COMMIT');

      return { user, campaigns };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}