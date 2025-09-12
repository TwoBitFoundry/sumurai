-- Migration: Add institution_id to plaid_connections
ALTER TABLE plaid_connections
  ADD COLUMN IF NOT EXISTS institution_id VARCHAR;

CREATE INDEX IF NOT EXISTS idx_plaid_connections_institution_id
  ON plaid_connections(institution_id);

