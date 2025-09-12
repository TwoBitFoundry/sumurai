-- Migration: Enable Row-Level Security for budgets table
-- This enables RLS on the budgets table to ensure multi-tenant data isolation

-- Enable Row-Level Security on budgets table
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for budgets table
-- Policy: Users can only access their own budgets
CREATE POLICY budgets_user_isolation ON budgets
    FOR ALL
    TO PUBLIC
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Note: The current_setting('app.current_user_id') will be set by the application
-- before making database queries to establish the user context for RLS enforcement