-- Migration: Rename plaid-specific columns to provider-agnostic names
-- This supports multiple financial data providers (Plaid, Teller, etc.)

ALTER TABLE accounts RENAME COLUMN plaid_account_id TO provider_account_id;
ALTER TABLE accounts RENAME COLUMN plaid_connection_id TO provider_connection_id;

ALTER TABLE transactions RENAME COLUMN plaid_transaction_id TO provider_transaction_id;

DROP INDEX IF EXISTS idx_accounts_plaid_id;
CREATE INDEX IF NOT EXISTS idx_accounts_provider_id ON accounts(provider_account_id);

DROP INDEX IF EXISTS idx_transactions_plaid_id;
CREATE INDEX IF NOT EXISTS idx_transactions_provider_id ON transactions(provider_transaction_id);

DROP INDEX IF EXISTS idx_accounts_plaid_connection_id;
CREATE INDEX IF NOT EXISTS idx_accounts_provider_connection_id ON accounts(provider_connection_id);

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS fk_accounts_plaid_connection;
ALTER TABLE accounts ADD CONSTRAINT fk_accounts_provider_connection
    FOREIGN KEY (provider_connection_id) REFERENCES plaid_connections(id) ON DELETE CASCADE;
