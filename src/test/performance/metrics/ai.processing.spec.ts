import { jest } from '@jest/globals';
import now from 'performance-now';
import pidusage from 'pidusage';
import { OpenAIService } from '../../backend/ai-service/src/services/openai_service';
import { CampaignGenerator } from '../../backend/ai-service/src/models/campaign_generator';
import { setupTestEnvironment, TestDataFactory } from '../../utils/test.helpers';
import { PlatformType, CampaignObjective } from '../../backend/shared/types/campaign.types';

// Resource metrics interface
interface ResourceMetrics {
  cpu: number;      // CPU usage percentage
  memory: number;   // Memory usage in bytes
  elapsed: number;  // Elapsed time in milliseconds
  timestamp: number;
}

// Performance thresholds based on technical requirements
const PERFORMANCE_THRESHOLDS = {
  CAMPAIGN_GENERATION: 5000,  // 5s maximum response time
  CREATIVE_GENERATION: 3000,  // 3s maximum response time
  CPU_THRESHOLD: 80,         // 80% CPU threshold
  MEMORY_THRESHOLD: 1024 * 1024 * 1024  // 1GB memory threshold
};

/**
 * Utility function to measure processing time and resource utilization
 */
async function measureProcessingTime<T>(
  fn: (...args: any[]) => Promise<T>,
  ...args: any[]
): Promise<{ result: T; duration: number; metrics: ResourceMetrics }> {
  const startTime = now();
  const startMetrics = await pidusage(process.pid);

  const result = await fn(...args);

  const endTime = now();
  const endMetrics = await pidusage(process.pid);

  return {
    result,
    duration: endTime - startTime,
    metrics: {
      cpu: endMetrics.cpu - startMetrics.cpu,
      memory: endMetrics.memory,
      elapsed: endTime - startTime,
      timestamp: Date.now()
    }
  };
}

/**
 * Monitor resource utilization during test execution
 */
