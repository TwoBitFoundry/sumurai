INSERT INTO simplefin_root_credentials (user_id, encrypted_access_url, setup_token_used_at, created_at, updated_at)
SELECT
    user_id,
    encrypted_access_token,
    updated_at,
    created_at,
    updated_at
FROM plaid_credentials
WHERE item_id LIKE 'simplefin_root_%'
ON CONFLICT (user_id) DO NOTHING;
