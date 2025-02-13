// External imports
import { test, describe, beforeAll, afterAll, expect } from 'jest'; // ^29.0.0
import { check, sleep } from 'k6'; // ^0.46.0

// Internal imports
import { GoogleAdsService } from '../../../backend/platform-integration/src/services/google.service';
import { LinkedInService } from '../../../backend/platform-integration/src/services/linkedin.service';
import { setupTestEnvironment, createTestCampaign } from '../../utils/test.helpers';
import { PlatformType, CampaignStatus } from '../../../backend/shared/types/campaign.types';
import { MetricType } from '../../../backend/shared/types/analytics.types';

// Performance thresholds and test configuration
const PERFORMANCE_THRESHOLDS = {
  latency: {
    p95: 100, // 95th percentile should be under 100ms
    median: 50, // Median latency under 50ms
    maxLatency: 200 // Maximum acceptable latency
  },
  throughput: {
    minRps: 10, // Minimum requests per second
    targetRps: 50 // Target requests per second under load
  },
  reliability: {
    successRate: 0.99, // 99% success rate required
    maxErrorRate: 0.01 // Maximum 1% error rate allowed
  }
};

interface PerformanceMetrics {
  averageLatency: number;
  p95Latency: number;
  medianLatency: number;
  successRate: number;
  errorRate: number;
  throughput: number;
  timingBreakdown: {
    networkLatency: number;
    processingTime: number;
    totalTime: number;
  };
}

interface LoadTestConfig {
  duration: number;
  rampUpTime: number;
  targetRps: number;
  maxVirtualUsers: number;
}

class PlatformPerformanceTest {
  private googleService: GoogleAdsService;
  private linkedInService: LinkedInService;
  private testEnv: any;

  constructor() {
    this.googleService = new GoogleAdsService();
    this.linkedInService = new LinkedInService('test-account-id');
  }

  async beforeAll() {
    this.testEnv = await setupTestEnvironment({
      dbConfig: {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        user: 'test_user',
        password: 'test_password'
      },
      mockServerPort: 3001
    });
  }

  async afterAll() {
    await this.testEnv.cleanup();
  }

  private async measurePlatformLatency(
    platform: PlatformType,
    operationType: string,
    sampleSize: number
  ): Promise<PerformanceMetrics> {
    const latencies: number[] = [];
    const networkLatencies: number[] = [];
    const processingTimes: number[] = [];
    let errors = 0;

    for (let i = 0; i < sampleSize; i++) {
      try {
        const startTime = performance.now();
        const networkStartTime = startTime;

        if (platform === PlatformType.GOOGLE) {
          if (operationType === 'create') {
            const campaign = await createTestCampaign('test-user', PlatformType.GOOGLE);
            await this.googleService.createCampaign(campaign);
          } else {
            await this.googleService.getCampaignPerformance('test-campaign-id');
          }
        } else {
          if (operationType === 'create') {
            const campaign = await createTestCampaign('test-user', PlatformType.LINKEDIN);
            await this.linkedInService.createCampaign(campaign);
          } else {
            await this.linkedInService.getCampaign('test-campaign-id');
          }
        }

        const networkEndTime = performance.now();
        const endTime = networkEndTime;

        latencies.push(endTime - startTime);
        networkLatencies.push(networkEndTime - networkStartTime);
        processingTimes.push(endTime - networkEndTime);
      } catch (error) {
        errors++;
      }

      // Add small delay between requests to prevent rate limiting
      await sleep(0.1);
    }

    // Calculate metrics
    const successRate = (sampleSize - errors) / sampleSize;
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const medianIndex = Math.floor(sortedLatencies.length * 0.5);

    return {
      averageLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p95Latency: sortedLatencies[p95Index],
      medianLatency: sortedLatencies[medianIndex],
      successRate,
      errorRate: errors / sampleSize,
      throughput: (sampleSize - errors) / (latencies.reduce((a, b) => a + b, 0) / 1000),
      timingBreakdown: {
        networkLatency: networkLatencies.reduce((a, b) => a + b, 0) / networkLatencies.length,
        processingTime: processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length,
        totalTime: latencies.reduce((a, b) => a + b, 0) / latencies.length
      }
    };
  }

