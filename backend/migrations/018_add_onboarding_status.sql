-- Migration: Add onboarding completion status to users
-- This adds a field to track whether a user has completed the onboarding process

-- Add onboarding_completed column to users table with default false
ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- Create index for efficient querying of onboarding status
CREATE INDEX IF NOT EXISTS idx_users_onboarding_completed ON users(onboarding_completed);