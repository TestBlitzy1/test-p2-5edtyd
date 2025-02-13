-- Import UUID extension from initial schema migration
\ir ../migrations/001_initial_schema.sql

-- Create or replace trigger function for timestamp updates
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create users table with role-based access control
CREATE TABLE IF NOT EXISTS users (
    -- Primary key using UUID for better security and distribution
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User authentication fields
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- Stores hashed password
    
    -- Role-based access control
    role user_roles NOT NULL DEFAULT 'USER',
    
    -- Authentication provider tracking
    provider auth_providers NOT NULL DEFAULT 'LOCAL',
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Email format validation
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create index on email for faster lookups during authentication
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create index on role for faster authorization checks
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Create index on provider for analytics and filtering
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);

-- Add trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_users_timestamp ON users;
CREATE TRIGGER update_users_timestamp
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Add table comments for documentation
COMMENT ON TABLE users IS 'Core user table for authentication and authorization with role-based access control';
COMMENT ON COLUMN users.id IS 'Unique identifier for user using UUID v4';
COMMENT ON COLUMN users.email IS 'User email address - must be unique and valid format';
COMMENT ON COLUMN users.password IS 'Bcrypt hashed password for local authentication';
COMMENT ON COLUMN users.role IS 'User role for authorization - ADMIN, MANAGER, ANALYST, or USER';
COMMENT ON COLUMN users.provider IS 'Authentication provider - LOCAL, GOOGLE, or LINKEDIN';
COMMENT ON COLUMN users.created_at IS 'Timestamp when user was created';
COMMENT ON COLUMN users.updated_at IS 'Timestamp when user was last updated';

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;