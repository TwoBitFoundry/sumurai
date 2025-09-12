-- Migration: Performance indexes for user-scoped queries
-- This adds optimized indexes for multi-tenant queries

-- Performance indexes for user-scoped transaction queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions(user_id, category_primary, date DESC);

-- Performance indexes for user-scoped account queries  
CREATE INDEX IF NOT EXISTS idx_accounts_user_name ON accounts(user_id, name);
CREATE INDEX IF NOT EXISTS idx_accounts_user_type ON accounts(user_id, account_type);

-- Performance indexes for JWT session cleanup
CREATE INDEX IF NOT EXISTS idx_jwt_sessions_expires_at ON jwt_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_jwt_sessions_user_created ON jwt_sessions(user_id, created_at DESC);

-- Performance indexes for Plaid operations
CREATE INDEX IF NOT EXISTS idx_plaid_credentials_user_item ON plaid_credentials(user_id, item_id);
CREATE INDEX IF NOT EXISTS idx_plaid_connections_user_active ON plaid_connections(user_id, is_connected, last_sync_at DESC);

-- Note: These indexes optimize the most common query patterns:
-- - User transaction history (user_id + date sorting)
-- - User account listing (user_id + name sorting)  
-- - Session cleanup (expires_at for automated cleanup)
-- - Plaid operations (user_id based lookups)