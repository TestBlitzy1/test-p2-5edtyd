import { test, expect } from '@playwright/test';
import { setupTestEnvironment, createTestUser } from '../../utils/test.helpers';
import { mockCampaignFixtures } from '../../fixtures/campaign.fixture';
import { 
  PlatformType, 
  CampaignStatus, 
  CampaignObjective 
} from '../../../backend/shared/types/campaign';

// Test configuration
const TEST_TIMEOUT = 60000;
const BASE_URL = process.env.TEST_APP_URL || 'http://localhost:3000';

// Test data
const TEST_USER = {
  email: 'test@example.com',
  password: 'Test123!@#'
};

test.describe('Campaign Creation E2E Tests', () => {
  let browser;
  let context;
  let page;

  test.beforeAll(async () => {
    // Setup test environment
    const testEnv = await setupTestEnvironment({
      dbConfig: {
        host: process.env.TEST_DB_HOST || 'localhost',
        port: parseInt(process.env.TEST_DB_PORT || '5432'),
        database: 'test_db',
        user: 'test_user',
        password: 'test_password'
      },
      mockServerPort: 3001
    });

    // Create test user
    await createTestUser(TEST_USER);
  });

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true
    });
    page = await context.newPage();
    
    // Set longer timeout for AI operations
    page.setDefaultTimeout(TEST_TIMEOUT);

    // Login before each test
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[data-testid="email-input"]', TEST_USER.email);
    await page.fill('[data-testid="password-input"]', TEST_USER.password);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL(`${BASE_URL}/dashboard`);
  });

  test.afterEach(async () => {
    await context.close();
  });

  test('should create LinkedIn campaign with AI-powered optimization', async () => {
    // Navigate to campaign creation
    await page.click('[data-testid="create-campaign-button"]');
    await page.waitForSelector('[data-testid="campaign-wizard"]');

    // Step 1: Campaign Details
    await page.fill('[data-testid="campaign-name-input"]', 'Test LinkedIn Campaign');
    await page.selectOption('[data-testid="platform-select"]', PlatformType.LINKEDIN);
    await page.selectOption('[data-testid="objective-select"]', CampaignObjective.LEAD_GENERATION);
    await page.click('[data-testid="next-button"]');

    // Step 2: Audience Targeting
    await page.waitForSelector('[data-testid="targeting-editor"]');
    await page.selectOption('[data-testid="locations-select"]', ['us', 'uk']);
    await page.selectOption('[data-testid="industries-select"]', ['software', 'technology']);
    await page.selectOption('[data-testid="company-size-select"]', ['11-50', '51-200']);
    
    // Wait for AI suggestions and apply them
    await page.waitForSelector('[data-testid="ai-suggestions"]');
    await page.click('[data-testid="apply-suggestions-button"]');
    await page.click('[data-testid="next-button"]');

    // Step 3: Ad Creatives
    await page.waitForSelector('[data-testid="creative-editor"]');
    await page.fill('[data-testid="headline-input"]', 'Test Campaign Headline');
    await page.fill('[data-testid="description-input"]', 'Detailed campaign description for testing purposes.');
    
    // Upload test image
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles('./test/fixtures/test-image.jpg');
    await page.click('[data-testid="next-button"]');

    // Step 4: Review & Launch
    await page.waitForSelector('[data-testid="campaign-review"]');
    
    // Verify campaign details
    const campaignData = await page.evaluate(() => {
      return JSON.parse(document.querySelector('[data-testid="campaign-json"]').textContent);
    });
    
    expect(campaignData).toMatchObject({
      name: 'Test LinkedIn Campaign',
      platform: PlatformType.LINKEDIN,
      objective: CampaignObjective.LEAD_GENERATION,
      status: CampaignStatus.DRAFT
    });

    // Launch campaign
    await page.click('[data-testid="launch-campaign-button"]');
    
    // Verify success and redirection
    await page.waitForSelector('[data-testid="success-message"]');
    expect(await page.textContent('[data-testid="success-message"]'))
      .toContain('Campaign created successfully');
  });

  test('should create Google Ads campaign with performance targets', async () => {
    await page.click('[data-testid="create-campaign-button"]');
    
    // Step 1: Campaign Details
    await page.fill('[data-testid="campaign-name-input"]', 'Test Google Campaign');
    await page.selectOption('[data-testid="platform-select"]', PlatformType.GOOGLE);
    await page.selectOption('[data-testid="objective-select"]', CampaignObjective.CONVERSIONS);
    await page.click('[data-testid="next-button"]');

    // Step 2: Audience Targeting
    await page.waitForSelector('[data-testid="targeting-editor"]');
    await page.selectOption('[data-testid="locations-select"]', ['us']);
    await page.selectOption('[data-testid="keywords-select"]', ['digital marketing', 'software']);
    
    // Verify audience reach estimation
    await page.waitForSelector('[data-testid="audience-reach"]');
    const reachText = await page.textContent('[data-testid="audience-reach"]');
    expect(reachText).toMatch(/[\d,]+ potential viewers/);
    
    await page.click('[data-testid="next-button"]');

    // Step 3: Ad Creatives
    await page.fill('[data-testid="headline-input"]', 'Google Ads Test Campaign');
    await page.fill('[data-testid="description-input"]', 'Test campaign description');
    await page.fill('[data-testid="destination-url"]', 'https://example.com');
    
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles('./test/fixtures/test-image.jpg');
    
    // Verify creative validation
    await page.waitForSelector('[data-testid="validation-status"]');
    expect(await page.textContent('[data-testid="validation-status"]'))
      .toContain('Valid');
      
    await page.click('[data-testid="next-button"]');

    // Launch campaign and verify creation
    await page.click('[data-testid="launch-campaign-button"]');
    await page.waitForSelector('[data-testid="success-message"]');
  });

  test('should validate campaign creation time requirement', async () => {
    const startTime = Date.now();
    
    // Create campaign with minimum required fields
    await page.click('[data-testid="create-campaign-button"]');
    await page.fill('[data-testid="campaign-name-input"]', 'Quick Test Campaign');
    await page.selectOption('[data-testid="platform-select"]', PlatformType.LINKEDIN);
    await page.selectOption('[data-testid="objective-select"]', CampaignObjective.LEAD_GENERATION);
    
    // Complete all required steps quickly
    await page.click('[data-testid="quick-setup-button"]');
    
    // Wait for campaign creation
    await page.waitForSelector('[data-testid="success-message"]');
    
    const endTime = Date.now();
    const creationTime = endTime - startTime;
    
    // Verify creation time is within 15 minutes requirement
    expect(creationTime).toBeLessThan(15 * 60 * 1000);
  });

  test('should handle validation errors appropriately', async () => {
    await page.click('[data-testid="create-campaign-button"]');
    
    // Try to proceed without required fields
    await page.click('[data-testid="next-button"]');
    
    // Verify validation messages
    const errors = await page.locator('[data-testid="validation-error"]').all();
    expect(errors.length).toBeGreaterThan(0);
    
    // Verify each required field has appropriate error message
    const errorMessages = await Promise.all(
      errors.map(error => error.textContent())
    );
    
    expect(errorMessages).toContain('Campaign name is required');
    expect(errorMessages).toContain('Platform selection is required');
    expect(errorMessages).toContain('Campaign objective is required');
  });
});