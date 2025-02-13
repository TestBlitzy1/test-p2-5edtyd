-- Test Data Seed File for Sales Intelligence Platform
-- Version: 1.0
-- Description: Provides comprehensive test data for development and testing environments

-- Begin transaction
BEGIN;

-- Clean existing data with cascading delete
DO $$ 
BEGIN
    EXECUTE 'TRUNCATE TABLE users, campaigns, analytics, metrics, performance_reports, forecasts CASCADE';
END $$;

-- Generate test users with different roles and authentication providers
INSERT INTO users (id, email, password, role, provider) VALUES
    -- Admin user with full system access
    ('11111111-1111-1111-1111-111111111111', 'admin@test.com', '$2b$10$testHashedPassword', 'ADMIN', 'LOCAL'),
    -- Manager with platform-specific permissions
    ('22222222-2222-2222-2222-222222222222', 'manager@test.com', '$2b$10$testHashedPassword', 'MANAGER', 'GOOGLE'),
    -- Analyst with read-only analytics access
    ('33333333-3333-3333-3333-333333333333', 'analyst@test.com', '$2b$10$testHashedPassword', 'ANALYST', 'LINKEDIN'),
    -- Regular user with basic campaign access
    ('44444444-4444-4444-4444-444444444444', 'user@test.com', '$2b$10$testHashedPassword', 'USER', 'LOCAL');

-- Generate LinkedIn campaign test data
INSERT INTO campaigns (id, user_id, name, platform, objective, status, budget_type, budget_amount, start_date, end_date, platform_campaign_id, platform_settings, optimization_settings) VALUES
    -- Active LinkedIn campaign with full configuration
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 
     '22222222-2222-2222-2222-222222222222',
     'LinkedIn Lead Gen Q1 2024',
     'LINKEDIN_ADS',
     'CONVERSION',
     'ACTIVE',
     'DAILY',
     1000.00,
     CURRENT_TIMESTAMP - INTERVAL '30 days',
     CURRENT_TIMESTAMP + INTERVAL '60 days',
     'LI_CAMP_123456',
     '{"targeting": {"industries": ["Technology", "Marketing"], "company_size": [">500"]}, "bidding": {"strategy": "AUTO"}}',
     '{"optimization_goal": "LEAD_QUALITY", "ai_recommendations": true}'
    ),
    -- Draft LinkedIn campaign for testing
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     '44444444-4444-4444-4444-444444444444',
     'Brand Awareness Campaign',
     'LINKEDIN_ADS',
     'AWARENESS',
     'DRAFT',
     'LIFETIME',
     5000.00,
     CURRENT_TIMESTAMP + INTERVAL '7 days',
     CURRENT_TIMESTAMP + INTERVAL '37 days',
     NULL,
     '{"targeting": {"locations": ["United States"], "job_titles": ["Marketing Manager"]}}',
     '{"optimization_goal": "REACH"}'
    );

-- Generate Google Ads campaign test data
INSERT INTO campaigns (id, user_id, name, platform, objective, status, budget_type, budget_amount, start_date, end_date, platform_campaign_id, platform_settings, optimization_settings) VALUES
    -- Active Google Ads campaign
    ('cccccccc-cccc-cccc-cccc-cccccccccccc',
     '22222222-2222-2222-2222-222222222222',
     'Search Performance Max',
     'GOOGLE_ADS',
     'CONVERSION',
     'ACTIVE',
     'DAILY',
     500.00,
     CURRENT_TIMESTAMP - INTERVAL '15 days',
     CURRENT_TIMESTAMP + INTERVAL '45 days',
     'GA_CAMP_789012',
     '{"targeting": {"keywords": ["digital marketing", "automation"], "locations": ["US"]}, "bidding": {"strategy": "MAXIMIZE_CONVERSIONS"}}',
     '{"optimization_goal": "CONVERSION_VALUE", "ai_recommendations": true}'
    );

