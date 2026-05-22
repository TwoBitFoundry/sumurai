CREATE TABLE transaction_category_overrides (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    normalized_merchant TEXT NOT NULL,
    category_name       VARCHAR(64) NOT NULL,
    custom_category_id  UUID REFERENCES user_custom_categories(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, normalized_merchant)
);

CREATE INDEX idx_overrides_user_norm
    ON transaction_category_overrides(user_id, normalized_merchant);

ALTER TABLE transaction_category_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY transaction_category_overrides_user_isolation ON transaction_category_overrides
    FOR ALL
    TO PUBLIC
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

CREATE OR REPLACE FUNCTION update_transaction_category_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_transaction_category_overrides_updated_at
    BEFORE UPDATE ON transaction_category_overrides
    FOR EACH ROW
    EXECUTE FUNCTION update_transaction_category_overrides_updated_at();
