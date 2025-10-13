-- Migration: Multi-provider support (Phase 1)
-- Adds provider field to users table for supporting multiple financial data providers

ALTER TABLE users ADD COLUMN provider VARCHAR(20) NOT NULL DEFAULT 'teller';

CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);
