-- Migration: Add CASCADE constraint for budgets table
-- This ensures budgets are automatically deleted when a user is deleted

ALTER TABLE budgets
  DROP CONSTRAINT IF EXISTS budgets_user_id_fkey,
  ADD CONSTRAINT budgets_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Note: This completes the CASCADE constraint coverage for user deletion.
-- All user-related data (transactions, accounts, connections, credentials, budgets)
-- will now be automatically cleaned up when a user is deleted.
