-- Migration: Rename plaid_connections table to provider_connections
-- This aligns the schema with provider-agnostic naming across the application.

ALTER TABLE plaid_connections RENAME TO provider_connections;

-- Rename constraints to match the new table name
ALTER TABLE provider_connections
    RENAME CONSTRAINT plaid_connections_pkey TO provider_connections_pkey;

ALTER TABLE provider_connections
    RENAME CONSTRAINT plaid_connections_item_id_key TO provider_connections_item_id_key;

ALTER TABLE provider_connections
    RENAME CONSTRAINT plaid_connections_user_id_fkey TO provider_connections_user_id_fkey;

-- Rename indexes for consistency
ALTER INDEX IF EXISTS idx_plaid_connections_user_id
    RENAME TO idx_provider_connections_user_id;

ALTER INDEX IF EXISTS idx_plaid_connections_item_id
    RENAME TO idx_provider_connections_item_id;

ALTER INDEX IF EXISTS idx_plaid_connections_connected
    RENAME TO idx_provider_connections_connected;

ALTER INDEX IF EXISTS idx_plaid_connections_last_sync
    RENAME TO idx_provider_connections_last_sync;

ALTER INDEX IF EXISTS idx_plaid_connections_user_id_new
    RENAME TO idx_provider_connections_user_id_new;

ALTER INDEX IF EXISTS idx_plaid_connections_user_active
    RENAME TO idx_provider_connections_user_active;

ALTER INDEX IF EXISTS idx_plaid_connections_sync_cursor
    RENAME TO idx_provider_connections_sync_cursor;

ALTER INDEX IF EXISTS idx_plaid_connections_institution_id
    RENAME TO idx_provider_connections_institution_id;

-- Rename trigger and its backing function
ALTER FUNCTION update_plaid_connections_updated_at()
    RENAME TO update_provider_connections_updated_at;

ALTER TRIGGER update_plaid_connections_updated_at ON provider_connections
    RENAME TO update_provider_connections_updated_at;

-- Update RLS policy names for clarity
ALTER POLICY plaid_connections_user_isolation ON provider_connections
    RENAME TO provider_connections_user_isolation;
