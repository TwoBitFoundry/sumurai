//! PostgreSQL access for users, connections, accounts, and transactions.

use crate::connection_pool::RepositoryPool;
use crate::models::{
    account::Account,
    analytics::MonthlyCashFlowAggregate,
    auth::{User, WebAuthnCredential},
    auto_categorization_job::TransactionCategoryUpdate,
    budget::Budget,
    custom_category::CustomCategory,
    plaid::{LatestAccountBalance, PlaidCredentials, ProviderConnection},
    transaction::{
        LargestTransaction, Transaction, TransactionWithAccount, TransactionsInsightsResponse,
    },
    transaction_category_override::TransactionCategoryOverride,
};
use crate::utils::tenant_context::set_tenant_context;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use anyhow::Result;
use async_trait::async_trait;
use chrono::NaiveDate;
use entity::{
    accounts, budgets, merchant_aliases, provider_connections, provider_credentials,
    simplefin_hidden_orgs, simplefin_root_credentials, transaction_category_overrides,
    transactions, user_custom_categories, users, webauthn_credentials,
};
use sea_orm::{
    sea_query::{Expr, Func, JoinType, OnConflict, Query, SimpleExpr},
    ActiveValue::Set,
    ColumnTrait, Condition, ConnectionTrait, DatabaseConnection, DatabaseTransaction, DbBackend,
    EntityTrait, FromQueryResult, PaginatorTrait, QueryFilter, QueryOrder, QueryResult,
    QuerySelect, QueryTrait, RelationTrait, Select, Statement, TransactionTrait, Value,
};
use std::{future::Future, pin::Pin};
use uuid::Uuid;

#[derive(FromQueryResult)]
struct MonthlyCashFlowRow {
    month: String,
    income: rust_decimal::Decimal,
    expenses: rust_decimal::Decimal,
}

