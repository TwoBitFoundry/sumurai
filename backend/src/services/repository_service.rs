use crate::models::{
    account::Account,
    auth::User,
    budget::Budget,
    plaid::{LatestAccountBalance, PlaidConnection, PlaidCredentials},
    transaction::{Transaction, TransactionWithAccount},
};
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use anyhow::Result;
use async_trait::async_trait;
use chrono::Datelike;
use sqlx::PgPool;
use uuid::Uuid;

#[async_trait]
#[cfg_attr(test, mockall::automock)]
pub trait DatabaseRepository: Send + Sync {
    async fn create_user(&self, user: &User) -> Result<()>;
    async fn get_user_by_email(&self, email: &str) -> Result<Option<User>>;
    async fn get_user_by_id(&self, user_id: &Uuid) -> Result<Option<User>>;
    async fn delete_user(&self, user_id: &Uuid) -> Result<()>;
    async fn mark_onboarding_complete(&self, user_id: &Uuid) -> Result<()>;
    async fn update_user_provider(&self, user_id: &Uuid, provider: &str) -> Result<()>;

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

    async fn get_spending_summary_for_user(&self, user_id: &Uuid) -> Result<Vec<Transaction>>;
    async fn get_category_breakdown_for_user(
        &self,
        user_id: &Uuid,
        period: &str,
    ) -> Result<Vec<Transaction>>;

    async fn get_merchant_analytics_for_user(&self, user_id: &Uuid) -> Result<Vec<Transaction>>;

    async fn upsert_account(&self, account: &Account) -> Result<()>;
    async fn upsert_transaction(&self, transaction: &Transaction) -> Result<()>;
    async fn get_account_by_plaid_id(&self, provider_account_id: &str) -> Result<Option<Account>>;
    async fn get_transactions(&self, limit: Option<i64>) -> Result<Vec<Transaction>>;
    async fn store_provider_credentials(&self, item_id: &str, access_token: &str) -> Result<Uuid>;
    async fn get_provider_credentials(&self, item_id: &str) -> Result<Option<PlaidCredentials>>;

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

