-- Enable required extensions and custom types
\ir ../migrations/001_initial_schema.sql

-- Create or replace budget utilization calculation function
CREATE OR REPLACE FUNCTION calculate_budget_utilization(
    spent_amount DECIMAL,
    total_budget DECIMAL,
    platform platform_types
) RETURNS DECIMAL AS $$
BEGIN
    -- Validate input parameters
    IF spent_amount IS NULL OR total_budget IS NULL OR platform IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Check for zero division
    IF total_budget = 0 THEN
        RETURN 0;
    END IF;
    
    -- Calculate utilization with platform-specific precision
    RETURN LEAST(
        ROUND(
            CASE platform
                WHEN 'LINKEDIN_ADS' THEN (spent_amount / total_budget) * 100
                WHEN 'GOOGLE_ADS' THEN (spent_amount / total_budget) * 100
            END,
            2
        ),
        100
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    -- Primary key and ownership
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Basic campaign information
    name VARCHAR(255) NOT NULL,
    platform platform_types NOT NULL,
    objective campaign_objectives NOT NULL,
    status campaign_status NOT NULL DEFAULT 'DRAFT',
    
    -- Budget configuration
    budget_type budget_types NOT NULL,
    budget_amount DECIMAL(15,2) NOT NULL,
    spent_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    
    -- Campaign timeline
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    
    -- Platform integration
    platform_campaign_id VARCHAR(100),
    platform_settings JSONB,
    
    -- AI optimization settings
    optimization_settings JSONB,
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT positive_budget CHECK (budget_amount > 0),
    CONSTRAINT positive_spent CHECK (spent_amount >= 0),
    CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date > start_date),
    CONSTRAINT valid_platform_id CHECK (
        (platform_campaign_id IS NULL AND status = 'DRAFT') OR
        (platform_campaign_id IS NOT NULL AND status != 'DRAFT')
    )
);

-- Create ad groups table
CREATE TABLE IF NOT EXISTS ad_groups (
    -- Primary key and campaign reference
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    
    -- Basic ad group information
    name VARCHAR(255) NOT NULL,
    status campaign_status NOT NULL DEFAULT 'DRAFT',
    
    -- Targeting and configuration
    targeting JSONB NOT NULL,
    platform_ad_group_id VARCHAR(100),
    bid_amount DECIMAL(15,2),
    
    -- Performance tracking
    performance_metrics JSONB,
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT positive_bid CHECK (bid_amount IS NULL OR bid_amount > 0)
);

-- Create creatives table
CREATE TABLE IF NOT EXISTS creatives (
    -- Primary key and ad group reference
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ad_group_id UUID NOT NULL REFERENCES ad_groups(id) ON DELETE CASCADE,
    
    -- Creative content
    headline VARCHAR(255) NOT NULL,
    description TEXT,
    image_url VARCHAR(2048),
    call_to_action VARCHAR(50),
    
    -- Platform integration
    platform_creative_id VARCHAR(100),
    
    -- Performance tracking
    performance_metrics JSONB,
    
    -- AI generation tracking
    ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_headline_length CHECK (char_length(headline) <= 255),
    CONSTRAINT valid_image_url CHECK (image_url IS NULL OR image_url ~* '^https?://.*$')
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_platform ON campaigns(platform);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_date_range ON campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_ad_groups_campaign_id ON ad_groups(campaign_id);
CREATE INDEX IF NOT EXISTS idx_creatives_ad_group_id ON creatives(ad_group_id);

-- Add triggers for automatic timestamp updates
CREATE TRIGGER update_campaigns_timestamp
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_ad_groups_timestamp
    BEFORE UPDATE ON ad_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_creatives_timestamp
    BEFORE UPDATE ON creatives
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Add table comments
COMMENT ON TABLE campaigns IS 'Main campaigns table storing campaign metadata, configuration, and platform-specific settings';
COMMENT ON TABLE ad_groups IS 'Ad groups table for organizing ads, targeting settings, and performance tracking';
COMMENT ON TABLE creatives IS 'Creative assets table for storing ad content, media, and performance metrics';

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON campaigns TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ad_groups TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON creatives TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;