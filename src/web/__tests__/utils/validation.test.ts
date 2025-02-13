import { describe, it, expect } from '@jest/globals'; // v29.7.0
import { 
  validateCampaign,
  validateLoginCredentials,
  validateBudget,
  validateTargeting
} from '../../src/lib/validation';
import { 
  ICampaign,
  PlatformType,
  BudgetPeriod,
  CampaignStatus,
  CampaignObjective
} from '../../src/types/campaign';

// Test data constants
const TEST_CAMPAIGN_DATA: ICampaign = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  userId: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Test Campaign',
  platform: PlatformType.LINKEDIN,
  objective: CampaignObjective.LEAD_GENERATION,
  status: CampaignStatus.DRAFT,
  budget: {
    amount: 5000,
    currency: 'USD',
    period: BudgetPeriod.DAILY
  },
  targeting: {
    locations: ['US', 'UK'],
    industries: ['SOFTWARE'],
    companySize: ['10-50'],
    jobTitles: ['Software Engineer']
  },
  adGroups: [{
    name: 'Test Ad Group',
    ads: [{
      headline: 'Test Ad',
      description: 'Test Description',
      imageUrl: 'https://example.com/image.jpg',
      destinationUrl: 'https://example.com'
    }],
    status: CampaignStatus.DRAFT
  }],
  performanceTargets: [{
    metricType: 'CTR',
    target: 2.5
  }],
  createdAt: new Date(),
  updatedAt: new Date()
};

const TEST_LOGIN_CREDENTIALS = {
  email: 'test@example.com',
  password: 'SecurePass123!'
};

describe('Campaign Validation Tests', () => {
  it('should validate a complete and valid campaign structure', async () => {
    const result = await validateCampaign(TEST_CAMPAIGN_DATA);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate platform-specific requirements for LinkedIn', async () => {
    const linkedInCampaign = {
      ...TEST_CAMPAIGN_DATA,
      platform: PlatformType.LINKEDIN,
      targeting: {
        ...TEST_CAMPAIGN_DATA.targeting,
        jobTitles: [] // LinkedIn requires job titles
      }
    };
    const result = await validateCampaign(linkedInCampaign);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'NO_JOB_TITLES'
      })
    );
  });

  it('should validate campaign structure within time limit', async () => {
    const startTime = Date.now();
    await validateCampaign(TEST_CAMPAIGN_DATA);
    const endTime = Date.now();
    const duration = endTime - startTime;
    expect(duration).toBeLessThan(5000); // 5 seconds max
  });

  it('should validate campaign compliance rules', async () => {
    const nonCompliantCampaign = {
      ...TEST_CAMPAIGN_DATA,
      targeting: {
        ...TEST_CAMPAIGN_DATA.targeting,
        locations: Array(31).fill('US') // Exceeds max locations
      }
    };
    const result = await validateCampaign(nonCompliantCampaign);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'EXCESSIVE_LOCATIONS'
      })
    );
  });
});

describe('Login Credentials Validation Tests', () => {
  it('should validate correct login credentials', async () => {
    const result = await validateLoginCredentials(TEST_LOGIN_CREDENTIALS);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate email format', async () => {
    const result = await validateLoginCredentials({
      ...TEST_LOGIN_CREDENTIALS,
      email: 'invalid-email'
    });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_EMAIL'
      })
    );
  });

  it('should validate password complexity requirements', async () => {
    const result = await validateLoginCredentials({
      ...TEST_LOGIN_CREDENTIALS,
      password: 'weak'
    });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_PASSWORD'
      })
    );
  });

  it('should check MFA requirements for sensitive accounts', async () => {
    const result = await validateLoginCredentials({
      ...TEST_LOGIN_CREDENTIALS,
      email: 'admin@example.com'
    });
    expect(result.requiresMFA).toBe(true);
  });
});

describe('Budget Validation Tests', () => {
  it('should validate minimum budget requirements for LinkedIn', () => {
    const result = validateBudget({
      amount: 5,
      currency: 'USD',
      period: BudgetPeriod.DAILY
    }, PlatformType.LINKEDIN);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'INSUFFICIENT_BUDGET'
      })
    );
  });

  it('should validate supported currencies', () => {
    const result = validateBudget({
      amount: 5000,
      currency: 'XYZ',
      period: BudgetPeriod.DAILY
    }, PlatformType.LINKEDIN);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'UNSUPPORTED_CURRENCY'
      })
    );
  });

  it('should provide budget optimization recommendations', () => {
    const result = validateBudget({
      amount: 15,
      currency: 'USD',
      period: BudgetPeriod.DAILY
    }, PlatformType.LINKEDIN);
    expect(result.recommendations).toContainEqual(
      expect.objectContaining({
        type: 'INCREASE'
      })
    );
  });
});

describe('Targeting Validation Tests', () => {
  it('should validate location targeting limits', async () => {
    const result = await validateTargeting({
      ...TEST_CAMPAIGN_DATA.targeting,
      locations: Array(31).fill('US')
    }, PlatformType.LINKEDIN);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'EXCESSIVE_LOCATIONS'
      })
    );
  });

  it('should validate industry targeting requirements', async () => {
    const result = await validateTargeting({
      ...TEST_CAMPAIGN_DATA.targeting,
      industries: []
    }, PlatformType.LINKEDIN);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'NO_INDUSTRIES'
      })
    );
  });

  it('should validate platform-specific targeting requirements', async () => {
    const result = await validateTargeting({
      ...TEST_CAMPAIGN_DATA.targeting,
      jobTitles: []
    }, PlatformType.LINKEDIN);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'NO_JOB_TITLES'
      })
    );
  });

  it('should provide reach estimates for valid targeting', async () => {
    const result = await validateTargeting(TEST_CAMPAIGN_DATA.targeting, PlatformType.LINKEDIN);
    expect(result.isValid).toBe(true);
    expect(result.reachEstimate).toEqual(
      expect.objectContaining({
        minReach: expect.any(Number),
        maxReach: expect.any(Number),
        confidence: expect.any(Number)
      })
    );
  });
});