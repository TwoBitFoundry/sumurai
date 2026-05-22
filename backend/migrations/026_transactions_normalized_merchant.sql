ALTER TABLE transactions
    ADD COLUMN normalized_merchant TEXT
    GENERATED ALWAYS AS (regexp_replace(lower(coalesce(merchant_name, '')), '[^a-z]', '', 'g')) STORED;

CREATE INDEX idx_transactions_user_norm_merchant
    ON transactions(user_id, normalized_merchant);
