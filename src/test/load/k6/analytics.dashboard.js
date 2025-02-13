import http from 'k6/http';
import { check, sleep } from 'k6';
import { API_ENDPOINTS } from '../../../web/src/lib/constants';

// Base URL from environment
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// Load test configuration
export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 100 },  // Ramp up to 100 users
    { duration: '1m', target: 0 }     // Ramp down to 0
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'],  // 95% of requests should be below 500ms
    'http_req_failed': ['rate<0.01'],    // Less than 1% failure rate
    'http_reqs': ['rate>100'],           // Maintain >100 RPS
    'checks': ['rate>0.95']              // 95% of checks should pass
  }
};

// Test data setup
export function setup() {
  // Authenticate test user
  const loginRes = http.post(`${BASE_URL}${API_ENDPOINTS.AUTH.LOGIN}`, {
    email: 'loadtest@example.com',
    password: 'secureTestPass123'
  });

  const authToken = loginRes.json('token');

  // Create test campaigns with varied metrics
  const campaignIds = [];
  const baselineMetrics = {};

  for (let i = 0; i < 3; i++) {
    const campaignRes = http.post(
      `${BASE_URL}${API_ENDPOINTS.CAMPAIGNS.CREATE}`,
      {
        name: `Load Test Campaign ${i}`,
        platform: i % 2 === 0 ? 'LINKEDIN' : 'GOOGLE',
        objective: 'LEAD_GENERATION',
        budget: { amount: 1000, period: 'DAILY', currency: 'USD' }
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    campaignIds.push(campaignRes.json('id'));
  }

  // Initialize baseline metrics for validation
  const metricsRes = http.get(
    `${BASE_URL}${API_ENDPOINTS.ANALYTICS.METRICS}`,
    {
      headers: { Authorization: `Bearer ${authToken}` },
      params: { campaignIds: campaignIds.join(',') }
    }
  );

  baselineMetrics.data = metricsRes.json('metrics');
  baselineMetrics.timestamp = new Date().toISOString();

  return {
    authToken,
    campaignIds,
    baselineMetrics
  };
}

// Main test function
export default function(data) {
  const headers = {
    'Authorization': `Bearer ${data.authToken}`,
    'Content-Type': 'application/json'
  };

  // Test campaign performance metrics endpoint
  const performanceRes = http.get(
    `${BASE_URL}${API_ENDPOINTS.ANALYTICS.PERFORMANCE}`,
    {
      headers,
      params: {
        campaignIds: data.campaignIds.join(','),
        timeRange: 'LAST_30_DAYS'
      }
    }
  );

  check(performanceRes, {
    'performance metrics status is 200': (r) => r.status === 200,
    'performance metrics have valid structure': (r) => checkAnalyticsResponse(r, {
      requiredMetrics: ['IMPRESSIONS', 'CLICKS', 'CTR', 'CONVERSIONS', 'ROAS'],
      baselineMetrics: data.baselineMetrics
    })
  });

  sleep(1);

  // Test real-time metrics endpoint
  const realtimeRes = http.get(
    `${BASE_URL}${API_ENDPOINTS.ANALYTICS.METRICS}`,
    {
      headers,
      params: {
        campaignIds: data.campaignIds[0],
        interval: 'REALTIME'
      }
    }
  );

  check(realtimeRes, {
    'realtime metrics status is 200': (r) => r.status === 200,
    'realtime metrics are fresh': (r) => {
      const metrics = r.json('metrics');
      return new Date(metrics.timestamp) > new Date(data.baselineMetrics.timestamp);
    }
  });

  sleep(1);

  // Test forecasting endpoint
  const forecastRes = http.get(
    `${BASE_URL}${API_ENDPOINTS.ANALYTICS.FORECASTS}`,
    {
      headers,
      params: {
        campaignIds: data.campaignIds.join(','),
        metrics: ['CTR', 'CONVERSIONS', 'ROAS'].join(',')
      }
    }
  );

  check(forecastRes, {
    'forecast status is 200': (r) => r.status === 200,
    'forecast contains confidence intervals': (r) => {
      const forecasts = r.json('forecasts');
      return forecasts.every(f => 
        f.confidenceIntervals &&
        f.confidenceIntervals.lower < f.confidenceIntervals.upper
      );
    }
  });

  sleep(1);
}

// Helper function for comprehensive response validation
function checkAnalyticsResponse(response, context) {
  const data = response.json();
  
  // Basic structure validation
  if (!data || !data.metrics || !Array.isArray(data.metrics)) {
    return false;
  }

  // Required metrics presence
  const hasRequiredMetrics = context.requiredMetrics.every(metric =>
    data.metrics.some(m => m.type === metric)
  );

  // Data type validation
  const validDataTypes = data.metrics.every(metric =>
    typeof metric.value === 'number' &&
    typeof metric.timestamp === 'string' &&
    (!metric.confidence || (metric.confidence >= 0 && metric.confidence <= 1))
  );

  // Temporal consistency
  const timestamps = data.metrics.map(m => new Date(m.timestamp));
  const chronological = timestamps.every((t, i) => 
    i === 0 || t >= timestamps[i - 1]
  );

  // Cross-metric relationship validation
  const validRelationships = data.metrics.every(metric => {
    if (metric.type === 'CTR') {
      const clicks = data.metrics.find(m => m.type === 'CLICKS')?.value || 0;
      const impressions = data.metrics.find(m => m.type === 'IMPRESSIONS')?.value || 1;
      return Math.abs(metric.value - (clicks / impressions)) < 0.0001;
    }
    return true;
  });

  return hasRequiredMetrics && 
         validDataTypes && 
         chronological && 
         validRelationships;
}