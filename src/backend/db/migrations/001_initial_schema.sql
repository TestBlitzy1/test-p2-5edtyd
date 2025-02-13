-- Enable UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- postgresql-contrib 15.x

-- Create custom enums for strongly typed columns
CREATE TYPE user_roles AS ENUM ('ADMIN', 'MANAGER', 'ANALYST', 'USER');
CREATE TYPE auth_providers AS ENUM ('LOCAL', 'GOOGLE', 'LINKEDIN');
CREATE TYPE platform_types AS ENUM ('LINKEDIN_ADS', 'GOOGLE_ADS');
CREATE TYPE campaign_status AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');
CREATE TYPE campaign_objectives AS ENUM ('AWARENESS', 'CONSIDERATION', 'CONVERSION');
CREATE TYPE budget_types AS ENUM ('DAILY', 'LIFETIME');
CREATE TYPE metric_types AS ENUM ('IMPRESSIONS', 'CLICKS', 'CTR', 'CONVERSIONS', 'COST', 'CPC', 'CPM', 'ROAS');
CREATE TYPE time_granularity AS ENUM ('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY');

-- Create trigger function for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create users table for authentication and authorization
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role user_roles NOT NULL DEFAULT 'USER',
    provider auth_providers NOT NULL DEFAULT 'LOCAL',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create campaigns table for campaign management
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    platform platform_types NOT NULL,
    objective campaign_objectives NOT NULL,
    status campaign_status NOT NULL DEFAULT 'DRAFT',
    budget_type budget_types NOT NULL,
    budget_amount DECIMAL(15,2) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    platform_campaign_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT positive_budget CHECK (budget_amount > 0),
    CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date > start_date)
);

-- Create analytics table for performance tracking
CREATE TABLE analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    granularity time_granularity NOT NULL DEFAULT 'DAILY',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_analytics_date_range CHECK (end_date > start_date)
);

-- Create metrics table for storing actual metric values
CREATE TABLE metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analytics_id UUID NOT NULL REFERENCES analytics(id) ON DELETE CASCADE,
    metric_type metric_types NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance optimization
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_platform ON campaigns(platform);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_analytics_campaign_id ON analytics(campaign_id);
CREATE INDEX idx_analytics_user_id ON analytics(user_id);
CREATE INDEX idx_analytics_date_range ON analytics(start_date, end_date);
CREATE INDEX idx_metrics_analytics_id ON metrics(analytics_id);
CREATE INDEX idx_metrics_timestamp ON metrics(timestamp);

-- Add triggers for automatic timestamp updates
CREATE TRIGGER update_users_timestamp
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_campaigns_timestamp
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_analytics_timestamp
    BEFORE UPDATE ON analytics
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_metrics_timestamp
    BEFORE UPDATE ON metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Add comments for documentation
COMMENT ON TABLE users IS 'Core user table for authentication, authorization, and multi-provider support';
COMMENT ON TABLE campaigns IS 'Main campaigns table storing campaign metadata, configuration, and platform integration details';
COMMENT ON TABLE analytics IS 'Main analytics data table for campaign performance tracking with configurable time granularity';
COMMENT ON TABLE metrics IS 'Detailed metrics storage for campaign performance data points';

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;