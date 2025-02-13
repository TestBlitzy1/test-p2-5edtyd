import { Browser, Page } from 'puppeteer'; // @types/puppeteer@^21.0.0
import { setupTestEnvironment, createTestCampaign, createTestUser } from '../../utils/test.helpers';
import { OpenAIService } from '../../../../backend/ai-service/src/services/openai_service';
import { PlatformType, CampaignStatus, ICreativeAsset } from '../../../backend/shared/types/campaign.types';
import { TEST_USER_ID, TEST_CAMPAIGN_ID } from '../../utils/test.constants';

describe('Creative Optimization E2E Tests', () => {
  let browser: Browser;
  let page: Page;
  let testUserId: string;
  let testCampaignId: string;
  let openAIService: OpenAIService;

  beforeAll(async () => {
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

    // Create test user and campaign
    testUserId = TEST_USER_ID;
    testCampaignId = TEST_CAMPAIGN_ID;

    // Setup browser for E2E testing
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();

    // Configure viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Initialize OpenAI service
    openAIService = new OpenAIService({
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      OPENAI_MODEL_VERSION: 'gpt-4',
      MAX_TOKENS: 2048,
      TEMPERATURE: 0.7
    });
  });

  afterAll(async () => {
    await browser.close();
    await openAIService.close();
  });

  describe('Creative Generation Tests', () => {
    test('should generate AI-powered creative variations', async () => {
      // Navigate to creative editor
      await page.goto(`${process.env.BASE_URL}/campaigns/${testCampaignId}/creatives`);
      await page.waitForSelector('[data-testid="creative-editor"]');

      // Click generate creative button
      await page.click('[data-testid="generate-creative-btn"]');
      await page.waitForSelector('[data-testid="creative-variations"]');

      // Verify multiple variations are generated
      const variations = await page.$$('[data-testid="creative-variation"]');
      expect(variations.length).toBeGreaterThan(1);

      // Validate creative content structure
      for (const variation of variations) {
        const headline = await variation.$eval('[data-testid="headline"]', el => el.textContent);
        const description = await variation.$eval('[data-testid="description"]', el => el.textContent);
        const cta = await variation.$eval('[data-testid="cta"]', el => el.textContent);

        expect(headline).toBeTruthy();
        expect(description).toBeTruthy();
        expect(cta).toBeTruthy();
      }
    }, 30000);

    test('should validate platform-specific creative requirements', async () => {
      // Select LinkedIn platform
      await page.select('[data-testid="platform-select"]', PlatformType.LINKEDIN);

      // Generate LinkedIn-specific creative
      await page.click('[data-testid="generate-creative-btn"]');
      await page.waitForSelector('[data-testid="creative-preview"]');

      // Verify LinkedIn character limits
      const headline = await page.$eval('[data-testid="headline"]', el => el.textContent);
      const description = await page.$eval('[data-testid="description"]', el => el.textContent);

      expect(headline?.length).toBeLessThanOrEqual(150);
      expect(description?.length).toBeLessThanOrEqual(600);
    }, 30000);
  });

  describe('Creative Optimization Tests', () => {
    test('should optimize existing creative based on performance data', async () => {
      // Navigate to optimization page
      await page.goto(`${process.env.BASE_URL}/campaigns/${testCampaignId}/optimize`);
      await page.waitForSelector('[data-testid="creative-optimizer"]');

      // Select creative for optimization
      await page.click('[data-testid="creative-select"]');
      await page.click('[data-testid="optimize-creative-btn"]');

      // Wait for optimization results
      await page.waitForSelector('[data-testid="optimization-results"]');

      // Verify optimization suggestions
      const suggestions = await page.$$('[data-testid="optimization-suggestion"]');
      expect(suggestions.length).toBeGreaterThan(0);

      // Validate performance metrics
      const metrics = await page.$eval('[data-testid="performance-metrics"]', el => {
        return {
          ctr: parseFloat(el.getAttribute('data-ctr') || '0'),
          conversionRate: parseFloat(el.getAttribute('data-conversion-rate') || '0')
        };
      });

      expect(metrics.ctr).toBeGreaterThan(0);
      expect(metrics.conversionRate).toBeGreaterThan(0);
    }, 30000);

    test('should apply AI-suggested optimizations', async () => {
      // Select optimization suggestion
      await page.click('[data-testid="apply-suggestion-btn"]');
      await page.waitForSelector('[data-testid="optimization-applied"]');

      // Verify creative updates
      const updatedCreative = await page.$eval('[data-testid="creative-content"]', el => ({
        headline: el.querySelector('[data-testid="headline"]')?.textContent,
        description: el.querySelector('[data-testid="description"]')?.textContent,
        cta: el.querySelector('[data-testid="cta"]')?.textContent
      }));

      expect(updatedCreative.headline).toBeTruthy();
      expect(updatedCreative.description).toBeTruthy();
      expect(updatedCreative.cta).toBeTruthy();

      // Verify optimization history
      const historyEntries = await page.$$('[data-testid="optimization-history-entry"]');
      expect(historyEntries.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Multi-Platform Creative Tests', () => {
    test('should generate platform-specific creatives', async () => {
      // Test LinkedIn creative generation
      await page.select('[data-testid="platform-select"]', PlatformType.LINKEDIN);
      await page.click('[data-testid="generate-creative-btn"]');
      await page.waitForSelector('[data-testid="linkedin-creative"]');

      const linkedinCreative = await page.$eval('[data-testid="linkedin-creative"]', el => ({
        headline: el.querySelector('[data-testid="headline"]')?.textContent,
        description: el.querySelector('[data-testid="description"]')?.textContent
      }));

      expect(linkedinCreative.headline?.length).toBeLessThanOrEqual(150);
      expect(linkedinCreative.description?.length).toBeLessThanOrEqual(600);

      // Test Google Ads creative generation
      await page.select('[data-testid="platform-select"]', PlatformType.GOOGLE);
      await page.click('[data-testid="generate-creative-btn"]');
      await page.waitForSelector('[data-testid="google-creative"]');

      const googleCreative = await page.$eval('[data-testid="google-creative"]', el => ({
        headline: el.querySelector('[data-testid="headline"]')?.textContent,
        description: el.querySelector('[data-testid="description"]')?.textContent
      }));

      expect(googleCreative.headline?.length).toBeLessThanOrEqual(90);
      expect(googleCreative.description?.length).toBeLessThanOrEqual(180);
    }, 30000);

    test('should validate creative assets across platforms', async () => {
      const testAsset: ICreativeAsset = {
        id: 'test-asset-1',
        type: 'IMAGE',
        url: 'https://example.com/test-image.jpg',
        title: 'Test Creative',
        description: 'Test Description'
      };

      // Validate LinkedIn image requirements
      await page.select('[data-testid="platform-select"]', PlatformType.LINKEDIN);
      await page.$eval('[data-testid="asset-upload"]', (el: HTMLInputElement) => {
        const dataTransfer = new DataTransfer();
        const file = new File(['test'], 'test-image.jpg', { type: 'image/jpeg' });
        dataTransfer.items.add(file);
        el.files = dataTransfer.files;
      });

      const linkedinValidation = await page.$eval('[data-testid="asset-validation"]', el => 
        el.getAttribute('data-valid')
      );
      expect(linkedinValidation).toBe('true');

      // Validate Google Ads image requirements
      await page.select('[data-testid="platform-select"]', PlatformType.GOOGLE);
      const googleValidation = await page.$eval('[data-testid="asset-validation"]', el => 
        el.getAttribute('data-valid')
      );
      expect(googleValidation).toBe('true');
    }, 30000);
  });
});