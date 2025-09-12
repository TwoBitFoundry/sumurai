-- Migration: User management and JWT session support
-- This creates the users and jwt_sessions tables for multi-tenant authentication

-- Users table for storing user accounts with unique email constraint
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR NOT NULL UNIQUE,
    password_hash VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- JWT sessions table for session management with unique jwt_id constraint
CREATE TABLE IF NOT EXISTS jwt_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jwt_id VARCHAR NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_jwt_sessions_jwt_id ON jwt_sessions(jwt_id);
CREATE INDEX IF NOT EXISTS idx_jwt_sessions_user_id ON jwt_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_jwt_sessions_expires_at ON jwt_sessions(expires_at);

-- Update trigger for users.updated_at timestamp
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();