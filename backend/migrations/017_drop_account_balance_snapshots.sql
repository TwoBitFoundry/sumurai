-- Migration: Drop account_balance_snapshots (clean break)
DROP TABLE IF EXISTS account_balance_snapshots CASCADE;

