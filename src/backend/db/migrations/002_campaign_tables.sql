-- Create custom enums for campaign management
CREATE TYPE targeting_types AS ENUM (
    'LOCATION',
    'INDUSTRY',
    'COMPANY_SIZE',
    'JOB_TITLE',
    'INTERESTS',
    'DEMOGRAPHICS'
);

CREATE TYPE creative_types AS ENUM (
    'TEXT',
    'IMAGE',
    'VIDEO',
    'CAROUSEL'
);

CREATE TYPE ad_group_status AS ENUM (
    'DRAFT',
    'ACTIVE',
    'PAUSED',
    'ARCHIVED'
);

-- Create ad_groups table for campaign organization
CREATE TABLE ad_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status ad_group_status NOT NULL DEFAULT 'DRAFT',
    platform_ad_group_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create targeting_rules table for ad group targeting
CREATE TABLE targeting_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ad_group_id UUID NOT NULL REFERENCES ad_groups(id) ON DELETE CASCADE,
    targeting_type targeting_types NOT NULL,
    parameters JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_targeting_parameters CHECK (jsonb_typeof(parameters) = 'object')
);

-- Create creatives table for ad content
CREATE TABLE creatives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ad_group_id UUID NOT NULL REFERENCES ad_groups(id) ON DELETE CASCADE,
    type creative_types NOT NULL,
    content JSONB NOT NULL,
    platform_creative_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_creative_content CHECK (jsonb_typeof(content) = 'object')
);

-- Create performance_targets table for campaign goals and forecasts
CREATE TABLE performance_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    metric_type metric_types NOT NULL,
    target_value DECIMAL(15,4) NOT NULL,
    forecast_value DECIMAL(15,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT positive_target_value CHECK (target_value > 0),
    CONSTRAINT valid_forecast_value CHECK (forecast_value IS NULL OR forecast_value > 0)
);

-- Create function to validate targeting rules
CREATE OR REPLACE FUNCTION validate_targeting_rules()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate targeting parameters based on platform type
    IF NOT EXISTS (
        SELECT 1 FROM campaigns c
        JOIN ad_groups ag ON ag.campaign_id = c.id
        WHERE ag.id = NEW.ad_group_id
        AND (
            (c.platform = 'LINKEDIN_ADS' AND NEW.targeting_type IN ('INDUSTRY', 'COMPANY_SIZE', 'JOB_TITLE'))
            OR
            (c.platform = 'GOOGLE_ADS' AND NEW.targeting_type IN ('LOCATION', 'INTERESTS', 'DEMOGRAPHICS'))
        )
    ) THEN
        RAISE EXCEPTION 'Invalid targeting type for platform';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate budget constraints
CREATE OR REPLACE FUNCTION validate_budget_constraints()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure performance targets align with campaign budget
    IF NEW.metric_type IN ('CPC', 'CPM') AND NEW.target_value > (
        SELECT budget_amount 
        FROM campaigns 
        WHERE id = NEW.campaign_id
    ) THEN
        RAISE EXCEPTION 'Target value cannot exceed campaign budget';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for validation
CREATE TRIGGER validate_targeting_rules_trigger
    BEFORE INSERT OR UPDATE ON targeting_rules
    FOR EACH ROW
    EXECUTE FUNCTION validate_targeting_rules();

CREATE TRIGGER validate_budget_constraints_trigger
    BEFORE INSERT OR UPDATE ON performance_targets
    FOR EACH ROW
    EXECUTE FUNCTION validate_budget_constraints();

-- Create triggers for timestamp updates
CREATE TRIGGER update_ad_groups_timestamp
    BEFORE UPDATE ON ad_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_targeting_rules_timestamp
    BEFORE UPDATE ON targeting_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_creatives_timestamp
    BEFORE UPDATE ON creatives
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_performance_targets_timestamp
    BEFORE UPDATE ON performance_targets
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Create indexes for performance optimization
CREATE INDEX idx_ad_groups_campaign_id ON ad_groups(campaign_id);
CREATE INDEX idx_ad_groups_status ON ad_groups(status);
CREATE INDEX idx_targeting_rules_ad_group_id ON targeting_rules(ad_group_id);
CREATE INDEX idx_targeting_rules_type ON targeting_rules(targeting_type);
CREATE INDEX idx_creatives_ad_group_id ON creatives(ad_group_id);
CREATE INDEX idx_creatives_type ON creatives(type);
CREATE INDEX idx_performance_targets_campaign_id ON performance_targets(campaign_id);
CREATE INDEX idx_performance_targets_metric ON performance_targets(metric_type);

-- Add comments for documentation
COMMENT ON TABLE ad_groups IS 'Organizes ads into logical groups within campaigns';
COMMENT ON TABLE targeting_rules IS 'Defines targeting criteria for ad groups across platforms';
COMMENT ON TABLE creatives IS 'Stores ad creative content and metadata for different formats';
COMMENT ON TABLE performance_targets IS 'Tracks campaign performance goals and AI-generated forecasts';

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;