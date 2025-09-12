-- Migration: Initial database schema for accounting app
-- This creates the foundational tables for accounts, transactions, and Plaid credentials

-- Accounts table for storing bank account information
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plaid_account_id VARCHAR UNIQUE,
    name VARCHAR NOT NULL,
    account_type VARCHAR NOT NULL,
    balance_current DECIMAL(12,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table for storing financial transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id),
    plaid_transaction_id VARCHAR UNIQUE,
    amount DECIMAL(12,2) NOT NULL,
    date DATE NOT NULL,
    merchant_name VARCHAR,
    category_primary VARCHAR NOT NULL,
    category_detailed VARCHAR NOT NULL,
    category_confidence VARCHAR NOT NULL,
    payment_channel VARCHAR,
    pending BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plaid credentials table for storing encrypted access tokens
CREATE TABLE IF NOT EXISTS plaid_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id VARCHAR NOT NULL UNIQUE,
    encrypted_access_token BYTEA NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_plaid_id ON accounts(plaid_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_plaid_id ON transactions(plaid_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_plaid_credentials_item_id ON plaid_credentials(item_id);
