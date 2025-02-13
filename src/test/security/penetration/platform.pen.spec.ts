// External imports
import { describe, test, beforeAll, afterAll, expect } from 'jest'; // ^29.0.0
import supertest from 'supertest'; // ^6.0.0
import nmap from 'node-nmap'; // ^4.0.0
import { ZapClient } from 'zaproxy'; // ^2.0.0

// Internal imports
import { GoogleAdsService } from '../../../backend/platform-integration/src/services/google.service';
import { LinkedInService } from '../../../backend/platform-integration/src/services/linkedin.service';
import { setupTestEnvironment } from '../../utils/test.helpers';
import { PlatformType } from '../../../backend/shared/types/campaign.types';

/**
 * Platform Integration Security Test Suite
 * Tests security vulnerabilities in LinkedIn Ads and Google Ads API integrations
 * @version 1.0.0
 */
@SecuritySuite
export class PlatformSecurityTest {
    private googleAdsService: GoogleAdsService;
    private linkedInService: LinkedInService;
    private zapClient: ZapClient;
    private testServer: any;

    constructor() {
        this.zapClient = new ZapClient({
            apiKey: process.env.ZAP_API_KEY,
            proxy: {
                host: 'localhost',
                port: 8080
            }
        });
    }

    @beforeAll
    async setup() {
        // Initialize test environment
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

        this.testServer = testEnv.mockServer;
        this.googleAdsService = new GoogleAdsService();
        this.linkedInService = new LinkedInService('test-account-id');

        // Configure ZAP scanner
        await this.zapClient.core.newSession('platform_security_test', true);
        await this.zapClient.core.setMode('ATTACK');
    }

    @afterAll
    async cleanup() {
        await this.zapClient.core.shutdown();
    }

    /**
     * Tests security vulnerabilities in Google Ads API integration
     */
    @Test
    @Security
    async testGoogleAdsApiSecurity(): Promise<void> {
        // Test authentication bypass attempts
        await test('Google Ads API - Authentication Bypass', async () => {
            const response = await supertest(this.testServer)
                .post('/api/campaigns')
                .set('Authorization', 'Invalid-Token')
                .send({
                    platform: PlatformType.GOOGLE,
                    name: 'Test Campaign'
                });
            expect(response.status).toBe(401);
        });

        // Test SQL injection in campaign parameters
        await test('Google Ads API - SQL Injection', async () => {
            const maliciousPayload = {
                name: "'; DROP TABLE campaigns; --",
                platform: PlatformType.GOOGLE
            };
            const response = await supertest(this.testServer)
                .post('/api/campaigns')
                .set('Authorization', 'Bearer valid-token')
                .send(maliciousPayload);
            expect(response.status).toBe(400);
        });

        // Test XSS vulnerabilities in ad content
        await test('Google Ads API - XSS Prevention', async () => {
            const xssPayload = {
                name: '<script>alert("xss")</script>',
                platform: PlatformType.GOOGLE
            };
            const response = await supertest(this.testServer)
                .post('/api/campaigns')
                .set('Authorization', 'Bearer valid-token')
                .send(xssPayload);
            expect(response.status).toBe(400);
        });

        // Test CSRF protection
        await test('Google Ads API - CSRF Protection', async () => {
            const response = await supertest(this.testServer)
                .post('/api/campaigns')
                .set('Authorization', 'Bearer valid-token')
                .set('X-CSRF-Token', 'invalid-token')
                .send({});
            expect(response.status).toBe(403);
        });
    }

    /**
     * Tests security vulnerabilities in LinkedIn Ads API integration
     */
    @Test
    @Security
    async testLinkedInApiSecurity(): Promise<void> {
        // Test OAuth token security
        await test('LinkedIn API - OAuth Security', async () => {
            const response = await supertest(this.testServer)
                .get('/api/linkedin/profile')
                .set('Authorization', 'Bearer expired-token');
            expect(response.status).toBe(401);
        });

        // Test parameter injection vulnerabilities
        await test('LinkedIn API - Parameter Injection', async () => {
            const maliciousPayload = {
                targeting: {
                    locations: [{ id: '1; exec(malicious_code)' }]
                }
            };
            const response = await supertest(this.testServer)
                .post('/api/linkedin/campaigns')
                .set('Authorization', 'Bearer valid-token')
                .send(maliciousPayload);
            expect(response.status).toBe(400);
        });

        // Test rate limiting bypass attempts
        await test('LinkedIn API - Rate Limiting', async () => {
            const requests = Array(100).fill(null).map(() =>
                supertest(this.testServer)
                    .get('/api/linkedin/campaigns')
                    .set('Authorization', 'Bearer valid-token')
            );
            const responses = await Promise.all(requests);
            expect(responses.some(r => r.status === 429)).toBe(true);
        });
    }

    /**
     * Tests data protection measures for platform integrations
     */
    @Test
    @Security
    async testPlatformDataProtection(): Promise<void> {
        // Test sensitive data encryption
        await test('Platform - Data Encryption', async () => {
            const response = await supertest(this.testServer)
                .get('/api/campaigns/sensitive-data')
                .set('Authorization', 'Bearer valid-token');
            expect(response.headers['content-security-policy']).toBeDefined();
            expect(response.headers['strict-transport-security']).toBeDefined();
        });

        // Test secure credential storage
        await test('Platform - Credential Storage', async () => {
            const nmapScan = new nmap.NmapScan('localhost', '-sV');
            await new Promise((resolve) => {
                nmapScan.on('complete', (data: any) => {
                    const vulnerableServices = data.filter((service: any) =>
                        service.service.includes('mysql') ||
                        service.service.includes('redis')
                    );
                    expect(vulnerableServices.length).toBe(0);
                    resolve(null);
                });
                nmapScan.startScan();
            });
        });

        // Test audit logging implementation
        await test('Platform - Audit Logging', async () => {
            const sensitiveOperation = await supertest(this.testServer)
                .post('/api/campaigns')
                .set('Authorization', 'Bearer valid-token')
                .send({ name: 'Test Campaign' });
            
            const auditLogs = await supertest(this.testServer)
                .get('/api/audit-logs')
                .set('Authorization', 'Bearer valid-token');
            
            expect(auditLogs.body).toContainEqual(
                expect.objectContaining({
                    operation: 'CREATE_CAMPAIGN',
                    userId: expect.any(String),
                    timestamp: expect.any(String)
                })
            );
        });
    }
}