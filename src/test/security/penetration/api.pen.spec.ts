import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'jest';
import supertest from 'supertest';
import { ZapClient } from 'zaproxy';
import { NmapScan } from 'node-nmap';
import { UserRole } from '../../../backend/shared/types/auth.types';
import { setupTestEnvironment, createTestUser } from '../../utils/test.helpers';
import { authenticate } from '../../../backend/api-gateway/src/middleware/auth.middleware';
import { ERROR_MESSAGES, AUTH_CONFIG, API_RATE_LIMITS } from '../../../backend/shared/constants';

/**
 * API Penetration Testing Suite
 * Comprehensive security validation for API endpoints and authentication mechanisms
 * @version 1.0.0
 */
@TestSuite('API Security Penetration Tests')
class ApiPenetrationTest {
  private request: supertest.SuperTest<supertest.Test>;
  private zapClient: ZapClient;
  private nmapScanner: NmapScan;
  private testUsers: Map<UserRole, { id: string; token: string }>;
  private testEnv: any;

  constructor() {
    this.testUsers = new Map();
  }

  /**
   * Setup test environment and security tools
   */
  beforeAll(async () => {
    // Initialize test environment
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

    // Initialize security testing tools
    this.zapClient = new ZapClient({
      apiKey: process.env.ZAP_API_KEY,
      proxy: 'http://localhost:8080'
    });

    this.nmapScanner = new NmapScan({
      range: ['localhost'],
      ports: '1-65535'
    });

    // Create test users for each role
    for (const role of Object.values(UserRole)) {
      const user = await createTestUser(role);
      const response = await authenticate(user);
      this.testUsers.set(role, {
        id: user.id,
        token: response.accessToken
      });
    }
  });

  /**
   * Clean up test environment after tests
   */
  afterAll(async () => {
    await this.testEnv.cleanup();
  });

  /**
   * Test authentication bypass vulnerabilities
   */
  @Test('Authentication Bypass Tests')
  async testAuthenticationBypass() {
    // Test accessing protected endpoint without token
    const noTokenResponse = await this.request
      .get('/api/campaigns')
      .expect(401);
    expect(noTokenResponse.body.error.message).toBe(ERROR_MESSAGES.UNAUTHORIZED);

    // Test with expired token
    const expiredToken = 'expired.jwt.token';
    const expiredResponse = await this.request
      .get('/api/campaigns')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
    expect(expiredResponse.body.error.message).toBe(ERROR_MESSAGES.INVALID_TOKEN);

    // Test with malformed token
    const malformedResponse = await this.request
      .get('/api/campaigns')
      .set('Authorization', 'Bearer malformed_token')
      .expect(401);
    expect(malformedResponse.body.error.message).toBe(ERROR_MESSAGES.INVALID_TOKEN);

    // Test token tampering
    const tamperAttempts = [
      { header: 'none', payload: 'modified', signature: 'invalid' },
      { header: 'modified', payload: 'none', signature: 'invalid' },
      { header: 'none', payload: 'none', signature: 'none' }
    ];

    for (const attempt of tamperAttempts) {
      const tamperedToken = `${attempt.header}.${attempt.payload}.${attempt.signature}`;
      await this.request
        .get('/api/campaigns')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);
    }
  });

  /**
   * Test privilege escalation vulnerabilities
   */
  @Test('Authorization Escalation Tests')
  async testAuthorizationEscalation() {
    const regularUserToken = this.testUsers.get(UserRole.USER)?.token;
    const adminEndpoints = [
      '/api/admin/users',
      '/api/admin/settings',
      '/api/admin/logs'
    ];

    // Test accessing admin endpoints with regular user token
    for (const endpoint of adminEndpoints) {
      await this.request
        .get(endpoint)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    }

    // Test role modification attempts
    const roleModResponse = await this.request
      .put('/api/users/role')
      .set('Authorization', `Bearer ${regularUserToken}`)
      .send({ role: UserRole.ADMIN })
      .expect(403);
    expect(roleModResponse.body.error.message).toBe(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS);

    // Test horizontal privilege escalation
    const otherUserData = await this.request
      .get('/api/users/other-user-id')
      .set('Authorization', `Bearer ${regularUserToken}`)
      .expect(403);
  });

  /**
   * Test for injection vulnerabilities
   */
  @Test('Injection Vulnerability Tests')
  async testInjectionVulnerabilities() {
    const adminToken = this.testUsers.get(UserRole.ADMIN)?.token;
    
    // SQL Injection tests
    const sqlInjectionPayloads = [
      "' OR '1'='1",
      "; DROP TABLE users;--",
      "' UNION SELECT * FROM users--"
    ];

    for (const payload of sqlInjectionPayloads) {
      await this.request
        .get(`/api/users?id=${payload}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    }

    // XSS Payload tests
    const xssPayloads = [
      "<script>alert('xss')</script>",
      "javascript:alert('xss')",
      "<img src='x' onerror='alert(1)'>"
    ];

    for (const payload of xssPayloads) {
      await this.request
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: payload })
        .expect(400);
    }

    // NoSQL Injection tests
    const noSqlPayloads = [
      { "$gt": "" },
      { "$where": "function() { return true; }" },
      { "$regex": ".*" }
    ];

    for (const payload of noSqlPayloads) {
      await this.request
        .get('/api/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ id: payload })
        .expect(400);
    }
  });

  /**
   * Test rate limiting and DDoS protection
   */
  @Test('Rate Limiting Tests')
  async testRateLimiting() {
    const userToken = this.testUsers.get(UserRole.USER)?.token;
    const endpoint = '/api/campaigns';

    // Test rate limit exceeded
    const requests = Array(API_RATE_LIMITS.MAX_REQUESTS_PER_MINUTE + 1)
      .fill(null)
      .map(() => 
        this.request
          .get(endpoint)
          .set('Authorization', `Bearer ${userToken}`)
      );

    const responses = await Promise.all(requests);
    const lastResponse = responses[responses.length - 1];
    expect(lastResponse.status).toBe(429);
    expect(lastResponse.body.error.message).toBe(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);

    // Test rate limit headers
    const response = await this.request
      .get(endpoint)
      .set('Authorization', `Bearer ${userToken}`);
    expect(response.headers).toHaveProperty('x-rate-limit-limit');
    expect(response.headers).toHaveProperty('x-rate-limit-remaining');
    expect(response.headers).toHaveProperty('x-rate-limit-reset');
  });

  /**
   * Run comprehensive vulnerability scan
   */
  async runVulnerabilityScan(): Promise<any> {
    // Configure ZAP scanner
    await this.zapClient.setMode('attack');
    await this.zapClient.spider.scan('http://localhost:3001');
    const scanId = await this.zapClient.ascan.scan('http://localhost:3001');

    // Wait for scan completion
    let status = 0;
    while (status < 100) {
      status = await this.zapClient.ascan.status(scanId);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Generate and return scan report
    const alerts = await this.zapClient.core.alerts();
    return {
      scanId,
      alerts,
      summary: await this.zapClient.core.summary()
    };
  }
}

export { ApiPenetrationTest };