async function monitorResourceUsage(pid: number): Promise<ResourceMetrics[]> {
  const metrics: ResourceMetrics[] = [];
  const interval = 100; // Sample every 100ms
  let running = true;

  while (running) {
    const usage = await pidusage(pid);
    metrics.push({
      cpu: usage.cpu,
      memory: usage.memory,
      elapsed: now(),
      timestamp: Date.now()
    });
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  return metrics;
}

describe('AI Processing Performance Tests', () => {
  let openAIService: OpenAIService;
  let campaignGenerator: CampaignGenerator;
  let testDataFactory: TestDataFactory;
  let resourceMonitor: NodeJS.Timeout;
  let metrics: ResourceMetrics[] = [];

  beforeAll(async () => {
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

    openAIService = new OpenAIService({
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL_VERSION: 'gpt-4',
      MAX_TOKENS: 2048,
      TEMPERATURE: 0.7
    });

    campaignGenerator = new CampaignGenerator(
      testEnv.mockServer,
      openAIService,
      { enableLogging: false }
    );

    testDataFactory = new TestDataFactory(testEnv.dbPool, testEnv.mockServer);
  });

  beforeEach(() => {
    metrics = [];
    resourceMonitor = setInterval(async () => {
      const usage = await pidusage(process.pid);
      metrics.push({
        cpu: usage.cpu,
        memory: usage.memory,
        elapsed: now(),
        timestamp: Date.now()
      });
    }, 100);
  });

  afterEach(() => {
    clearInterval(resourceMonitor);
  });

  describe('Campaign Generation Performance', () => {
    it('should generate campaign structure within 5 second threshold', async () => {
      const testCampaign = {
        platform: PlatformType.LINKEDIN,
        objective: CampaignObjective.LEAD_GENERATION,
        target_audience: {
          industries: ['Technology'],
          company_size: ['11-50'],
          job_titles: ['Marketing Manager']
        },
        budget: 1000,
        industry: 'Technology'
      };

      const { duration, metrics } = await measureProcessingTime(
        async () => await campaignGenerator.generate_campaign(testCampaign, PlatformType.LINKEDIN)
      );

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CAMPAIGN_GENERATION);
      expect(metrics.cpu).toBeLessThan(PERFORMANCE_THRESHOLDS.CPU_THRESHOLD);
      expect(metrics.memory).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_THRESHOLD);
    });

    it('should maintain performance under concurrent campaign generation load', async () => {
      const concurrentRequests = 5;
      const testCampaign = {
        platform: PlatformType.LINKEDIN,
        objective: CampaignObjective.LEAD_GENERATION,
        target_audience: {
          industries: ['Technology'],
          company_size: ['11-50']
        },
        budget: 1000,
        industry: 'Technology'
      };

      const requests = Array(concurrentRequests).fill(testCampaign);
      const startTime = now();

      const results = await Promise.all(
        requests.map(campaign => 
          measureProcessingTime(
            async () => await campaignGenerator.generate_campaign(campaign, PlatformType.LINKEDIN)
          )
        )
      );

      const totalDuration = now() - startTime;
      const avgDuration = results.reduce((sum, { duration }) => sum + duration, 0) / concurrentRequests;

      expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.CAMPAIGN_GENERATION);
      expect(Math.max(...results.map(r => r.metrics.cpu))).toBeLessThan(PERFORMANCE_THRESHOLDS.CPU_THRESHOLD);
    });
  });

  describe('Creative Generation Performance', () => {
    it('should generate ad creative within 3 second threshold', async () => {
      const testCreative = {
        objective: CampaignObjective.LEAD_GENERATION,
        audience: {
          industries: ['Technology'],
          job_titles: ['Marketing Manager']
        },
        platform: PlatformType.LINKEDIN,
        brand_guidelines: {
          tone: 'Professional',
          keywords: ['Innovation', 'Technology']
        },
        creative_type: 'IMAGE'
      };

      const { duration, metrics } = await measureProcessingTime(
        async () => await openAIService.generate_ad_creative(testCreative)
      );

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CREATIVE_GENERATION);
      expect(metrics.cpu).toBeLessThan(PERFORMANCE_THRESHOLDS.CPU_THRESHOLD);
      expect(metrics.memory).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_THRESHOLD);
    });

    it('should maintain performance under concurrent creative generation load', async () => {
      const concurrentRequests = 3;
      const testCreative = {
        objective: CampaignObjective.LEAD_GENERATION,
        audience: {
          industries: ['Technology'],
          job_titles: ['Marketing Manager']
        },
        platform: PlatformType.LINKEDIN,
        brand_guidelines: {
          tone: 'Professional',
          keywords: ['Innovation']
        },
        creative_type: 'IMAGE'
      };

      const requests = Array(concurrentRequests).fill(testCreative);
      const startTime = now();

      const results = await Promise.all(
        requests.map(creative => 
          measureProcessingTime(
            async () => await openAIService.generate_ad_creative(creative)
          )
        )
      );

      const totalDuration = now() - startTime;
      const avgDuration = results.reduce((sum, { duration }) => sum + duration, 0) / concurrentRequests;

      expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.CREATIVE_GENERATION);
      expect(Math.max(...results.map(r => r.metrics.cpu))).toBeLessThan(PERFORMANCE_THRESHOLDS.CPU_THRESHOLD);
    });
  });

  describe('Resource Utilization', () => {
    it('should maintain stable memory usage during extended processing', async () => {
      const testDuration = 30000; // 30 seconds
      const startMemory = process.memoryUsage().heapUsed;
      const startTime = now();

      while (now() - startTime < testDuration) {
        await campaignGenerator.generate_campaign({
          platform: PlatformType.LINKEDIN,
          objective: CampaignObjective.LEAD_GENERATION,
          target_audience: {
            industries: ['Technology']
          },
          budget: 1000,
          industry: 'Technology'
        }, PlatformType.LINKEDIN);
      }

      const endMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = endMemory - startMemory;

      expect(memoryGrowth).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_THRESHOLD);
    });
  });
});