-- Generate ad groups for campaigns
INSERT INTO ad_groups (id, campaign_id, name, status, targeting, platform_ad_group_id, bid_amount, performance_metrics) VALUES
    -- LinkedIn ad groups
    ('11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'Tech Decision Makers',
     'ACTIVE',
     '{"seniority": ["Director", "VP"], "skills": ["Digital Transformation"]}',
     'LI_AG_111111',
     25.00,
     '{"impressions": 15000, "clicks": 450, "conversions": 23}'
    ),
    -- Google Ads ad groups
    ('22222222-cccc-cccc-cccc-cccccccccccc',
     'cccccccc-cccc-cccc-cccc-cccccccccccc',
     'Marketing Automation',
     'ACTIVE',
     '{"keywords": ["marketing automation software", "campaign automation"]}',
     'GA_AG_222222',
     15.00,
     '{"impressions": 25000, "clicks": 750, "conversions": 45}'
    );

-- Generate creative assets
INSERT INTO creatives (id, ad_group_id, headline, description, image_url, call_to_action, platform_creative_id, performance_metrics, ai_generated) VALUES
    -- LinkedIn creative
    ('aaaaaaaa-1111-aaaa-aaaa-aaaaaaaaaaaa',
     '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'Transform Your Marketing with AI',
     'Discover how AI can automate your campaign creation and optimization. Book a demo today!',
     'https://assets.example.com/images/linkedin-creative-1.jpg',
     'Book Demo',
     'LI_CR_111111',
     '{"impressions": 7500, "clicks": 225, "ctr": 3.0}',
     true
    ),
    -- Google Ads creative
    ('cccccccc-2222-cccc-cccc-cccccccccccc',
     '22222222-cccc-cccc-cccc-cccccccccccc',
     'AI-Powered Marketing Automation',
     'Reduce campaign setup time by 80%. Start your free trial today!',
     'https://assets.example.com/images/google-creative-1.jpg',
     'Start Free Trial',
     'GA_CR_222222',
     '{"impressions": 12500, "clicks": 375, "ctr": 3.0}',
     true
    );

-- Generate analytics data
INSERT INTO analytics (id, campaign_id, user_id, start_date, end_date, granularity) VALUES
    -- LinkedIn campaign analytics
    ('analytics-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     '22222222-2222-2222-2222-222222222222',
     CURRENT_TIMESTAMP - INTERVAL '30 days',
     CURRENT_TIMESTAMP,
     'DAILY'
    ),
    -- Google Ads campaign analytics
    ('analytics-cccc-cccc-cccc-cccccccccccc',
     'cccccccc-cccc-cccc-cccc-cccccccccccc',
     '22222222-2222-2222-2222-222222222222',
     CURRENT_TIMESTAMP - INTERVAL '15 days',
     CURRENT_TIMESTAMP,
     'DAILY'
    );

-- Generate metrics data (last 30 days)
INSERT INTO metrics (analytics_id, metric_type, value, timestamp)
SELECT 
    'analytics-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    metric_type,
    CASE 
        WHEN metric_type = 'IMPRESSIONS' THEN RANDOM() * 1000
        WHEN metric_type = 'CLICKS' THEN RANDOM() * 50
        WHEN metric_type = 'CTR' THEN RANDOM() * 5
        WHEN metric_type = 'CONVERSIONS' THEN RANDOM() * 10
        WHEN metric_type = 'COST' THEN RANDOM() * 100
        WHEN metric_type = 'CPC' THEN RANDOM() * 2 + 1
        WHEN metric_type = 'CPM' THEN RANDOM() * 20 + 10
        WHEN metric_type = 'ROAS' THEN RANDOM() * 4 + 1
    END,
    CURRENT_TIMESTAMP - (INTERVAL '1 day' * generate_series(0, 29))
FROM unnest(enum_range(NULL::metric_types)) metric_type;

-- Generate performance reports
INSERT INTO performance_reports (campaign_id, metrics_summary, trends, recommendations) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     '{"impressions": 45000, "clicks": 1350, "conversions": 69, "ctr": 3.0, "cost": 3000}',
     '{"ctr_trend": "increasing", "cpc_trend": "stable", "conversion_trend": "increasing"}',
     ARRAY['Increase budget allocation to top-performing ad groups', 'Test new creative variations', 'Expand targeting to similar audiences']
    );

-- Generate forecasts
INSERT INTO forecasts (campaign_id, predictions, confidence, forecast_date) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     '{"impressions": 60000, "clicks": 1800, "conversions": 90, "cost": 4000}',
     85.5,
     CURRENT_TIMESTAMP + INTERVAL '30 days'
    );

COMMIT;