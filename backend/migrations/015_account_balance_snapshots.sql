-- Migration: Account Balance Snapshots with RLS and indexes

-- Create table to store daily balance snapshots per account
CREATE TABLE IF NOT EXISTS account_balance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  institution_id text NOT NULL,
  account_id uuid NOT NULL,
  as_of_date date NOT NULL,
  current_balance numeric NOT NULL,
  available_balance numeric,
  currency text NOT NULL,
  account_type text NOT NULL,
  account_subtype text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, as_of_date)
);

-- Enable Row Level Security and add user-scoped policy
ALTER TABLE account_balance_snapshots ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = current_schema()
      AND tablename = 'account_balance_snapshots' AND policyname = 'rls_user'
  ) THEN
    CREATE POLICY rls_user ON account_balance_snapshots
      USING (user_id = current_setting('app.current_user_id', true)::uuid);
  END IF;
END$$;

-- Helpful indexes for common access patterns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'idx_abs_user_date'
  ) THEN
    CREATE INDEX idx_abs_user_date ON account_balance_snapshots (user_id, as_of_date);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'idx_abs_inst_date'
  ) THEN
    CREATE INDEX idx_abs_inst_date ON account_balance_snapshots (institution_id, as_of_date);
  END IF;
END$$;

