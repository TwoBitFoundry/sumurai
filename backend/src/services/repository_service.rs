//! PostgreSQL access for users, connections, accounts, and transactions.

use crate::models::{
    account::Account,
    auth::User,
    budget::Budget,
    custom_category::CustomCategory,
    plaid::{LatestAccountBalance, PlaidCredentials, ProviderConnection},
    transaction::{
        LargestTransaction, Transaction, TransactionWithAccount, TransactionsInsightsResponse,
    },
    transaction_category_override::TransactionCategoryOverride,
};
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use anyhow::Result;
use async_trait::async_trait;
use chrono::NaiveDate;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow)]
struct TransactionWithAccountRow {
    id: Uuid,
    account_id: Uuid,
    user_id: Option<Uuid>,
    provider_transaction_id: Option<String>,
    amount: rust_decimal::Decimal,
    date: NaiveDate,
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
    is_overridden: bool,
    is_custom: bool,
}

type TransactionsInsightsRow = (
    i64,
    f64,
    f64,
    Option<f64>,
    Option<String>,
    i64,
    Vec<String>,
    Vec<String>,
);

pub const EXCLUDED_ANALYTICS_CATEGORY_PRIMARIES: [&str; 4] =
    ["INCOME", "LOAN_PAYMENTS", "TRANSFER_IN", "TRANSFER_OUT"];

#[async_trait]
#[cfg_attr(test, mockall::automock)]
#[allow(dead_code)]
pub trait DatabaseRepository: Send + Sync {
    async fn create_user(&self, user: &User) -> Result<()>;
    async fn get_user_by_email(&self, email: &str) -> Result<Option<User>>;
    async fn get_user_by_id(&self, user_id: &Uuid) -> Result<Option<User>>;
    async fn mark_onboarding_complete(&self, user_id: &Uuid) -> Result<()>;
    async fn update_user_provider(&self, user_id: &Uuid, provider: &str) -> Result<()>;

    async fn get_transactions_for_user(&self, user_id: &Uuid) -> Result<Vec<Transaction>>;
    async fn get_spending_transactions_for_user(&self, user_id: &Uuid) -> Result<Vec<Transaction>>;
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
    async fn get_spending_transactions_by_date_range_for_user(
        &self,
        user_id: &Uuid,
        start_date: chrono::NaiveDate,
        end_date: chrono::NaiveDate,
    ) -> Result<Vec<Transaction>>;
    async fn get_provider_transaction_ids_for_user(&self, user_id: &Uuid) -> Result<Vec<String>>;
    async fn get_accounts_for_user(&self, user_id: &Uuid) -> Result<Vec<Account>>;
    async fn get_transaction_count_by_account_for_user(
        &self,
        user_id: &Uuid,
    ) -> Result<std::collections::HashMap<Uuid, i64>>;

    async fn upsert_account(&self, account: &Account) -> Result<()>;
    async fn upsert_transaction(&self, transaction: &Transaction) -> Result<()>;
    #[allow(clippy::too_many_arguments)]
    async fn upsert_transactions_batch(
        &self,
        transactions: &[Transaction],
        user_id: &Uuid,
    ) -> Result<()>;
    #[allow(clippy::too_many_arguments)]
    async fn get_transactions_paginated(
        &self,
        user_id: &Uuid,
        limit: i64,
        offset: i64,
        search: Option<&str>,
        account_ids: Option<&[Uuid]>,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
        category_primary: Option<&str>,
    ) -> Result<Vec<TransactionWithAccount>>;
    #[allow(clippy::too_many_arguments)]
    async fn count_transactions(
        &self,
        user_id: &Uuid,
        search: Option<&str>,
        account_ids: Option<&[Uuid]>,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
        category_primary: Option<&str>,
    ) -> Result<i64>;
    #[allow(clippy::too_many_arguments)]
    async fn get_transactions_insights(
        &self,
        user_id: &Uuid,
        search: Option<&str>,
        account_ids: Option<&[Uuid]>,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
        category_primary: Option<&str>,
    ) -> Result<TransactionsInsightsResponse>;
    async fn get_distinct_transaction_categories(&self, user_id: &Uuid) -> Result<Vec<String>>;

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
    async fn delete_provider_transactions(&self, item_id: &str) -> Result<i32>;
    async fn delete_provider_accounts(&self, item_id: &str) -> Result<i32>;
    async fn delete_provider_connection(&self, user_id: &Uuid, item_id: &str) -> Result<()>;
    async fn delete_provider_credentials(&self, item_id: &str) -> Result<()>;
    async fn get_budgets_for_user(&self, user_id: Uuid) -> Result<Vec<Budget>>;
    async fn get_budget_by_id_for_user(
        &self,
        budget_id: &Uuid,
        user_id: &Uuid,
    ) -> Result<Option<Budget>>;
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

