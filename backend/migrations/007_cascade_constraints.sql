-- Migration: Add CASCADE constraints for user deletion cleanup
-- This ensures proper cleanup when users are deleted

-- Add CASCADE constraint for JWT sessions 
-- When a user is deleted, all their JWT sessions should be automatically deleted
ALTER TABLE jwt_sessions 
  DROP CONSTRAINT IF EXISTS jwt_sessions_user_id_fkey,
  ADD CONSTRAINT jwt_sessions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add CASCADE constraint for accounts
-- When a user is deleted, all their accounts should be automatically deleted  
ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS accounts_user_id_fkey,
  ADD CONSTRAINT accounts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add CASCADE constraint for transactions
-- When a user is deleted, all their transactions should be automatically deleted
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_user_id_fkey,
  ADD CONSTRAINT transactions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add CASCADE constraint for plaid_credentials
-- When a user is deleted, all their Plaid credentials should be automatically deleted
ALTER TABLE plaid_credentials
  DROP CONSTRAINT IF EXISTS plaid_credentials_user_id_fkey,
  ADD CONSTRAINT plaid_credentials_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add CASCADE constraint for plaid_connections 
-- When a user is deleted, all their Plaid connections should be automatically deleted
ALTER TABLE plaid_connections
  DROP CONSTRAINT IF EXISTS plaid_connections_user_id_fkey,
  ADD CONSTRAINT plaid_connections_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Performance improvement: Add index for expired session cleanup
-- Note: Removed WHERE clause with NOW() as it's not immutable
CREATE INDEX IF NOT EXISTS idx_jwt_sessions_expired ON jwt_sessions(expires_at);

-- Note: These CASCADE constraints ensure that deleting a user automatically
-- removes all related data, maintaining referential integrity and preventing
-- orphaned records that could cause security issues in a multi-tenant system.