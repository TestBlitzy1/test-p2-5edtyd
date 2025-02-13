import supertest from 'supertest';
import { setupTestEnvironment, createTestUser, cleanupTestData } from '../../utils/test.helpers';
import { UserRole } from '../../../backend/shared/types/auth.types';

// Global test variables
let request: supertest.SuperTest<supertest.Test>;
let testUsers: Record<UserRole, { id: string; token: string }>;
let testCampaigns: Record<string, any[]>;

describe('Authorization E2E Tests', () => {
  // Setup test environment before all tests
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

    request = supertest(testEnv.mockServer.getApp());

    // Create test users for each role
    testUsers = {
      [UserRole.ADMIN]: await createTestUser(UserRole.ADMIN),
      [UserRole.MANAGER]: await createTestUser(UserRole.MANAGER),
      [UserRole.ANALYST]: await createTestUser(UserRole.ANALYST)
    };

    // Create test campaigns with different ownership
    testCampaigns = {
      admin: [],
      manager: [],
      analyst: []
    };
  });

  // Cleanup after each test
  afterEach(async () => {
    await cleanupTestData();
  });

  describe('Campaign Management Authorization', () => {
    describe('Admin Access Tests', () => {
      const adminToken = testUsers[UserRole.ADMIN].token;

      test('should allow admin to create campaigns', async () => {
        const response = await request
          .post('/api/campaigns')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Test Campaign',
            platform: 'LINKEDIN',
            objective: 'LEAD_GENERATION'
          });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
      });

      test('should allow admin to view all campaigns', async () => {
        const response = await request
          .get('/api/campaigns')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });

      test('should allow admin to modify any campaign', async () => {
        const campaignId = testCampaigns.manager[0].id;
        const response = await request
          .put(`/api/campaigns/${campaignId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Updated Campaign Name'
          });

        expect(response.status).toBe(200);
        expect(response.body.name).toBe('Updated Campaign Name');
      });

      test('should allow admin to delete campaigns', async () => {
        const campaignId = testCampaigns.manager[0].id;
        const response = await request
          .delete(`/api/campaigns/${campaignId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(204);
      });
    });

    describe('Manager Access Tests', () => {
      const managerToken = testUsers[UserRole.MANAGER].token;

      test('should allow manager to create campaigns', async () => {
        const response = await request
          .post('/api/campaigns')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            name: 'Manager Campaign',
            platform: 'GOOGLE',
            objective: 'BRAND_AWARENESS'
          });

        expect(response.status).toBe(201);
      });

      test('should allow manager to view own campaigns', async () => {
        const response = await request
          .get('/api/campaigns')
          .set('Authorization', `Bearer ${managerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.every((campaign: any) => 
          campaign.userId === testUsers[UserRole.MANAGER].id
        )).toBe(true);
      });

      test('should not allow manager to view other users campaigns', async () => {
        const adminCampaignId = testCampaigns.admin[0].id;
        const response = await request
          .get(`/api/campaigns/${adminCampaignId}`)
          .set('Authorization', `Bearer ${managerToken}`);

        expect(response.status).toBe(403);
      });

      test('should not allow manager to modify other users campaigns', async () => {
        const adminCampaignId = testCampaigns.admin[0].id;
        const response = await request
          .put(`/api/campaigns/${adminCampaignId}`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            name: 'Unauthorized Update'
          });

        expect(response.status).toBe(403);
      });
    });

    describe('Analyst Access Tests', () => {
      const analystToken = testUsers[UserRole.ANALYST].token;

      test('should allow analyst to view assigned campaigns', async () => {
        const response = await request
          .get('/api/campaigns')
          .set('Authorization', `Bearer ${analystToken}`);

        expect(response.status).toBe(200);
      });

      test('should not allow analyst to create campaigns', async () => {
        const response = await request
          .post('/api/campaigns')
          .set('Authorization', `Bearer ${analystToken}`)
          .send({
            name: 'Unauthorized Campaign',
            platform: 'LINKEDIN'
          });

        expect(response.status).toBe(403);
      });

      test('should not allow analyst to modify campaigns', async () => {
        const campaignId = testCampaigns.manager[0].id;
        const response = await request
          .put(`/api/campaigns/${campaignId}`)
          .set('Authorization', `Bearer ${analystToken}`)
          .send({
            name: 'Unauthorized Update'
          });

        expect(response.status).toBe(403);
      });
    });
  });

  describe('Analytics Authorization', () => {
    describe('Admin Analytics Access', () => {
      const adminToken = testUsers[UserRole.ADMIN].token;

      test('should allow admin to view all analytics', async () => {
        const response = await request
          .get('/api/analytics')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
      });

      test('should allow admin to configure analytics settings', async () => {
        const response = await request
          .put('/api/analytics/settings')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            defaultTimeframe: 'MONTHLY',
            customMetrics: ['ROAS', 'CPC']
          });

        expect(response.status).toBe(200);
      });
    });

    describe('Manager Analytics Access', () => {
      const managerToken = testUsers[UserRole.MANAGER].token;

      test('should allow manager to view own campaign analytics', async () => {
        const response = await request
          .get('/api/analytics')
          .set('Authorization', `Bearer ${managerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.campaigns.every((campaign: any) =>
          campaign.userId === testUsers[UserRole.MANAGER].id
        )).toBe(true);
      });

      test('should not allow manager to view other users analytics', async () => {
        const adminCampaignId = testCampaigns.admin[0].id;
        const response = await request
          .get(`/api/analytics/campaigns/${adminCampaignId}`)
          .set('Authorization', `Bearer ${managerToken}`);

        expect(response.status).toBe(403);
      });
    });

    describe('Analyst Analytics Access', () => {
      const analystToken = testUsers[UserRole.ANALYST].token;

      test('should allow analyst to view assigned analytics', async () => {
        const response = await request
          .get('/api/analytics')
          .set('Authorization', `Bearer ${analystToken}`);

        expect(response.status).toBe(200);
      });

      test('should not allow analyst to modify analytics settings', async () => {
        const response = await request
          .put('/api/analytics/settings')
          .set('Authorization', `Bearer ${analystToken}`)
          .send({
            defaultTimeframe: 'WEEKLY'
          });

        expect(response.status).toBe(403);
      });
    });
  });

  describe('Platform Integration Authorization', () => {
    describe('Admin Platform Access', () => {
      const adminToken = testUsers[UserRole.ADMIN].token;

      test('should allow admin to configure platform integrations', async () => {
        const response = await request
          .post('/api/integrations/platforms')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            platform: 'LINKEDIN',
            credentials: {
              clientId: 'test-client-id',
              clientSecret: 'test-client-secret'
            }
          });

        expect(response.status).toBe(201);
      });

      test('should allow admin to view all platform connections', async () => {
        const response = await request
          .get('/api/integrations/platforms')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
      });
    });

    describe('Manager Platform Access', () => {
      const managerToken = testUsers[UserRole.MANAGER].token;

      test('should allow manager to configure own platform connections', async () => {
        const response = await request
          .post('/api/integrations/connections')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            platform: 'GOOGLE',
            accountId: 'test-account'
          });

        expect(response.status).toBe(201);
      });

      test('should not allow manager to modify global platform settings', async () => {
        const response = await request
          .put('/api/integrations/platforms/settings')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            defaultBidStrategy: 'AUTOMATED'
          });

        expect(response.status).toBe(403);
      });
    });

    describe('Analyst Platform Access', () => {
      const analystToken = testUsers[UserRole.ANALYST].token;

      test('should allow analyst to view platform data', async () => {
        const response = await request
          .get('/api/integrations/platforms/data')
          .set('Authorization', `Bearer ${analystToken}`);

        expect(response.status).toBe(200);
      });

      test('should not allow analyst to configure platform connections', async () => {
        const response = await request
          .post('/api/integrations/connections')
          .set('Authorization', `Bearer ${analystToken}`)
          .send({
            platform: 'LINKEDIN',
            accountId: 'test-account'
          });

        expect(response.status).toBe(403);
      });
    });
  });
});