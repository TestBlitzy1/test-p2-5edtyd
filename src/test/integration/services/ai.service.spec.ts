import { OpenAIService } from '../../backend/ai-service/src/services/openai_service';
import { PyTorchService } from '../../backend/ai-service/src/services/pytorch_service';
import { setupTestEnvironment, TestDataFactory } from '../../utils/test.helpers';
import { PlatformType, CampaignObjective } from '../../../backend/shared/types/campaign.types';
import { MetricType } from '../../../backend/shared/types/analytics.types';

describe('AI Service Integration Tests', () => {
  let openAIService: OpenAIService;
  let pytorchService: PyTorchService;
  let testDataFactory: TestDataFactory;

  // Test environment configuration
  const testConfig = {
    openai: {
      timeout: 30000,
      maxRetries: 3,
      rateLimit: { tokensPerMin: 90000 }
    },
    pytorch: {
      gpuEnabled: true,
      batchSize: 32,
      modelVersion: '2.0.0'
    }
  };

  beforeAll(async () => {
    // Initialize test environment with GPU support
    const env = await setupTestEnvironment({
      dbConfig: {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        user: 'test_user',
        password: 'test_password'
      },
      mockServerPort: 3001
    });

    // Initialize services with test configuration
    openAIService = new OpenAIService({
      OPENAI_API_KEY: process.env.TEST_OPENAI_API_KEY!,
      OPENAI_MODEL_VERSION: 'gpt-4',
      MAX_TOKENS: 2048,
      TEMPERATURE: 0.7,
      REQUEST_TIMEOUT_MS: testConfig.openai.timeout
    });

    pytorchService = new PyTorchService({
      gpuEnabled: testConfig.pytorch.gpuEnabled,
      batchSize: testConfig.pytorch.batchSize,
      modelVersion: testConfig.pytorch.modelVersion
    });

    testDataFactory = new TestDataFactory(env.dbPool, env.mockServer);
  });

  afterAll(async () => {
    // Cleanup resources and GPU memory
    await pytorchService.clear_cache();
    await openAIService.close();
    await testDataFactory.cleanupTestData();
  });

  describe('OpenAI Service Integration Tests', () => {
    it('should generate campaign structure with platform-specific optimizations', async () => {
      const campaignParams = {
        platform: PlatformType.LINKEDIN,
        objective: CampaignObjective.LEAD_GENERATION,
        target_audience: {
          industries: ['Technology'],
          jobTitles: ['Marketing Manager'],
          companySize: ['11-50']
        },
        budget: {
          amount: 1000,
          currency: 'USD',
          period: 'DAILY'
        },
        industry: 'Technology',
        metrics: [MetricType.CTR, MetricType.CONVERSIONS]
      };

      const result = await openAIService.generate_campaign_structure(campaignParams);

      // Validate campaign structure
      expect(result).toBeDefined();
      expect(result.campaign_name).toBeDefined();
      expect(result.ad_groups).toBeInstanceOf(Array);
      expect(result.targeting).toBeDefined();
      expect(result.budget).toBeDefined();

      // Validate LinkedIn-specific optimizations
      expect(result.targeting.platformSpecific.linkedin).toBeDefined();
      expect(result.targeting.platformSpecific.linkedin.skills).toBeInstanceOf(Array);
    });

    it('should generate optimized ad creative with performance insights', async () => {
      const creativeParams = {
        objective: CampaignObjective.LEAD_GENERATION,
        audience: {
          industries: ['Technology'],
          jobTitles: ['Marketing Manager']
        },
        platform: PlatformType.LINKEDIN,
        brand_guidelines: {
          tone: 'Professional',
          keywords: ['Innovation', 'Growth']
        },
        creative_type: 'IMAGE'
      };

      const performanceData = {
        historical_ctr: 2.5,
        conversion_rate: 3.2,
        best_performing_headlines: ['Drive Growth', 'Boost ROI']
      };

      const result = await openAIService.generate_ad_creative(creativeParams, performanceData);

      // Validate creative content
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].headline).toBeDefined();
      expect(result[0].ad_copy).toBeDefined();
      expect(result[0].call_to_action).toBeDefined();
    });
  });

  describe('PyTorch Service Integration Tests', () => {
    it('should predict campaign performance with GPU optimization', async () => {
      const campaignData = {
        text: 'Drive business growth with our AI-powered marketing solution',
        features: {
          industry: 'Technology',
          target_audience: 'Marketing Professionals',
          budget: 1000,
          platform: PlatformType.LINKEDIN
        }
      };

      const result = await pytorchService.predict('performance_predictor', campaignData, {
        model_path: 'models/performance_predictor.pt',
        model_type: 'CUSTOM',
        model_config: {
          input_shape: [1, 768]
        }
      });

      // Validate prediction results
      expect(result).toBeDefined();
      expect(result.prediction).toBeInstanceOf(Array);
      expect(result.model_name).toBe('performance_predictor');
      expect(result.inference_time).toBeLessThan(1000);
    });

    it('should perform optimized batch predictions with memory management', async () => {
      const batchData = Array.from({ length: 5 }, () => ({
        text: 'Drive business growth with our AI-powered marketing solution',
        features: {
          industry: 'Technology',
          target_audience: 'Marketing Professionals',
          budget: 1000,
          platform: PlatformType.LINKEDIN
        }
      }));

      const result = await pytorchService.batch_predict('performance_predictor', batchData, {
        model_path: 'models/performance_predictor.pt',
        model_type: 'CUSTOM',
        batch_size: testConfig.pytorch.batchSize
      });

      // Validate batch prediction results
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(batchData.length);
      result.forEach(prediction => {
        expect(prediction.prediction).toBeInstanceOf(Array);
      });
    });
  });
});