#[derive(FromQueryResult)]
pub(crate) struct TransactionWithAccountRow {
    pub(crate) id: Uuid,
    pub(crate) account_id: Uuid,
    pub(crate) user_id: Option<Uuid>,
    pub(crate) provider_transaction_id: Option<String>,
    pub(crate) amount: rust_decimal::Decimal,
    pub(crate) date: NaiveDate,
    pub(crate) merchant_name: Option<String>,
    pub(crate) category_primary: String,
    pub(crate) category_detailed: String,
    pub(crate) category_confidence: String,
    pub(crate) payment_channel: Option<String>,
    pub(crate) pending: Option<bool>,
    pub(crate) created_at: Option<chrono::DateTime<chrono::FixedOffset>>,
    pub(crate) account_name: String,
    pub(crate) account_type: String,
    pub(crate) account_mask: Option<String>,
    pub(crate) is_overridden: bool,
    pub(crate) is_custom: bool,
    pub(crate) original_merchant_name: Option<String>,
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
    async fn get_transactions_for_export(
        &self,
        user_id: &Uuid,
        account_ids: Option<&[Uuid]>,
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
    async fn get_monthly_cash_flow_aggregates_for_user(
        &self,
        user_id: &Uuid,
        start_date: chrono::NaiveDate,
        end_date: chrono::NaiveDate,
        account_ids: Option<&[Uuid]>,
    ) -> Result<Vec<MonthlyCashFlowAggregate>>;
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

    async fn save_provider_connection(&self, connection: &ProviderConnection) -> Result<Uuid>;
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

    async fn clear_user_password_hash(&self, user_id: &Uuid) -> Result<()>;

    async fn delete_user(&self, user_id: &Uuid) -> Result<()>;

    async fn insert_webauthn_credential(
        &self,
        user_id: &Uuid,
        credential_id: Vec<u8>,
        passkey: serde_json::Value,
        name: &str,
    ) -> Result<crate::models::auth::WebAuthnCredential>;

    async fn list_webauthn_credentials_for_user(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<crate::models::auth::WebAuthnCredential>>;

    async fn find_webauthn_credentials_by_credential_ids(
        &self,
        user_id: &Uuid,
        ids: &[Vec<u8>],
    ) -> Result<Vec<crate::models::auth::WebAuthnCredential>>;

    async fn update_webauthn_credential_counter_and_last_used(
        &self,
        user_id: &Uuid,
        id: &Uuid,
        sign_count: u32,
    ) -> Result<()>;

    async fn delete_webauthn_credential(&self, user_id: &Uuid, id: &Uuid) -> Result<bool>;

    async fn delete_all_webauthn_credentials_for_user(&self, user_id: &Uuid) -> Result<u64>;

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

    async fn store_simplefin_root_credential(&self, user_id: &Uuid, access_url: &str)
        -> Result<()>;

    async fn get_simplefin_root_credential(&self, user_id: &Uuid) -> Result<Option<String>>;

    async fn delete_simplefin_root_credential(&self, user_id: &Uuid) -> Result<bool>;

    async fn list_simplefin_hidden_orgs(
        &self,
        user_id: &Uuid,
    ) -> Result<std::collections::HashSet<String>>;

    async fn list_simplefin_ignored_institutions(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<crate::models::simplefin::SimpleFinIgnoredInstitution>>;

    async fn insert_simplefin_hidden_org(
        &self,
        user_id: &Uuid,
        conn_id: &str,
        institution_name: Option<&str>,
    ) -> Result<()>;

    async fn remove_simplefin_hidden_org(&self, user_id: &Uuid, org_conn_id: &str) -> Result<bool>;

    async fn disconnect_simplefin_org(
        &self,
        user_id: &Uuid,
        item_id: &str,
        org_conn_id: &str,
        institution_name: Option<&str>,
    ) -> Result<(i32, i32)>;

    async fn count_eligible_auto_categorize_transactions(&self, user_id: &Uuid) -> Result<i64>;

    async fn fetch_eligible_auto_categorize_transactions(
        &self,
        user_id: &Uuid,
        limit: i64,
        after_date: Option<chrono::NaiveDate>,
        after_id: Option<Uuid>,
    ) -> Result<Vec<Transaction>>;

    async fn update_transaction_categories_batch(
        &self,
        user_id: &Uuid,
        updates: &[TransactionCategoryUpdate],
    ) -> Result<()>;

    async fn get_active_merchant_aliases(
        &self,
    ) -> Result<Vec<crate::services::merchant_normalization::types::AliasRow>>;
}

pub struct PostgresRepository {
    pool: Option<RepositoryPool>,
    #[cfg(test)]
    mock_db: Option<DatabaseConnection>,
    encryption_key: [u8; 32],
}

struct SqlStatementBuilder {
    sql: String,
    values: Vec<Value>,
}

impl SqlStatementBuilder {
    fn from_prefix(sql: String, values: Vec<Value>) -> Self {
        Self { sql, values }
    }

    fn push(&mut self, fragment: &str) {
        self.sql.push_str(fragment);
    }

    fn into_statement(self) -> Statement {
        Statement::from_sql_and_values(DbBackend::Postgres, self.sql, self.values)
    }
}

impl PostgresRepository {
    pub fn new(pool: RepositoryPool, encryption_key: [u8; 32]) -> Self {
        Self {
            pool: Some(pool),
            #[cfg(test)]
            mock_db: None,
            encryption_key,
        }
    }

    pub fn from_database(db: &DatabaseConnection, encryption_key: [u8; 32]) -> Self {
        Self::new(RepositoryPool::from_database(db), encryption_key)
    }

    #[cfg(test)]
    pub fn from_mock(db: DatabaseConnection, encryption_key: [u8; 32]) -> Self {
        Self {
            pool: None,
            mock_db: Some(db),
            encryption_key,
        }
    }

    #[cfg(test)]
    pub fn into_mock_transaction_log(self) -> Vec<sea_orm::Transaction> {
        self.mock_db
            .expect("into_mock_transaction_log requires from_mock")
            .into_transaction_log()
    }

    fn conn(&self) -> DatabaseConnection {
        self.pool
            .as_ref()
            .expect("repository pool is required")
            .connection()
    }

    async fn run_with_tenant<T>(
        db: &DatabaseConnection,
        user_id: &Uuid,
        f: impl for<'txn> FnOnce(
                &'txn DatabaseTransaction,
            ) -> Pin<Box<dyn Future<Output = Result<T>> + Send + 'txn>>
            + Send,
    ) -> Result<T>
    where
        T: Send,
    {
        let tx = db.begin().await?;

        set_tenant_context(&tx, *user_id).await?;

        let result = f(&tx).await;
        match result {
            Ok(value) => {
                tx.commit().await?;
                Ok(value)
            }
            Err(err) => {
                tx.rollback().await?;
                Err(err)
            }
        }
    }

    fn to_db_time(dt: chrono::DateTime<chrono::Utc>) -> chrono::DateTime<chrono::FixedOffset> {
        dt.fixed_offset()
    }

    fn opt_to_db_time(
        dt: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Option<chrono::DateTime<chrono::FixedOffset>> {
        dt.map(Self::to_db_time)
    }

    async fn with_tenant<T>(
        &self,
        user_id: &Uuid,
        f: impl for<'txn> FnOnce(
                &'txn DatabaseTransaction,
            ) -> Pin<Box<dyn Future<Output = Result<T>> + Send + 'txn>>
            + Send,
    ) -> Result<T>
    where
        T: Send,
    {
        #[cfg(test)]
        if let Some(db) = &self.mock_db {
            return Self::run_with_tenant(db, user_id, f).await;
        }

        let conn = self.conn();
        Self::run_with_tenant(&conn, user_id, f).await
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

    fn transaction_active_model(transaction: &Transaction) -> transactions::ActiveModel {
        transactions::ActiveModel {
            id: Set(transaction.id),
            account_id: Set(Some(transaction.account_id)),
            user_id: Set(transaction.user_id),
            provider_transaction_id: Set(transaction.provider_transaction_id.clone()),
            amount: Set(transaction.amount),
            date: Set(transaction.date),
            merchant_name: Set(transaction.merchant_name.clone()),
            category_primary: Set(transaction.category_primary.clone()),
            category_detailed: Set(transaction.category_detailed.clone()),
            category_confidence: Set(transaction.category_confidence.clone()),
            payment_channel: Set(transaction.payment_channel.clone()),
            pending: Set(Some(transaction.pending)),
            created_at: Set(Some(Self::to_db_time(
                transaction.created_at.unwrap_or_else(chrono::Utc::now),
            ))),
            original_merchant_name: Set(transaction.original_merchant_name.clone()),
            ..Default::default()
        }
    }

    async fn upsert_transaction_on<C: ConnectionTrait>(
        conn: &C,
        transaction: &Transaction,
    ) -> Result<()> {
        transactions::Entity::insert(Self::transaction_active_model(transaction))
            .on_conflict(
                OnConflict::columns([
                    transactions::Column::AccountId,
                    transactions::Column::ProviderTransactionId,
                ])
                .update_columns([
                    transactions::Column::Amount,
                    transactions::Column::MerchantName,
                    transactions::Column::OriginalMerchantName,
                    transactions::Column::Pending,
                ])
                .to_owned(),
            )
            .exec(conn)
            .await?;
        Ok(())
    }

    async fn upsert_account_on<C: ConnectionTrait>(conn: &C, account: &Account) -> Result<()> {
        accounts::Entity::insert(accounts::ActiveModel {
            id: Set(account.id),
            user_id: Set(account.user_id),
            provider_account_id: Set(account.provider_account_id.clone()),
            provider_connection_id: Set(account.provider_connection_id),
            name: Set(account.name.clone()),
            account_type: Set(account.account_type.clone()),
            balance_current: Set(account.balance_current),
            mask: Set(account.mask.clone()),
            ..Default::default()
        })
        .on_conflict(
            OnConflict::column(accounts::Column::ProviderAccountId)
                .update_columns([
                    accounts::Column::ProviderConnectionId,
                    accounts::Column::Name,
                    accounts::Column::AccountType,
                    accounts::Column::BalanceCurrent,
                    accounts::Column::Mask,
                ])
                .to_owned(),
        )
        .exec(conn)
        .await?;
        Ok(())
    }

    fn effective_category_expr() -> sea_orm::sea_query::SimpleExpr {
        Func::coalesce([
            Expr::col((
                transaction_category_overrides::Entity,
                transaction_category_overrides::Column::CategoryName,
            ))
            .into(),
            Expr::col((transactions::Entity, transactions::Column::CategoryPrimary)).into(),
        ])
        .into()
    }

    fn transactions_with_account_joins() -> Select<transactions::Entity> {
        transactions::Entity::find()
            .join(JoinType::InnerJoin, transactions::Relation::Accounts.def())
            .join(
                JoinType::LeftJoin,
                transactions::Relation::TransactionCategoryOverrides.def(),
            )
    }

    fn monthly_cash_flow_statement(
        user_id: Uuid,
        start_date: NaiveDate,
        end_date: NaiveDate,
        account_ids: Option<&[Uuid]>,
    ) -> Statement {
        let excluded = EXCLUDED_ANALYTICS_CATEGORY_PRIMARIES
            .iter()
            .map(|category| format!("'{}'", category))
            .collect::<Vec<_>>()
            .join(", ");
        let mut sql = format!(
            r#"
            SELECT
                to_char(date, 'YYYY-MM') AS month,
                COALESCE(SUM(CASE
                    WHEN amount > 0 AND category_primary <> 'TRANSFER_IN' THEN amount
                    ELSE 0
                END), 0) AS income,
                COALESCE(SUM(CASE
                    WHEN amount < 0 AND category_primary NOT IN ({excluded}) THEN -amount
                    ELSE 0
                END), 0) AS expenses
            FROM transactions
            WHERE user_id = $1
              AND date >= $2
              AND date <= $3
            "#
        );
        let mut values: Vec<Value> = vec![user_id.into(), start_date.into(), end_date.into()];

        if let Some(account_ids) = account_ids.filter(|account_ids| !account_ids.is_empty()) {
            let start_index = values.len() + 1;
            let placeholders = (0..account_ids.len())
                .map(|offset| format!("${}", start_index + offset))
                .collect::<Vec<_>>()
                .join(", ");
            sql.push_str(&format!(" AND account_id IN ({placeholders})"));
            values.extend(account_ids.iter().copied().map(Value::from));
        }

        sql.push_str(" GROUP BY 1 ORDER BY 1");

        Statement::from_sql_and_values(DbBackend::Postgres, sql, values)
    }

    fn transaction_with_account_select(
        query: Select<transactions::Entity>,
    ) -> Select<transactions::Entity> {
        query
            .select_only()
            .columns([
                transactions::Column::Id,
                transactions::Column::AccountId,
                transactions::Column::UserId,
                transactions::Column::ProviderTransactionId,
                transactions::Column::Amount,
                transactions::Column::Date,
                transactions::Column::MerchantName,
                transactions::Column::OriginalMerchantName,
                transactions::Column::CategoryDetailed,
                transactions::Column::CategoryConfidence,
                transactions::Column::PaymentChannel,
                transactions::Column::Pending,
                transactions::Column::CreatedAt,
            ])
            .column_as(Self::effective_category_expr(), "category_primary")
            .column_as(
                Expr::col((accounts::Entity, accounts::Column::Name)),
                "account_name",
            )
            .column_as(
                Expr::col((accounts::Entity, accounts::Column::AccountType)),
                "account_type",
            )
            .column_as(
                Expr::col((accounts::Entity, accounts::Column::Mask)),
                "account_mask",
            )
            .column_as(
                Expr::col((
                    transaction_category_overrides::Entity,
                    transaction_category_overrides::Column::Id,
                ))
                .is_not_null(),
                "is_overridden",
            )
            .column_as(
                Expr::col((
                    transaction_category_overrides::Entity,
                    transaction_category_overrides::Column::CustomCategoryId,
                ))
                .is_not_null(),
                "is_custom",
            )
    }

    #[allow(clippy::too_many_arguments)]
    fn apply_transaction_filters(
        mut query: Select<transactions::Entity>,
        user_id: &Uuid,
        search: Option<&str>,
        account_ids: Option<&[Uuid]>,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
        category_primary: Option<&str>,
    ) -> Select<transactions::Entity> {
        query = query.filter(transactions::Column::UserId.eq(*user_id));

        if let Some(search) = search {
            let search = search.trim();
            if !search.is_empty() {
                let search = format!("%{}%", search.to_lowercase());
                query = query.filter(
                    Condition::any()
                        .add(
                            Expr::expr(Func::lower(Func::coalesce([
                                Expr::col((
                                    transactions::Entity,
                                    transactions::Column::MerchantName,
                                ))
                                .into(),
                                Expr::val("").into(),
                            ])))
                            .like(search.clone()),
                        )
                        .add(
                            Expr::expr(Func::lower(Expr::col((
                                transactions::Entity,
                                transactions::Column::CategoryPrimary,
                            ))))
                            .like(search.clone()),
                        )
                        .add(
                            Expr::expr(Func::lower(Expr::col((
                                transactions::Entity,
                                transactions::Column::CategoryDetailed,
                            ))))
                            .like(search.clone()),
                        )
                        .add(
                            Expr::expr(Func::lower(Expr::col((
                                accounts::Entity,
                                accounts::Column::Name,
                            ))))
                            .like(search),
                        ),
                );
            }
        }

        if let Some(account_ids) = account_ids.filter(|account_ids| !account_ids.is_empty()) {
            query = query.filter(transactions::Column::AccountId.is_in(account_ids.to_vec()));
        }

        if let Some(start_date) = start_date {
            query = query.filter(transactions::Column::Date.gte(start_date));
        }

        if let Some(end_date) = end_date {
            query = query.filter(transactions::Column::Date.lte(end_date));
        }

        if let Some(category_primary) = category_primary {
            let category_primary = category_primary.trim();
            if !category_primary.is_empty() {
                query =
                    query.filter(Self::effective_category_expr().eq(category_primary.to_string()));
            }
        }

        query
    }

    #[allow(clippy::too_many_arguments)]
    fn insights_filtered_select(
        user_id: &Uuid,
        search: Option<&str>,
        account_ids: Option<&[Uuid]>,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
        category_primary: Option<&str>,
    ) -> Select<transactions::Entity> {
        Self::apply_transaction_filters(
            Self::transactions_with_account_joins(),
            user_id,
            search,
            account_ids,
            start_date,
            end_date,
            category_primary,
        )
        .select_only()
        .column(transactions::Column::Amount)
        .column_as(
            Expr::cust_with_expr(
                "NULLIF(TRIM($1), '')",
                Expr::col((transactions::Entity, transactions::Column::MerchantName)),
            ),
            "merchant",
        )
        .column_as(Self::effective_category_expr(), "effective_category")
    }

    fn auto_categorize_filter() -> SimpleExpr {
        Expr::exists(
            Query::select()
                .expr_as(Expr::val(1), sea_orm::sea_query::Alias::new("one"))
                .from(transaction_category_overrides::Entity)
                .and_where(
                    Expr::col((
                        transaction_category_overrides::Entity,
                        transaction_category_overrides::Column::UserId,
                    ))
                    .equals((transactions::Entity, transactions::Column::UserId)),
                )
                .and_where(
                    Expr::col((
                        transaction_category_overrides::Entity,
                        transaction_category_overrides::Column::NormalizedMerchant,
                    ))
                    .equals((
                        transactions::Entity,
                        transactions::Column::NormalizedMerchant,
                    )),
                )
                .to_owned(),
        )
        .not()
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
            pending: row.pending.unwrap_or(false),
            created_at: row.created_at.map(|dt| dt.with_timezone(&chrono::Utc)),
            account_name: row.account_name,
            account_type: row.account_type,
            account_mask: row.account_mask,
            is_custom: row.is_custom,
            is_overridden: row.is_overridden,
            original_merchant_name: row.original_merchant_name,
        }
    }

    fn map_transaction_insights_row(row: &QueryResult) -> Result<TransactionsInsightsResponse> {
        let total_count: i64 = row.try_get("", "total_count")?;
        let total_spent: f64 = row.try_get("", "total_spent")?;
        let average_amount: f64 = row.try_get("", "average_amount")?;
        let largest_amount: Option<f64> = row.try_get("", "largest_amount")?;
        let largest_merchant: Option<String> = row.try_get("", "largest_merchant")?;
        let recurring_count: i64 = row.try_get("", "recurring_count")?;
        let recurring_merchants: Vec<String> = row.try_get("", "recurring_merchants")?;
        let top_categories: Vec<String> = row.try_get("", "top_categories")?;
        Ok(Self::map_transaction_insights_tuple((
            total_count,
            total_spent,
            average_amount,
            largest_amount,
            largest_merchant,
            recurring_count,
            recurring_merchants,
            top_categories,
        )))
    }

    fn map_transaction_insights_tuple(
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
}

#[async_trait]
impl DatabaseRepository for PostgresRepository {
    async fn create_user(&self, user: &User) -> Result<()> {
        let db = self.conn();
        users::Entity::insert(users::ActiveModel {
            id: Set(user.id),
            email: Set(user.email.clone()),
            password_hash: Set(user.password_hash.clone()),
            created_at: Set(Some(Self::to_db_time(user.created_at))),
            updated_at: Set(Some(Self::to_db_time(user.updated_at))),
            onboarding_completed: Set(user.onboarding_completed),
            provider: Set(user.provider.clone()),
        })
        .exec(&db)
        .await?;
        Ok(())
    }

    async fn get_user_by_email(&self, email: &str) -> Result<Option<User>> {
        let db = self.conn();
        let normalized = email.trim().to_lowercase();
        Ok(users::Entity::find()
            .filter(
                Expr::expr(Func::lower(Expr::col(users::Column::Email)))
                    .eq(Expr::value(normalized)),
            )
            .one(&db)
            .await?
            .map(Into::into))
    }

    async fn get_user_by_id(&self, user_id: &Uuid) -> Result<Option<User>> {
        let db = self.conn();
        Ok(users::Entity::find_by_id(*user_id)
            .one(&db)
            .await?
            .map(Into::into))
    }

    async fn mark_onboarding_complete(&self, user_id: &Uuid) -> Result<()> {
        let db = self.conn();
        users::Entity::update_many()
            .col_expr(users::Column::OnboardingCompleted, Expr::value(true))
            .col_expr(
                users::Column::UpdatedAt,
                Expr::value(Self::to_db_time(chrono::Utc::now())),
            )
            .filter(users::Column::Id.eq(*user_id))
            .exec(&db)
            .await?;
        Ok(())
    }

    async fn update_user_provider(&self, user_id: &Uuid, provider: &str) -> Result<()> {
        let db = self.conn();
        users::Entity::update_many()
            .col_expr(users::Column::Provider, Expr::value(provider.to_string()))
            .col_expr(
                users::Column::UpdatedAt,
                Expr::value(Self::to_db_time(chrono::Utc::now())),
            )
            .filter(users::Column::Id.eq(*user_id))
            .exec(&db)
            .await?;
        Ok(())
    }

    async fn upsert_account(&self, account: &Account) -> Result<()> {
        let user_id = account
            .user_id
            .ok_or_else(|| anyhow::anyhow!("account user_id is required"))?;
        let account = account.clone();
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move { Self::upsert_account_on(txn, &account).await })
        })
        .await
    }

