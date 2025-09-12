-- Migration: Add user_id foreign keys to existing tables for multi-tenant isolation
-- This adds user_id columns and foreign key constraints to ensure all data is user-scoped

-- Add user_id column to accounts table with foreign key constraint
ALTER TABLE accounts 
ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Add user_id column to transactions table with foreign key constraint  
ALTER TABLE transactions
ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Add user_id column to plaid_credentials table with foreign key constraint
ALTER TABLE plaid_credentials
ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Update plaid_connections to use UUID foreign key instead of VARCHAR user_id
ALTER TABLE plaid_connections 
DROP COLUMN user_id,
ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Add indexes for performance on new foreign key columns
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);  
CREATE INDEX IF NOT EXISTS idx_plaid_credentials_user_id ON plaid_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_connections_user_id_new ON plaid_connections(user_id);

-- Note: In production, these columns should be NOT NULL, but for testing we allow NULL initially