    async fn save_provider_connection(&self, connection: &PlaidConnection) -> Result<()>;
    async fn get_all_provider_connections_by_user(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<PlaidConnection>>;
    async fn get_provider_connection_by_id(
        &self,
        connection_id: &Uuid,
        user_id: &Uuid,
    ) -> Result<Option<PlaidConnection>>;
    async fn get_provider_connection_by_item(
        &self,
        item_id: &str,
    ) -> Result<Option<PlaidConnection>>;
    async fn delete_provider_transactions(&self, item_id: &str) -> Result<i32>;
    async fn delete_provider_accounts(&self, item_id: &str) -> Result<i32>;
    async fn delete_provider_connection(&self, user_id: &Uuid, item_id: &str) -> Result<()>;
    async fn delete_provider_credentials(&self, item_id: &str) -> Result<()>;
    async fn get_budgets_for_user(&self, user_id: Uuid) -> Result<Vec<Budget>>;
    async fn create_budget_for_user(&self, budget: Budget) -> Result<Budget>;

    async fn update_budget_for_user(
        &self,
        budget_id: Uuid,
        user_id: Uuid,
        amount: rust_decimal::Decimal,
    ) -> Result<Budget>;

    async fn delete_budget_for_user(&self, budget_id: Uuid, user_id: Uuid) -> Result<()>;

    async fn get_latest_account_balances_for_user(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<LatestAccountBalance>>;
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

    async fn delete_user(&self, user_id: &Uuid) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        let _session_count: (i64,) = (0,);

        let _account_count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM accounts WHERE user_id = $1")
                .bind(user_id)
                .fetch_one(&mut *tx)
                .await?;

        let _transaction_count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM transactions WHERE user_id = $1")
                .bind(user_id)
                .fetch_one(&mut *tx)
                .await?;

        let result = sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

        if result.rows_affected() == 0 {
            return Err(anyhow::anyhow!("User not found"));
        }

        tx.commit().await?;
        Ok(())
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
            INSERT INTO accounts (id, user_id, provider_account_id, provider_connection_id, name, account_type, balance_current, mask)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (provider_account_id) 
            DO UPDATE SET 
                provider_connection_id = EXCLUDED.provider_connection_id,
                name = EXCLUDED.name,
                account_type = EXCLUDED.account_type,
                balance_current = EXCLUDED.balance_current,
                mask = EXCLUDED.mask
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
        .execute(&mut *tx)
            .await?;
        tx.commit().await?;

        Ok(())
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

    async fn get_account_by_plaid_id(&self, provider_account_id: &str) -> Result<Option<Account>> {
        let row = sqlx::query_as::<_, (
            Uuid,
            Option<Uuid>,
            Option<String>,
            Option<Uuid>,
            String,
            String,
            Option<rust_decimal::Decimal>,
            Option<String>,
            Option<String>,
        )>(
            "SELECT a.id, a.user_id, a.provider_account_id, a.provider_connection_id, a.name, a.account_type, a.balance_current, a.mask, pc.institution_name \
             FROM accounts a LEFT JOIN plaid_connections pc ON pc.id = a.provider_connection_id \
             WHERE a.provider_account_id = $1"
        )
        .bind(provider_account_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(
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
            },
        ))
    }

    async fn get_transactions(&self, limit: Option<i64>) -> Result<Vec<Transaction>> {
        let limit = limit.unwrap_or(100);

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
            ORDER BY date DESC, created_at DESC
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

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

    async fn store_provider_credentials(&self, item_id: &str, access_token: &str) -> Result<Uuid> {
        let id = Uuid::new_v4();
        let encrypted_token = self.encrypt_token(access_token)?;

        sqlx::query(
            r#"
            INSERT INTO plaid_credentials (id, item_id, encrypted_access_token)
            VALUES ($1, $2, $3)
            ON CONFLICT (item_id)
            DO UPDATE SET
                encrypted_access_token = EXCLUDED.encrypted_access_token,
                updated_at = NOW()
            "#,
        )
        .bind(id)
        .bind(item_id)
        .bind(&encrypted_token)
        .execute(&self.pool)
        .await?;

        Ok(id)
    }

    async fn get_provider_credentials(&self, item_id: &str) -> Result<Option<PlaidCredentials>> {
        let row = sqlx::query_as::<_, (Uuid, String, Vec<u8>, chrono::DateTime<chrono::Utc>, chrono::DateTime<chrono::Utc>)>(
            "SELECT id, item_id, encrypted_access_token, created_at, updated_at FROM plaid_credentials WHERE item_id = $1"
        )
        .bind(item_id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some((id, item_id, encrypted_access_token, created_at, updated_at)) = row {
            let access_token = self.decrypt_token(&encrypted_access_token)?;

            Ok(Some(PlaidCredentials {
                id,
                item_id,
                user_id: None,
                access_token,
                created_at,
                updated_at,
            }))
        } else {
            Ok(None)
        }
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

    async fn save_provider_connection(&self, connection: &PlaidConnection) -> Result<()> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(connection.user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query(
            r#"
            INSERT INTO plaid_connections (
                id, user_id, item_id, is_connected, last_sync_at, connected_at,
                disconnected_at, institution_id, institution_name, transaction_count, account_count,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
    ) -> Result<Vec<PlaidConnection>> {
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
                String,
                bool,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<String>,
                Option<String>,
                Option<String>,
                Option<String>,
                i32,
                i32,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<chrono::DateTime<chrono::Utc>>,
            ),
        >(
            r#"
            SELECT id, user_id, item_id, is_connected, last_sync_at, connected_at,
                   disconnected_at, institution_id, institution_name, institution_logo_url,
                   sync_cursor, transaction_count, account_count, created_at, updated_at
            FROM plaid_connections
            WHERE user_id = $1
            ORDER BY created_at DESC
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
                    item_id,
                    is_connected,
                    last_sync_at,
                    connected_at,
                    disconnected_at,
                    institution_id,
                    institution_name,
                    institution_logo_url,
                    sync_cursor,
                    transaction_count,
                    account_count,
                    created_at,
                    updated_at,
                )| PlaidConnection {
                    id,
                    user_id,
                    item_id,
                    is_connected,
                    last_sync_at,
                    connected_at,
                    disconnected_at,
                    institution_id,
                    institution_name,
                    institution_logo_url,
                    sync_cursor,
                    transaction_count,
                    account_count,
                    created_at,
                    updated_at,
                },
            )
            .collect())
    }

    async fn get_provider_connection_by_id(
        &self,
        connection_id: &Uuid,
        user_id: &Uuid,
    ) -> Result<Option<PlaidConnection>> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let row = sqlx::query_as::<
            _,
            (
                Uuid,
                Uuid,
                String,
                bool,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<String>,
                Option<String>,
                Option<String>,
                Option<String>,
                i32,
                i32,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<chrono::DateTime<chrono::Utc>>,
            ),
        >(
            r#"
            SELECT id, user_id, item_id, is_connected, last_sync_at, connected_at,
                   disconnected_at, institution_id, institution_name, institution_logo_url,
                   sync_cursor, transaction_count, account_count, created_at, updated_at
            FROM plaid_connections
            WHERE id = $1
            "#,
        )
        .bind(connection_id)
        .fetch_optional(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(row.map(
            |(
                id,
                user_id,
                item_id,
                is_connected,
                last_sync_at,
                connected_at,
                disconnected_at,
                institution_id,
                institution_name,
                institution_logo_url,
                sync_cursor,
                transaction_count,
                account_count,
                created_at,
                updated_at,
            )| PlaidConnection {
                id,
                user_id,
                item_id,
                is_connected,
                last_sync_at,
                connected_at,
                disconnected_at,
                institution_id,
                institution_name,
                institution_logo_url,
                sync_cursor,
                transaction_count,
                account_count,
                created_at,
                updated_at,
            },
        ))
    }

    async fn get_provider_connection_by_item(
        &self,
        item_id: &str,
    ) -> Result<Option<PlaidConnection>> {
        let row = sqlx::query_as::<
            _,
            (
                Uuid,
                Uuid,
                String,
                bool,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<String>,
                Option<String>,
                Option<String>,
                Option<String>,
                i32,
                i32,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<chrono::DateTime<chrono::Utc>>,
            ),
        >(
            r#"
            SELECT id, user_id, item_id, is_connected, last_sync_at, connected_at,
                   disconnected_at, institution_id, institution_name, institution_logo_url, sync_cursor,
                   transaction_count, account_count, created_at, updated_at
            FROM plaid_connections 
            WHERE item_id = $1
            "#,
        )
        .bind(item_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(
            |(
                id,
                user_id,
                item_id,
                is_connected,
                last_sync_at,
                connected_at,
                disconnected_at,
                institution_id,
                institution_name,
                institution_logo_url,
                sync_cursor,
                transaction_count,
                account_count,
                created_at,
                updated_at,
            )| PlaidConnection {
                id,
                user_id,
                item_id,
                is_connected,
                last_sync_at,
                connected_at,
                disconnected_at,
                institution_id,
                institution_name,
                institution_logo_url,
                sync_cursor,
                transaction_count,
                account_count,
                created_at,
                updated_at,
            },
        ))
    }

    async fn delete_provider_transactions(&self, item_id: &str) -> Result<i32> {
        let connection_id: Option<Uuid> =
            sqlx::query_scalar("SELECT id FROM plaid_connections WHERE item_id = $1")
                .bind(item_id)
                .fetch_optional(&self.pool)
                .await?;

        let Some(conn_id) = connection_id else {
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
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected() as i32)
    }

    async fn delete_provider_accounts(&self, item_id: &str) -> Result<i32> {
        let connection_id: Option<Uuid> =
            sqlx::query_scalar("SELECT id FROM plaid_connections WHERE item_id = $1")
                .bind(item_id)
                .fetch_optional(&self.pool)
                .await?;

        let Some(conn_id) = connection_id else {
            return Ok(0);
        };

        let result = sqlx::query("DELETE FROM accounts WHERE provider_connection_id = $1")
            .bind(conn_id)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected() as i32)
    }

    async fn delete_provider_connection(&self, user_id: &Uuid, item_id: &str) -> Result<()> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query("DELETE FROM plaid_connections WHERE user_id = $1 AND item_id = $2")
            .bind(user_id)
            .bind(item_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(())
    }

    async fn delete_provider_credentials(&self, item_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM plaid_credentials WHERE item_id = $1")
            .bind(item_id)
            .execute(&self.pool)
            .await?;

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
                String,
                String,
                Option<String>,
            ),
        >(
            r#"
            SELECT t.id, t.account_id, t.user_id, t.provider_transaction_id, t.amount, t.date,
                   t.merchant_name, t.category_primary, t.category_detailed,
                   t.category_confidence, t.payment_channel, t.pending, t.created_at,
                   a.name as account_name, a.account_type, a.mask as account_mask
            FROM transactions t
            INNER JOIN accounts a ON t.account_id = a.id
            WHERE t.user_id = $1
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
                    account_name,
                    account_type,
                    account_mask,
                )| TransactionWithAccount {
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
                    account_name,
                    account_type,
                    account_mask,
                },
            )
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
            WHERE user_id = $1 AND date >= $2 AND date <= $3
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
            ),
        >(
            r#"
            SELECT a.id, a.user_id, a.provider_account_id, a.provider_connection_id, a.name, a.account_type, a.balance_current, a.mask, pc.institution_name
            FROM accounts a
            LEFT JOIN plaid_connections pc ON pc.id = a.provider_connection_id
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

    async fn get_spending_summary_for_user(&self, user_id: &Uuid) -> Result<Vec<Transaction>> {
        self.get_transactions_for_user(user_id).await
    }

    async fn get_category_breakdown_for_user(
        &self,
        user_id: &Uuid,
        period: &str,
    ) -> Result<Vec<Transaction>> {
        match period {
            "current-month" => {
                let now = chrono::Utc::now().naive_utc().date();
                let start_date =
                    chrono::NaiveDate::from_ymd_opt(now.year(), now.month(), 1).unwrap();
                let end_date = if now.month() == 12 {
                    chrono::NaiveDate::from_ymd_opt(now.year() + 1, 1, 1)
                        .unwrap()
                        .pred_opt()
                        .unwrap()
                } else {
                    chrono::NaiveDate::from_ymd_opt(now.year(), now.month() + 1, 1)
                        .unwrap()
                        .pred_opt()
                        .unwrap()
                };
                self.get_transactions_by_date_range_for_user(user_id, start_date, end_date)
                    .await
            }
            _ => self.get_transactions_for_user(user_id).await,
        }
    }

    async fn get_merchant_analytics_for_user(&self, user_id: &Uuid) -> Result<Vec<Transaction>> {
        let mut transactions = self.get_transactions_for_user(user_id).await?;
        transactions.sort_by(|a, b| b.amount.cmp(&a.amount));
        Ok(transactions)
    }

    async fn get_budgets_for_user(&self, user_id: Uuid) -> Result<Vec<Budget>> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let budgets = sqlx::query_as::<_, Budget>(
            "SELECT id, user_id, category, amount, created_at, updated_at 
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
            "INSERT INTO budgets (id, user_id, category, amount, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(budget.id)
        .bind(budget.user_id)
        .bind(&budget.category)
        .bind(budget.amount)
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
        amount: rust_decimal::Decimal,
    ) -> Result<Budget> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let updated_at = chrono::Utc::now();

        sqlx::query(
            "UPDATE budgets SET amount = $1, updated_at = $2 
             WHERE id = $3 AND user_id = $4",
        )
        .bind(amount)
        .bind(updated_at)
        .bind(budget_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        let updated_budget = sqlx::query_as::<_, Budget>(
            "SELECT id, user_id, category, amount, created_at, updated_at 
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
                COALESCE(pc.institution_name, 'unknown_institution') AS institution_id,
                a.account_type,
                NULL::text AS account_subtype,
                'USD'::text AS currency,
                COALESCE(a.balance_current, 0) AS current_balance,
                a.provider_connection_id,
                pc.institution_name
            FROM accounts a
            LEFT JOIN plaid_connections pc ON pc.id = a.provider_connection_id
            WHERE a.user_id = $1
            ORDER BY a.name
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }
}
