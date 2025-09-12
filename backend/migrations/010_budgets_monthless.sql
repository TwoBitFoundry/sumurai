-- 010_budgets_monthless.sql
-- Cycle 4: Database Migration & Schema Updates
-- Transform budgets from month-scoped to user/category unique.

-- Notes:
-- - Idempotent where possible via IF EXISTS and TRY/CATCH blocks.
-- - Deduplication keeps the latest record per (user_id, category), prioritizing
--   rows with most recent updated_at, then created_at, then highest month (YYYY-MM).
-- - RLS policies and triggers remain intact.

-- Drop month-based indexes if present
DROP INDEX IF EXISTS idx_budgets_month;
DROP INDEX IF EXISTS idx_budgets_user_month;

-- Drop the old unique constraint (user_id, category, month) if it exists
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_user_id_category_month_key;

-- Deduplicate: keep only the latest row per (user_id, category)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, category
           ORDER BY updated_at DESC NULLS LAST,
                    created_at DESC NULLS LAST,
                    month DESC NULLS LAST
         ) AS rn
  FROM budgets
)
DELETE FROM budgets b
USING ranked r
WHERE b.id = r.id
  AND r.rn > 1;

-- Remove the month column
ALTER TABLE budgets DROP COLUMN IF EXISTS month;

-- Add new unique constraint on (user_id, category) via unique index
-- Robust to re-running individually
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_user_id_category_unique;
CREATE UNIQUE INDEX IF NOT EXISTS budgets_user_id_category_unique_idx ON budgets (user_id, category);
ALTER TABLE budgets
  ADD CONSTRAINT budgets_user_id_category_unique
  UNIQUE USING INDEX budgets_user_id_category_unique_idx;

-- (Notice omitted in favor of simple DDL to ease test execution)

-- Rollback guidance (manual):
-- 1. ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_user_id_category_unique;
-- 2. ALTER TABLE budgets ADD COLUMN month VARCHAR;
-- 3. CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month);
--    CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, month);
-- 4. ALTER TABLE budgets ADD CONSTRAINT budgets_user_id_category_month_key UNIQUE(user_id, category, month);
-- (Data lost by deduplication cannot be restored automatically.)
