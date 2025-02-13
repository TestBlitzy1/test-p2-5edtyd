import { Campaign } from '../../../backend/campaign-service/src/models/campaign.model';
import { 
  generateMockCampaign, 
  DEFAULT_CAMPAIGN_FIXTURES 
} from '../../fixtures/campaign.fixture';
import { setupTestEnvironment } from '../../utils/test.helpers';
import { 
  PlatformType, 
  CampaignStatus, 
  CampaignObjective,
  MetricType 
} from '../../../backend/shared/types/campaign.types';

describe('Campaign Model', () => {
  let testEnv: any;

  beforeEach(async () => {
    testEnv = await setupTestEnvironment({
      dbConfig: {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        user: 'test_user',
        password: 'test_password'
      },
      mockServerPort: 3001
    });
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  describe('Campaign Creation', () => {
    it('should create a valid LinkedIn campaign with AI optimization', async () => {
      const mockCampaign = generateMockCampaign({
        platform: PlatformType.LINKEDIN,
        objective: CampaignObjective.LEAD_GENERATION
      });

      const campaign = await Campaign.create(mockCampaign);

      expect(campaign).toBeDefined();
      expect(campaign.id).toBeDefined();
      expect(campaign.platform).toBe(PlatformType.LINKEDIN);
      expect(campaign.status).toBe(CampaignStatus.DRAFT);
      expect(campaign.aiOptimization.enabled).toBe(true);
      expect(campaign.createdAt).toBeInstanceOf(Date);
      expect(Date.now() - campaign.createdAt.getTime()).toBeLessThan(300000); // 5 minutes
    });

    it('should create a valid Google Ads campaign with AI optimization', async () => {
      const mockCampaign = generateMockCampaign({
        platform: PlatformType.GOOGLE,
        objective: CampaignObjective.CONVERSIONS
      });

      const campaign = await Campaign.create(mockCampaign);

      expect(campaign).toBeDefined();
      expect(campaign.platform).toBe(PlatformType.GOOGLE);
      expect(campaign.platformConfig.google).toBeDefined();
      expect(campaign.platformConfig.google.networkSettings).toBeDefined();
    });

    it('should reject campaign creation with invalid data', async () => {
      const invalidCampaign = DEFAULT_CAMPAIGN_FIXTURES.INVALID_CAMPAIGN;

      await expect(Campaign.create(invalidCampaign))
        .rejects
        .toThrow('Campaign validation failed');
    });
  });

  describe('Campaign Validation', () => {
    it('should validate LinkedIn campaign targeting requirements', async () => {
      const campaign = new Campaign(DEFAULT_CAMPAIGN_FIXTURES.LINKEDIN_CAMPAIGN);
      const validationResult = await campaign.validateAndOptimize();

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
    });

    it('should validate Google Ads campaign budget constraints', async () => {
      const campaign = new Campaign(DEFAULT_CAMPAIGN_FIXTURES.GOOGLE_CAMPAIGN);
      const validationResult = await campaign.validateAndOptimize();

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
    });

    it('should reject invalid targeting configuration', async () => {
      const invalidCampaign = generateMockCampaign({
        targeting: {
          ...DEFAULT_CAMPAIGN_FIXTURES.LINKEDIN_CAMPAIGN.targeting,
          locations: [] // Invalid: empty locations
        }
      });

      const campaign = new Campaign(invalidCampaign);
      const validationResult = await campaign.validateAndOptimize();

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContain('Invalid targeting configuration');
    });
  });

  describe('Campaign Optimization', () => {
    it('should apply AI optimization recommendations', async () => {
      const campaign = new Campaign(DEFAULT_CAMPAIGN_FIXTURES.AI_OPTIMIZED_CAMPAIGN);
      const optimizationResult = await campaign.optimizeWithAI();

      expect(optimizationResult.success).toBe(true);
      expect(optimizationResult.recommendations).toBeDefined();
      expect(optimizationResult.confidence).toBeGreaterThan(0);
      expect(campaign.lastOptimizedAt).toBeInstanceOf(Date);
    });

    it('should respect optimization frequency constraints', async () => {
      const campaign = new Campaign(DEFAULT_CAMPAIGN_FIXTURES.LINKEDIN_CAMPAIGN);
      
      // First optimization
      await campaign.optimizeWithAI();
      const firstOptimization = campaign.lastOptimizedAt;

      // Attempt immediate re-optimization
      await campaign.optimizeWithAI();
      
      expect(campaign.lastOptimizedAt).toEqual(firstOptimization);
    });

    it('should optimize campaign budget within allowed range', async () => {
      const campaign = new Campaign(DEFAULT_CAMPAIGN_FIXTURES.LINKEDIN_CAMPAIGN);
      const originalBudget = campaign.budget.amount;

      await campaign.optimizeWithAI({
        minBudgetAdjustment: -20,
        maxBudgetAdjustment: 50
      });

      const newBudget = campaign.budget.amount;
      const adjustmentPercentage = ((newBudget - originalBudget) / originalBudget) * 100;

      expect(adjustmentPercentage).toBeGreaterThanOrEqual(-20);
      expect(adjustmentPercentage).toBeLessThanOrEqual(50);
    });
  });

  describe('Campaign State Management', () => {
    it('should handle valid state transitions', async () => {
      const campaign = new Campaign(DEFAULT_CAMPAIGN_FIXTURES.LINKEDIN_CAMPAIGN);
      
      expect(campaign.status).toBe(CampaignStatus.DRAFT);
      
      await campaign.validateAndOptimize();
      expect(campaign.status).toBe(CampaignStatus.PENDING_APPROVAL);
      
      await campaign.activate();
      expect(campaign.status).toBe(CampaignStatus.ACTIVE);
      
      await campaign.pause();
      expect(campaign.status).toBe(CampaignStatus.PAUSED);
    });

    it('should prevent invalid state transitions', async () => {
      const campaign = new Campaign({
        ...DEFAULT_CAMPAIGN_FIXTURES.LINKEDIN_CAMPAIGN,
        status: CampaignStatus.ARCHIVED
      });

      await expect(campaign.activate())
        .rejects
        .toThrow('Invalid state transition');
    });

    it('should maintain state consistency during concurrent operations', async () => {
      const campaign = new Campaign(DEFAULT_CAMPAIGN_FIXTURES.LINKEDIN_CAMPAIGN);
      
      const operations = [
        campaign.validateAndOptimize(),
        campaign.optimizeWithAI(),
        campaign.pause()
      ];

      await expect(Promise.all(operations)).resolves.toBeDefined();
      expect([CampaignStatus.PAUSED, CampaignStatus.PENDING_APPROVAL])
        .toContain(campaign.status);
    });
  });
});