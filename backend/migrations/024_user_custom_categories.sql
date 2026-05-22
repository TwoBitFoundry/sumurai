CREATE TABLE user_custom_categories (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(30) NOT NULL,
    lookup_key   VARCHAR(30) NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, lookup_key)
);

CREATE INDEX idx_user_custom_categories_user
    ON user_custom_categories(user_id, display_name);

ALTER TABLE user_custom_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_custom_categories_user_isolation ON user_custom_categories
    FOR ALL
    TO PUBLIC
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

CREATE OR REPLACE FUNCTION update_user_custom_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_custom_categories_updated_at
    BEFORE UPDATE ON user_custom_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_user_custom_categories_updated_at();
