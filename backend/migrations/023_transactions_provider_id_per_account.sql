ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_plaid_transaction_id_key;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_provider_transaction_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_account_provider_transaction_id_unique_idx
  ON transactions (account_id, provider_transaction_id);

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_account_provider_transaction_id_unique;
ALTER TABLE transactions
  ADD CONSTRAINT transactions_account_provider_transaction_id_unique
  UNIQUE USING INDEX transactions_account_provider_transaction_id_unique_idx;
