-- Migration: Add explicit provider column to provider_connections
-- This is step 1 of 3-step provider column migration:
-- 1. ADD COLUMN provider (allows NULL)
-- 2. Backfill provider based on item_id pattern
-- 3. ALTER COLUMN to NOT NULL

ALTER TABLE provider_connections
ADD COLUMN provider VARCHAR(50) DEFAULT '';

CREATE INDEX idx_provider_connections_provider ON provider_connections(provider);