    async fn update_user_password(&self, user_id: &Uuid, new_password_hash: &str) -> Result<()>;

    async fn delete_user(&self, user_id: &Uuid) -> Result<()>;

    async fn create_custom_category(
        &self,
        user_id: &Uuid,
        display_name: &str,
        lookup_key: &str,
    ) -> Result<CustomCategory>;

    async fn list_custom_categories_for_user(&self, user_id: &Uuid) -> Result<Vec<CustomCategory>>;

    async fn delete_custom_category(&self, user_id: &Uuid, id: &Uuid) -> Result<()>;

    async fn upsert_transaction_category_override(
        &self,
        user_id: &Uuid,
        normalized_merchant: &str,
        category_name: &str,
        custom_category_id: Option<Uuid>,
    ) -> Result<TransactionCategoryOverride>;

    async fn delete_transaction_category_override_by_norm(
        &self,
        user_id: &Uuid,
        normalized_merchant: &str,
    ) -> Result<()>;

    async fn get_transaction_by_id_for_user(
        &self,
        user_id: &Uuid,
        id: &Uuid,
    ) -> Result<Option<Transaction>>;

    async fn list_simplefin_hidden_orgs(
        &self,
        user_id: &Uuid,
    ) -> Result<std::collections::HashSet<String>>;

    async fn insert_simplefin_hidden_org(&self, user_id: &Uuid, conn_id: &str) -> Result<()>;
}

pub struct PostgresRepository {
    pool: PgPool,
    encryption_key: [u8; 32],
}

impl PostgresRepository {
    pub fn new(pool: PgPool, encryption_key: [u8; 32]) -> Self {
        Self {
            pool,
            encryption_key,
        }
    }

    fn encrypt_token(&self, token: &str) -> Result<Vec<u8>> {
        let cipher = Aes256Gcm::new_from_slice(&self.encryption_key)
            .map_err(|e| anyhow::anyhow!("Invalid encryption key: {:?}", e))?;

        let nonce_bytes: [u8; 12] = rand::random();
        let nonce = Nonce::from(nonce_bytes);

        let ciphertext = cipher
            .encrypt(&nonce, token.as_bytes())
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
        let nonce_bytes: [u8; 12] = nonce_bytes
            .try_into()
            .map_err(|e| anyhow::anyhow!("Invalid nonce length: {:?}", e))?;
        let nonce = Nonce::from(nonce_bytes);

        let cipher = Aes256Gcm::new_from_slice(&self.encryption_key)
            .map_err(|e| anyhow::anyhow!("Invalid encryption key: {:?}", e))?;

        let plaintext = cipher
            .decrypt(&nonce, ciphertext)
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

    #[allow(clippy::too_many_arguments)]
    fn append_transaction_filters<'a>(
        qb: &mut sqlx::QueryBuilder<'a, sqlx::Postgres>,
        user_id: &'a Uuid,
        search: Option<&str>,
        account_ids: Option<&'a [Uuid]>,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
        category_primary: Option<&'a str>,
    ) {
        qb.push(" WHERE t.user_id = ");
        qb.push_bind(user_id);

        if let Some(search) = search {
            let search = search.trim();
            if !search.is_empty() {
                let search = format!("%{}%", search.to_lowercase());
                qb.push(" AND (LOWER(COALESCE(t.merchant_name, '')) LIKE ");
                qb.push_bind(search.clone());
                qb.push(" OR LOWER(t.category_primary) LIKE ");
                qb.push_bind(search.clone());
                qb.push(" OR LOWER(t.category_detailed) LIKE ");
                qb.push_bind(search.clone());
                qb.push(" OR LOWER(a.name) LIKE ");
                qb.push_bind(search);
                qb.push(")");
            }
        }

        if let Some(account_ids) = account_ids.filter(|account_ids| !account_ids.is_empty()) {
            qb.push(" AND t.account_id IN (");
            let mut separated = qb.separated(", ");
            for account_id in account_ids {
                separated.push_bind(account_id);
            }
            qb.push(")");
        }

        if let Some(start_date) = start_date {
            qb.push(" AND t.date >= ");
            qb.push_bind(start_date);
        }

        if let Some(end_date) = end_date {
            qb.push(" AND t.date <= ");
            qb.push_bind(end_date);
        }

        if let Some(category_primary) = category_primary {
            let category_primary = category_primary.trim();
            if !category_primary.is_empty() {
                qb.push(" AND COALESCE(o.category_name, t.category_primary) = ");
                qb.push_bind(category_primary);
            }
        }
    }

