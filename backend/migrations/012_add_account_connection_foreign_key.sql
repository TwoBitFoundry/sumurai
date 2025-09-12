-- Migration: Add foreign key relationship between accounts and plaid_connections
-- This ensures referential integrity for bank-level operations and multi-connection support

-- Add plaid_connection_id column to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS plaid_connection_id UUID;

-- Update existing accounts to link them to their connections via item_id lookup
-- This handles existing data by finding the connection that owns each account
UPDATE accounts SET plaid_connection_id = (
    SELECT pc.id 
    FROM plaid_connections pc 
    JOIN plaid_credentials pcred ON pc.item_id = pcred.item_id
    WHERE accounts.plaid_account_id IS NOT NULL
    AND pc.is_connected = true
    ORDER BY pc.connected_at DESC
    LIMIT 1
) WHERE plaid_connection_id IS NULL AND plaid_account_id IS NOT NULL;

-- Add foreign key constraint with CASCADE delete
-- When a connection is deleted, all its accounts are automatically deleted
ALTER TABLE accounts ADD CONSTRAINT fk_accounts_plaid_connection 
    FOREIGN KEY (plaid_connection_id) REFERENCES plaid_connections(id) ON DELETE CASCADE;

-- Add index for performance on foreign key lookups
CREATE INDEX IF NOT EXISTS idx_accounts_plaid_connection_id ON accounts(plaid_connection_id);

-- Add index for compound queries (connection + account type)
CREATE INDEX IF NOT EXISTS idx_accounts_connection_type ON accounts(plaid_connection_id, account_type);