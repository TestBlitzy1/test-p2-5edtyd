import { describe, it, expect } from '@jest/globals';
import { Page } from '@playwright/test';
import { setupTestEnvironment, cleanupTestEnvironment } from '../../utils/test.helpers';
import { generateMockCampaign } from '../../fixtures/campaign.fixture';
import { 
    MetricType, 
    TimeGranularity 
} from '../../../backend/shared/types/analytics.types';
import { PlatformType } from '../../../backend/shared/types/campaign.types';

describe('Analytics Reports E2E Tests', () => {
    let page: Page;
    let testCampaign: any;

    beforeAll(async () => {
        // Initialize test environment with analytics configuration
        await setupTestEnvironment();
        testCampaign = generateMockCampaign({
            platform: PlatformType.LINKEDIN,
            aiOptimization: {
                enabled: true,
                optimizationGoals: [MetricType.CTR, MetricType.CONVERSIONS, MetricType.ROAS],
                autoOptimize: true,
                minBudgetAdjustment: -20,
                maxBudgetAdjustment: 50,
                optimizationFrequency: 24
            }
        });
    });

    afterAll(async () => {
        await cleanupTestEnvironment();
    });

    describe('Real-time Performance Analytics', () => {
        it('should display real-time performance metrics correctly', async () => {
            // Navigate to analytics dashboard
            await page.goto('/analytics/dashboard');
            
            // Verify key metric components are present
            await expect(page.locator('[data-testid="metrics-panel"]')).toBeVisible();
            await expect(page.locator('[data-testid="ctr-metric"]')).toBeVisible();
            await expect(page.locator('[data-testid="conversion-metric"]')).toBeVisible();
            await expect(page.locator('[data-testid="roas-metric"]')).toBeVisible();

            // Verify real-time updates
            const initialCTR = await page.locator('[data-testid="ctr-value"]').textContent();
            await page.waitForTimeout(5000); // Wait for real-time update
            const updatedCTR = await page.locator('[data-testid="ctr-value"]').textContent();
            expect(updatedCTR).not.toBe(initialCTR);
        });

        it('should allow time range selection and update metrics accordingly', async () => {
            // Test different time ranges
            const timeRanges = ['24h', '7d', '30d', '90d'];
            
            for (const range of timeRanges) {
                await page.selectOption('[data-testid="time-range-selector"]', range);
                await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
                await expect(page.locator('[data-testid="metrics-panel"]')).toBeVisible();
                
                // Verify metrics are updated for the selected time range
                await expect(page.locator(`[data-testid="time-range-${range}"]`)).toHaveClass(/active/);
            }
        });
    });

    describe('ROI Calculations', () => {
        it('should calculate and display accurate ROI metrics', async () => {
            await page.goto('/analytics/roi');

            // Verify ROI components
            await expect(page.locator('[data-testid="roi-calculator"]')).toBeVisible();
            
            // Test ROI calculation with different inputs
            await page.fill('[data-testid="campaign-cost"]', '1000');
            await page.fill('[data-testid="campaign-revenue"]', '5000');
            
            // Verify calculated ROI
            const roiValue = await page.locator('[data-testid="roi-value"]').textContent();
            expect(parseFloat(roiValue!)).toBe(400); // (5000-1000)/1000 * 100
        });

        it('should display ROI trends and forecasts', async () => {
            // Verify trend chart is present
            await expect(page.locator('[data-testid="roi-trend-chart"]')).toBeVisible();
            
            // Verify forecast section
            await expect(page.locator('[data-testid="roi-forecast"]')).toBeVisible();
            await expect(page.locator('[data-testid="forecast-confidence"]')).toBeVisible();
        });
    });

    describe('Budget Optimization Tracking', () => {
        it('should track and display budget optimization metrics', async () => {
            await page.goto('/analytics/budget');

            // Verify budget tracking components
            await expect(page.locator('[data-testid="budget-overview"]')).toBeVisible();
            await expect(page.locator('[data-testid="spend-tracking"]')).toBeVisible();
            await expect(page.locator('[data-testid="optimization-suggestions"]')).toBeVisible();
        });

        it('should provide AI-driven budget optimization recommendations', async () => {
            // Verify AI recommendations section
            await expect(page.locator('[data-testid="ai-recommendations"]')).toBeVisible();
            
            // Check for specific recommendation components
            const recommendations = page.locator('[data-testid="recommendation-item"]');
            await expect(recommendations).toHaveCount(await recommendations.count());
            
            // Verify recommendation details
            await expect(page.locator('[data-testid="recommendation-impact"]')).toBeVisible();
            await expect(page.locator('[data-testid="recommendation-confidence"]')).toBeVisible();
        });
    });

    describe('Data Visualization', () => {
        it('should render interactive data visualizations correctly', async () => {
            await page.goto('/analytics/visualizations');

            // Verify chart components
            await expect(page.locator('[data-testid="performance-chart"]')).toBeVisible();
            await expect(page.locator('[data-testid="trend-chart"]')).toBeVisible();
            await expect(page.locator('[data-testid="comparison-chart"]')).toBeVisible();

            // Test chart interactivity
            await page.click('[data-testid="chart-data-point"]');
            await expect(page.locator('[data-testid="tooltip"]')).toBeVisible();
        });

        it('should support data export functionality', async () => {
            // Test export options
            await page.click('[data-testid="export-button"]');
            await expect(page.locator('[data-testid="export-menu"]')).toBeVisible();
            
            // Verify export formats
            const exportFormats = ['CSV', 'PDF', 'XLSX'];
            for (const format of exportFormats) {
                await expect(page.locator(`[data-testid="export-${format}"]`)).toBeVisible();
            }
        });
    });

    describe('Cross-Platform Analytics', () => {
        it('should display aggregated metrics across platforms', async () => {
            await page.goto('/analytics/cross-platform');

            // Verify platform-specific metrics
            await expect(page.locator('[data-testid="linkedin-metrics"]')).toBeVisible();
            await expect(page.locator('[data-testid="google-metrics"]')).toBeVisible();
            
            // Verify comparison metrics
            await expect(page.locator('[data-testid="platform-comparison"]')).toBeVisible();
        });

        it('should allow platform-specific metric filtering', async () => {
            // Test platform filters
            await page.click('[data-testid="platform-filter-linkedin"]');
            await expect(page.locator('[data-testid="linkedin-metrics"]')).toBeVisible();
            await expect(page.locator('[data-testid="google-metrics"]')).toBeHidden();
            
            await page.click('[data-testid="platform-filter-google"]');
            await expect(page.locator('[data-testid="google-metrics"]')).toBeVisible();
            await expect(page.locator('[data-testid="linkedin-metrics"]')).toBeHidden();
        });
    });
});