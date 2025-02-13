// External imports - k6@^0.45.0
import { sleep } from 'k6';
import http from 'k6/http';
import { check } from 'k6/check';

// Base configuration
export const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
export const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN;

// Load test configuration with staged ramp-up
export const options = {
    stages: [
        { duration: '1m', target: 20 },  // Ramp up to 20 users
        { duration: '2m', target: 50 },  // Ramp up to 50 users
        { duration: '1m', target: 100 }, // Peak load of 100 users
        { duration: '1m', target: 0 }    // Ramp down to 0
    ],
    thresholds: {
        'http_req_duration': ['p(95)<100'], // 95% of requests must complete within 100ms
        'http_req_failed': ['rate<0.01'],   // Less than 1% error rate
        'checks': ['rate>0.95']             // 95% of checks must pass
    },
    // Platform-specific rate limits
    rateLimit: {
        linkedin: 100, // LinkedIn API requests per minute
        google: 150    // Google Ads API requests per minute
    }
};

// Test data generation utilities
const generateCampaignData = (platform) => ({
    name: `Load Test Campaign ${Date.now()}`,
    platform: platform,
    objective: 'LEAD_GENERATION',
    budget: {
        amount: 1000,
        currency: 'USD',
        period: 'DAILY',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    },
    targeting: {
        locations: [{
            id: 'US',
            country: 'United States'
        }],
        industries: ['SOFTWARE'],
        companySize: ['MEDIUM', 'LARGE'],
        jobTitles: ['Software Engineer', 'Developer'],
        interests: ['Technology', 'Software Development'],
        platformSpecific: {
            linkedin: {
                skills: ['JavaScript', 'Python'],
                groups: [],
                schools: [],
                degrees: ['Bachelor'],
                fieldOfStudy: ['Computer Science']
            },
            google: {
                keywords: ['software development', 'programming'],
                topics: ['Technology'],
                placements: [],
                audiences: []
            }
        }
    }
});

// Test setup function
export function setup() {
    const headers = {
        'Authorization': `Bearer ${TEST_USER_TOKEN}`,
        'Content-Type': 'application/json'
    };

    // Validate authentication and platform access
    const authCheck = http.get(`${BASE_URL}/api/auth/validate`, { headers });
    check(authCheck, {
        'Authentication valid': (r) => r.status === 200
    });

    return {
        headers,
        testData: {
            linkedin: generateCampaignData('LINKEDIN'),
            google: generateCampaignData('GOOGLE')
        }
    };
}

// LinkedIn campaign creation test
export function testLinkedInCampaignCreation(testContext) {
    const response = http.post(
        `${BASE_URL}/api/campaigns/linkedin`,
        JSON.stringify(testContext.testData.linkedin),
        { headers: testContext.headers }
    );

    check(response, {
        'LinkedIn campaign creation successful': (r) => r.status === 201,
        'Response time within limits': (r) => r.timings.duration < 100,
        'Valid campaign ID returned': (r) => r.json('id') !== undefined
    });

    sleep(60 / options.rateLimit.linkedin); // Rate limiting
}

// Google campaign creation test
export function testGoogleCampaignCreation(testContext) {
    const response = http.post(
        `${BASE_URL}/api/campaigns/google`,
        JSON.stringify(testContext.testData.google),
        { headers: testContext.headers }
    );

    check(response, {
        'Google campaign creation successful': (r) => r.status === 201,
        'Response time within limits': (r) => r.timings.duration < 100,
        'Valid campaign ID returned': (r) => r.json('id') !== undefined
    });

    sleep(60 / options.rateLimit.google); // Rate limiting
}

// Campaign performance metrics test
export function testCampaignPerformance(testContext) {
    const response = http.get(
        `${BASE_URL}/api/campaigns/performance`,
        { headers: testContext.headers }
    );

    check(response, {
        'Performance metrics retrieved successfully': (r) => r.status === 200,
        'Response time within limits': (r) => r.timings.duration < 100,
        'Metrics data structure valid': (r) => {
            const data = r.json();
            return data.metrics && 
                   data.metrics.IMPRESSIONS !== undefined &&
                   data.metrics.CLICKS !== undefined &&
                   data.metrics.CONVERSIONS !== undefined;
        }
    });

    sleep(1); // Basic rate limiting for metrics endpoint
}

// Test cleanup function
export function teardown(testContext) {
    // Cleanup test campaigns
    const headers = testContext.headers;
    const cleanupEndpoints = [
        `${BASE_URL}/api/campaigns/linkedin/test`,
        `${BASE_URL}/api/campaigns/google/test`
    ];

    cleanupEndpoints.forEach(endpoint => {
        http.del(endpoint, null, { headers });
    });
}

// Default test function
export default function(testContext) {
    // Randomize test distribution
    const rand = Math.random();
    
    if (rand < 0.4) {
        testLinkedInCampaignCreation(testContext);
    } else if (rand < 0.8) {
        testGoogleCampaignCreation(testContext);
    } else {
        testCampaignPerformance(testContext);
    }
}