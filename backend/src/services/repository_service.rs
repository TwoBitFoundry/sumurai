use crate::models::{
    account::Account,
    auth::User,
    budget::Budget,
    category::{CategoryRule, UserCategory},
    plaid::{LatestAccountBalance, PlaidCredentials, ProviderConnection},
    transaction::{Transaction, TransactionWithAccount},
};
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use anyhow::Result;
use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct ManualAccountBalanceHistoryPoint {
    pub account_id: Uuid,
    pub as_of_date: chrono::NaiveDate,
    pub balance_current: rust_decimal::Decimal,
}

#[async_trait]
#[cfg_attr(test, mockall::automock)]
#[allow(dead_code)]
pub trait DatabaseRepository: Send + Sync {
    async fn create_user(&self, user: &User) -> Result<()>;
    async fn get_user_by_email(&self, email: &str) -> Result<Option<User>>;
    async fn get_user_by_id(&self, user_id: &Uuid) -> Result<Option<User>>;
    async fn mark_onboarding_complete(&self, user_id: &Uuid) -> Result<()>;
    async fn update_user_provider(&self, user_id: &Uuid, provider: &str) -> Result<()>;
    async fn get_all_user_ids(&self) -> Result<Vec<Uuid>>;

    async fn get_transactions_for_user(&self, user_id: &Uuid) -> Result<Vec<Transaction>>;
    async fn get_transactions_with_account_for_user(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<TransactionWithAccount>>;
    async fn get_transactions_by_date_range_for_user(
        &self,
        user_id: &Uuid,
        start_date: chrono::NaiveDate,
        end_date: chrono::NaiveDate,
    ) -> Result<Vec<Transaction>>;
    async fn get_accounts_for_user(&self, user_id: &Uuid) -> Result<Vec<Account>>;
    async fn get_transaction_count_by_account_for_user(
        &self,
        user_id: &Uuid,
    ) -> Result<std::collections::HashMap<Uuid, i64>>;

    async fn create_manual_account(&self, account: &Account) -> Result<Account>;
    async fn update_manual_account(&self, account: &Account) -> Result<Account>;
    async fn delete_manual_account(&self, account_id: Uuid, user_id: Uuid) -> Result<()>;
    async fn record_manual_account_balance(
        &self,
        account_id: Uuid,
        user_id: Uuid,
        as_of_date: chrono::NaiveDate,
        balance_current: rust_decimal::Decimal,
    ) -> Result<()>;
    async fn get_manual_account_balance_history_for_user(
        &self,
        user_id: &Uuid,
        end_date: chrono::NaiveDate,
    ) -> Result<Vec<ManualAccountBalanceHistoryPoint>>;
    async fn upsert_account(&self, account: &Account) -> Result<()>;
    async fn merge_duplicate_provider_accounts(
        &self,
        user_id: &Uuid,
        connection_id: &Uuid,
    ) -> Result<i64>;
    async fn merge_duplicate_provider_transactions(
        &self,
        user_id: &Uuid,
        connection_id: &Uuid,
    ) -> Result<i64>;
    async fn mark_transaction_duplicate(
        &self,
        transaction_id: Uuid,
        user_id: Uuid,
    ) -> Result<Uuid>;
    async fn auto_resolve_pending_duplicates(
        &self,
        user_id: &Uuid,
        connection_id: Option<&Uuid>,
    ) -> Result<i64>;
    async fn upsert_transaction(&self, transaction: &Transaction) -> Result<()>;

    async fn store_provider_credentials_for_user(
        &self,
        user_id: &Uuid,
        item_id: &str,
        access_token: &str,
    ) -> Result<Uuid>;

    async fn get_provider_credentials_for_user(
        &self,
        user_id: &Uuid,
        item_id: &str,
    ) -> Result<Option<PlaidCredentials>>;

    async fn save_provider_connection(&self, connection: &ProviderConnection) -> Result<()>;
    async fn get_all_provider_connections_by_user(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<ProviderConnection>>;
    async fn get_provider_connection_by_id(
        &self,
        connection_id: &Uuid,
        user_id: &Uuid,
    ) -> Result<Option<ProviderConnection>>;
    async fn delete_provider_transactions(&self, user_id: &Uuid, item_id: &str) -> Result<i32>;
    async fn delete_provider_accounts(&self, user_id: &Uuid, item_id: &str) -> Result<i32>;
    async fn delete_provider_connection(&self, user_id: &Uuid, item_id: &str) -> Result<()>;
    async fn delete_provider_credentials(&self, user_id: &Uuid, item_id: &str) -> Result<()>;
    async fn get_budgets_for_user(&self, user_id: Uuid) -> Result<Vec<Budget>>;
    async fn create_budget_for_user(&self, budget: Budget) -> Result<Budget>;

    async fn update_budget_for_user(
        &self,
        budget_id: Uuid,
        user_id: Uuid,
        amount: Option<rust_decimal::Decimal>,
        frequency: Option<String>,
        rollover: Option<bool>,
        rollover_start_month: Option<String>,
    ) -> Result<Budget>;

    async fn delete_budget_for_user(&self, budget_id: Uuid, user_id: Uuid) -> Result<()>;

    async fn get_latest_account_balances_for_user(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<LatestAccountBalance>>;

    async fn update_user_password(&self, user_id: &Uuid, new_password_hash: &str) -> Result<()>;

    async fn delete_user(&self, user_id: &Uuid) -> Result<()>;

    async fn get_user_categories(&self, user_id: Uuid) -> Result<Vec<UserCategory>>;
    async fn create_user_category(
        &self,
        user_id: Uuid,
        name: String,
        parent_category: Option<String>,
    ) -> Result<UserCategory>;
    async fn delete_user_category(&self, category_id: Uuid, user_id: Uuid) -> Result<()>;
    async fn set_transaction_category_override(
        &self,
        transaction_id: Uuid,
        user_id: Uuid,
        category_name: String,
        subcategory_name: Option<String>,
    ) -> Result<()>;
    async fn remove_transaction_category_override(
        &self,
        transaction_id: Uuid,
        user_id: Uuid,
    ) -> Result<()>;

    async fn get_category_rules(&self, user_id: Uuid) -> Result<Vec<CategoryRule>>;
    async fn create_category_rule(
        &self,
        user_id: Uuid,
        pattern: String,
        category_name: String,
        subcategory_name: Option<String>,
    ) -> Result<CategoryRule>;
    async fn update_category_rule(
        &self,
        rule_id: Uuid,
        user_id: Uuid,
        pattern: Option<String>,
        category_name: Option<String>,
        subcategory_name: Option<String>,
    ) -> Result<CategoryRule>;
    async fn delete_category_rule(&self, rule_id: Uuid, user_id: Uuid) -> Result<()>;
}

pub struct PostgresRepository {
    pool: PgPool,
    encryption_key: [u8; 32],
}

impl PostgresRepository {
    pub fn new(pool: PgPool) -> Result<Self> {
        let key_str = std::env::var("ENCRYPTION_KEY").unwrap_or_else(|_| {
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef".to_string()
        });

        let key_bytes =
            hex::decode(&key_str).map_err(|_| anyhow::anyhow!("Invalid encryption key format"))?;

        if key_bytes.len() != 32 {
            return Err(anyhow::anyhow!(
                "Encryption key must be 32 bytes (64 hex chars)"
            ));
        }

        let mut encryption_key = [0u8; 32];
        encryption_key.copy_from_slice(&key_bytes);

        Ok(Self {
            pool,
            encryption_key,
        })
    }

    fn encrypt_token(&self, token: &str) -> Result<Vec<u8>> {
        let key = Key::<Aes256Gcm>::from_slice(&self.encryption_key);
        let cipher = Aes256Gcm::new(key);

        let nonce_bytes: [u8; 12] = rand::random();
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, token.as_bytes())
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

        let mut result = nonce_bytes.to_vec();
        result.extend_from_slice(&ciphertext);

        Ok(result)
    }

    fn decrypt_token(&self, encrypted_data: &[u8]) -> Result<String> {
        if encrypted_data.len() < 12 {
            return Err(anyhow::anyhow!("Invalid encrypted data length"));
        }

        let (nonce_bytes, ciphertext) = encrypted_data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        let key = Key::<Aes256Gcm>::from_slice(&self.encryption_key);
        let cipher = Aes256Gcm::new(key);

        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;

        String::from_utf8(plaintext)
            .map_err(|e| anyhow::anyhow!("Invalid UTF-8 in decrypted data: {}", e))
    }

    fn map_user_row(
        (id, email, password_hash, provider, created_at, updated_at, onboarding_completed): (
            uuid::Uuid,
            String,
            String,
            String,
            chrono::DateTime<chrono::Utc>,
            chrono::DateTime<chrono::Utc>,
            bool,
        ),
    ) -> User {
        User {
            id,
            email,
            password_hash,
            provider,
            created_at,
            updated_at,
            onboarding_completed,
        }
    }
}

#[derive(sqlx::FromRow)]
struct ProviderConnectionRow {
    id: Uuid,
    user_id: Uuid,
    item_id: String,
    is_connected: bool,
    last_sync_at: Option<chrono::DateTime<chrono::Utc>>,
    connected_at: Option<chrono::DateTime<chrono::Utc>>,
    disconnected_at: Option<chrono::DateTime<chrono::Utc>>,
    institution_id: Option<String>,
    institution_name: Option<String>,
    institution_logo_url: Option<String>,
    sync_cursor: Option<String>,
    transaction_count: i32,
    account_count: i32,
    status: String,
    last_sync_error: Option<String>,
    created_at: Option<chrono::DateTime<chrono::Utc>>,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

impl From<ProviderConnectionRow> for ProviderConnection {
    fn from(r: ProviderConnectionRow) -> Self {
        Self {
            id: r.id,
            user_id: r.user_id,
            item_id: r.item_id,
            is_connected: r.is_connected,
            last_sync_at: r.last_sync_at,
            connected_at: r.connected_at,
            disconnected_at: r.disconnected_at,
            institution_id: r.institution_id,
            institution_name: r.institution_name,
            institution_logo_url: r.institution_logo_url,
            sync_cursor: r.sync_cursor,
            transaction_count: r.transaction_count,
            account_count: r.account_count,
            status: r.status,
            last_sync_error: r.last_sync_error,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

#[async_trait]
impl DatabaseRepository for PostgresRepository {
    async fn create_user(&self, user: &User) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO users (id, email, password_hash, provider, created_at, updated_at, onboarding_completed)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
        )
        .bind(user.id)
        .bind(&user.email)
        .bind(&user.password_hash)
        .bind(&user.provider)
        .bind(user.created_at)
        .bind(user.updated_at)
        .bind(user.onboarding_completed)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn get_user_by_email(&self, email: &str) -> Result<Option<User>> {
        let row = sqlx::query_as::<
            _,
            (
                uuid::Uuid,
                String,
                String,
                String,
                chrono::DateTime<chrono::Utc>,
                chrono::DateTime<chrono::Utc>,
                bool,
            ),
        >(
            "SELECT id, email, password_hash, provider, created_at, updated_at, onboarding_completed FROM users WHERE email = $1",
        )
        .bind(email)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(Self::map_user_row))
    }

    async fn get_user_by_id(&self, user_id: &Uuid) -> Result<Option<User>> {
        let row = sqlx::query_as::<
            _,
            (
                uuid::Uuid,
                String,
                String,
                String,
                chrono::DateTime<chrono::Utc>,
                chrono::DateTime<chrono::Utc>,
                bool,
            ),
        >(
            "SELECT id, email, password_hash, provider, created_at, updated_at, onboarding_completed FROM users WHERE id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(Self::map_user_row))
    }

    async fn mark_onboarding_complete(&self, user_id: &Uuid) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE users
            SET onboarding_completed = true, updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn update_user_provider(&self, user_id: &Uuid, provider: &str) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE users
            SET provider = $2, updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(user_id)
        .bind(provider)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn get_all_user_ids(&self) -> Result<Vec<Uuid>> {
        let rows = sqlx::query_scalar::<_, Uuid>("SELECT id FROM users ORDER BY created_at ASC")
            .fetch_all(&self.pool)
            .await?;
        Ok(rows)
    }

    async fn upsert_account(&self, account: &Account) -> Result<()> {
        // Ensure RLS permits this write by setting current user id (if provided)
        let mut tx = self.pool.begin().await?;
        if let Some(user_id) = account.user_id {
            sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
                .bind(user_id.to_string())
                .execute(&mut *tx)
                .await?;
        }
        sqlx::query(
            r#"
            INSERT INTO accounts (id, user_id, provider_account_id, provider_connection_id, name, account_type, balance_current, mask, institution_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (provider_account_id) 
            DO UPDATE SET 
                provider_connection_id = EXCLUDED.provider_connection_id,
                name = EXCLUDED.name,
                account_type = EXCLUDED.account_type,
                balance_current = COALESCE(EXCLUDED.balance_current, accounts.balance_current),
                mask = EXCLUDED.mask,
                institution_name = EXCLUDED.institution_name,
                updated_at = NOW()
            "#
        )
        .bind(account.id)
        .bind(account.user_id)
        .bind(&account.provider_account_id)
        .bind(account.provider_connection_id)
        .bind(&account.name)
        .bind(&account.account_type)
        .bind(account.balance_current)
        .bind(&account.mask)
        .bind(&account.institution_name)
        .execute(&mut *tx)
            .await?;
        tx.commit().await?;

        Ok(())
    }

    async fn merge_duplicate_provider_accounts(
        &self,
        user_id: &Uuid,
        connection_id: &Uuid,
    ) -> Result<i64> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let merged_count = sqlx::query_scalar::<_, i64>(
            r#"
            WITH ranked_accounts AS (
                SELECT
                    id,
                    FIRST_VALUE(id) OVER (
                        PARTITION BY provider_connection_id, LOWER(name), COALESCE(mask, ''), account_type
                        ORDER BY (balance_current IS NOT NULL) DESC, updated_at DESC, id DESC
                    ) AS canonical_id,
                    ROW_NUMBER() OVER (
                        PARTITION BY provider_connection_id, LOWER(name), COALESCE(mask, ''), account_type
                        ORDER BY (balance_current IS NOT NULL) DESC, updated_at DESC, id DESC
                    ) AS row_number
                FROM accounts
                WHERE user_id = $1
                  AND provider_connection_id = $2
                  AND provider_account_id IS NOT NULL
            ),
            duplicate_accounts AS (
                SELECT id, canonical_id
                FROM ranked_accounts
                WHERE row_number > 1
            ),
            moved_transactions AS (
                UPDATE transactions t
                SET account_id = d.canonical_id
                FROM duplicate_accounts d
                WHERE t.account_id = d.id
                  AND t.user_id = $1
                RETURNING t.id
            ),
            deleted_accounts AS (
                DELETE FROM accounts a
                USING duplicate_accounts d
                WHERE a.id = d.id
                RETURNING a.id
            )
            SELECT COUNT(*)::BIGINT FROM deleted_accounts
            "#,
        )
        .bind(user_id)
        .bind(connection_id)
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(merged_count)
    }

    async fn merge_duplicate_provider_transactions(
        &self,
        user_id: &Uuid,
        connection_id: &Uuid,
    ) -> Result<i64> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let merged_count = sqlx::query_scalar::<_, i64>(
            r#"
            WITH transaction_candidates AS (
                SELECT
                    t.id,
                    t.account_id,
                    t.amount,
                    t.date,
                    LOWER(REGEXP_REPLACE(COALESCE(t.merchant_name, ''), '[^[:alnum:]]+', '', 'g')) AS merchant_key,
                    COALESCE(t.merchant_name, '') AS merchant_name,
                    t.created_at
                FROM transactions t
                INNER JOIN accounts a ON a.id = t.account_id
                WHERE t.user_id = $1
                  AND a.provider_connection_id = $2
                  AND t.provider_transaction_id IS NOT NULL
            ),
            duplicate_pairs AS (
                SELECT DISTINCT
                    CASE
                        WHEN LENGTH(newer.merchant_key) > LENGTH(older.merchant_key)
                            OR (
                                LENGTH(newer.merchant_key) = LENGTH(older.merchant_key)
                                AND newer.created_at >= older.created_at
                            )
                        THEN newer.id
                        ELSE older.id
                    END AS canonical_id,
                    CASE
                        WHEN LENGTH(newer.merchant_key) > LENGTH(older.merchant_key)
                            OR (
                                LENGTH(newer.merchant_key) = LENGTH(older.merchant_key)
                                AND newer.created_at >= older.created_at
                            )
                        THEN older.id
                        ELSE newer.id
                    END AS duplicate_id
                FROM transaction_candidates older
                INNER JOIN transaction_candidates newer
                    ON newer.account_id = older.account_id
                    AND newer.amount = older.amount
                    AND newer.date = older.date
                    AND newer.id <> older.id
                    AND older.merchant_key <> ''
                    AND newer.merchant_key <> ''
                    AND (
                        older.merchant_key = newer.merchant_key
                        OR POSITION(older.merchant_key IN newer.merchant_key) > 0
                        OR POSITION(newer.merchant_key IN older.merchant_key) > 0
                    )
            ),
            moved_overrides AS (
                INSERT INTO transaction_category_overrides (
                    transaction_id, user_id, category_name, created_at
                )
                SELECT
                    d.canonical_id,
                    tco.user_id,
                    tco.category_name,
                    tco.created_at
                FROM transaction_category_overrides tco
                INNER JOIN duplicate_pairs d ON d.duplicate_id = tco.transaction_id
                WHERE tco.user_id = $1
                ON CONFLICT (transaction_id, user_id)
                DO NOTHING
                RETURNING transaction_id
            ),
            deleted_transactions AS (
                DELETE FROM transactions t
                USING duplicate_pairs d
                WHERE t.id = d.duplicate_id
                  AND t.user_id = $1
                RETURNING t.id
            )
            SELECT COUNT(*)::BIGINT FROM deleted_transactions
            "#,
        )
        .bind(user_id)
        .bind(connection_id)
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(merged_count)
    }

    async fn mark_transaction_duplicate(
        &self,
        transaction_id: Uuid,
        user_id: Uuid,
    ) -> Result<Uuid> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let canonical_id = sqlx::query_scalar::<_, Uuid>(
            r#"
            WITH selected AS (
                SELECT
                    id,
                    account_id,
                    amount,
                    date,
                    pending,
                    LOWER(REGEXP_REPLACE(COALESCE(merchant_name, ''), '[^[:alnum:]]+', '', 'g')) AS merchant_key
                FROM transactions
                WHERE id = $1
                  AND user_id = $2
                  AND duplicate_of_transaction_id IS NULL
            ),
            candidate AS (
                SELECT t.id
                FROM transactions t
                INNER JOIN selected s
                    ON t.account_id = s.account_id
                    AND t.amount = s.amount
                    AND ABS(t.date - s.date) <= 7
                    AND t.id <> s.id
                    AND t.user_id = $2
                    AND t.duplicate_of_transaction_id IS NULL
                    AND s.amount <> 0
                    AND (s.pending = TRUE OR t.pending = FALSE)
                ORDER BY
                    CASE
                        WHEN s.merchant_key <> ''
                            AND LOWER(REGEXP_REPLACE(COALESCE(t.merchant_name, ''), '[^[:alnum:]]+', '', 'g')) <> ''
                            AND (
                                LOWER(REGEXP_REPLACE(COALESCE(t.merchant_name, ''), '[^[:alnum:]]+', '', 'g')) = s.merchant_key
                                OR POSITION(s.merchant_key IN LOWER(REGEXP_REPLACE(COALESCE(t.merchant_name, ''), '[^[:alnum:]]+', '', 'g'))) > 0
                                OR POSITION(LOWER(REGEXP_REPLACE(COALESCE(t.merchant_name, ''), '[^[:alnum:]]+', '', 'g')) IN s.merchant_key) > 0
                            )
                        THEN 0
                        ELSE 1
                    END,
                    t.pending ASC,
                    t.created_at ASC NULLS LAST,
                    t.id ASC
                LIMIT 1
            ),
            updated AS (
                UPDATE transactions t
                SET duplicate_of_transaction_id = candidate.id,
                    duplicate_reviewed_at = NOW(),
                    duplicate_reviewed_by = $2
                FROM candidate
                WHERE t.id = $1
                  AND t.user_id = $2
                RETURNING t.duplicate_of_transaction_id, candidate.id AS canonical_id, t.id AS pending_id
            ),
            transferred_overrides AS (
                INSERT INTO transaction_category_overrides (transaction_id, user_id, category_name, subcategory_name, created_at)
                SELECT 
                    u.canonical_id,
                    tco.user_id,
                    tco.category_name,
                    tco.subcategory_name,
                    tco.created_at
                FROM updated u
                JOIN transaction_category_overrides tco ON tco.transaction_id = u.pending_id AND tco.user_id = $2
                LEFT JOIN transaction_category_overrides tco_posted ON tco_posted.transaction_id = u.canonical_id AND tco_posted.user_id = $2
                WHERE tco_posted.category_name IS NULL
                ON CONFLICT (transaction_id, user_id) DO NOTHING
                RETURNING 1
            ),
            transferred_receipts AS (
                UPDATE amazon_receipts ar
                SET matched_transaction_id = u.canonical_id
                FROM updated u
                WHERE ar.matched_transaction_id = u.pending_id
                RETURNING 1
            )
            SELECT duplicate_of_transaction_id FROM updated
            "#,
        )
        .bind(transaction_id)
        .bind(user_id)
        .fetch_optional(&mut *tx)
        .await?;

        tx.commit().await?;

        canonical_id.ok_or_else(|| {
            anyhow::anyhow!(
                "No matching duplicate candidate found for transaction {}",
                transaction_id
            )
        })
    }

    async fn auto_resolve_pending_duplicates(
        &self,
        user_id: &Uuid,
        connection_id: Option<&Uuid>,
    ) -> Result<i64> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let resolved_count = sqlx::query_scalar::<_, i64>(
            r#"
            WITH pending_tx AS (
                SELECT 
                    t.id, t.account_id, t.amount, t.date,
                    LOWER(REGEXP_REPLACE(COALESCE(t.merchant_name, ''), '[^[:alnum:]]+', '', 'g')) AS merchant_key
                FROM transactions t
                INNER JOIN accounts a ON a.id = t.account_id
                WHERE t.user_id = $1
                  AND t.pending = TRUE
                  AND t.duplicate_of_transaction_id IS NULL
                  AND t.amount <> 0
                  AND ($2::uuid IS NULL OR a.provider_connection_id = $2)
            ),
            posted_tx AS (
                SELECT 
                    t.id, t.account_id, t.amount, t.date,
                    LOWER(REGEXP_REPLACE(COALESCE(t.merchant_name, ''), '[^[:alnum:]]+', '', 'g')) AS merchant_key
                FROM transactions t
                INNER JOIN accounts a ON a.id = t.account_id
                WHERE t.user_id = $1
                  AND t.pending = FALSE
                  AND t.duplicate_of_transaction_id IS NULL
                  AND t.amount <> 0
                  AND ($2::uuid IS NULL OR a.provider_connection_id = $2)
            ),
            matched_pairs AS (
                SELECT DISTINCT ON (p.id)
                    p.id AS pending_id,
                    post.id AS posted_id
                FROM pending_tx p
                INNER JOIN posted_tx post
                    ON post.account_id = p.account_id
                    AND post.amount = p.amount
                    AND ABS(post.date - p.date) <= 7
                    AND (
                        p.merchant_key = post.merchant_key
                        OR POSITION(p.merchant_key IN post.merchant_key) > 0
                        OR POSITION(post.merchant_key IN p.merchant_key) > 0
                        OR (LENGTH(p.merchant_key) >= 6 AND LENGTH(post.merchant_key) >= 6 AND (
                            POSITION(SUBSTRING(p.merchant_key FROM 1 FOR 6) IN post.merchant_key) > 0
                            OR POSITION(SUBSTRING(post.merchant_key FROM 1 FOR 6) IN p.merchant_key) > 0
                        ))
                        OR (
                            (p.merchant_key LIKE '%verizon%' AND post.merchant_key LIKE '%verizon%')
                            OR (p.merchant_key LIKE '%amazon%' AND post.merchant_key LIKE '%amazon%')
                        )
                    )
                ORDER BY p.id, ABS(post.date - p.date) ASC, post.date ASC
            ),
            updated AS (
                UPDATE transactions t
                SET duplicate_of_transaction_id = m.posted_id,
                    duplicate_reviewed_at = NOW(),
                    duplicate_reviewed_by = $1
                FROM matched_pairs m
                WHERE t.id = m.pending_id
                  AND t.user_id = $1
                RETURNING t.id AS pending_id, m.posted_id
            ),
            transferred_overrides AS (
                INSERT INTO transaction_category_overrides (transaction_id, user_id, category_name, subcategory_name, created_at)
                SELECT 
                    u.posted_id,
                    tco.user_id,
                    tco.category_name,
                    tco.subcategory_name,
                    tco.created_at
                FROM updated u
                JOIN transaction_category_overrides tco ON tco.transaction_id = u.pending_id AND tco.user_id = $1
                LEFT JOIN transaction_category_overrides tco_posted ON tco_posted.transaction_id = u.posted_id AND tco_posted.user_id = $1
                WHERE tco_posted.category_name IS NULL
                ON CONFLICT (transaction_id, user_id) DO NOTHING
                RETURNING 1
            ),
            transferred_receipts AS (
                UPDATE amazon_receipts ar
                SET matched_transaction_id = u.posted_id
                FROM updated u
                WHERE ar.matched_transaction_id = u.pending_id
                RETURNING 1
            )
            SELECT COUNT(*)::BIGINT FROM updated
            "#,
        )
        .bind(user_id)
        .bind(connection_id)
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(resolved_count)
    }

    async fn create_manual_account(&self, account: &Account) -> Result<Account> {
        let mut tx = self.pool.begin().await?;
        if let Some(user_id) = account.user_id {
            sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
                .bind(user_id.to_string())
                .execute(&mut *tx)
                .await?;
        }

        let (updated_at,) = sqlx::query_as::<_, (chrono::DateTime<chrono::Utc>,)>(
            r#"
            INSERT INTO accounts (
                id, user_id, provider_account_id, provider_connection_id,
                name, account_type, balance_current, mask, institution_name
            )
            VALUES ($1, $2, NULL, NULL, $3, $4, $5, $6, $7)
            RETURNING updated_at
            "#,
        )
        .bind(account.id)
        .bind(account.user_id)
        .bind(&account.name)
        .bind(&account.account_type)
        .bind(account.balance_current)
        .bind(&account.mask)
        .bind(&account.institution_name)
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(Account {
            updated_at: Some(updated_at),
            ..account.clone()
        })
    }

    async fn update_manual_account(&self, account: &Account) -> Result<Account> {
        let user_id = account
            .user_id
            .ok_or_else(|| anyhow::anyhow!("Manual account update requires a user id"))?;
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let updated_at = sqlx::query_scalar::<_, chrono::DateTime<chrono::Utc>>(
            r#"
            UPDATE accounts
            SET name = $1,
                balance_current = $2,
                mask = $3,
                institution_name = $4,
                updated_at = NOW()
            WHERE id = $5
              AND user_id = $6
              AND provider_connection_id IS NULL
              AND account_type = $7
            RETURNING updated_at
            "#,
        )
        .bind(&account.name)
        .bind(account.balance_current)
        .bind(&account.mask)
        .bind(&account.institution_name)
        .bind(account.id)
        .bind(user_id)
        .bind(&account.account_type)
        .fetch_optional(&mut *tx)
        .await?;

        let Some(updated_at) = updated_at else {
            let _ = tx.rollback().await;
            return Err(anyhow::anyhow!("Manual account not found"));
        };

        tx.commit().await?;
        Ok(Account {
            updated_at: Some(updated_at),
            ..account.clone()
        })
    }

    async fn delete_manual_account(&self, account_id: Uuid, user_id: Uuid) -> Result<()> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let result = sqlx::query(
            r#"
            DELETE FROM accounts
            WHERE id = $1
              AND user_id = $2
              AND provider_connection_id IS NULL
            "#,
        )
        .bind(account_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        if result.rows_affected() == 0 {
            let _ = tx.rollback().await;
            return Err(anyhow::anyhow!("Manual account not found"));
        }

        tx.commit().await?;
        Ok(())
    }

    async fn record_manual_account_balance(
        &self,
        account_id: Uuid,
        user_id: Uuid,
        as_of_date: chrono::NaiveDate,
        balance_current: rust_decimal::Decimal,
    ) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query(
            r#"
            INSERT INTO manual_account_balance_history (
                account_id, user_id, as_of_date, balance_current
            )
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (account_id, as_of_date)
            DO UPDATE SET balance_current = EXCLUDED.balance_current
            "#,
        )
        .bind(account_id)
        .bind(user_id)
        .bind(as_of_date)
        .bind(balance_current)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(())
    }

    async fn get_manual_account_balance_history_for_user(
        &self,
        user_id: &Uuid,
        end_date: chrono::NaiveDate,
    ) -> Result<Vec<ManualAccountBalanceHistoryPoint>> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let rows = sqlx::query_as::<_, (Uuid, chrono::NaiveDate, rust_decimal::Decimal)>(
            r#"
            SELECT account_id, as_of_date, balance_current
            FROM manual_account_balance_history
            WHERE user_id = $1
              AND as_of_date <= $2
            ORDER BY account_id, as_of_date
            "#,
        )
        .bind(user_id)
        .bind(end_date)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(rows
            .into_iter()
            .map(
                |(account_id, as_of_date, balance_current)| ManualAccountBalanceHistoryPoint {
                    account_id,
                    as_of_date,
                    balance_current,
                },
            )
            .collect())
    }

