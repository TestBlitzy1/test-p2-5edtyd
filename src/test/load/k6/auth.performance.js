// K6 imports - @version 0.40.0
import http from 'k6/http';
import { check, sleep } from 'k6';

// Internal test data imports
import { TEST_USER } from '../../utils/test.constants';

// Base URL for auth service
const BASE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3000/api/auth';

// Test configuration with multi-region support and concurrent user ramp-up
export const options = {
  stages: [
    { duration: '5m', target: 2000 },  // Ramp up to 2000 users
    { duration: '10m', target: 5000 }, // Increase to 5000 users
    { duration: '5m', target: 10000 }, // Peak load of 10000 users
    { duration: '5m', target: 0 }      // Ramp down to 0
  ],
  scenarios: {
    us_east: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: ['5m:2000', '10m:5000', '5m:10000', '5m:0'],
      env: { REGION: 'us-east' }
    },
    eu_west: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: ['5m:2000', '10m:5000', '5m:10000', '5m:0'],
      env: { REGION: 'eu-west' }
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<100', 'p(99)<200'],  // Response time thresholds
    http_req_failed: ['rate<0.001'],                // Error rate threshold
    http_reqs: ['rate>100'],                        // Request rate threshold
    oauth_validation_time: ['p(95)<50'],            // OAuth validation threshold
    token_refresh_time: ['p(95)<75'],               // Token refresh threshold
    concurrent_users: ['value>=10000']              // Concurrent users threshold
  }
};

// Test setup function for initializing test data and environment
export function setup() {
  // Initialize test data for each region
  const testData = {
    us_east: {
      credentials: {
        email: TEST_USER.email,
        password: TEST_USER.password,
        region: 'us-east'
      },
      endpoint: `${BASE_URL}/us-east`
    },
    eu_west: {
      credentials: {
        email: TEST_USER.email,
        password: TEST_USER.password,
        region: 'eu-west'
      },
      endpoint: `${BASE_URL}/eu-west`
    }
  };

  // Verify service health for each region
  const healthChecks = Object.entries(testData).map(([region, data]) => {
    const response = http.get(`${data.endpoint}/health`);
    return response.status === 200;
  });

  if (!healthChecks.every(check => check)) {
    throw new Error('Health check failed for one or more regions');
  }

  return testData;
}

// Handle user login with OAuth flow and regional routing
function handleLogin(data) {
  const startTime = new Date();
  
  // Prepare login request with OAuth parameters
  const payload = JSON.stringify({
    email: data.credentials.email,
    password: data.credentials.password,
    grant_type: 'password',
    scope: 'read write'
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Region': data.credentials.region
    }
  };

  // Execute login request
  const response = http.post(`${data.endpoint}/login`, payload, params);

  // Validate response and OAuth token
  const checks = check(response, {
    'status is 200': r => r.status === 200,
    'has access token': r => r.json('accessToken') !== undefined,
    'has refresh token': r => r.json('refreshToken') !== undefined,
    'has correct token type': r => r.json('tokenType') === 'Bearer',
    'has valid expiration': r => r.json('expiresIn') > 0,
    'response time OK': r => r.timings.duration < 100
  });

  // Track OAuth validation time
  const oauthValidationTime = new Date() - startTime;
  
  return {
    success: checks,
    token: response.json('accessToken'),
    validationTime: oauthValidationTime,
    region: data.credentials.region
  };
}

// Handle token refresh with regional performance tracking
function handleRefreshToken(token, region) {
  const startTime = new Date();

  const response = http.post(`${BASE_URL}/${region}/refresh`, JSON.stringify({
    refreshToken: token
  }), {
    headers: {
      'Content-Type': 'application/json',
      'X-Region': region
    }
  });

  // Validate refresh response
  check(response, {
    'refresh successful': r => r.status === 200,
    'new token received': r => r.json('accessToken') !== undefined,
    'refresh time OK': r => (new Date() - startTime) < 75
  });

  return {
    token: response.json('accessToken'),
    refreshTime: new Date() - startTime
  };
}

// Default function for executing the load test
export default function(data) {
  // Get region from environment
  const region = __ENV.REGION;
  const regionData = data[region];

  // Execute login flow
  const loginResult = handleLogin(regionData);
  
  if (loginResult.success) {
    // Simulate user activity
    sleep(1);

    // Perform token refresh
    const refreshResult = handleRefreshToken(loginResult.token, region);
    
    // Track metrics
    const metrics = {
      oauth_validation_time: loginResult.validationTime,
      token_refresh_time: refreshResult.refreshTime,
      concurrent_users: 1
    };

    // Report custom metrics
    Object.entries(metrics).forEach(([metric, value]) => {
      if (value !== undefined) {
        metrics[metric] = value;
      }
    });
  }

  // Add randomized sleep to simulate real user behavior
  sleep(Math.random() * 2 + 1);
}