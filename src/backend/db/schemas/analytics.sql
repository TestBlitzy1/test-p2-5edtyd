-- Enable required extensions and import custom types
\ir ../migrations/001_initial_schema.sql

-- Create or replace CTR calculation function
CREATE OR REPLACE FUNCTION calculate_ctr(
    clicks BIGINT,
    impressions BIGINT
) RETURNS DECIMAL AS $$
BEGIN
    -- Validate input parameters
    IF clicks IS NULL OR impressions IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Check for zero division
    IF impressions = 0 THEN
        RETURN 0;
    END IF;
    
    -- Calculate CTR with 4 decimal precision
    RETURN ROUND((clicks::DECIMAL / impressions::DECIMAL) * 100, 4);
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

-- Create or replace ROAS calculation function
CREATE OR REPLACE FUNCTION calculate_roas(
    revenue DECIMAL,
    cost DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
    -- Validate input parameters
    IF revenue IS NULL OR cost IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Check for zero division
    IF cost = 0 THEN
        RETURN 0;
    END IF;
    
    -- Calculate ROAS with 2 decimal precision
    RETURN ROUND(revenue / cost, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

-- Create analytics table for campaign performance tracking
CREATE TABLE IF NOT EXISTS analytics (
    -- Primary key and relationships
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Time range configuration
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    granularity time_granularity NOT NULL DEFAULT 'DAILY',
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

-- Create metrics table for individual metric measurements
CREATE TABLE IF NOT EXISTS metrics (
    -- Primary key and analytics reference
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analytics_id UUID NOT NULL REFERENCES analytics(id) ON DELETE CASCADE,
    
    -- Metric data
    metric_type metric_types NOT NULL,
    value DECIMAL(15,4) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create performance reports table for aggregated analytics
CREATE TABLE IF NOT EXISTS performance_reports (
    -- Primary key and campaign reference
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    
    -- Report data
    metrics_summary JSONB NOT NULL,
    trends JSONB,
    recommendations TEXT[],
    
    -- Timestamp
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create forecasts table for performance predictions
CREATE TABLE IF NOT EXISTS forecasts (
    -- Primary key and campaign reference
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    
    -- Forecast data
    predictions JSONB NOT NULL,
    confidence DECIMAL(5,2) NOT NULL,
    forecast_date TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_confidence CHECK (confidence >= 0 AND confidence <= 100)
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_analytics_campaign_id ON analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_date_range ON analytics(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_metrics_analytics_id ON metrics(analytics_id);
CREATE INDEX IF NOT EXISTS idx_metrics_type_timestamp ON metrics(metric_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_reports_campaign_id ON performance_reports(campaign_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_campaign_date ON forecasts(campaign_id, forecast_date);

-- Add triggers for automatic timestamp updates
CREATE TRIGGER update_analytics_timestamp
    BEFORE UPDATE ON analytics
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_metrics_timestamp
    BEFORE UPDATE ON metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Add table comments
COMMENT ON TABLE analytics IS 'Main analytics data table with time range and granularity settings';
COMMENT ON TABLE metrics IS 'Individual metric measurements with timestamps for time-series analysis';
COMMENT ON TABLE performance_reports IS 'Aggregated campaign performance reports with trends and recommendations';
COMMENT ON TABLE forecasts IS 'Performance forecasts with predictions and confidence scores';

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON analytics TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON metrics TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON performance_reports TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON forecasts TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;