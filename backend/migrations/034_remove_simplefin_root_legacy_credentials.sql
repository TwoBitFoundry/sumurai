DELETE FROM plaid_credentials
WHERE item_id LIKE 'simplefin_root_%'
  AND user_id IN (SELECT user_id FROM simplefin_root_credentials);
