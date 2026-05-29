ALTER TABLE plaid_credentials RENAME TO provider_credentials;

ALTER TABLE provider_credentials
    RENAME CONSTRAINT plaid_credentials_pkey TO provider_credentials_pkey;

ALTER TABLE provider_credentials
    RENAME CONSTRAINT plaid_credentials_item_id_key TO provider_credentials_item_id_key;

ALTER TABLE provider_credentials
    RENAME CONSTRAINT plaid_credentials_user_id_fkey TO provider_credentials_user_id_fkey;

ALTER INDEX IF EXISTS idx_plaid_credentials_item_id
    RENAME TO idx_provider_credentials_item_id;

ALTER INDEX IF EXISTS idx_plaid_credentials_user_id
    RENAME TO idx_provider_credentials_user_id;

ALTER INDEX IF EXISTS idx_plaid_credentials_user_item
    RENAME TO idx_provider_credentials_user_item;

ALTER POLICY plaid_credentials_user_isolation ON provider_credentials
    RENAME TO provider_credentials_user_isolation;
