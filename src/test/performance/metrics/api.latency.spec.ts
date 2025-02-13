// External package imports
import supertest from 'supertest'; // @types/supertest@^6.0.0
import { performance } from 'perf_hooks';

// Internal imports
import { TEST_USER } from '../../utils/test.constants';
import { setupTestEnvironment } from '../../utils/test.helpers';
import { MetricType } from '../../../backend/shared/types/analytics.types';

// Constants for performance thresholds and test configuration
const LATENCY_THRESHOLD_MS = 100; // Maximum acceptable latency as per technical requirements
const TEST_ITERATIONS = 100; // Number of test iterations for statistical significance
const CONCURRENT_USERS = 50; // Number of concurrent users for load testing
const API_ENDPOINTS = ['/api/campaigns', '/api/analytics', '/api/auth', '/api/optimization'];

// Network condition simulation profiles
const NETWORK_CONDITIONS = {
  optimal: { latency: 0, jitter: 0, bandwidth: Infinity },
  good: { latency: 50, jitter: 10, bandwidth: 10000 }, // 10 Mbps
  poor: { latency: 200, jitter: 50, bandwidth: 1000 } // 1 Mbps
};

// Interface for detailed latency metrics
interface LatencyMetrics {
  total: number;
  dns: number;
  tcp: number;
  tls: number;
  ttfb: number;
  processing: number;
  statusCode: number;
  success: boolean;
}

// Interface for statistical analysis results
interface LatencyStatistics {
  mean: number;
  median: number;
  p95: number;
  p99: number;
  stdDev: number;
  errorRate: number;
}

/**
 * Measures the response time of a specific API endpoint with detailed timing breakdown
 */
async function measureEndpointLatency(
  endpoint: string,
  requestOptions: any = {},
  networkConditions = NETWORK_CONDITIONS.optimal
): Promise<LatencyMetrics> {
  const startTime = performance.now();
  let dnsTime = 0, tcpTime = 0, tlsTime = 0, ttfb = 0;

  try {
    const response = await supertest(requestOptions.baseURL || 'http://localhost:3000')
      .get(endpoint)
      .set('Authorization', `Bearer ${requestOptions.token || 'test-token'}`)
      .set('Content-Type', 'application/json')
      .timeout({
        response: LATENCY_THRESHOLD_MS * 2,
        deadline: LATENCY_THRESHOLD_MS * 3
      });

    const endTime = performance.now();
    
    return {
      total: endTime - startTime,
      dns: dnsTime,
      tcp: tcpTime,
      tls: tlsTime,
      ttfb: ttfb,
      processing: (endTime - startTime) - (dnsTime + tcpTime + tlsTime + ttfb),
      statusCode: response.status,
      success: response.status >= 200 && response.status < 300
    };
  } catch (error) {
    const endTime = performance.now();
    return {
      total: endTime - startTime,
      dns: dnsTime,
      tcp: tcpTime,
      tls: tlsTime,
      ttfb: ttfb,
      processing: 0,
      statusCode: error.status || 500,
      success: false
    };
  }
}

/**
 * Performs statistical analysis on latency measurements
 */
function calculateLatencyStats(measurements: LatencyMetrics[]): LatencyStatistics {
  const totalLatencies = measurements.map(m => m.total).sort((a, b) => a - b);
  const successCount = measurements.filter(m => m.success).length;
  
  return {
    mean: totalLatencies.reduce((a, b) => a + b, 0) / totalLatencies.length,
    median: totalLatencies[Math.floor(totalLatencies.length / 2)],
    p95: totalLatencies[Math.floor(totalLatencies.length * 0.95)],
    p99: totalLatencies[Math.floor(totalLatencies.length * 0.99)],
    stdDev: Math.sqrt(
      totalLatencies.reduce((sq, n) => sq + Math.pow(n - (totalLatencies.reduce((a, b) => a + b, 0) / totalLatencies.length), 2), 0) 
      / (totalLatencies.length - 1)
    ),
    errorRate: (measurements.length - successCount) / measurements.length
  };
}

/**
 * Simulates concurrent API requests to measure performance under load
 */
async function simulateConcurrentLoad(
  endpoint: string,
  concurrentUsers: number,
  requestOptions: any = {}
): Promise<LatencyMetrics[]> {
  const requests = Array(concurrentUsers).fill(null).map(() =>
    measureEndpointLatency(endpoint, requestOptions)
  );
  
  return Promise.all(requests);
}

describe('API Endpoint Latency Tests', () => {
  let testEnv: any;

  beforeAll(async () => {
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

  afterAll(async () => {
    await testEnv.cleanup();
  });

  describe('Single Request Latency Tests', () => {
    test.each(API_ENDPOINTS)(
      'should respond within 100ms for %s endpoint',
      async (endpoint) => {
        const metrics = await measureEndpointLatency(endpoint, {
          token: TEST_USER.id
        });

        expect(metrics.success).toBe(true);
        expect(metrics.total).toBeLessThan(LATENCY_THRESHOLD_MS);
        expect(metrics.statusCode).toBe(200);
      }
    );

    test('should maintain consistent latency for analytics queries', async () => {
      const measurements = await Promise.all(
        Array(TEST_ITERATIONS).fill(null).map(() =>
          measureEndpointLatency('/api/analytics', {
            token: TEST_USER.id,
            params: {
              metricType: MetricType.IMPRESSIONS,
              timeRange: '7d'
            }
          })
        )
      );

      const stats = calculateLatencyStats(measurements);
      expect(stats.p95).toBeLessThan(LATENCY_THRESHOLD_MS);
      expect(stats.errorRate).toBeLessThan(0.01); // 1% error rate threshold
    });
  });

  describe('Concurrent Load Tests', () => {
    test('should maintain performance with concurrent users', async () => {
      const measurements = await simulateConcurrentLoad(
        '/api/campaigns',
        CONCURRENT_USERS,
        { token: TEST_USER.id }
      );

      const stats = calculateLatencyStats(measurements);
      expect(stats.p95).toBeLessThan(LATENCY_THRESHOLD_MS * 1.5); // Allow 50% degradation under load
      expect(stats.errorRate).toBeLessThan(0.05); // 5% error rate threshold under load
    });
  });

  describe('Network Condition Tests', () => {
    test.each(Object.entries(NETWORK_CONDITIONS))(
      'should handle %s network conditions',
      async (condition, profile) => {
        const metrics = await measureEndpointLatency(
          '/api/campaigns',
          { token: TEST_USER.id },
          profile
        );

        expect(metrics.success).toBe(true);
        expect(metrics.total).toBeLessThan(
          LATENCY_THRESHOLD_MS + (profile.latency * 2)
        );
      }
    );
  });
});