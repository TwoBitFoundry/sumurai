-- Migration: Add NOT NULL constraint to provider column
-- Step 3 of 3: Make provider column required (and remove default)

ALTER TABLE provider_connections
ALTER COLUMN provider DROP DEFAULT;

ALTER TABLE provider_connections
ALTER COLUMN provider SET NOT NULL;