    fn map_transaction_with_account_row(row: TransactionWithAccountRow) -> TransactionWithAccount {
        TransactionWithAccount {
            id: row.id,
            account_id: row.account_id,
            user_id: row.user_id,
            provider_account_id: None,
            provider_transaction_id: row.provider_transaction_id,
            amount: row.amount,
            date: row.date,
            merchant_name: row.merchant_name,
            category_primary: row.category_primary,
            category_detailed: row.category_detailed,
            category_confidence: row.category_confidence,
            payment_channel: row.payment_channel,
            pending: row.pending,
            created_at: row.created_at,
            account_name: row.account_name,
            account_type: row.account_type,
            account_mask: row.account_mask,
            is_custom: row.is_custom,
            is_overridden: row.is_overridden,
        }
    }

    fn map_transaction_insights_row(
        (
            total_count,
            total_spent,
            average_amount,
            largest_amount,
            largest_merchant,
            recurring_count,
            recurring_merchants,
            top_categories,
        ): TransactionsInsightsRow,
    ) -> TransactionsInsightsResponse {
        let largest = largest_amount
            .zip(largest_merchant)
            .map(|(amount, merchant)| LargestTransaction { amount, merchant });

        TransactionsInsightsResponse {
            total_count,
            total_spent,
            average_amount,
            largest,
            recurring_count,
            recurring_merchants,
            top_categories,
        }
    }