    async fn upsert_transaction(&self, transaction: &Transaction) -> Result<()> {
        let user_id = transaction
            .user_id
            .ok_or_else(|| anyhow::anyhow!("transaction user_id is required"))?;
        let transaction = transaction.clone();
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move { Self::upsert_transaction_on(txn, &transaction).await })
        })
        .await
    }

    async fn upsert_transactions_batch(
        &self,
        transactions: &[Transaction],
        user_id: &Uuid,
    ) -> Result<()> {
        if transactions.is_empty() {
            return Ok(());
        }

        let user_id = *user_id;
        let models: Vec<transactions::ActiveModel> = transactions
            .iter()
            .map(Self::transaction_active_model)
            .collect();

        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                transactions::Entity::insert_many(models)
                    .on_conflict(
                        OnConflict::columns([
                            transactions::Column::AccountId,
                            transactions::Column::ProviderTransactionId,
                        ])
                        .update_columns([
                            transactions::Column::Amount,
                            transactions::Column::MerchantName,
                            transactions::Column::Pending,
                        ])
                        .to_owned(),
                    )
                    .exec(txn)
                    .await?;
                Ok(())
            })
        })
        .await
    }

    async fn store_provider_credentials_for_user(
        &self,
        user_id: &Uuid,
        item_id: &str,
        access_token: &str,
    ) -> Result<Uuid> {
        let id = Uuid::new_v4();
        let encrypted_token = self.encrypt_token(access_token)?;
        let user_id = *user_id;

        self.with_tenant(&user_id, move |txn| {
            let encrypted_token = encrypted_token.clone();
            let item_id = item_id.to_string();
            Box::pin(async move {
                provider_credentials::Entity::insert(provider_credentials::ActiveModel {
                    id: Set(id),
                    user_id: Set(Some(user_id)),
                    item_id: Set(item_id),
                    encrypted_access_token: Set(encrypted_token),
                    created_at: Set(Some(Self::to_db_time(chrono::Utc::now()))),
                    updated_at: Set(Some(Self::to_db_time(chrono::Utc::now()))),
                })
                .on_conflict(
                    OnConflict::column(provider_credentials::Column::ItemId)
                        .update_columns([
                            provider_credentials::Column::UserId,
                            provider_credentials::Column::EncryptedAccessToken,
                            provider_credentials::Column::UpdatedAt,
                        ])
                        .to_owned(),
                )
                .exec(txn)
                .await?;
                Ok(id)
            })
        })
        .await
    }

    async fn get_provider_credentials_for_user(
        &self,
        user_id: &Uuid,
        item_id: &str,
    ) -> Result<Option<PlaidCredentials>> {
        let user_id = *user_id;
        let row = self
            .with_tenant(&user_id, move |txn| {
                let item_id = item_id.to_string();
                Box::pin(async move {
                    Ok(provider_credentials::Entity::find()
                        .filter(provider_credentials::Column::ItemId.eq(item_id))
                        .one(txn)
                        .await?)
                })
            })
            .await?;

        if let Some(row) = row {
            let access_token = self.decrypt_token(&row.encrypted_access_token)?;
            let created_at = row
                .created_at
                .map(Into::into)
                .unwrap_or_else(chrono::Utc::now);
            let updated_at = row
                .updated_at
                .map(Into::into)
                .unwrap_or_else(chrono::Utc::now);
            Ok(Some(PlaidCredentials {
                id: row.id,
                item_id: row.item_id,
                user_id: row.user_id,
                access_token,
                created_at,
                updated_at,
            }))
        } else {
            Ok(None)
        }
    }

    async fn save_provider_connection(&self, connection: &ProviderConnection) -> Result<Uuid> {
        let user_id = connection.user_id;
        let connection = connection.clone();
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                provider_connections::Entity::insert(provider_connections::ActiveModel {
                    id: Set(connection.id),
                    user_id: Set(Some(connection.user_id)),
                    item_id: Set(connection.item_id.clone()),
                    provider: Set(connection.provider.clone()),
                    is_connected: Set(connection.is_connected),
                    last_sync_at: Set(Self::opt_to_db_time(connection.last_sync_at)),
                    connected_at: Set(Self::opt_to_db_time(connection.connected_at)),
                    disconnected_at: Set(Self::opt_to_db_time(connection.disconnected_at)),
                    institution_id: Set(connection.institution_id.clone()),
                    institution_name: Set(connection.institution_name.clone()),
                    transaction_count: Set(Some(connection.transaction_count)),
                    account_count: Set(Some(connection.account_count)),
                    created_at: Set(Self::opt_to_db_time(connection.created_at)),
                    updated_at: Set(Self::opt_to_db_time(connection.updated_at)),
                    institution_logo_url: Set(connection.institution_logo_url.clone()),
                    sync_cursor: Set(connection.sync_cursor.clone()),
                })
                .on_conflict(
                    OnConflict::column(provider_connections::Column::ItemId)
                        .update_columns([
                            provider_connections::Column::Provider,
                            provider_connections::Column::IsConnected,
                            provider_connections::Column::LastSyncAt,
                            provider_connections::Column::ConnectedAt,
                            provider_connections::Column::DisconnectedAt,
                            provider_connections::Column::InstitutionId,
                            provider_connections::Column::InstitutionName,
                            provider_connections::Column::TransactionCount,
                            provider_connections::Column::AccountCount,
                            provider_connections::Column::UpdatedAt,
                            provider_connections::Column::InstitutionLogoUrl,
                            provider_connections::Column::SyncCursor,
                        ])
                        .to_owned(),
                )
                .exec(txn)
                .await?;
                let saved = provider_connections::Entity::find()
                    .filter(provider_connections::Column::ItemId.eq(connection.item_id.clone()))
                    .one(txn)
                    .await?
                    .ok_or_else(|| anyhow::anyhow!("Provider connection not found after save"))?;
                Ok(saved.id)
            })
        })
        .await
    }

    async fn get_all_provider_connections_by_user(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<ProviderConnection>> {
        let user_id = *user_id;
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                Ok(provider_connections::Entity::find()
                    .filter(provider_connections::Column::UserId.eq(user_id))
                    .order_by_desc(provider_connections::Column::CreatedAt)
                    .all(txn)
                    .await?
                    .into_iter()
                    .map(Into::into)
                    .collect())
            })
        })
        .await
    }

    async fn get_provider_connection_by_id(
        &self,
        connection_id: &Uuid,
        user_id: &Uuid,
    ) -> Result<Option<ProviderConnection>> {
        let connection_id = *connection_id;
        let user_id = *user_id;
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                Ok(provider_connections::Entity::find()
                    .filter(provider_connections::Column::Id.eq(connection_id))
                    .filter(provider_connections::Column::UserId.eq(user_id))
                    .one(txn)
                    .await?
                    .map(Into::into))
            })
        })
        .await
    }

    async fn delete_provider_transactions(&self, item_id: &str) -> Result<i32> {
        let db = self.conn();
        let Some(connection) = provider_connections::Entity::find()
            .filter(provider_connections::Column::ItemId.eq(item_id))
            .one(&db)
            .await?
        else {
            return Ok(0);
        };

        let account_ids = accounts::Entity::find()
            .filter(accounts::Column::ProviderConnectionId.eq(connection.id))
            .all(&db)
            .await?
            .into_iter()
            .map(|account| account.id)
            .collect::<Vec<_>>();

        if account_ids.is_empty() {
            return Ok(0);
        }

        let result = transactions::Entity::delete_many()
            .filter(transactions::Column::AccountId.is_in(account_ids))
            .exec(&db)
            .await?;

        Ok(result.rows_affected as i32)
    }

    async fn delete_provider_accounts(&self, item_id: &str) -> Result<i32> {
        let db = self.conn();
        let Some(connection) = provider_connections::Entity::find()
            .filter(provider_connections::Column::ItemId.eq(item_id))
            .one(&db)
            .await?
        else {
            return Ok(0);
        };

        let result = accounts::Entity::delete_many()
            .filter(accounts::Column::ProviderConnectionId.eq(connection.id))
            .exec(&db)
            .await?;

        Ok(result.rows_affected as i32)
    }

    async fn delete_provider_connection(&self, user_id: &Uuid, item_id: &str) -> Result<()> {
        let user_id = *user_id;
        let item_id = item_id.to_string();
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                provider_connections::Entity::delete_many()
                    .filter(provider_connections::Column::UserId.eq(user_id))
                    .filter(provider_connections::Column::ItemId.eq(item_id))
                    .exec(txn)
                    .await?;
                Ok(())
            })
        })
        .await
    }

    async fn delete_provider_credentials(&self, item_id: &str) -> Result<()> {
        let db = self.conn();
        provider_credentials::Entity::delete_many()
            .filter(provider_credentials::Column::ItemId.eq(item_id))
            .exec(&db)
            .await?;

        Ok(())
    }

    async fn get_transactions_for_user(&self, user_id: &Uuid) -> Result<Vec<Transaction>> {
        let user_id = *user_id;
        let rows = self
            .with_tenant(&user_id, move |txn| {
                Box::pin(async move {
                    Ok(transactions::Entity::find()
                        .filter(transactions::Column::UserId.eq(user_id))
                        .order_by_desc(transactions::Column::Date)
                        .order_by_desc(transactions::Column::CreatedAt)
                        .limit(1000)
                        .all(txn)
                        .await?)
                })
            })
            .await?;

        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn get_spending_transactions_for_user(&self, user_id: &Uuid) -> Result<Vec<Transaction>> {
        let user_id = *user_id;
        let rows = self
            .with_tenant(&user_id, move |txn| {
                Box::pin(async move {
                    Ok(transactions::Entity::find()
                        .filter(transactions::Column::UserId.eq(user_id))
                        .filter(
                            transactions::Column::CategoryPrimary
                                .is_not_in(EXCLUDED_ANALYTICS_CATEGORY_PRIMARIES),
                        )
                        .order_by_desc(transactions::Column::Date)
                        .order_by_desc(transactions::Column::CreatedAt)
                        .limit(1000)
                        .all(txn)
                        .await?)
                })
            })
            .await?;

        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn get_transactions_with_account_for_user(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<TransactionWithAccount>> {
        let user_id = *user_id;
        let rows = self
            .with_tenant(&user_id, move |txn| {
                Box::pin(async move {
                    Ok(
                        Self::transaction_with_account_select(Self::apply_transaction_filters(
                            Self::transactions_with_account_joins(),
                            &user_id,
                            None,
                            None,
                            None,
                            None,
                            None,
                        ))
                        .order_by_desc(transactions::Column::Date)
                        .order_by_desc(transactions::Column::CreatedAt)
                        .limit(1000)
                        .into_model::<TransactionWithAccountRow>()
                        .all(txn)
                        .await?,
                    )
                })
            })
            .await?;

        Ok(rows
            .into_iter()
            .map(Self::map_transaction_with_account_row)
            .collect())
    }

    async fn get_transactions_for_export(
        &self,
        user_id: &Uuid,
        account_ids: Option<&[Uuid]>,
    ) -> Result<Vec<TransactionWithAccount>> {
        if matches!(account_ids, Some([])) {
            return Ok(Vec::new());
        }

        let user_id = *user_id;
        let account_ids = account_ids.map(|ids| ids.to_vec());
        let rows = self
            .with_tenant(&user_id, move |txn| {
                Box::pin(async move {
                    Ok(
                        Self::transaction_with_account_select(Self::apply_transaction_filters(
                            Self::transactions_with_account_joins(),
                            &user_id,
                            None,
                            account_ids.as_deref(),
                            None,
                            None,
                            None,
                        ))
                        .order_by_desc(transactions::Column::Date)
                        .order_by_desc(transactions::Column::CreatedAt)
                        .into_model::<TransactionWithAccountRow>()
                        .all(txn)
                        .await?,
                    )
                })
            })
            .await?;

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
        let user_id = *user_id;
        let search = search.map(str::to_string);
        let account_ids = account_ids.map(|ids| ids.to_vec());
        let category_primary = category_primary.map(str::to_string);
        let limit = limit.max(0);
        let offset = offset.max(0);

        let rows = self
            .with_tenant(&user_id, move |txn| {
                Box::pin(async move {
                    Ok(
                        Self::transaction_with_account_select(Self::apply_transaction_filters(
                            Self::transactions_with_account_joins(),
                            &user_id,
                            search.as_deref(),
                            account_ids.as_deref(),
                            start_date,
                            end_date,
                            category_primary.as_deref(),
                        ))
                        .order_by_desc(transactions::Column::Date)
                        .order_by_desc(transactions::Column::CreatedAt)
                        .limit(limit as u64)
                        .offset(offset as u64)
                        .into_model::<TransactionWithAccountRow>()
                        .all(txn)
                        .await?,
                    )
                })
            })
            .await?;

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
        let user_id = *user_id;
        let search = search.map(str::to_string);
        let account_ids = account_ids.map(|ids| ids.to_vec());
        let category_primary = category_primary.map(str::to_string);

        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                Ok(Self::apply_transaction_filters(
                    Self::transactions_with_account_joins(),
                    &user_id,
                    search.as_deref(),
                    account_ids.as_deref(),
                    start_date,
                    end_date,
                    category_primary.as_deref(),
                )
                .count(txn)
                .await? as i64)
            })
        })
        .await
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
        let user_id = *user_id;
        let search = search.map(str::to_string);
        let account_ids = account_ids.map(|ids| ids.to_vec());
        let category_primary = category_primary.map(str::to_string);

        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                let filtered = Self::insights_filtered_select(
                    &user_id,
                    search.as_deref(),
                    account_ids.as_deref(),
                    start_date,
                    end_date,
                    category_primary.as_deref(),
                )
                .build(DbBackend::Postgres);
                let filtered_values = filtered
                    .values
                    .map(|values| values.0)
                    .unwrap_or_default();
                let mut qb = SqlStatementBuilder::from_prefix(
                    format!("WITH filtered AS ({})", filtered.sql),
                    filtered_values,
                );
                qb.push(
                    r#"
                    ,
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
                let row = txn
                    .query_one(qb.into_statement())
                    .await?
                    .ok_or_else(|| anyhow::anyhow!("insights query returned no rows"))?;
                Self::map_transaction_insights_row(&row)
            })
        })
        .await
    }

    async fn get_distinct_transaction_categories(&self, user_id: &Uuid) -> Result<Vec<String>> {
        let user_id = *user_id;
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                Ok(transactions::Entity::find()
                    .select_only()
                    .column(transactions::Column::CategoryPrimary)
                    .distinct()
                    .filter(transactions::Column::UserId.eq(user_id))
                    .filter(transactions::Column::CategoryPrimary.is_not_null())
                    .filter(transactions::Column::CategoryPrimary.ne(""))
                    .order_by_asc(transactions::Column::CategoryPrimary)
                    .into_tuple::<String>()
                    .all(txn)
                    .await?)
            })
        })
        .await
    }

    async fn get_transactions_by_date_range_for_user(
        &self,
        user_id: &Uuid,
        start_date: chrono::NaiveDate,
        end_date: chrono::NaiveDate,
    ) -> Result<Vec<Transaction>> {
        let user_id = *user_id;
        let rows = self
            .with_tenant(&user_id, move |txn| {
                Box::pin(async move {
                    Ok(transactions::Entity::find()
                        .filter(transactions::Column::UserId.eq(user_id))
                        .filter(transactions::Column::Date.gte(start_date))
                        .filter(transactions::Column::Date.lte(end_date))
                        .order_by_desc(transactions::Column::Date)
                        .order_by_desc(transactions::Column::CreatedAt)
                        .limit(1000)
                        .all(txn)
                        .await?)
                })
            })
            .await?;

        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn get_spending_transactions_by_date_range_for_user(
        &self,
        user_id: &Uuid,
        start_date: chrono::NaiveDate,
        end_date: chrono::NaiveDate,
    ) -> Result<Vec<Transaction>> {
        let user_id = *user_id;
        let rows = self
            .with_tenant(&user_id, move |txn| {
                Box::pin(async move {
                    Ok(transactions::Entity::find()
                        .filter(transactions::Column::UserId.eq(user_id))
                        .filter(transactions::Column::Date.gte(start_date))
                        .filter(transactions::Column::Date.lte(end_date))
                        .filter(
                            transactions::Column::CategoryPrimary
                                .is_not_in(EXCLUDED_ANALYTICS_CATEGORY_PRIMARIES),
                        )
                        .order_by_desc(transactions::Column::Date)
                        .order_by_desc(transactions::Column::CreatedAt)
                        .limit(1000)
                        .all(txn)
                        .await?)
                })
            })
            .await?;

        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn get_monthly_cash_flow_aggregates_for_user(
        &self,
        user_id: &Uuid,
        start_date: chrono::NaiveDate,
        end_date: chrono::NaiveDate,
        account_ids: Option<&[Uuid]>,
    ) -> Result<Vec<MonthlyCashFlowAggregate>> {
        if matches!(account_ids, Some([])) {
            return Ok(Vec::new());
        }

        let user_id = *user_id;
        let account_ids = account_ids.map(|ids| ids.to_vec());
        let rows = self
            .with_tenant(&user_id, move |txn| {
                Box::pin(async move {
                    Ok(
                        MonthlyCashFlowRow::find_by_statement(Self::monthly_cash_flow_statement(
                            user_id,
                            start_date,
                            end_date,
                            account_ids.as_deref(),
                        ))
                        .all(txn)
                        .await?,
                    )
                })
            })
            .await?;

        Ok(rows
            .into_iter()
            .map(|row| MonthlyCashFlowAggregate {
                month: row.month,
                income: row.income,
                expenses: row.expenses,
            })
            .collect())
    }

    async fn get_provider_transaction_ids_for_user(&self, user_id: &Uuid) -> Result<Vec<String>> {
        let user_id = *user_id;
        let rows = self
            .with_tenant(&user_id, move |txn| {
                Box::pin(async move {
                    Ok(transactions::Entity::find()
                        .filter(transactions::Column::UserId.eq(user_id))
                        .filter(transactions::Column::ProviderTransactionId.is_not_null())
                        .all(txn)
                        .await?)
                })
            })
            .await?;

        let mut provider_transaction_ids: Vec<String> = rows
            .into_iter()
            .filter_map(|row| row.provider_transaction_id)
            .collect();
        provider_transaction_ids.sort();
        provider_transaction_ids.dedup();
        Ok(provider_transaction_ids)
    }

    async fn get_accounts_for_user(&self, user_id: &Uuid) -> Result<Vec<Account>> {
        let user_id = *user_id;
        let rows = self
            .with_tenant(&user_id, move |txn| {
                Box::pin(async move {
                    Ok(accounts::Entity::find()
                        .filter(accounts::Column::UserId.eq(user_id))
                        .find_also_related(provider_connections::Entity)
                        .order_by_asc(accounts::Column::Name)
                        .all(txn)
                        .await?)
                })
            })
            .await?;

        Ok(rows
            .into_iter()
            .map(|(account, provider_connection)| Account {
                id: account.id,
                user_id: account.user_id,
                provider_account_id: account.provider_account_id,
                provider_connection_id: account.provider_connection_id,
                name: account.name,
                account_type: account.account_type,
                balance_current: account.balance_current,
                mask: account.mask,
                institution_name: provider_connection
                    .and_then(|connection| connection.institution_name),
                provider_conn_id: None,
            })
            .collect())
    }

    async fn get_transaction_count_by_account_for_user(
        &self,
        user_id: &Uuid,
    ) -> Result<std::collections::HashMap<Uuid, i64>> {
        let user_id = *user_id;
        let rows = self
            .with_tenant(&user_id, move |txn| {
                Box::pin(async move {
                    Ok(accounts::Entity::find()
                        .filter(accounts::Column::UserId.eq(user_id))
                        .find_with_related(transactions::Entity)
                        .all(txn)
                        .await?)
                })
            })
            .await?;

        Ok(rows
            .into_iter()
            .map(|(account, transactions)| (account.id, transactions.len() as i64))
            .collect())
    }

    async fn get_budgets_for_user(&self, user_id: Uuid) -> Result<Vec<Budget>> {
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                Ok(budgets::Entity::find()
                    .filter(budgets::Column::UserId.eq(user_id))
                    .order_by_asc(budgets::Column::Category)
                    .all(txn)
                    .await?
                    .into_iter()
                    .map(Into::into)
                    .collect())
            })
        })
        .await
    }

    async fn get_budget_by_id_for_user(
        &self,
        budget_id: &Uuid,
        user_id: &Uuid,
    ) -> Result<Option<Budget>> {
        let budget_id = *budget_id;
        let user_id = *user_id;
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                Ok(budgets::Entity::find()
                    .filter(budgets::Column::Id.eq(budget_id))
                    .filter(budgets::Column::UserId.eq(user_id))
                    .one(txn)
                    .await?
                    .map(Into::into))
            })
        })
        .await
    }

    async fn create_budget_for_user(&self, budget: Budget) -> Result<Budget> {
        let user_id = budget.user_id;
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                let result = budgets::Entity::insert(budgets::ActiveModel {
                    id: Set(budget.id),
                    user_id: Set(budget.user_id),
                    category: Set(budget.category.clone()),
                    amount: Set(budget.amount),
                    created_at: Set(Some(Self::to_db_time(budget.created_at))),
                    updated_at: Set(Some(Self::to_db_time(budget.updated_at))),
                })
                .exec(txn)
                .await;

                match result {
                    Ok(_) => Ok(budget),
                    Err(e) => {
                        if matches!(e, sea_orm::DbErr::RecordNotInserted) {
                            Err(anyhow::anyhow!("Budget category already exists"))
                        } else {
                            Err(anyhow::anyhow!(e))
                        }
                    }
                }
            })
        })
        .await
    }

    async fn update_budget_for_user(
        &self,
        budget_id: Uuid,
        user_id: Uuid,
        amount: rust_decimal::Decimal,
    ) -> Result<Budget> {
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                let update = budgets::Entity::update_many()
                    .col_expr(budgets::Column::Amount, Expr::value(amount))
                    .col_expr(
                        budgets::Column::UpdatedAt,
                        Expr::value(Self::to_db_time(chrono::Utc::now())),
                    )
                    .filter(budgets::Column::Id.eq(budget_id))
                    .filter(budgets::Column::UserId.eq(user_id))
                    .exec(txn)
                    .await?;

                if update.rows_affected == 0 {
                    return Err(anyhow::anyhow!("Budget not found or access denied"));
                }

                let budget = budgets::Entity::find()
                    .filter(budgets::Column::Id.eq(budget_id))
                    .filter(budgets::Column::UserId.eq(user_id))
                    .one(txn)
                    .await?
                    .ok_or_else(|| anyhow::anyhow!("Budget not found or access denied"))?;

                Ok(budget.into())
            })
        })
        .await
    }

    async fn delete_budget_for_user(&self, budget_id: Uuid, user_id: Uuid) -> Result<()> {
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                budgets::Entity::delete_many()
                    .filter(budgets::Column::Id.eq(budget_id))
                    .filter(budgets::Column::UserId.eq(user_id))
                    .exec(txn)
                    .await?;
                Ok(())
            })
        })
        .await
    }

    async fn get_latest_account_balances_for_user(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<LatestAccountBalance>> {
        let user_id = *user_id;
        let rows = self
            .with_tenant(&user_id, move |txn| {
                Box::pin(async move {
                    Ok(accounts::Entity::find()
                        .filter(accounts::Column::UserId.eq(user_id))
                        .find_also_related(provider_connections::Entity)
                        .order_by_asc(accounts::Column::Name)
                        .all(txn)
                        .await?)
                })
            })
            .await?;

        Ok(rows
            .into_iter()
            .map(|(account, provider_connection)| LatestAccountBalance {
                account_id: account.id,
                institution_id: provider_connection
                    .as_ref()
                    .map(|connection| connection.id.to_string())
                    .unwrap_or_else(|| "unknown_institution".to_string()),
                account_type: account.account_type,
                account_subtype: None,
                currency: "USD".to_string(),
                current_balance: account
                    .balance_current
                    .unwrap_or(rust_decimal::Decimal::ZERO),
                provider_connection_id: account.provider_connection_id,
                institution_name: provider_connection
                    .and_then(|connection| connection.institution_name),
            })
            .collect())
    }

    async fn update_user_password(&self, user_id: &Uuid, new_password_hash: &str) -> Result<()> {
        let user_id = *user_id;
        let new_password_hash = new_password_hash.to_string();
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                users::Entity::update_many()
                    .col_expr(users::Column::PasswordHash, Expr::value(new_password_hash))
                    .col_expr(
                        users::Column::UpdatedAt,
                        Expr::value(Self::to_db_time(chrono::Utc::now())),
                    )
                    .filter(users::Column::Id.eq(user_id))
                    .exec(txn)
                    .await?;
                Ok(())
            })
        })
        .await
    }

    async fn clear_user_password_hash(&self, user_id: &Uuid) -> Result<()> {
        let user_id = *user_id;
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                users::Entity::update_many()
                    .col_expr(
                        users::Column::PasswordHash,
                        Expr::value(Option::<String>::None),
                    )
                    .col_expr(
                        users::Column::UpdatedAt,
                        Expr::value(Self::to_db_time(chrono::Utc::now())),
                    )
                    .filter(users::Column::Id.eq(user_id))
                    .exec(txn)
                    .await?;
                Ok(())
            })
        })
        .await
    }

    async fn delete_user(&self, user_id: &Uuid) -> Result<()> {
        let user_id = *user_id;
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                users::Entity::delete_many()
                    .filter(users::Column::Id.eq(user_id))
                    .exec(txn)
                    .await?;
                Ok(())
            })
        })
        .await
    }

    async fn insert_webauthn_credential(
        &self,
        user_id: &Uuid,
        credential_id: Vec<u8>,
        passkey: serde_json::Value,
        name: &str,
    ) -> Result<WebAuthnCredential> {
        let user_id = *user_id;
        let name = name.to_string();
        let id = Uuid::new_v4();
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                let row = webauthn_credentials::Entity::insert(webauthn_credentials::ActiveModel {
                    id: Set(id),
                    user_id: Set(user_id),
                    credential_id: Set(credential_id),
                    passkey: Set(passkey),
                    name: Set(name),
                    created_at: Set(Self::to_db_time(chrono::Utc::now())),
                    ..Default::default()
                })
                .exec_with_returning(txn)
                .await?;
                Ok(WebAuthnCredential::from(row))
            })
        })
        .await
    }

    async fn list_webauthn_credentials_for_user(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<WebAuthnCredential>> {
        let user_id = *user_id;
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                let rows = webauthn_credentials::Entity::find()
                    .filter(webauthn_credentials::Column::UserId.eq(user_id))
                    .order_by_asc(webauthn_credentials::Column::CreatedAt)
                    .all(txn)
                    .await?;
                Ok(rows.into_iter().map(WebAuthnCredential::from).collect())
            })
        })
        .await
    }

    async fn find_webauthn_credentials_by_credential_ids(
        &self,
        user_id: &Uuid,
        ids: &[Vec<u8>],
    ) -> Result<Vec<WebAuthnCredential>> {
        let user_id = *user_id;
        let ids = ids.to_vec();
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                let rows = webauthn_credentials::Entity::find()
                    .filter(webauthn_credentials::Column::UserId.eq(user_id))
                    .filter(webauthn_credentials::Column::CredentialId.is_in(ids))
                    .all(txn)
                    .await?;
                Ok(rows.into_iter().map(WebAuthnCredential::from).collect())
            })
        })
        .await
    }

    async fn update_webauthn_credential_counter_and_last_used(
        &self,
        user_id: &Uuid,
        id: &Uuid,
        _sign_count: u32,
    ) -> Result<()> {
        let user_id = *user_id;
        let id = *id;
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                webauthn_credentials::Entity::update_many()
                    .col_expr(
                        webauthn_credentials::Column::LastUsedAt,
                        Expr::value(Self::to_db_time(chrono::Utc::now())),
                    )
                    .filter(webauthn_credentials::Column::Id.eq(id))
                    .filter(webauthn_credentials::Column::UserId.eq(user_id))
                    .exec(txn)
                    .await?;
                Ok(())
            })
        })
        .await
    }

    async fn delete_webauthn_credential(&self, user_id: &Uuid, id: &Uuid) -> Result<bool> {
        let user_id = *user_id;
        let id = *id;
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                let result = webauthn_credentials::Entity::delete_many()
                    .filter(webauthn_credentials::Column::Id.eq(id))
                    .filter(webauthn_credentials::Column::UserId.eq(user_id))
                    .exec(txn)
                    .await?;
                Ok(result.rows_affected > 0)
            })
        })
        .await
    }

    async fn delete_all_webauthn_credentials_for_user(&self, user_id: &Uuid) -> Result<u64> {
        let user_id = *user_id;
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                let result = webauthn_credentials::Entity::delete_many()
                    .filter(webauthn_credentials::Column::UserId.eq(user_id))
                    .exec(txn)
                    .await?;
                Ok(result.rows_affected)
            })
        })
        .await
    }

    async fn create_custom_category(
        &self,
        user_id: &Uuid,
        display_name: &str,
        lookup_key: &str,
    ) -> Result<CustomCategory> {
        let user_id = *user_id;
        let display_name = display_name.to_string();
        let lookup_key = lookup_key.to_string();
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                Ok(
                    user_custom_categories::Entity::insert(user_custom_categories::ActiveModel {
                        user_id: Set(user_id),
                        display_name: Set(display_name),
                        lookup_key: Set(lookup_key),
                        created_at: Set(Some(Self::to_db_time(chrono::Utc::now()))),
                        updated_at: Set(Some(Self::to_db_time(chrono::Utc::now()))),
                        ..Default::default()
                    })
                    .exec_with_returning(txn)
                    .await?
                    .into(),
                )
            })
        })
        .await
    }

    async fn list_custom_categories_for_user(&self, user_id: &Uuid) -> Result<Vec<CustomCategory>> {
        let user_id = *user_id;
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                Ok(user_custom_categories::Entity::find()
                    .filter(user_custom_categories::Column::UserId.eq(user_id))
                    .order_by_asc(user_custom_categories::Column::DisplayName)
                    .all(txn)
                    .await?
                    .into_iter()
                    .map(Into::into)
                    .collect())
            })
        })
        .await
    }

    async fn delete_custom_category(&self, user_id: &Uuid, id: &Uuid) -> Result<()> {
        let user_id = *user_id;
        let id = *id;
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                user_custom_categories::Entity::delete_many()
                    .filter(user_custom_categories::Column::Id.eq(id))
                    .filter(user_custom_categories::Column::UserId.eq(user_id))
                    .exec(txn)
                    .await?;
                Ok(())
            })
        })
        .await
    }

    async fn upsert_transaction_category_override(
        &self,
        user_id: &Uuid,
        normalized_merchant: &str,
        category_name: &str,
        custom_category_id: Option<Uuid>,
    ) -> Result<TransactionCategoryOverride> {
        let user_id = *user_id;
        let normalized_merchant = normalized_merchant.to_string();
        let category_name = category_name.to_string();
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                Ok(transaction_category_overrides::Entity::insert(
                    transaction_category_overrides::ActiveModel {
                        user_id: Set(user_id),
                        normalized_merchant: Set(normalized_merchant),
                        category_name: Set(category_name),
                        custom_category_id: Set(custom_category_id),
                        created_at: Set(Some(Self::to_db_time(chrono::Utc::now()))),
                        updated_at: Set(Some(Self::to_db_time(chrono::Utc::now()))),
                        ..Default::default()
                    },
                )
                .on_conflict(
                    OnConflict::columns([
                        transaction_category_overrides::Column::UserId,
                        transaction_category_overrides::Column::NormalizedMerchant,
                    ])
                    .update_columns([
                        transaction_category_overrides::Column::CategoryName,
                        transaction_category_overrides::Column::CustomCategoryId,
                        transaction_category_overrides::Column::UpdatedAt,
                    ])
                    .to_owned(),
                )
                .exec_with_returning(txn)
                .await?
                .into())
            })
        })
        .await
    }

    async fn delete_transaction_category_override_by_norm(
        &self,
        user_id: &Uuid,
        normalized_merchant: &str,
    ) -> Result<()> {
        let user_id = *user_id;
        let normalized_merchant = normalized_merchant.to_string();
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                transaction_category_overrides::Entity::delete_many()
                    .filter(transaction_category_overrides::Column::UserId.eq(user_id))
                    .filter(
                        transaction_category_overrides::Column::NormalizedMerchant
                            .eq(normalized_merchant),
                    )
                    .exec(txn)
                    .await?;
                Ok(())
            })
        })
        .await
    }

    async fn get_transaction_by_id_for_user(
        &self,
        user_id: &Uuid,
        id: &Uuid,
    ) -> Result<Option<Transaction>> {
        let user_id = *user_id;
        let id = *id;
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                Ok(transactions::Entity::find()
                    .filter(transactions::Column::Id.eq(id))
                    .filter(transactions::Column::UserId.eq(user_id))
                    .one(txn)
                    .await?
                    .map(Into::into))
            })
        })
        .await
    }

    async fn store_simplefin_root_credential(
        &self,
        user_id: &Uuid,
        access_url: &str,
    ) -> Result<()> {
        let encrypted_access_url = self.encrypt_token(access_url)?;
        let user_id = *user_id;

        self.with_tenant(&user_id, move |txn| {
            let encrypted_access_url = encrypted_access_url.clone();
            Box::pin(async move {
                simplefin_root_credentials::Entity::insert(
                    simplefin_root_credentials::ActiveModel {
                        user_id: Set(user_id),
                        encrypted_access_url: Set(encrypted_access_url),
                        setup_token_used_at: Set(Self::to_db_time(chrono::Utc::now())),
                        created_at: Set(Self::to_db_time(chrono::Utc::now())),
                        updated_at: Set(Self::to_db_time(chrono::Utc::now())),
                    },
                )
                .on_conflict(
                    OnConflict::column(simplefin_root_credentials::Column::UserId)
                        .update_columns([
                            simplefin_root_credentials::Column::EncryptedAccessUrl,
                            simplefin_root_credentials::Column::SetupTokenUsedAt,
                            simplefin_root_credentials::Column::UpdatedAt,
                        ])
                        .to_owned(),
                )
                .exec(txn)
                .await?;
                Ok(())
            })
        })
        .await
    }

    async fn get_simplefin_root_credential(&self, user_id: &Uuid) -> Result<Option<String>> {
        let user_id = *user_id;
        let row = self
            .with_tenant(&user_id, move |txn| {
                Box::pin(async move {
                    Ok(simplefin_root_credentials::Entity::find_by_id(user_id)
                        .one(txn)
                        .await?)
                })
            })
            .await?;

        row.map(|row| self.decrypt_token(&row.encrypted_access_url))
            .transpose()
    }

    async fn delete_simplefin_root_credential(&self, user_id: &Uuid) -> Result<bool> {
        let user_id = *user_id;
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                let result = simplefin_root_credentials::Entity::delete_by_id(user_id)
                    .exec(txn)
                    .await?;
                Ok(result.rows_affected > 0)
            })
        })
        .await
    }

    async fn list_simplefin_hidden_orgs(
        &self,
        user_id: &Uuid,
    ) -> Result<std::collections::HashSet<String>> {
        let user_id = *user_id;
        let rows = self
            .with_tenant(&user_id, move |txn| {
                Box::pin(async move { Ok(simplefin_hidden_orgs::Entity::find().all(txn).await?) })
            })
            .await?;

        Ok(rows.into_iter().map(|row| row.org_conn_id).collect())
    }

    async fn list_simplefin_ignored_institutions(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<crate::models::simplefin::SimpleFinIgnoredInstitution>> {
        let user_id = *user_id;
        let rows = self
            .with_tenant(&user_id, move |txn| {
                Box::pin(async move {
                    Ok(simplefin_hidden_orgs::Entity::find()
                        .order_by_desc(simplefin_hidden_orgs::Column::HiddenAt)
                        .all(txn)
                        .await?)
                })
            })
            .await?;

        Ok(rows
            .into_iter()
            .map(
                |row| crate::models::simplefin::SimpleFinIgnoredInstitution {
                    org_conn_id: row.org_conn_id,
                    institution_name: row.institution_name,
                    hidden_at: row.hidden_at.to_rfc3339(),
                },
            )
            .collect())
    }

    async fn insert_simplefin_hidden_org(
        &self,
        user_id: &Uuid,
        conn_id: &str,
        institution_name: Option<&str>,
    ) -> Result<()> {
        let conn_id = conn_id.to_string();
        let institution_name = institution_name.map(str::to_string);
        let user_id = *user_id;

        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                simplefin_hidden_orgs::Entity::insert(simplefin_hidden_orgs::ActiveModel {
                    user_id: Set(user_id),
                    org_conn_id: Set(conn_id),
                    hidden_at: Set(Self::to_db_time(chrono::Utc::now())),
                    institution_name: Set(institution_name),
                })
                .on_conflict(
                    OnConflict::columns([
                        simplefin_hidden_orgs::Column::UserId,
                        simplefin_hidden_orgs::Column::OrgConnId,
                    ])
                    .update_columns([
                        simplefin_hidden_orgs::Column::InstitutionName,
                        simplefin_hidden_orgs::Column::HiddenAt,
                    ])
                    .to_owned(),
                )
                .exec(txn)
                .await?;
                Ok(())
            })
        })
        .await
    }

    async fn remove_simplefin_hidden_org(&self, user_id: &Uuid, org_conn_id: &str) -> Result<bool> {
        let org_conn_id = org_conn_id.to_string();
        let user_id = *user_id;

        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                let result = simplefin_hidden_orgs::Entity::delete_many()
                    .filter(simplefin_hidden_orgs::Column::UserId.eq(user_id))
                    .filter(simplefin_hidden_orgs::Column::OrgConnId.eq(org_conn_id))
                    .exec(txn)
                    .await?;
                Ok(result.rows_affected > 0)
            })
        })
        .await
    }

    async fn disconnect_simplefin_org(
        &self,
        user_id: &Uuid,
        item_id: &str,
        org_conn_id: &str,
        institution_name: Option<&str>,
    ) -> Result<(i32, i32)> {
        let user_id = *user_id;
        let item_id = item_id.to_string();
        let org_conn_id = org_conn_id.to_string();
        let institution_name = institution_name.map(str::to_string);

        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                let connection = provider_connections::Entity::find()
                    .filter(provider_connections::Column::UserId.eq(user_id))
                    .filter(provider_connections::Column::ItemId.eq(item_id))
                    .one(txn)
                    .await?;

                let Some(connection) = connection else {
                    return Ok((0, 0));
                };

                let account_ids: Vec<Uuid> = accounts::Entity::find()
                    .filter(accounts::Column::ProviderConnectionId.eq(connection.id))
                    .all(txn)
                    .await?
                    .into_iter()
                    .map(|account| account.id)
                    .collect();

                let deleted_transactions = if account_ids.is_empty() {
                    0
                } else {
                    transactions::Entity::delete_many()
                        .filter(transactions::Column::AccountId.is_in(account_ids))
                        .exec(txn)
                        .await?
                        .rows_affected as i32
                };

                let deleted_accounts = accounts::Entity::delete_many()
                    .filter(accounts::Column::ProviderConnectionId.eq(connection.id))
                    .exec(txn)
                    .await?
                    .rows_affected as i32;

                provider_connections::Entity::delete_by_id(connection.id)
                    .exec(txn)
                    .await?;

                simplefin_hidden_orgs::Entity::insert(simplefin_hidden_orgs::ActiveModel {
                    user_id: Set(user_id),
                    org_conn_id: Set(org_conn_id),
                    institution_name: Set(institution_name),
                    hidden_at: Set(Self::to_db_time(chrono::Utc::now())),
                })
                .on_conflict(
                    OnConflict::columns([
                        simplefin_hidden_orgs::Column::UserId,
                        simplefin_hidden_orgs::Column::OrgConnId,
                    ])
                    .update_columns([
                        simplefin_hidden_orgs::Column::InstitutionName,
                        simplefin_hidden_orgs::Column::HiddenAt,
                    ])
                    .to_owned(),
                )
                .exec(txn)
                .await?;

                Ok((deleted_transactions, deleted_accounts))
            })
        })
        .await
    }

    async fn count_eligible_auto_categorize_transactions(&self, user_id: &Uuid) -> Result<i64> {
        let user_id = *user_id;
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                Ok(transactions::Entity::find()
                    .filter(transactions::Column::UserId.eq(user_id))
                    .filter(transactions::Column::CategoryPrimary.eq("OTHER"))
                    .filter(Self::auto_categorize_filter())
                    .count(txn)
                    .await? as i64)
            })
        })
        .await
    }

    async fn fetch_eligible_auto_categorize_transactions(
        &self,
        user_id: &Uuid,
        limit: i64,
        after_date: Option<chrono::NaiveDate>,
        after_id: Option<Uuid>,
    ) -> Result<Vec<Transaction>> {
        let user_id = *user_id;
        let rows = self
            .with_tenant(&user_id, move |txn| {
                Box::pin(async move {
                    let mut query = transactions::Entity::find()
                        .filter(transactions::Column::UserId.eq(user_id))
                        .filter(transactions::Column::CategoryPrimary.eq("OTHER"))
                        .filter(Self::auto_categorize_filter());

                    if let Some(after_date) = after_date {
                        let pagination = if let Some(after_id) = after_id {
                            Condition::any()
                                .add(transactions::Column::Date.gt(after_date))
                                .add(
                                    Condition::all()
                                        .add(transactions::Column::Date.eq(after_date))
                                        .add(transactions::Column::Id.gt(after_id)),
                                )
                        } else {
                            Condition::any().add(transactions::Column::Date.gt(after_date))
                        };
                        query = query.filter(pagination);
                    }

                    Ok(query
                        .order_by_asc(transactions::Column::Date)
                        .order_by_asc(transactions::Column::Id)
                        .limit(limit.max(0) as u64)
                        .all(txn)
                        .await?)
                })
            })
            .await?;

        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn update_transaction_categories_batch(
        &self,
        user_id: &Uuid,
        updates: &[TransactionCategoryUpdate],
    ) -> Result<()> {
        if updates.is_empty() {
            return Ok(());
        }

        let user_id = *user_id;
        let updates = updates.to_vec();
        self.with_tenant(&user_id, move |txn| {
            Box::pin(async move {
                for update in updates {
                    transactions::Entity::update_many()
                        .col_expr(
                            transactions::Column::CategoryPrimary,
                            Expr::value(update.category_primary.clone()),
                        )
                        .col_expr(
                            transactions::Column::CategoryDetailed,
                            Expr::value(update.category_detailed.clone()),
                        )
                        .col_expr(
                            transactions::Column::CategoryConfidence,
                            Expr::value(update.category_confidence.clone()),
                        )
                        .filter(transactions::Column::Id.eq(update.transaction_id))
                        .filter(transactions::Column::UserId.eq(user_id))
                        .exec(txn)
                        .await?;
                }
                Ok(())
            })
        })
        .await
    }

    async fn get_active_merchant_aliases(
        &self,
    ) -> Result<Vec<crate::services::merchant_normalization::types::AliasRow>> {
        use crate::services::merchant_normalization::types::AliasRow;

        let conn = self.conn();
        let rows = merchant_aliases::Entity::find()
            .filter(merchant_aliases::Column::IsActive.eq(true))
            .all(&conn)
            .await?;

        Ok(rows
            .into_iter()
            .map(|r| AliasRow {
                match_type: r.match_type,
                match_key: r.match_key,
                canonical_name: r.canonical_name,
                priority: r.priority,
            })
            .collect())
    }
}
