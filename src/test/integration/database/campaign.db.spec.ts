import { Pool } from 'pg';
import { cleanDatabase, setupTestEnvironment, TestDataFactory } from '../../utils/test.helpers';
import { Campaign } from '../../../backend/campaign-service/src/models/campaign.model';
import { 
    PlatformType, 
    CampaignStatus, 
    CampaignObjective,
    BudgetPeriod,
    CompanySizeRange 
} from '../../../backend/shared/types/campaign.types';
import { MetricType } from '../../../backend/shared/types/analytics.types';

describe('Campaign Database Integration Tests', () => {
    let dbPool: Pool;
    let dataFactory: TestDataFactory;
    let testTransaction: any;

    // Test constants
    const TEST_USER_ID = 'test-user-123';
    const TEST_TIMEOUT = 10000;

    beforeAll(async () => {
        // Initialize test environment
        const testEnv = await setupTestEnvironment({
            dbConfig: {
                host: 'localhost',
                port: 5432,
                database: 'test_db',
                user: 'test_user',
                password: 'test_password'
            },
            mockServerPort: 3001
        });
        dbPool = testEnv.dbPool;
        dataFactory = new TestDataFactory(dbPool, testEnv.mockServer);
    }, TEST_TIMEOUT);

    afterAll(async () => {
        await cleanDatabase(dbPool);
        await dbPool.end();
    });

    beforeEach(async () => {
        // Start a new transaction for test isolation
        testTransaction = await dbPool.connect();
        await testTransaction.query('BEGIN');
        await cleanDatabase(dbPool);
    });

    afterEach(async () => {
        await testTransaction.query('ROLLBACK');
        await testTransaction.release();
    });

    describe('Campaign Creation Tests', () => {
        it('should successfully create a LinkedIn campaign with valid data', async () => {
            // Arrange
            const linkedInCampaign = {
                userId: TEST_USER_ID,
                name: 'Test LinkedIn Campaign',
                platform: PlatformType.LINKEDIN,
                objective: CampaignObjective.LEAD_GENERATION,
                status: CampaignStatus.DRAFT,
                budget: {
                    amount: 1000,
                    currency: 'USD',
                    period: BudgetPeriod.DAILY,
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                },
                targeting: {
                    locations: [{
                        id: 'us-1',
                        country: 'United States',
                        region: 'California'
                    }],
                    industries: ['Technology'],
                    companySize: [CompanySizeRange.MEDIUM],
                    jobTitles: ['Marketing Manager'],
                    interests: ['Digital Marketing'],
                    platformSpecific: {
                        linkedin: {
                            skills: ['Digital Marketing'],
                            groups: [],
                            schools: [],
                            degrees: [],
                            fieldOfStudy: []
                        }
                    }
                },
                aiOptimization: {
                    enabled: true,
                    optimizationGoals: [MetricType.CTR, MetricType.CONVERSIONS],
                    autoOptimize: true,
                    minBudgetAdjustment: -20,
                    maxBudgetAdjustment: 50,
                    optimizationFrequency: 24
                }
            };

            // Act
            const campaign = await Campaign.create(linkedInCampaign);

            // Assert
            expect(campaign).toBeDefined();
            expect(campaign.id).toBeDefined();
            expect(campaign.platform).toBe(PlatformType.LINKEDIN);
            expect(campaign.status).toBe(CampaignStatus.DRAFT);
            expect(campaign.aiOptimization.enabled).toBe(true);
        });

        it('should successfully create a Google Ads campaign with valid data', async () => {
            // Arrange
            const googleCampaign = {
                userId: TEST_USER_ID,
                name: 'Test Google Campaign',
                platform: PlatformType.GOOGLE,
                objective: CampaignObjective.WEBSITE_TRAFFIC,
                status: CampaignStatus.DRAFT,
                budget: {
                    amount: 500,
                    currency: 'USD',
                    period: BudgetPeriod.DAILY,
                    startDate: new Date()
                },
                targeting: {
                    locations: [{
                        id: 'us-1',
                        country: 'United States'
                    }],
                    industries: ['Technology'],
                    companySize: [],
                    jobTitles: [],
                    interests: ['Digital Marketing'],
                    platformSpecific: {
                        google: {
                            keywords: ['digital marketing'],
                            topics: [],
                            placements: [],
                            audiences: []
                        }
                    }
                },
                platformConfig: {
                    google: {
                        networkSettings: {
                            searchNetwork: true,
                            displayNetwork: false,
                            partnerNetwork: false
                        },
                        deliveryMethod: 'STANDARD'
                    }
                }
            };

            // Act
            const campaign = await Campaign.create(googleCampaign);

            // Assert
            expect(campaign).toBeDefined();
            expect(campaign.id).toBeDefined();
            expect(campaign.platform).toBe(PlatformType.GOOGLE);
            expect(campaign.platformConfig.google).toBeDefined();
        });
    });

    describe('Campaign Optimization Tests', () => {
        it('should successfully apply AI optimizations to campaign', async () => {
            // Arrange
            const campaign = await Campaign.create({
                userId: TEST_USER_ID,
                name: 'Optimization Test Campaign',
                platform: PlatformType.LINKEDIN,
                objective: CampaignObjective.LEAD_GENERATION,
                status: CampaignStatus.ACTIVE,
                budget: {
                    amount: 1000,
                    currency: 'USD',
                    period: BudgetPeriod.DAILY,
                    startDate: new Date()
                },
                targeting: {
                    locations: [{
                        id: 'us-1',
                        country: 'United States'
                    }],
                    industries: ['Technology'],
                    companySize: [CompanySizeRange.MEDIUM],
                    jobTitles: ['Marketing Manager'],
                    interests: ['Digital Marketing'],
                    platformSpecific: {
                        linkedin: {
                            skills: ['Digital Marketing'],
                            groups: [],
                            schools: []
                        }
                    }
                }
            });

            // Act
            const optimizationResult = await campaign.optimizeWithAI({
                optimizationGoals: [MetricType.CTR, MetricType.CONVERSIONS],
                autoOptimize: true
            });

            // Assert
            expect(optimizationResult.success).toBe(true);
            expect(optimizationResult.recommendations).toBeDefined();
            expect(optimizationResult.confidence).toBeGreaterThan(0);
            expect(campaign.lastOptimizedAt).toBeDefined();
        });
    });

    describe('Campaign Budget Management Tests', () => {
        it('should enforce budget constraints and validations', async () => {
            // Arrange
            const invalidBudget = {
                amount: 5, // Below minimum
                currency: 'USD',
                period: BudgetPeriod.DAILY,
                startDate: new Date()
            };

            // Act & Assert
            await expect(Campaign.create({
                userId: TEST_USER_ID,
                name: 'Invalid Budget Campaign',
                platform: PlatformType.LINKEDIN,
                budget: invalidBudget,
                targeting: {
                    locations: [],
                    industries: [],
                    companySize: [],
                    jobTitles: [],
                    interests: [],
                    platformSpecific: {}
                }
            })).rejects.toThrow();
        });
    });

    describe('Concurrent Operation Tests', () => {
        it('should handle concurrent campaign updates correctly', async () => {
            // Arrange
            const campaign = await Campaign.create({
                userId: TEST_USER_ID,
                name: 'Concurrency Test Campaign',
                platform: PlatformType.LINKEDIN,
                status: CampaignStatus.DRAFT,
                budget: {
                    amount: 1000,
                    currency: 'USD',
                    period: BudgetPeriod.DAILY,
                    startDate: new Date()
                },
                targeting: {
                    locations: [{
                        id: 'us-1',
                        country: 'United States'
                    }],
                    industries: ['Technology'],
                    companySize: [CompanySizeRange.MEDIUM],
                    jobTitles: [],
                    interests: [],
                    platformSpecific: {
                        linkedin: {
                            skills: [],
                            groups: [],
                            schools: []
                        }
                    }
                }
            });

            // Act
            const updatePromises = [
                campaign.update({ name: 'Updated Name 1' }),
                campaign.update({ name: 'Updated Name 2' })
            ];

            // Assert
            await expect(Promise.all(updatePromises)).rejects.toThrow();
        });
    });
});