    fn append_category_exclusion<'a>(
        qb: &mut sqlx::QueryBuilder<'a, sqlx::Postgres>,
        categories: &'a [&'a str],
    ) {
        qb.push(" AND category_primary NOT IN (");
        let mut separated = qb.separated(", ");
        for category in categories {
            separated.push_bind(category);
        }
        qb.push(")");
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
            ON CONFLICT (account_id, provider_transaction_id)
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

    async fn upsert_transactions_batch(
        &self,
        transactions: &[Transaction],
        user_id: &Uuid,
    ) -> Result<()> {
        if transactions.is_empty() {
            return Ok(());
        }

        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let mut qb = sqlx::QueryBuilder::new(
            r#"
            INSERT INTO transactions (
                id, account_id, user_id, provider_transaction_id, amount, date,
                merchant_name, category_primary, category_detailed,
                category_confidence, payment_channel, pending, created_at
            )
            "#,
        );

        qb.push_values(transactions, |mut b, transaction| {
            b.push_bind(transaction.id)
                .push_bind(transaction.account_id)
                .push_bind(transaction.user_id)
                .push_bind(&transaction.provider_transaction_id)
                .push_bind(transaction.amount)
                .push_bind(transaction.date)
                .push_bind(&transaction.merchant_name)
                .push_bind(&transaction.category_primary)
                .push_bind(&transaction.category_detailed)
                .push_bind(&transaction.category_confidence)
                .push_bind(&transaction.payment_channel)
                .push_bind(transaction.pending)
                .push_bind(transaction.created_at.unwrap_or_else(chrono::Utc::now));
        });

        qb.push(
            r#"
            ON CONFLICT (account_id, provider_transaction_id)
            DO UPDATE SET
                amount = EXCLUDED.amount,
                merchant_name = EXCLUDED.merchant_name,
                pending = EXCLUDED.pending
            "#,
        );

        qb.build().execute(&mut *tx).await?;
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
    ) -> Result<Vec<ProviderConnection>> {
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
            FROM provider_connections
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
                )| ProviderConnection {
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
    ) -> Result<Option<ProviderConnection>> {
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
            FROM provider_connections
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
            )| ProviderConnection {
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
            sqlx::query_scalar("SELECT id FROM provider_connections WHERE item_id = $1")
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
            sqlx::query_scalar("SELECT id FROM provider_connections WHERE item_id = $1")
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

        sqlx::query("DELETE FROM provider_connections WHERE user_id = $1 AND item_id = $2")
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

    async fn get_spending_transactions_for_user(&self, user_id: &Uuid) -> Result<Vec<Transaction>> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let mut qb = sqlx::QueryBuilder::<sqlx::Postgres>::new(
            "SELECT id, account_id, user_id, provider_transaction_id, amount, date, merchant_name, category_primary, category_detailed, category_confidence, payment_channel, pending, created_at FROM transactions WHERE user_id = ",
        );
        qb.push_bind(user_id);
        Self::append_category_exclusion(&mut qb, &EXCLUDED_ANALYTICS_CATEGORY_PRIMARIES);
        qb.push(" ORDER BY date DESC, created_at DESC LIMIT 1000");

        let rows = qb
            .build_query_as::<(
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
            )>()
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

        let rows = sqlx::query_as::<_, TransactionWithAccountRow>(
            r#"
            SELECT t.id, t.account_id, t.user_id, t.provider_transaction_id, t.amount, t.date,
                   t.merchant_name, COALESCE(o.category_name, t.category_primary), t.category_detailed,
                   t.category_confidence, t.payment_channel, t.pending, t.created_at,
                   a.name as account_name, a.account_type, a.mask as account_mask,
                   (o.id IS NOT NULL) AS is_overridden,
                   (o.custom_category_id IS NOT NULL) AS is_custom
            FROM transactions t
            INNER JOIN accounts a ON t.account_id = a.id
            LEFT JOIN transaction_category_overrides o ON o.user_id = t.user_id AND o.normalized_merchant = t.normalized_merchant
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
            .map(Self::map_transaction_with_account_row)
            .collect())
    }

    async fn get_transactions_paginated(
        &self,
        user_id: &Uuid,
        limit: i64,
        offset: i64,
        search: Option<&str>,
        account_ids: Option<&[Uuid]>,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
        category_primary: Option<&str>,
    ) -> Result<Vec<TransactionWithAccount>> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let mut qb = sqlx::QueryBuilder::new(
            r#"
            SELECT t.id, t.account_id, t.user_id, t.provider_transaction_id, t.amount, t.date,
                   t.merchant_name, COALESCE(o.category_name, t.category_primary) AS category_primary,
                   t.category_detailed, t.category_confidence, t.payment_channel, t.pending, t.created_at,
                   a.name as account_name, a.account_type, a.mask as account_mask,
                   (o.id IS NOT NULL) AS is_overridden,
                   (o.custom_category_id IS NOT NULL) AS is_custom
            FROM transactions t
            INNER JOIN accounts a ON t.account_id = a.id
            LEFT JOIN transaction_category_overrides o ON o.user_id = t.user_id AND o.normalized_merchant = t.normalized_merchant
            "#,
        );
        Self::append_transaction_filters(
            &mut qb,
            user_id,
            search,
            account_ids,
            start_date,
            end_date,
            category_primary,
        );
        qb.push(" ORDER BY t.date DESC, t.created_at DESC LIMIT ");
        qb.push_bind(limit.max(0));
        qb.push(" OFFSET ");
        qb.push_bind(offset.max(0));

        let rows = qb
            .build_query_as::<TransactionWithAccountRow>()
            .fetch_all(&mut *tx)
            .await?;

        tx.commit().await?;

        Ok(rows
            .into_iter()
            .map(Self::map_transaction_with_account_row)
            .collect())
    }

    async fn count_transactions(
        &self,
        user_id: &Uuid,
        search: Option<&str>,
        account_ids: Option<&[Uuid]>,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
        category_primary: Option<&str>,
    ) -> Result<i64> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let mut qb = sqlx::QueryBuilder::new(
            r#"
            SELECT COUNT(*)
            FROM transactions t
            INNER JOIN accounts a ON t.account_id = a.id
            LEFT JOIN transaction_category_overrides o ON o.user_id = t.user_id AND o.normalized_merchant = t.normalized_merchant
            "#,
        );
        Self::append_transaction_filters(
            &mut qb,
            user_id,
            search,
            account_ids,
            start_date,
            end_date,
            category_primary,
        );

        let count = qb.build_query_scalar::<i64>().fetch_one(&mut *tx).await?;
        tx.commit().await?;
        Ok(count)
    }

    async fn get_transactions_insights(
        &self,
        user_id: &Uuid,
        search: Option<&str>,
        account_ids: Option<&[Uuid]>,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
        category_primary: Option<&str>,
    ) -> Result<TransactionsInsightsResponse> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let mut qb = sqlx::QueryBuilder::new(
            r#"
            WITH filtered AS (
                SELECT
                    t.amount,
                    NULLIF(TRIM(t.merchant_name), '') AS merchant,
                    COALESCE(o.category_name, t.category_primary) AS effective_category
                FROM transactions t
                INNER JOIN accounts a ON t.account_id = a.id
                LEFT JOIN transaction_category_overrides o ON o.user_id = t.user_id AND o.normalized_merchant = t.normalized_merchant
            "#,
        );
        Self::append_transaction_filters(
            &mut qb,
            user_id,
            search,
            account_ids,
            start_date,
            end_date,
            category_primary,
        );
        qb.push(
            r#"
            ),
            aggregates AS (
                SELECT
                    COUNT(*) AS total_count,
                    COALESCE(SUM(ABS(amount)), 0)::float8 AS total_spent,
                    COALESCE(AVG(ABS(amount)), 0)::float8 AS average_amount
                FROM filtered
            ),
            largest AS (
                SELECT ABS(amount)::float8 AS amount, merchant
                FROM filtered
                WHERE merchant IS NOT NULL
                ORDER BY ABS(amount) DESC, merchant ASC
                LIMIT 1
            ),
            merchant_counts AS (
                SELECT merchant, COUNT(*) AS c
                FROM filtered
                WHERE merchant IS NOT NULL
                GROUP BY merchant
                HAVING COUNT(*) >= 3
            ),
            recurring AS (
                SELECT
                    COUNT(*)::bigint AS recurring_count,
                    COALESCE(
                        (ARRAY_AGG(merchant ORDER BY c DESC, merchant))[1:3],
                        ARRAY[]::text[]
                    ) AS recurring_merchants
                FROM merchant_counts
            ),
            top_categories AS (
                SELECT COALESCE(ARRAY_AGG(effective_category ORDER BY c DESC, effective_category), ARRAY[]::text[]) AS categories
                FROM (
                    SELECT effective_category, COUNT(*) AS c
                    FROM filtered
                    WHERE effective_category IS NOT NULL
                    GROUP BY effective_category
                    ORDER BY c DESC, effective_category
                    LIMIT 2
                ) tc
            )
            SELECT
                a.total_count,
                a.total_spent,
                a.average_amount,
                l.amount AS largest_amount,
                l.merchant AS largest_merchant,
                r.recurring_count,
                r.recurring_merchants,
                tc.categories AS top_categories
            FROM aggregates a
            LEFT JOIN largest l ON true
            LEFT JOIN recurring r ON true
            LEFT JOIN top_categories tc ON true
            "#,
        );

        let row = qb
            .build_query_as::<TransactionsInsightsRow>()
            .fetch_one(&mut *tx)
            .await?;
        tx.commit().await?;

        Ok(Self::map_transaction_insights_row(row))
    }

    async fn get_distinct_transaction_categories(&self, user_id: &Uuid) -> Result<Vec<String>> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let categories = sqlx::query_scalar::<_, String>(
            r#"
            SELECT DISTINCT category_primary
            FROM transactions
            WHERE user_id = $1
              AND category_primary IS NOT NULL
              AND category_primary <> ''
            ORDER BY category_primary ASC
            "#,
        )
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(categories)
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

    async fn get_spending_transactions_by_date_range_for_user(
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

        let mut qb = sqlx::QueryBuilder::<sqlx::Postgres>::new(
            "SELECT id, account_id, user_id, provider_transaction_id, amount, date, merchant_name, category_primary, category_detailed, category_confidence, payment_channel, pending, created_at FROM transactions WHERE user_id = ",
        );
        qb.push_bind(user_id);
        qb.push(" AND date >= ");
        qb.push_bind(start_date);
        qb.push(" AND date <= ");
        qb.push_bind(end_date);
        Self::append_category_exclusion(&mut qb, &EXCLUDED_ANALYTICS_CATEGORY_PRIMARIES);
        qb.push(" ORDER BY date DESC, created_at DESC LIMIT 1000");

        let rows = qb
            .build_query_as::<(
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
            )>()
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

    async fn get_provider_transaction_ids_for_user(&self, user_id: &Uuid) -> Result<Vec<String>> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let provider_transaction_ids = sqlx::query_scalar::<_, String>(
            r#"
            SELECT DISTINCT provider_transaction_id
            FROM transactions
            WHERE user_id = $1
              AND provider_transaction_id IS NOT NULL
            ORDER BY provider_transaction_id ASC
            "#,
        )
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(provider_transaction_ids)
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
                    provider_conn_id: None,
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
            SELECT a.id, COUNT(t.id)::bigint AS count
            FROM accounts a
            LEFT JOIN transactions t ON t.account_id = a.id AND t.user_id = $1
            WHERE a.user_id = $1
            GROUP BY a.id
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

    async fn get_budget_by_id_for_user(
        &self,
        budget_id: &Uuid,
        user_id: &Uuid,
    ) -> Result<Option<Budget>> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let budget = sqlx::query_as::<_, Budget>(
            "SELECT id, user_id, category, amount, created_at, updated_at FROM budgets WHERE id = $1 AND user_id = $2",
        )
        .bind(budget_id)
        .bind(user_id)
        .fetch_optional(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(budget)
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
                COALESCE(pc.id::text, 'unknown_institution') AS institution_id,
                a.account_type,
                NULL::text AS account_subtype,
                'USD'::text AS currency,
                COALESCE(a.balance_current, 0) AS current_balance,
                a.provider_connection_id,
                pc.institution_name
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

    async fn create_custom_category(
        &self,
        user_id: &Uuid,
        display_name: &str,
        lookup_key: &str,
    ) -> Result<CustomCategory> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let row = sqlx::query_as::<_, CustomCategory>(
            r#"
            INSERT INTO user_custom_categories (user_id, display_name, lookup_key)
            VALUES ($1, $2, $3)
            RETURNING id, user_id, display_name, lookup_key, created_at, updated_at
            "#,
        )
        .bind(user_id)
        .bind(display_name)
        .bind(lookup_key)
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(row)
    }

    async fn list_custom_categories_for_user(&self, user_id: &Uuid) -> Result<Vec<CustomCategory>> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let rows = sqlx::query_as::<_, CustomCategory>(
            r#"
            SELECT id, user_id, display_name, lookup_key, created_at, updated_at
            FROM user_custom_categories
            WHERE user_id = $1
            ORDER BY display_name
            "#,
        )
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(rows)
    }

    async fn delete_custom_category(&self, user_id: &Uuid, id: &Uuid) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query("DELETE FROM user_custom_categories WHERE id = $1 AND user_id = $2")
            .bind(id)
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(())
    }

    async fn upsert_transaction_category_override(
        &self,
        user_id: &Uuid,
        normalized_merchant: &str,
        category_name: &str,
        custom_category_id: Option<Uuid>,
    ) -> Result<TransactionCategoryOverride> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let row = sqlx::query_as::<_, TransactionCategoryOverride>(
            r#"
            INSERT INTO transaction_category_overrides
                (user_id, normalized_merchant, category_name, custom_category_id)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, normalized_merchant)
            DO UPDATE SET
                category_name = EXCLUDED.category_name,
                custom_category_id = EXCLUDED.custom_category_id,
                updated_at = NOW()
            RETURNING id, user_id, normalized_merchant, category_name, custom_category_id,
                      created_at, updated_at
            "#,
        )
        .bind(user_id)
        .bind(normalized_merchant)
        .bind(category_name)
        .bind(custom_category_id)
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(row)
    }

    async fn delete_transaction_category_override_by_norm(
        &self,
        user_id: &Uuid,
        normalized_merchant: &str,
    ) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query(
            "DELETE FROM transaction_category_overrides WHERE user_id = $1 AND normalized_merchant = $2",
        )
        .bind(user_id)
        .bind(normalized_merchant)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(())
    }

    async fn get_transaction_by_id_for_user(
        &self,
        user_id: &Uuid,
        id: &Uuid,
    ) -> Result<Option<Transaction>> {
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
            SELECT id, account_id, user_id, provider_transaction_id,
                   amount, date, merchant_name, category_primary, category_detailed,
                   category_confidence, payment_channel, pending, created_at
            FROM transactions
            WHERE id = $1 AND user_id = $2
            "#,
        )
        .bind(id)
        .bind(user_id)
        .fetch_optional(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(row.map(
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
        ))
    }

    async fn list_simplefin_hidden_orgs(
        &self,
        user_id: &Uuid,
    ) -> Result<std::collections::HashSet<String>> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let rows = sqlx::query_scalar::<_, String>("SELECT org_conn_id FROM simplefin_hidden_orgs")
            .fetch_all(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(rows.into_iter().collect())
    }

    async fn insert_simplefin_hidden_org(&self, user_id: &Uuid, conn_id: &str) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query(
            r#"
            INSERT INTO simplefin_hidden_orgs (user_id, org_conn_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(user_id)
        .bind(conn_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(())
    }
}
