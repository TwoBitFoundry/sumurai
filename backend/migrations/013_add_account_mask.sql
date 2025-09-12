-- Migration: Add mask field to accounts table
-- This adds the account mask (last 4 digits) field for display purposes

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS mask VARCHAR(4);