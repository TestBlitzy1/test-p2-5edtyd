import { describe, beforeAll, afterAll, it, expect } from 'jest';
import supertest from 'supertest';
import { IUser } from '../../backend/shared/types/auth.types';
import { ICampaign } from '../../backend/shared/types/campaign.types';
import { TestHelpers } from '../../utils/test.helpers';

/**
 * GDPR Compliance Test Suite
 * Validates comprehensive GDPR requirements across the Sales Intelligence Platform
 * @version 1.0.0
 */
@TestSuite('GDPR Compliance Tests')
export class GDPRComplianceTest {
  private testUser: IUser;
  private testCampaign: ICampaign;
  private testHelpers: TestHelpers;
  private request: supertest.SuperTest<supertest.Test>;

  constructor() {
    this.testHelpers = new TestHelpers();
  }

  @beforeAll
  async setUp(): Promise<void> {
    // Initialize test environment with privacy controls
    this.testUser = await this.testHelpers.createTestUser({
      consentFlags: {
        marketingConsent: true,
        analyticsConsent: true,
        thirdPartyDataSharing: false,
        automatedDecisionMaking: true
      }
    });

    this.testCampaign = await this.testHelpers.createTestCampaign(this.testUser.id);
    this.request = supertest(process.env.API_URL);
  }

  @afterAll
  async tearDown(): Promise<void> {
    await this.testHelpers.cleanup();
  }

  /**
   * Tests implementation of GDPR data subject rights
   */
  @Test('Data Subject Rights Implementation')
  async testUserDataRights(): Promise<void> {
    // Test right to access
    const accessResponse = await this.request
      .get(`/api/users/${this.testUser.id}/data`)
      .set('Authorization', `Bearer ${this.testUser.token}`);
    expect(accessResponse.status).toBe(200);
    expect(accessResponse.body).toHaveProperty('personalData');
    expect(accessResponse.body).toHaveProperty('processingPurposes');

    // Test right to data portability
    const portabilityResponse = await this.request
      .get(`/api/users/${this.testUser.id}/export`)
      .set('Authorization', `Bearer ${this.testUser.token}`);
    expect(portabilityResponse.status).toBe(200);
    expect(portabilityResponse.headers['content-type']).toBe('application/json');

    // Test right to be forgotten
    const deletionResponse = await this.request
      .delete(`/api/users/${this.testUser.id}`)
      .set('Authorization', `Bearer ${this.testUser.token}`);
    expect(deletionResponse.status).toBe(200);

    // Verify complete data deletion
    const verifyDeletion = await this.request
      .get(`/api/users/${this.testUser.id}`)
      .set('Authorization', `Bearer ${this.testUser.token}`);
    expect(verifyDeletion.status).toBe(404);
  }

  /**
   * Tests GDPR data processing compliance
   */
  @Test('Data Processing Compliance')
  async testDataProcessingCompliance(): Promise<void> {
    // Test data minimization
    const campaignData = await this.request
      .get(`/api/campaigns/${this.testCampaign.id}`)
      .set('Authorization', `Bearer ${this.testUser.token}`);
    expect(campaignData.body.targeting).not.toHaveProperty('sensitiveData');
    expect(campaignData.body.targeting).toHaveProperty('dataMinimizationApplied', true);

    // Test storage limitation
    const retentionPolicy = await this.request
      .get('/api/system/data-retention-policy')
      .set('Authorization', `Bearer ${this.testUser.token}`);
    expect(retentionPolicy.body).toHaveProperty('campaignDataRetentionDays');
    expect(retentionPolicy.body).toHaveProperty('analyticsDataRetentionDays');

    // Test purpose limitation
    const processingPurposes = await this.request
      .get(`/api/campaigns/${this.testCampaign.id}/processing-purposes`)
      .set('Authorization', `Bearer ${this.testUser.token}`);
    expect(processingPurposes.body).toBeInstanceOf(Array);
    expect(processingPurposes.body.length).toBeGreaterThan(0);
  }

  /**
   * Tests GDPR-compliant consent management
   */
  @Test('Consent Management')
  async testConsentManagement(): Promise<void> {
    // Test explicit consent collection
    const consentResponse = await this.request
      .post('/api/users/consent')
      .set('Authorization', `Bearer ${this.testUser.token}`)
      .send({
        marketingConsent: true,
        analyticsConsent: true,
        thirdPartyDataSharing: false
      });
    expect(consentResponse.status).toBe(200);

    // Test consent withdrawal
    const withdrawalResponse = await this.request
      .delete('/api/users/consent/marketing')
      .set('Authorization', `Bearer ${this.testUser.token}`);
    expect(withdrawalResponse.status).toBe(200);

    // Verify consent records
    const consentHistory = await this.request
      .get('/api/users/consent/history')
      .set('Authorization', `Bearer ${this.testUser.token}`);
    expect(consentHistory.body).toBeInstanceOf(Array);
    expect(consentHistory.body[0]).toHaveProperty('timestamp');
    expect(consentHistory.body[0]).toHaveProperty('action');
  }

  /**
   * Tests data breach notification procedures
   */
  @Test('Data Breach Procedures')
  async testDataBreachProcedures(): Promise<void> {
    // Simulate data breach
    const breachSimulation = await this.testHelpers.simulateDataBreach({
      affectedUsers: [this.testUser.id],
      breachType: 'unauthorized_access',
      dataCompromised: ['email', 'campaign_data']
    });

    // Test breach detection
    expect(breachSimulation.detectionTime).toBeLessThan(72 * 60 * 60 * 1000); // 72 hours in ms

    // Test breach notification
    const notifications = await this.request
      .get('/api/system/breach-notifications')
      .set('Authorization', `Bearer ${this.testUser.token}`);
    expect(notifications.body).toHaveProperty('userNotified', true);
    expect(notifications.body).toHaveProperty('authorityNotified', true);
    expect(notifications.body.notificationTime - breachSimulation.detectionTime)
      .toBeLessThan(72 * 60 * 60 * 1000);

    // Test breach documentation
    const breachRecord = await this.request
      .get(`/api/system/breach-records/${breachSimulation.breachId}`)
      .set('Authorization', `Bearer ${this.testUser.token}`);
    expect(breachRecord.body).toHaveProperty('impactAssessment');
    expect(breachRecord.body).toHaveProperty('mitigationSteps');
    expect(breachRecord.body).toHaveProperty('preventiveMeasures');
  }
}