    async fn upsert_transaction(&self, transaction: &Transaction) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        if let Some(user_id) = transaction.user_id {
            sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
                .bind(user_id.to_string())
                .execute(&mut *tx)
                .await?;
        }

        sqlx::query(
            r#"
            INSERT INTO transactions (
                id, account_id, user_id, provider_transaction_id, amount, date,
                merchant_name, category_primary, category_detailed,
                category_confidence, payment_channel, pending, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (provider_transaction_id)
            DO UPDATE SET
                amount = EXCLUDED.amount,
                merchant_name = EXCLUDED.merchant_name,
                pending = EXCLUDED.pending
            "#,
        )
        .bind(transaction.id)
        .bind(transaction.account_id)
        .bind(transaction.user_id)
        .bind(&transaction.provider_transaction_id)
        .bind(transaction.amount)
        .bind(transaction.date)
        .bind(&transaction.merchant_name)
        .bind(&transaction.category_primary)
        .bind(&transaction.category_detailed)
        .bind(&transaction.category_confidence)
        .bind(&transaction.payment_channel)
        .bind(transaction.pending)
        .bind(transaction.created_at.unwrap_or_else(chrono::Utc::now))
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;

        Ok(())
    }

    async fn store_provider_credentials_for_user(
        &self,
        user_id: &Uuid,
        item_id: &str,
        access_token: &str,
    ) -> Result<Uuid> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let id = Uuid::new_v4();
        let encrypted_token = self.encrypt_token(access_token)?;