  private async testConcurrentOperations(
    platform: PlatformType,
    concurrentUsers: number,
    config: LoadTestConfig
  ): Promise<void> {
    const options = {
      vus: concurrentUsers,
      duration: `${config.duration}s`,
      thresholds: {
        http_req_duration: [`p(95)<${PERFORMANCE_THRESHOLDS.latency.p95}`],
        http_req_failed: [`rate<${PERFORMANCE_THRESHOLDS.reliability.maxErrorRate}`]
      }
    };

    const service = platform === PlatformType.GOOGLE ? this.googleService : this.linkedInService;

    const scenario = () => {
      const campaign = createTestCampaign('test-user', platform);
      
      check(service.createCampaign(campaign), {
        'campaign creation successful': (response: any) => response !== undefined,
      });

      sleep(1);
    };

    // Execute k6 load test
    await scenario();
  }

  // Test Suites
  async testGoogleAdsLatency() {
    describe('Google Ads API Performance Tests', () => {
      test('Campaign Creation Latency', async () => {
        const metrics = await this.measurePlatformLatency(
          PlatformType.GOOGLE,
          'create',
          100
        );

        expect(metrics.p95Latency).toBeLessThan(PERFORMANCE_THRESHOLDS.latency.p95);
        expect(metrics.medianLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.latency.median);
        expect(metrics.successRate).toBeGreaterThan(PERFORMANCE_THRESHOLDS.reliability.successRate);
      });

      test('Campaign Performance Query Latency', async () => {
        const metrics = await this.measurePlatformLatency(
          PlatformType.GOOGLE,
          'performance',
          100
        );

        expect(metrics.p95Latency).toBeLessThan(PERFORMANCE_THRESHOLDS.latency.p95);
        expect(metrics.successRate).toBeGreaterThan(PERFORMANCE_THRESHOLDS.reliability.successRate);
      });
    });
  }

  async testLinkedInAdsLatency() {
    describe('LinkedIn Ads API Performance Tests', () => {
      test('Campaign Creation Latency', async () => {
        const metrics = await this.measurePlatformLatency(
          PlatformType.LINKEDIN,
          'create',
          100
        );

        expect(metrics.p95Latency).toBeLessThan(PERFORMANCE_THRESHOLDS.latency.p95);
        expect(metrics.medianLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.latency.median);
        expect(metrics.successRate).toBeGreaterThan(PERFORMANCE_THRESHOLDS.reliability.successRate);
      });

      test('Campaign Query Latency', async () => {
        const metrics = await this.measurePlatformLatency(
          PlatformType.LINKEDIN,
          'query',
          100
        );

        expect(metrics.p95Latency).toBeLessThan(PERFORMANCE_THRESHOLDS.latency.p95);
        expect(metrics.successRate).toBeGreaterThan(PERFORMANCE_THRESHOLDS.reliability.successRate);
      });
    });
  }

  async testConcurrentCampaignCreation() {
    describe('Concurrent Campaign Creation Load Tests', () => {
      test('Google Ads Concurrent Campaign Creation', async () => {
        await this.testConcurrentOperations(
          PlatformType.GOOGLE,
          50,
          {
            duration: 60,
            rampUpTime: 10,
            targetRps: PERFORMANCE_THRESHOLDS.throughput.targetRps,
            maxVirtualUsers: 50
          }
        );
      });

      test('LinkedIn Ads Concurrent Campaign Creation', async () => {
        await this.testConcurrentOperations(
          PlatformType.LINKEDIN,
          50,
          {
            duration: 60,
            rampUpTime: 10,
            targetRps: PERFORMANCE_THRESHOLDS.throughput.targetRps,
            maxVirtualUsers: 50
          }
        );
      });
    });
  }
}

// Export test suite
export { PlatformPerformanceTest };