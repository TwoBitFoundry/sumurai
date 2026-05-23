-- Migration: Backfill provider column based on item_id pattern
-- Step 2 of 3: Populate provider column from item_id inference

UPDATE provider_connections
SET provider =
  CASE
    WHEN item_id LIKE 'simplefin_%' AND item_id NOT LIKE 'simplefin_root_%' THEN 'simplefin'
    WHEN item_id LIKE 'simplefin_root_%' THEN 'simplefin'
    WHEN item_id LIKE 'teller_%' THEN 'teller'
    ELSE 'plaid'
  END
WHERE provider = '';

-- Verify backfill: should return 0
SELECT COUNT(*) as remaining_empty_provider FROM provider_connections WHERE provider = '';
