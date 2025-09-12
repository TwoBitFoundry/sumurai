-- Migration: Plaid connection state management
-- This creates the plaid_connections table for persistent state tracking

-- Plaid connections table for storing connection state and metadata
CREATE TABLE IF NOT EXISTS plaid_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR NOT NULL,
    item_id VARCHAR NOT NULL UNIQUE,
    is_connected BOOLEAN NOT NULL DEFAULT false,
    last_sync_at TIMESTAMPTZ,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    disconnected_at TIMESTAMPTZ,
    institution_name VARCHAR,
    transaction_count INTEGER DEFAULT 0,
    account_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_plaid_connections_user_id ON plaid_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_connections_item_id ON plaid_connections(item_id);
CREATE INDEX IF NOT EXISTS idx_plaid_connections_connected ON plaid_connections(is_connected);
CREATE INDEX IF NOT EXISTS idx_plaid_connections_last_sync ON plaid_connections(last_sync_at DESC);

-- Update trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_plaid_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_plaid_connections_updated_at
    BEFORE UPDATE ON plaid_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_plaid_connections_updated_at();