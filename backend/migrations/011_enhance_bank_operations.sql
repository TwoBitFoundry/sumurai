-- Migration: Enhance bank operations for bank-level sync and disconnect
-- This adds fields needed for Phase 1 of Connect Tab Integration Plan

-- Extend accounts table with additional bank account fields
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS mask VARCHAR(4),
ADD COLUMN IF NOT EXISTS subtype VARCHAR,
ADD COLUMN IF NOT EXISTS official_name VARCHAR;

-- Extend plaid_connections table with institution logo and sync cursor
ALTER TABLE plaid_connections
ADD COLUMN IF NOT EXISTS institution_logo_url VARCHAR,
ADD COLUMN IF NOT EXISTS sync_cursor VARCHAR;

-- Add RLS policies for accounts table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'accounts' 
        AND policyname = 'accounts_user_policy'
    ) THEN
        ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
        CREATE POLICY accounts_user_policy ON accounts
            FOR ALL USING (true); -- Simplified policy for now, will be enhanced later
    END IF;
END $$;

-- Add indexes for new columns for performance
CREATE INDEX IF NOT EXISTS idx_accounts_mask ON accounts(mask);
CREATE INDEX IF NOT EXISTS idx_accounts_subtype ON accounts(subtype);
CREATE INDEX IF NOT EXISTS idx_plaid_connections_sync_cursor ON plaid_connections(sync_cursor);