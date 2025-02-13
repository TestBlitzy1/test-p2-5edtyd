// External imports
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const campaignCreationErrors = new Rate('campaign_creation_errors');
const platformSpecificErrors = new Rate('platform_specific_errors');
const aiProcessingErrors = new Rate('ai_processing_errors');

// Environment configuration
const API_BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000/api';
const PLATFORM_TYPES = ['LINKEDIN', 'GOOGLE'];
const CAMPAIGN_OBJECTIVES = ['LEAD_GENERATION', 'BRAND_AWARENESS', 'WEBSITE_TRAFFIC', 'CONVERSIONS'];

// Performance thresholds
const THINK_TIME_MIN = 1;
const THINK_TIME_MAX = 5;
const MAX_RESPONSE_TIME = 100;
const ERROR_RATE_THRESHOLD = 0.001;
const CAMPAIGN_CREATION_TIMEOUT = 900; // 15 minutes in seconds

// Test configuration
export const options = {
    vus: 100,
    duration: '30m',
    thresholds: {
        http_req_duration: [`p(95)<${MAX_RESPONSE_TIME}`],
        http_req_failed: [`rate<${ERROR_RATE_THRESHOLD}`],
        campaign_creation_errors: [`rate<${ERROR_RATE_THRESHOLD}`],
        platform_specific_errors: [`rate<${ERROR_RATE_THRESHOLD}`],
        ai_processing_errors: [`rate<${ERROR_RATE_THRESHOLD}`]
    },
    scenarios: {
        linkedin_campaign_creation: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '5m', target: 50 },
                { duration: '10m', target: 50 },
                { duration: '5m', target: 100 },
                { duration: '5m', target: 0 }
            ],
            env: { PLATFORM: 'LINKEDIN' }
        },
        google_campaign_creation: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '5m', target: 50 },
                { duration: '10m', target: 50 },
                { duration: '5m', target: 100 },
                { duration: '5m', target: 0 }
            ],
            env: { PLATFORM: 'GOOGLE' }
        }
    }
};

// Test setup - initialize test data and authentication
export function setup() {
    const authToken = generateLoadTestToken();
    const testContext = {
        authToken,
        linkedInTemplate: generateLinkedInCampaign(),
        googleTemplate: generateGoogleCampaign()
    };

    // Validate API health
    const healthCheck = http.get(`${API_BASE_URL}/health`);
    check(healthCheck, {
        'API is healthy': (r) => r.status === 200
    });

    return testContext;
}

// Test teardown - cleanup test data
export function teardown(data) {
    // Log test summary metrics
    console.log('Test Summary:', {
        campaignCreationErrors: campaignCreationErrors.value,
        platformSpecificErrors: platformSpecificErrors.value,
        aiProcessingErrors: aiProcessingErrors.value
    });
}

// Main test function
export default function(data) {
    const platform = __ENV.PLATFORM || PLATFORM_TYPES[Math.floor(Math.random() * PLATFORM_TYPES.length)];
    const campaignTemplate = platform === 'LINKEDIN' ? data.linkedInTemplate : data.googleTemplate;
    
    // Generate unique campaign data
    const campaign = {
        ...campaignTemplate,
        name: `Load Test Campaign ${platform} ${Date.now()}`,
        objective: CAMPAIGN_OBJECTIVES[Math.floor(Math.random() * CAMPAIGN_OBJECTIVES.length)]
    };

    // Set up request headers
    const headers = {
        'Authorization': `Bearer ${data.authToken}`,
        'Content-Type': 'application/json',
        'X-Platform': platform
    };

    // Create campaign
    const createResponse = http.post(
        `${API_BASE_URL}/campaigns`,
        JSON.stringify(campaign),
        { headers, timeout: CAMPAIGN_CREATION_TIMEOUT * 1000 }
    );

    // Validate campaign creation
    check(createResponse, {
        'Campaign creation successful': (r) => r.status === 201,
        'Response contains campaign ID': (r) => r.json('id') !== undefined,
        'AI processing completed': (r) => r.json('aiOptimization.status') === 'COMPLETED',
        'Response time within limits': (r) => r.timings.duration < MAX_RESPONSE_TIME
    }) || campaignCreationErrors.add(1);

    // Platform-specific validation
    if (platform === 'LINKEDIN') {
        check(createResponse, {
            'LinkedIn campaign structure valid': (r) => r.json('platformConfig.linkedin') !== undefined,
            'LinkedIn targeting configured': (r) => r.json('targeting.platformSpecific.linkedin') !== undefined
        }) || platformSpecificErrors.add(1);
    } else {
        check(createResponse, {
            'Google campaign structure valid': (r) => r.json('platformConfig.google') !== undefined,
            'Google targeting configured': (r) => r.json('targeting.platformSpecific.google') !== undefined
        }) || platformSpecificErrors.add(1);
    }

    // Validate AI optimization
    check(createResponse, {
        'AI optimization enabled': (r) => r.json('aiOptimization.enabled') === true,
        'Performance targets set': (r) => Array.isArray(r.json('performanceTargets')),
        'Budget optimization configured': (r) => r.json('aiOptimization.autoOptimize') === true
    }) || aiProcessingErrors.add(1);

    // Add randomized think time between requests
    sleep(Math.random() * (THINK_TIME_MAX - THINK_TIME_MIN) + THINK_TIME_MIN);
}

// Helper function to generate test authentication token
function generateLoadTestToken() {
    const tokenResponse = http.post(`${API_BASE_URL}/auth/test-token`, {
        role: 'LOAD_TEST',
        scope: ['campaign:create', 'campaign:read']
    });

    check(tokenResponse, {
        'Auth token generated successfully': (r) => r.status === 200
    });

    return tokenResponse.json('token');
}

// Helper function to generate LinkedIn campaign test data
function generateLinkedInCampaign() {
    return {
        platform: 'LINKEDIN',
        budget: {
            amount: 5000,
            currency: 'USD',
            period: 'DAILY',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        targeting: {
            locations: [{ country: 'United States', region: 'California' }],
            industries: ['Technology', 'Marketing'],
            companySize: ['11-50', '51-200'],
            jobTitles: ['Marketing Manager'],
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
            optimizationGoals: ['CTR', 'CONVERSIONS'],
            autoOptimize: true,
            minBudgetAdjustment: -20,
            maxBudgetAdjustment: 50,
            optimizationFrequency: 24
        }
    };
}

// Helper function to generate Google Ads campaign test data
function generateGoogleCampaign() {
    return {
        platform: 'GOOGLE',
        budget: {
            amount: 5000,
            currency: 'USD',
            period: 'DAILY',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        targeting: {
            locations: [{ country: 'United States', region: 'California' }],
            industries: ['Technology', 'Marketing'],
            platformSpecific: {
                google: {
                    keywords: ['digital marketing'],
                    topics: [],
                    placements: [],
                    audiences: []
                }
            }
        },
        aiOptimization: {
            enabled: true,
            optimizationGoals: ['CTR', 'CONVERSIONS'],
            autoOptimize: true,
            minBudgetAdjustment: -20,
            maxBudgetAdjustment: 50,
            optimizationFrequency: 24
        }
    };
}