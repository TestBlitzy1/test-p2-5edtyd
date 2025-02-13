import { GoogleAdsService } from '../../../backend/platform-integration/src/services/google.service';
import { LinkedInService } from '../../../backend/platform-integration/src/services/linkedin.service';
import { ICampaign, PlatformType, CampaignStatus, CompanySizeRange } from '../../../backend/shared/types/campaign.types';
import { MetricType } from '../../../backend/shared/types/analytics.types';

describe('Platform Compliance Test Suite', () => {
    let googleAdsService: GoogleAdsService;
    let linkedInService: LinkedInService;
    let mockCampaign: ICampaign;

    beforeEach(() => {
        // Initialize services with test credentials
        googleAdsService = new GoogleAdsService();
        linkedInService = new LinkedInService('test-account-id');

        // Setup mock campaign data
        mockCampaign = {
            id: 'test-campaign-id',
            userId: 'test-user-id',
            name: 'Test Compliance Campaign',
            platform: PlatformType.GOOGLE,
            status: CampaignStatus.DRAFT,
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
                    country: 'United States',
                    radius: 50,
                    radiusUnit: 'MI'
                }],
                industries: ['SOFTWARE'],
                companySize: [CompanySizeRange.MEDIUM, CompanySizeRange.LARGE],
                jobTitles: ['Software Engineer', 'Developer'],
                interests: ['Technology', 'Programming'],
                platformSpecific: {
                    google: {
                        keywords: ['software development', 'programming'],
                        topics: ['Technology', 'Software'],
                        placements: [],
                        audiences: ['tech_enthusiasts']
                    }
                }
            },
            adGroups: [],
            performanceTargets: [{
                metric: MetricType.CTR,
                target: 2.5,
                timeframe: 30,
                priority: 1
            }],
            aiOptimization: {
                enabled: true,
                optimizationGoals: [MetricType.CTR, MetricType.CONVERSIONS],
                autoOptimize: true,
                minBudgetAdjustment: -20,
                maxBudgetAdjustment: 50,
                optimizationFrequency: 24
            },
            createdAt: new Date(),
            updatedAt: new Date()
        } as ICampaign;
    });

    describe('Google Ads Compliance Tests', () => {
        it('should validate campaign content against prohibited content policies', async () => {
            const result = await googleAdsService.validateCampaignPolicies(mockCampaign);
            expect(result.isValid).toBe(true);
            expect(result.violations).toHaveLength(0);
        });

        it('should validate targeting restrictions for sensitive categories', async () => {
            mockCampaign.targeting.platformSpecific.google.topics = ['Healthcare'];
            const result = await googleAdsService.validateCampaignPolicies(mockCampaign);
            expect(result.restrictions).toBeDefined();
            expect(result.restrictions.sensitiveCategories).toContain('Healthcare');
        });

        it('should enforce daily budget minimum requirements', async () => {
            mockCampaign.budget.amount = 0.5; // Below minimum
            await expect(googleAdsService.validateCampaignPolicies(mockCampaign))
                .rejects.toThrow('Daily budget must be at least $1.00 USD');
        });

        it('should validate ad format specifications', async () => {
            const result = await googleAdsService.validateCampaignPolicies(mockCampaign);
            expect(result.adFormatValidation).toBeDefined();
            expect(result.adFormatValidation.isValid).toBe(true);
        });

        it('should check API rate limit compliance', async () => {
            const rateLimitCheck = await googleAdsService.checkRateLimits();
            expect(rateLimitCheck.remainingQuota).toBeGreaterThan(0);
            expect(rateLimitCheck.quotaResetTime).toBeDefined();
        });
    });

    describe('LinkedIn Ads Compliance Tests', () => {
        beforeEach(() => {
            mockCampaign.platform = PlatformType.LINKEDIN;
            mockCampaign.platformConfig = {
                linkedin: {
                    campaignType: 'SPONSORED_UPDATES',
                    objectiveType: 'LEAD_GENERATION',
                    audienceExpansion: true,
                    enabledNetworks: ['LINKEDIN']
                }
            };
        });

        it('should validate professional content guidelines', async () => {
            const result = await linkedInService.validateCampaignPolicies(mockCampaign);
            expect(result.contentGuidelines).toBeDefined();
            expect(result.contentGuidelines.isProfessional).toBe(true);
        });

        it('should enforce B2B targeting compliance', async () => {
            const result = await linkedInService.validateCampaignPolicies(mockCampaign);
            expect(result.targetingCompliance).toBeDefined();
            expect(result.targetingCompliance.isB2BCompliant).toBe(true);
        });

        it('should validate sponsored content requirements', async () => {
            const result = await linkedInService.validateCampaignPolicies(mockCampaign);
            expect(result.sponsoredContent).toBeDefined();
            expect(result.sponsoredContent.meetsRequirements).toBe(true);
        });

        it('should check API quota compliance', async () => {
            const quotaCheck = await linkedInService.checkRateLimits();
            expect(quotaCheck.remaining).toBeGreaterThan(0);
            expect(quotaCheck.resetTime).toBeDefined();
        });
    });

    describe('Cross-Platform Compliance Tests', () => {
        it('should handle platform-specific error responses', async () => {
            const googleError = await googleAdsService.validateCampaignPolicies({
                ...mockCampaign,
                platform: PlatformType.GOOGLE
            }).catch(error => error);

            const linkedInError = await linkedInService.validateCampaignPolicies({
                ...mockCampaign,
                platform: PlatformType.LINKEDIN
            }).catch(error => error);

            expect(googleError.code).toBeDefined();
            expect(linkedInError.code).toBeDefined();
        });

        it('should validate cross-platform rate limiting', async () => {
            const googleRateLimit = await googleAdsService.checkRateLimits();
            const linkedInRateLimit = await linkedInService.checkRateLimits();

            expect(googleRateLimit.isRateLimited).toBeDefined();
            expect(linkedInRateLimit.isRateLimited).toBeDefined();
        });

        it('should enforce platform-specific budget constraints', async () => {
            const googleBudget = await googleAdsService.validateCampaignPolicies(mockCampaign);
            mockCampaign.platform = PlatformType.LINKEDIN;
            const linkedInBudget = await linkedInService.validateCampaignPolicies(mockCampaign);

            expect(googleBudget.budgetValidation.isValid).toBe(true);
            expect(linkedInBudget.budgetValidation.isValid).toBe(true);
        });
    });
});