        sqlx::query(
            r#"
            INSERT INTO plaid_credentials (id, user_id, item_id, encrypted_access_token)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (item_id)
            DO UPDATE SET
                user_id = EXCLUDED.user_id,
                encrypted_access_token = EXCLUDED.encrypted_access_token,
                updated_at = NOW()
            "#,
        )
        .bind(id)
        .bind(user_id)
        .bind(item_id)
        .bind(&encrypted_token)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(id)
    }

    async fn get_provider_credentials_for_user(
        &self,
        user_id: &Uuid,
        item_id: &str,
    ) -> Result<Option<PlaidCredentials>> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let row = sqlx::query_as::<_, (Uuid, String, Vec<u8>, chrono::DateTime<chrono::Utc>, chrono::DateTime<chrono::Utc>)>(
            "SELECT id, item_id, encrypted_access_token, created_at, updated_at FROM plaid_credentials WHERE item_id = $1"
        )
        .bind(item_id)
        .fetch_optional(&mut *tx)
        .await?;

        tx.commit().await?;

        if let Some((id, item_id, encrypted_access_token, created_at, updated_at)) = row {
            let access_token = self.decrypt_token(&encrypted_access_token)?;
            Ok(Some(PlaidCredentials {
                id,
                item_id,
                user_id: Some(*user_id),
                access_token,
                created_at,
                updated_at,
            }))
        } else {
            Ok(None)
        }
    }

    async fn save_provider_connection(&self, connection: &ProviderConnection) -> Result<()> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(connection.user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query(
            r#"
            INSERT INTO provider_connections (
                id, user_id, item_id, is_connected, last_sync_at, connected_at,
                disconnected_at, institution_id, institution_name, transaction_count, account_count,
                status, last_sync_error, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (item_id)
            DO UPDATE SET
                is_connected = EXCLUDED.is_connected,
                last_sync_at = EXCLUDED.last_sync_at,
                connected_at = EXCLUDED.connected_at,
                disconnected_at = EXCLUDED.disconnected_at,
                institution_id = EXCLUDED.institution_id,
                institution_name = EXCLUDED.institution_name,
                transaction_count = EXCLUDED.transaction_count,
                account_count = EXCLUDED.account_count,
                status = EXCLUDED.status,
                last_sync_error = EXCLUDED.last_sync_error,
                updated_at = EXCLUDED.updated_at
            "#,
        )
        .bind(connection.id)
        .bind(connection.user_id)
        .bind(&connection.item_id)
        .bind(connection.is_connected)
        .bind(connection.last_sync_at)
        .bind(connection.connected_at)
        .bind(connection.disconnected_at)
        .bind(&connection.institution_id)
        .bind(&connection.institution_name)
        .bind(connection.transaction_count)
        .bind(connection.account_count)
        .bind(&connection.status)
        .bind(&connection.last_sync_error)
        .bind(connection.created_at)
        .bind(connection.updated_at)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;

        Ok(())
    }

    async fn get_all_provider_connections_by_user(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<ProviderConnection>> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let rows = sqlx::query_as::<_, ProviderConnectionRow>(
            r#"
            SELECT id, user_id, item_id, is_connected, last_sync_at, connected_at,
                   disconnected_at, institution_id, institution_name, institution_logo_url,
                   sync_cursor, transaction_count, account_count, status, last_sync_error, created_at, updated_at
            FROM provider_connections
            WHERE user_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn get_provider_connection_by_id(
        &self,
        connection_id: &Uuid,
        user_id: &Uuid,
    ) -> Result<Option<ProviderConnection>> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let row = sqlx::query_as::<_, ProviderConnectionRow>(
            r#"
            SELECT id, user_id, item_id, is_connected, last_sync_at, connected_at,
                   disconnected_at, institution_id, institution_name, institution_logo_url,
                   sync_cursor, transaction_count, account_count, status, last_sync_error, created_at, updated_at
            FROM provider_connections
            WHERE id = $1
            "#,
        )
        .bind(connection_id)
        .fetch_optional(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(row.map(Into::into))
    }

    async fn delete_provider_transactions(&self, user_id: &Uuid, item_id: &str) -> Result<i32> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let connection_id: Option<Uuid> =
            sqlx::query_scalar("SELECT id FROM provider_connections WHERE item_id = $1")
                .bind(item_id)
                .fetch_optional(&mut *tx)
                .await?;

        let Some(conn_id) = connection_id else {
            tx.commit().await?;
            return Ok(0);
        };

        let result = sqlx::query(
            r#"
            DELETE FROM transactions
            WHERE account_id IN (
                SELECT id FROM accounts WHERE provider_connection_id = $1
            )
            "#,
        )
        .bind(conn_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(result.rows_affected() as i32)
    }

    async fn delete_provider_accounts(&self, user_id: &Uuid, item_id: &str) -> Result<i32> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let connection_id: Option<Uuid> =
            sqlx::query_scalar("SELECT id FROM provider_connections WHERE item_id = $1")
                .bind(item_id)
                .fetch_optional(&mut *tx)
                .await?;

        let Some(conn_id) = connection_id else {
            tx.commit().await?;
            return Ok(0);
        };

        let result = sqlx::query("DELETE FROM accounts WHERE provider_connection_id = $1")
            .bind(conn_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(result.rows_affected() as i32)
    }

    async fn delete_provider_connection(&self, user_id: &Uuid, item_id: &str) -> Result<()> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query("DELETE FROM provider_connections WHERE user_id = $1 AND item_id = $2")
            .bind(user_id)
            .bind(item_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(())
    }

    async fn delete_provider_credentials(&self, user_id: &Uuid, item_id: &str) -> Result<()> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query("DELETE FROM plaid_credentials WHERE item_id = $1")
            .bind(item_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(())
    }

    async fn get_transactions_for_user(&self, user_id: &Uuid) -> Result<Vec<Transaction>> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let rows = sqlx::query_as::<
            _,
            (
                Uuid,
                Uuid,
                Option<Uuid>,
                Option<String>,
                rust_decimal::Decimal,
                chrono::NaiveDate,
                Option<String>,
                String,
                String,
                String,
                Option<String>,
                bool,
                Option<chrono::DateTime<chrono::Utc>>,
            ),
        >(
            r#"
            SELECT id, account_id, user_id, provider_transaction_id, amount, date,
                   merchant_name, category_primary, category_detailed,
                   category_confidence, payment_channel, pending, created_at
            FROM transactions 
            WHERE user_id = $1
              AND duplicate_of_transaction_id IS NULL
            ORDER BY date DESC, created_at DESC
            LIMIT 1000
            "#,
        )
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(rows
            .into_iter()
            .map(
                |(
                    id,
                    account_id,
                    user_id,
                    provider_transaction_id,
                    amount,
                    date,
                    merchant_name,
                    category_primary,
                    category_detailed,
                    category_confidence,
                    payment_channel,
                    pending,
                    created_at,
                )| Transaction {
                    id,
                    account_id,
                    user_id,
                    provider_account_id: None,
                    provider_transaction_id,
                    amount,
                    date,
                    merchant_name,
                    category_primary,
                    category_detailed,
                    category_confidence,
                    payment_channel,
                    pending,
                    created_at,
                },
            )
            .collect())
    }

    async fn get_transactions_with_account_for_user(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<TransactionWithAccount>> {
        // SQLx only implements FromRow for tuples up to 16 elements, so we use a
        // named struct to handle the 17-column result set.
        #[derive(sqlx::FromRow)]
        struct Row {
            id: Uuid,
            account_id: Uuid,
            user_id: Option<Uuid>,
            provider_transaction_id: Option<String>,
            amount: rust_decimal::Decimal,
            date: chrono::NaiveDate,
            merchant_name: Option<String>,
            category_primary: String,
            category_detailed: String,
            category_confidence: String,
            payment_channel: Option<String>,
            pending: bool,
            created_at: Option<chrono::DateTime<chrono::Utc>>,
            account_name: String,
            account_type: String,
            account_mask: Option<String>,
            provider: Option<String>,
            custom_category: Option<String>,
            custom_subcategory: Option<String>,
        }

        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let rows = sqlx::query_as::<_, Row>(
            r#"
            SELECT t.id, t.account_id, t.user_id, t.provider_transaction_id, t.amount, t.date,
                   t.merchant_name, t.category_primary, t.category_detailed,
                   t.category_confidence, t.payment_channel, t.pending, t.created_at,
                   a.name as account_name, a.account_type, a.mask as account_mask,
                   CASE
                     WHEN pc.item_id LIKE 'teller_%' THEN 'teller'
                     WHEN pc.item_id IS NOT NULL THEN 'plaid'
                     ELSE NULL
                   END as provider,
                   COALESCE(tco.category_name, tco_dup.category_name) as custom_category,
                   COALESCE(tco.subcategory_name, tco_dup.subcategory_name) as custom_subcategory
            FROM transactions t
            INNER JOIN accounts a ON t.account_id = a.id
            LEFT JOIN provider_connections pc ON a.provider_connection_id = pc.id
            LEFT JOIN transaction_category_overrides tco
                ON t.id = tco.transaction_id AND tco.user_id = $1
            LEFT JOIN (
                SELECT DISTINCT ON (t_p.duplicate_of_transaction_id)
                    t_p.duplicate_of_transaction_id,
                    tco_p.category_name,
                    tco_p.subcategory_name
                FROM transactions t_p
                JOIN transaction_category_overrides tco_p
                    ON t_p.id = tco_p.transaction_id AND tco_p.user_id = $1
                WHERE t_p.duplicate_of_transaction_id IS NOT NULL
                ORDER BY t_p.duplicate_of_transaction_id, t_p.created_at DESC
            ) tco_dup ON t.id = tco_dup.duplicate_of_transaction_id
            WHERE t.user_id = $1
              AND t.duplicate_of_transaction_id IS NULL
            ORDER BY t.date DESC, t.created_at DESC
            LIMIT 1000
            "#,
        )
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?;
        tx.commit().await?;

        Ok(rows
            .into_iter()
            .map(|r| TransactionWithAccount {
                id: r.id,
                account_id: r.account_id,
                user_id: r.user_id,
                provider_account_id: None,
                provider_transaction_id: r.provider_transaction_id,
                amount: r.amount,
                date: r.date,
                merchant_name: r.merchant_name,
                category_primary: r.category_primary,
                category_detailed: r.category_detailed,
                category_confidence: r.category_confidence,
                payment_channel: r.payment_channel,
                pending: r.pending,
                created_at: r.created_at,
                account_name: r.account_name,
                account_type: r.account_type,
                account_mask: r.account_mask,
                provider: r.provider,
                custom_category: r.custom_category,
                custom_subcategory: r.custom_subcategory,
                rule_category: None, // populated by the handler after applying category rules
                rule_subcategory: None,
            })
            .collect())
    }

    async fn get_transactions_by_date_range_for_user(
        &self,
        user_id: &Uuid,
        start_date: chrono::NaiveDate,
        end_date: chrono::NaiveDate,
    ) -> Result<Vec<Transaction>> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let rows = sqlx::query_as::<
            _,
            (
                Uuid,
                Uuid,
                Option<Uuid>,
                Option<String>,
                rust_decimal::Decimal,
                chrono::NaiveDate,
                Option<String>,
                String,
                String,
                String,
                Option<String>,
                bool,
                Option<chrono::DateTime<chrono::Utc>>,
            ),
        >(
            r#"
            SELECT id, account_id, user_id, provider_transaction_id, amount, date,
                   merchant_name, category_primary, category_detailed,
                   category_confidence, payment_channel, pending, created_at
            FROM transactions 
            WHERE user_id = $1
              AND date >= $2
              AND date <= $3
              AND duplicate_of_transaction_id IS NULL
            ORDER BY date DESC, created_at DESC
            LIMIT 1000
            "#,
        )
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(rows
            .into_iter()
            .map(
                |(
                    id,
                    account_id,
                    user_id,
                    provider_transaction_id,
                    amount,
                    date,
                    merchant_name,
                    category_primary,
                    category_detailed,
                    category_confidence,
                    payment_channel,
                    pending,
                    created_at,
                )| Transaction {
                    id,
                    account_id,
                    user_id,
                    provider_account_id: None,
                    provider_transaction_id,
                    amount,
                    date,
                    merchant_name,
                    category_primary,
                    category_detailed,
                    category_confidence,
                    payment_channel,
                    pending,
                    created_at,
                },
            )
            .collect())
    }

    async fn get_accounts_for_user(&self, user_id: &Uuid) -> Result<Vec<Account>> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let rows = sqlx::query_as::<
            _,
            (
                Uuid,
                Option<Uuid>,
                Option<String>,
                Option<Uuid>,
                String,
                String,
                Option<rust_decimal::Decimal>,
                Option<String>,
                Option<String>,
                Option<chrono::DateTime<chrono::Utc>>,
            ),
        >(
            r#"
            SELECT
                a.id,
                a.user_id,
                a.provider_account_id,
                a.provider_connection_id,
                a.name,
                a.account_type,
                COALESCE(
                    a.balance_current,
                    CASE
                        WHEN LOWER(a.account_type) IN ('credit', 'credit card') THEN (
                            SELECT NULLIF(COALESCE(SUM(-t.amount), 0), 0)
                            FROM transactions t
                            WHERE t.account_id = a.id
                              AND t.user_id = a.user_id
                              AND t.pending = false
                        )
                    END
                ) AS balance_current,
                a.mask,
                COALESCE(a.institution_name, pc.institution_name) AS institution_name,
                a.updated_at
            FROM accounts a
            LEFT JOIN provider_connections pc ON pc.id = a.provider_connection_id
            WHERE a.user_id = $1
            ORDER BY a.name
            "#,
        )
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(rows
            .into_iter()
            .map(
                |(
                    id,
                    user_id,
                    provider_account_id,
                    provider_connection_id,
                    name,
                    account_type,
                    balance_current,
                    mask,
                    institution_name,
                    updated_at,
                )| Account {
                    id,
                    user_id,
                    provider_account_id,
                    provider_connection_id,
                    name,
                    account_type,
                    balance_current,
                    mask,
                    institution_name,
                    updated_at,
                },
            )
            .collect())
    }

    async fn get_transaction_count_by_account_for_user(
        &self,
        user_id: &Uuid,
    ) -> Result<std::collections::HashMap<Uuid, i64>> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let rows = sqlx::query_as::<_, (Uuid, i64)>(
            r#"
            SELECT account_id, COUNT(*) as count
            FROM transactions 
            WHERE user_id = $1
            GROUP BY account_id
            "#,
        )
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(rows.into_iter().collect())
    }

    async fn get_budgets_for_user(&self, user_id: Uuid) -> Result<Vec<Budget>> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let budgets = sqlx::query_as::<_, Budget>(
            "SELECT id, user_id, category, amount, frequency, rollover, rollover_start_month, created_at, updated_at 
             FROM budgets 
             WHERE user_id = $1 
             ORDER BY category ASC",
        )
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(budgets)
    }

    async fn create_budget_for_user(&self, budget: Budget) -> Result<Budget> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(budget.user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let res = sqlx::query(
            "INSERT INTO budgets (id, user_id, category, amount, frequency, rollover, rollover_start_month, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        )
        .bind(budget.id)
        .bind(budget.user_id)
        .bind(&budget.category)
        .bind(budget.amount)
        .bind(&budget.frequency)
        .bind(budget.rollover)
        .bind(&budget.rollover_start_month)
        .bind(budget.created_at)
        .bind(budget.updated_at)
        .execute(&mut *tx)
        .await;

        if let Err(e) = res {
            if let sqlx::Error::Database(db_err) = &e {
                if db_err.is_unique_violation() {
                    let _ = tx.rollback().await;
                    return Err(anyhow::anyhow!("Budget category already exists"));
                }
            }
            let _ = tx.rollback().await;
            return Err(anyhow::anyhow!(e));
        }

        tx.commit().await?;
        Ok(budget)
    }

    async fn update_budget_for_user(
        &self,
        budget_id: Uuid,
        user_id: Uuid,
        amount: Option<rust_decimal::Decimal>,
        frequency: Option<String>,
        rollover: Option<bool>,
        rollover_start_month: Option<String>,
    ) -> Result<Budget> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let updated_at = chrono::Utc::now();

        sqlx::query(
            "UPDATE budgets 
             SET amount = COALESCE($1, amount),
                 frequency = COALESCE($2, frequency),
                 rollover = COALESCE($3, rollover),
                 rollover_start_month = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE rollover_start_month END,
                 updated_at = $5 
             WHERE id = $6 AND user_id = $7",
        )
        .bind(amount)
        .bind(frequency)
        .bind(rollover)
        .bind(rollover_start_month)
        .bind(updated_at)
        .bind(budget_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        let updated_budget = sqlx::query_as::<_, Budget>(
            "SELECT id, user_id, category, amount, frequency, rollover, rollover_start_month, created_at, updated_at 
             FROM budgets 
             WHERE id = $1 AND user_id = $2",
        )
        .bind(budget_id)
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(updated_budget)
    }

    async fn delete_budget_for_user(&self, budget_id: Uuid, user_id: Uuid) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query("DELETE FROM budgets WHERE id = $1 AND user_id = $2")
            .bind(budget_id)
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(())
    }

    async fn get_latest_account_balances_for_user(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<LatestAccountBalance>> {
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&self.pool)
            .await?;

        let rows = sqlx::query_as::<_, LatestAccountBalance>(
            r#"
            SELECT
                a.id AS account_id,
                COALESCE(a.institution_name, pc.institution_name, 'unknown_institution') AS institution_id,
                a.account_type,
                NULL::text AS account_subtype,
                'USD'::text AS currency,
                COALESCE(
                    a.balance_current,
                    CASE
                        WHEN LOWER(a.account_type) IN ('credit', 'credit card') THEN (
                            SELECT NULLIF(COALESCE(SUM(-t.amount), 0), 0)
                            FROM transactions t
                            WHERE t.account_id = a.id
                              AND t.user_id = a.user_id
                              AND t.pending = false
                        )
                    END,
                    0
                ) AS current_balance,
                a.provider_connection_id,
                COALESCE(a.institution_name, pc.institution_name) AS institution_name
            FROM accounts a
            LEFT JOIN provider_connections pc ON pc.id = a.provider_connection_id
            WHERE a.user_id = $1
            ORDER BY a.name
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn update_user_password(&self, user_id: &Uuid, new_password_hash: &str) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2")
            .bind(new_password_hash)
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(())
    }

    async fn delete_user(&self, user_id: &Uuid) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(())
    }

    async fn get_user_categories(&self, user_id: Uuid) -> Result<Vec<UserCategory>> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let categories = sqlx::query_as::<_, UserCategory>(
            "SELECT id, user_id, name, parent_category, created_at
             FROM user_categories
             WHERE user_id = $1
             ORDER BY name ASC",
        )
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(categories)
    }

    async fn create_user_category(
        &self,
        user_id: Uuid,
        name: String,
        parent_category: Option<String>,
    ) -> Result<UserCategory> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let id = Uuid::new_v4();
        let created_at = chrono::Utc::now();

        let res = sqlx::query(
            "INSERT INTO user_categories (id, user_id, name, parent_category, created_at)
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(id)
        .bind(user_id)
        .bind(&name)
        .bind(&parent_category)
        .bind(created_at)
        .execute(&mut *tx)
        .await;

        if let Err(e) = res {
            if let sqlx::Error::Database(db_err) = &e {
                if db_err.is_unique_violation() {
                    let _ = tx.rollback().await;
                    return Err(anyhow::anyhow!("Category name already exists"));
                }
            }
            let _ = tx.rollback().await;
            return Err(anyhow::anyhow!(e));
        }

        tx.commit().await?;
        Ok(UserCategory {
            id,
            user_id,
            name,
            parent_category,
            created_at,
        })
    }

    async fn delete_user_category(&self, category_id: Uuid, user_id: Uuid) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        // Fetch the category name so we can clear any overrides that reference it.
        let name: Option<String> =
            sqlx::query_scalar("SELECT name FROM user_categories WHERE id = $1 AND user_id = $2")
                .bind(category_id)
                .bind(user_id)
                .fetch_optional(&mut *tx)
                .await?;

        sqlx::query("DELETE FROM user_categories WHERE id = $1 AND user_id = $2")
            .bind(category_id)
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

        // Remove transaction overrides that used this category name so those
        // transactions revert to their provider category.
        if let Some(cat_name) = name {
            sqlx::query(
                "DELETE FROM transaction_category_overrides WHERE user_id = $1 AND category_name = $2",
            )
            .bind(user_id)
            .bind(cat_name)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    async fn set_transaction_category_override(
        &self,
        transaction_id: Uuid,
        user_id: Uuid,
        category_name: String,
        subcategory_name: Option<String>,
    ) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query(
            "INSERT INTO transaction_category_overrides (transaction_id, user_id, category_name, subcategory_name, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (transaction_id, user_id) DO UPDATE SET category_name = EXCLUDED.category_name, subcategory_name = EXCLUDED.subcategory_name",
        )
        .bind(transaction_id)
        .bind(user_id)
        .bind(&category_name)
        .bind(&subcategory_name)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(())
    }

    async fn remove_transaction_category_override(
        &self,
        transaction_id: Uuid,
        user_id: Uuid,
    ) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query(
            "DELETE FROM transaction_category_overrides WHERE transaction_id = $1 AND user_id = $2",
        )
        .bind(transaction_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(())
    }

    async fn get_category_rules(&self, user_id: Uuid) -> Result<Vec<CategoryRule>> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let rules = sqlx::query_as::<_, CategoryRule>(
            "SELECT id, user_id, pattern, category_name, subcategory_name, created_at, updated_at
             FROM category_rules
             WHERE user_id = $1
             ORDER BY length(pattern) DESC, updated_at DESC, created_at DESC",
        )
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;
        tracing::info!(user_id = %user_id, rule_count = rules.len(), "get_category_rules returned");
        Ok(rules)
    }

    async fn create_category_rule(
        &self,
        user_id: Uuid,
        pattern: String,
        category_name: String,
        subcategory_name: Option<String>,
    ) -> Result<CategoryRule> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let id = Uuid::new_v4();
        let now = chrono::Utc::now();

        let rule = sqlx::query_as::<_, CategoryRule>(
            "INSERT INTO category_rules (id, user_id, pattern, category_name, subcategory_name, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $6)
             ON CONFLICT (user_id, pattern)
             DO UPDATE SET
                 category_name = EXCLUDED.category_name,
                 subcategory_name = EXCLUDED.subcategory_name,
                 updated_at = EXCLUDED.updated_at
             RETURNING id, user_id, pattern, category_name, subcategory_name, created_at, updated_at",
        )
        .bind(id)
        .bind(user_id)
        .bind(&pattern)
        .bind(&category_name)
        .bind(&subcategory_name)
        .bind(now)
        .fetch_one(&mut *tx)
        .await;

        if let Err(e) = rule {
            let _ = tx.rollback().await;
            return Err(anyhow::anyhow!(e));
        }

        let rule = rule.unwrap();
        tx.commit().await?;
        Ok(rule)
    }

    async fn update_category_rule(
        &self,
        rule_id: Uuid,
        user_id: Uuid,
        pattern: Option<String>,
        category_name: Option<String>,
        subcategory_name: Option<String>,
    ) -> Result<CategoryRule> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let now = chrono::Utc::now();

        sqlx::query(
            "UPDATE category_rules
             SET pattern = COALESCE($1, pattern),
                 category_name = COALESCE($2, category_name),
                 subcategory_name = COALESCE($3, subcategory_name),
                 updated_at = $4
             WHERE id = $5 AND user_id = $6",
        )
        .bind(pattern)
        .bind(category_name)
        .bind(subcategory_name)
        .bind(now)
        .bind(rule_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        let updated = sqlx::query_as::<_, CategoryRule>(
            "SELECT id, user_id, pattern, category_name, subcategory_name, created_at, updated_at
             FROM category_rules
             WHERE id = $1 AND user_id = $2",
        )
        .bind(rule_id)
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|_| anyhow::anyhow!("Rule not found"))?;

        tx.commit().await?;
        Ok(updated)
    }

    async fn delete_category_rule(&self, rule_id: Uuid, user_id: Uuid) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query("DELETE FROM category_rules WHERE id = $1 AND user_id = $2")
            .bind(rule_id)
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(())
    }
}
