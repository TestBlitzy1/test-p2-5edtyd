-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- postgresql-contrib 15.x

-- Create utility functions for metric calculations
CREATE OR REPLACE FUNCTION calculate_ctr(clicks bigint, impressions bigint)
RETURNS DECIMAL(15,4) AS $$
BEGIN
    IF impressions IS NULL OR clicks IS NULL THEN
        RETURN NULL;
    END IF;
    IF impressions = 0 THEN
        RETURN 0;
    END IF;
    RETURN ROUND((clicks::decimal / impressions::decimal * 100), 4);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_roas(revenue decimal, cost decimal)
RETURNS DECIMAL(15,4) AS $$
BEGIN
    IF revenue IS NULL OR cost IS NULL THEN
        RETURN NULL;
    END IF;
    IF cost = 0 THEN
        RETURN 0;
    END IF;
    RETURN ROUND((revenue / cost), 4);
END;
$$ LANGUAGE plpgsql;

-- Create real-time metrics table
CREATE TABLE metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    metric_type metric_types NOT NULL,
    value DECIMAL(15,4) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_metric_value CHECK (value >= 0)
);

-- Create performance reports table
CREATE TABLE performance_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    metrics_summary JSONB NOT NULL,
    trends JSONB NOT NULL,
    recommendations text[],
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_metrics_summary CHECK (jsonb_typeof(metrics_summary) = 'object'),
    CONSTRAINT valid_trends CHECK (jsonb_typeof(trends) = 'object')
);

-- Create forecasts table
CREATE TABLE forecasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    predictions JSONB NOT NULL,
    confidence DECIMAL(5,2) NOT NULL,
    forecast_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_predictions CHECK (jsonb_typeof(predictions) = 'object'),
    CONSTRAINT valid_confidence CHECK (confidence BETWEEN 0 AND 100)
);

-- Create function to validate metric thresholds
CREATE OR REPLACE FUNCTION validate_metric_thresholds()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate metric values based on type
    CASE NEW.metric_type
        WHEN 'CTR' THEN
            IF NEW.value > 100 THEN
                RAISE EXCEPTION 'CTR cannot exceed 100%%';
            END IF;
        WHEN 'CPC', 'CPM', 'COST' THEN
            IF NEW.value < 0 THEN
                RAISE EXCEPTION 'Cost metrics cannot be negative';
            END IF;
    END CASE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to aggregate metrics
CREATE OR REPLACE FUNCTION aggregate_metrics(
    p_campaign_id UUID,
    p_start_time TIMESTAMP WITH TIME ZONE,
    p_end_time TIMESTAMP WITH TIME ZONE,
    p_granularity time_granularity
)
RETURNS TABLE (
    time_bucket TIMESTAMP WITH TIME ZONE,
    metric_type metric_types,
    metric_value DECIMAL(15,4)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        date_trunc(
            CASE p_granularity
                WHEN 'HOURLY' THEN 'hour'
                WHEN 'DAILY' THEN 'day'
                WHEN 'WEEKLY' THEN 'week'
                WHEN 'MONTHLY' THEN 'month'
            END,
            timestamp
        ) as time_bucket,
        metric_type,
        SUM(value) as metric_value
    FROM metrics
    WHERE campaign_id = p_campaign_id
    AND timestamp BETWEEN p_start_time AND p_end_time
    GROUP BY 1, 2
    ORDER BY 1, 2;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER validate_metric_thresholds_trigger
    BEFORE INSERT OR UPDATE ON metrics
    FOR EACH ROW
    EXECUTE FUNCTION validate_metric_thresholds();

-- Create indexes for performance optimization
CREATE INDEX idx_metrics_campaign_timestamp ON metrics(campaign_id, timestamp);
CREATE INDEX idx_metrics_type_timestamp ON metrics(metric_type, timestamp);
CREATE INDEX idx_performance_reports_campaign ON performance_reports(campaign_id, generated_at);
CREATE INDEX idx_forecasts_campaign_date ON forecasts(campaign_id, forecast_date);
CREATE INDEX idx_metrics_recent ON metrics(timestamp DESC, campaign_id) WHERE timestamp > (CURRENT_TIMESTAMP - INTERVAL '30 days');

-- Add partitioning for metrics table
CREATE TABLE metrics_partitioned (
    LIKE metrics INCLUDING ALL
) PARTITION BY RANGE (timestamp);

-- Create partitions for recent and historical data
CREATE TABLE metrics_recent PARTITION OF metrics_partitioned
    FOR VALUES FROM (CURRENT_TIMESTAMP - INTERVAL '3 months') TO (MAXVALUE);

CREATE TABLE metrics_historical PARTITION OF metrics_partitioned
    FOR VALUES FROM (MINVALUE) TO (CURRENT_TIMESTAMP - INTERVAL '3 months');

-- Add comments for documentation
COMMENT ON TABLE metrics IS 'Stores individual metric measurements for campaigns with real-time tracking capabilities';
COMMENT ON TABLE performance_reports IS 'Stores generated performance reports with metrics summaries and trend analysis';
COMMENT ON TABLE forecasts IS 'Stores AI-generated performance forecasts with predictions and confidence scores';
COMMENT ON FUNCTION calculate_ctr IS 'Calculates Click-Through Rate from impressions and clicks with validation';
COMMENT ON FUNCTION calculate_roas IS 'Calculates Return on Ad Spend with proper decimal handling';
COMMENT ON FUNCTION aggregate_metrics IS 'Aggregates metrics based on specified time granularity for analysis';

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON metrics TO app_user;
GRANT SELECT, INSERT ON performance_reports TO app_user;
GRANT SELECT, INSERT ON forecasts TO app_user;
GRANT EXECUTE ON FUNCTION calculate_ctr TO app_user;
GRANT EXECUTE ON FUNCTION calculate_roas TO app_user;
GRANT EXECUTE ON FUNCTION aggregate_metrics TO app_user;