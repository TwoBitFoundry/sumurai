-- Migration: Row-Level Security policies for multi-tenant data isolation
-- This enables RLS on all user-scoped tables to ensure complete data isolation

-- Enable Row-Level Security on user-scoped tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_connections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for accounts table
-- Policy: Users can only access their own accounts
CREATE POLICY accounts_user_isolation ON accounts
    FOR ALL
    TO PUBLIC
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Create RLS policies for transactions table  
-- Policy: Users can only access their own transactions
CREATE POLICY transactions_user_isolation ON transactions
    FOR ALL
    TO PUBLIC
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Create RLS policies for plaid_credentials table
-- Policy: Users can only access their own Plaid credentials
CREATE POLICY plaid_credentials_user_isolation ON plaid_credentials
    FOR ALL
    TO PUBLIC
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Create RLS policies for plaid_connections table
-- Policy: Users can only access their own Plaid connections
CREATE POLICY plaid_connections_user_isolation ON plaid_connections
    FOR ALL
    TO PUBLIC
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Note: The current_setting('app.current_user_id') will be set by the application
-- before making database queries to establish the user context for RLS enforcement