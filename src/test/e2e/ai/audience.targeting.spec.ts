import { describe, beforeAll, afterAll, it, expect } from 'jest';
import supertest from 'supertest';
import { setupTestEnvironment, cleanDatabase, createTestUser } from '../../utils/test.helpers';
import { generateMockCampaign } from '../../fixtures/campaign.fixture';
import { 
  PlatformType, 
  CampaignStatus,
  CompanySizeRange,
  ITargeting 
} from '../../../backend/shared/types/campaign.types';
import { MetricType } from '../../../backend/shared/types/analytics.types';
import { UserRole } from '../../../backend/shared/types/auth.types';

describe('Audience Targeting E2E Tests', () => {
  let testEnv: any;
  let request: supertest.SuperTest<supertest.Test>;
  let testUser: any;
  let testCampaign: any;

  beforeAll(async () => {
    // Setup test environment with extended timeout for AI processing
    testEnv = await setupTestEnvironment({
      dbConfig: {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        user: 'test_user',
        password: 'test_password'
      },
      mockServerPort: 3001,
      simulatedLatency: 100
    });

    // Create test user with audience targeting permissions
    testUser = await createTestUser({
      role: UserRole.MANAGER,
      permissions: ['audience.targeting.read', 'audience.targeting.write']
    });

    // Generate test campaign with initial targeting
    testCampaign = generateMockCampaign({
      userId: testUser.id,
      platform: PlatformType.LINKEDIN,
      status: CampaignStatus.DRAFT
    });

    request = supertest(testEnv.mockServer.getApp());
  });

  afterAll(async () => {
    await cleanDatabase(testEnv.dbPool);
    await testEnv.cleanup();
  });

  describe('Audience Analysis Tests', () => {
    it('should analyze audience data and provide segmentation insights', async () => {
      const response = await request
        .post('/api/ai/audience/analyze')
        .send({
          campaignId: testCampaign.id,
          targeting: testCampaign.targeting
        })
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        segments: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            size: expect.any(Number),
            affinity: expect.any(Number),
            characteristics: expect.any(Array)
          })
        ]),
        insights: expect.arrayContaining([
          expect.objectContaining({
            type: expect.any(String),
            confidence: expect.any(Number),
            recommendation: expect.any(String)
          })
        ]),
        metrics: expect.objectContaining({
          potentialReach: expect.any(Number),
          estimatedEngagement: expect.any(Number),
          audienceQualityScore: expect.any(Number)
        })
      });
    });

    it('should validate audience targeting parameters', async () => {
      const invalidTargeting: ITargeting = {
        ...testCampaign.targeting,
        companySize: ['INVALID_SIZE'] as CompanySizeRange[],
      };

      await request
        .post('/api/ai/audience/analyze')
        .send({
          campaignId: testCampaign.id,
          targeting: invalidTargeting
        })
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(400)
        .expect(res => {
          expect(res.body.error).toContain('Invalid company size range');
        });
    });
  });

  describe('Lookalike Audience Tests', () => {
    it('should generate lookalike audiences based on successful segments', async () => {
      const response = await request
        .post('/api/ai/audience/lookalike')
        .send({
          campaignId: testCampaign.id,
          sourceAudience: testCampaign.targeting,
          platformType: PlatformType.LINKEDIN,
          similarityThreshold: 0.7
        })
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        lookalikes: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            targeting: expect.any(Object),
            similarityScore: expect.any(Number),
            estimatedReach: expect.any(Number),
            confidenceScore: expect.any(Number)
          })
        ]),
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            type: 'TARGETING_EXPANSION',
            value: expect.any(Object),
            impact: expect.any(Number)
          })
        ])
      });
    });
  });

  describe('Audience Optimization Tests', () => {
    it('should optimize audience targeting based on performance data', async () => {
      const response = await request
        .post('/api/ai/audience/optimize')
        .send({
          campaignId: testCampaign.id,
          targeting: testCampaign.targeting,
          performanceMetrics: {
            [MetricType.CTR]: 2.5,
            [MetricType.CONVERSIONS]: 100,
            [MetricType.ROAS]: 3.2
          },
          optimizationGoals: [
            {
              metric: MetricType.CTR,
              target: 3.0,
              priority: 1
            },
            {
              metric: MetricType.CONVERSIONS,
              target: 150,
              priority: 2
            }
          ]
        })
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        optimizedTargeting: expect.objectContaining({
          locations: expect.any(Array),
          industries: expect.any(Array),
          companySize: expect.any(Array),
          jobTitles: expect.any(Array)
        }),
        expectedImprovements: expect.objectContaining({
          [MetricType.CTR]: expect.any(Number),
          [MetricType.CONVERSIONS]: expect.any(Number)
        }),
        confidenceScore: expect.any(Number),
        reasoning: expect.any(Array)
      });
    });
  });

  describe('Multi-Platform Targeting Tests', () => {
    it('should translate targeting parameters across platforms', async () => {
      const response = await request
        .post('/api/ai/audience/translate')
        .send({
          sourceTargeting: testCampaign.targeting,
          sourcePlatform: PlatformType.LINKEDIN,
          targetPlatform: PlatformType.GOOGLE
        })
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        translatedTargeting: expect.objectContaining({
          locations: expect.any(Array),
          platformSpecific: expect.objectContaining({
            google: expect.objectContaining({
              keywords: expect.any(Array),
              topics: expect.any(Array),
              audiences: expect.any(Array)
            })
          })
        }),
        mappingConfidence: expect.any(Number),
        reachEstimates: expect.objectContaining({
          original: expect.any(Number),
          translated: expect.any(Number)
        })
      });
    });

    it('should validate platform-specific targeting requirements', async () => {
      const invalidPlatformTargeting = {
        ...testCampaign.targeting,
        platformSpecific: {
          google: {
            keywords: [] // Empty keywords not allowed for Google Ads
          }
        }
      };

      await request
        .post('/api/ai/audience/translate')
        .send({
          sourceTargeting: invalidPlatformTargeting,
          sourcePlatform: PlatformType.LINKEDIN,
          targetPlatform: PlatformType.GOOGLE
        })
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(400)
        .expect(res => {
          expect(res.body.error).toContain('Google Ads targeting requires at least one keyword');
        });
    });
  });
});