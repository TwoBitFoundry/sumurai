CREATE TABLE IF NOT EXISTS simplefin_root_credentials (
    user_id                 UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    encrypted_access_url    BYTEA NOT NULL,
    setup_token_used_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE simplefin_root_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS simplefin_root_credentials_user_isolation ON simplefin_root_credentials;

CREATE POLICY simplefin_root_credentials_user_isolation ON simplefin_root_credentials
    FOR ALL
    TO PUBLIC
    USING (user_id = current_setting('app.current_user_id', true)::uuid)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
