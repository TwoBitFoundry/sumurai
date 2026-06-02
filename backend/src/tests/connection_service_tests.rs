use crate::models::{
    account::Account,
    plaid::ProviderConnection,
    transaction::{ProviderTransactionsResult, Transaction},
};
use crate::providers::{
    FinancialDataProvider, InstitutionInfo, ProviderCredentials, ProviderRegistry,
};
use crate::services::cache_service::MockCacheService;
use crate::services::connection_service::{ConnectionService, SyncConnectionParams};
use crate::services::repository_service::MockDatabaseRepository;
use crate::services::sync_service::SyncService;
use crate::test_fixtures::{build_credential_resolvers, noop_categorizer};
use anyhow::Result;
use async_trait::async_trait;
use chrono::{NaiveDate, Utc};
use rust_decimal::Decimal;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

struct MockProvider {
    accounts: Vec<Account>,
    transactions: Vec<Transaction>,
}

#[async_trait]
impl FinancialDataProvider for MockProvider {
    fn provider_name(&self) -> &str {
        "plaid"
    }

    async fn create_link_token(&self, _user_id: &Uuid) -> Result<String> {
        Ok("mock_link_token".to_string())
    }

    async fn exchange_public_token(&self, _public_token: &str) -> Result<ProviderCredentials> {
        Ok(ProviderCredentials {
            provider: "plaid".to_string(),
            access_token: "mock_access_token".to_string(),
            item_id: "item_123".to_string(),
            certificate: None,
            private_key: None,
        })
    }

    async fn get_accounts(&self, _credentials: &ProviderCredentials) -> Result<Vec<Account>> {
        Ok(self.accounts.clone())
    }

    async fn get_transactions(
        &self,
        _credentials: &ProviderCredentials,
        _start_date: NaiveDate,
        _end_date: NaiveDate,
    ) -> Result<ProviderTransactionsResult> {
        Ok(ProviderTransactionsResult {
            transactions: self.transactions.clone(),
            page_count: 1,
        })
    }

    async fn get_institution_info(
        &self,
        _credentials: &ProviderCredentials,
    ) -> Result<InstitutionInfo> {
        Ok(InstitutionInfo {
            institution_id: "ins_123".to_string(),
            name: "Test Bank".to_string(),
            logo: None,
            color: None,
        })
    }
}

fn build_transactions(account_id: Uuid, user_id: Uuid) -> Vec<Transaction> {
    (0..600)
        .map(|index| Transaction {
            id: Uuid::new_v4(),
            account_id,
            user_id: Some(user_id),
            provider_account_id: Some("provider_acc_1".to_string()),
            provider_transaction_id: Some(format!("provider_txn_{index:03}")),
            amount: Decimal::new(-1_000 - index as i64, 2),
            date: NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
            merchant_name: Some("Merchant".to_string()),
            category_primary: "Food".to_string(),
            category_detailed: "Restaurant".to_string(),
            category_confidence: "HIGH".to_string(),
            payment_channel: Some("in_store".to_string()),
            pending: false,
            created_at: Some(Utc::now()),
        })
        .collect()
}

#[tokio::test]
async fn given_plaid_sync_with_many_transactions_when_persisting_then_batches_writes_and_caches_all_transactions(
) {
    let user_id = Uuid::new_v4();
    let account_id = Uuid::new_v4();
    let connection_id = Uuid::new_v4();
    let jwt_id = "jwt_123";
    let item_id = "item_123";

    let mut connection = ProviderConnection::new(user_id, item_id);
    connection.id = connection_id;
    connection.mark_connected("Test Bank");

    let accounts = vec![Account {
        id: account_id,
        user_id: Some(user_id),
        provider_account_id: Some("provider_acc_1".to_string()),
        provider_connection_id: Some(connection_id),
        name: "Checking".to_string(),
        account_type: "checking".to_string(),
        balance_current: Some(Decimal::new(10_000, 2)),
        mask: Some("1234".to_string()),
        institution_name: Some("Test Bank".to_string()),
        provider_conn_id: None,
    }];

    let transactions = build_transactions(account_id, user_id);
    let provider: Arc<dyn FinancialDataProvider> = Arc::new(MockProvider {
        accounts: accounts.clone(),
        transactions: transactions.clone(),
    });
    let provider_registry = Arc::new(ProviderRegistry::from_providers([(
        "plaid",
        Arc::clone(&provider),
    )]));

    let mut mock_db = MockDatabaseRepository::new();
    let mut mock_cache = MockCacheService::new();
    let observed_batch_sizes = Arc::new(Mutex::new(Vec::new()));

    mock_db
        .expect_get_provider_credentials_for_user()
        .with(
            mockall::predicate::eq(user_id),
            mockall::predicate::eq(item_id),
        )
        .times(1)
        .returning(|_, _| {
            Box::pin(async {
                Ok(Some(crate::models::plaid::PlaidCredentials {
                    id: Uuid::new_v4(),
                    item_id: "item_123".to_string(),
                    user_id: Some(Uuid::new_v4()),
                    access_token: "access_token".to_string(),
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                }))
            })
        });

    mock_db
        .expect_upsert_account()
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_db
        .expect_get_accounts_for_user()
        .with(mockall::predicate::eq(user_id))
        .times(1)
        .returning(move |_| {
            let accounts = accounts.clone();
            Box::pin(async move { Ok(accounts) })
        });

    mock_db
        .expect_get_provider_transaction_ids_for_user()
        .with(mockall::predicate::eq(user_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_count_transactions()
        .with(
            mockall::predicate::eq(user_id),
            mockall::predicate::always(),
            mockall::predicate::always(),
            mockall::predicate::always(),
            mockall::predicate::always(),
            mockall::predicate::always(),
        )
        .times(1)
        .returning(|_, _, _, _, _, _| Box::pin(async { Ok(600) }));

    let observed_batch_sizes_clone = Arc::clone(&observed_batch_sizes);
    mock_db
        .expect_upsert_transactions_batch()
        .times(2)
        .returning(move |transactions, _| {
            observed_batch_sizes_clone
                .lock()
                .unwrap()
                .push(transactions.len());
            Box::pin(async { Ok(()) })
        });

    mock_db
        .expect_save_provider_connection()
        .times(1)
        .returning(|_| Box::pin(async { Ok(Uuid::new_v4()) }));

    mock_cache
        .expect_add_transaction()
        .times(600)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_invalidate_pattern()
        .times(2)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_clear_transactions()
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_clear_budgets()
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_cache_jwt_scoped_bank_connection()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_cache_jwt_scoped_bank_accounts()
        .times(1)
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    let db_repository = Arc::new(mock_db);
    let credential_resolvers = build_credential_resolvers(db_repository.clone());
    let connection_service = ConnectionService::new(
        db_repository,
        Arc::new(mock_cache),
        provider_registry.clone(),
        noop_categorizer(),
        credential_resolvers,
    );
    let sync_service = SyncService::new(provider_registry);

    let result = connection_service
        .sync_provider_connection(
            SyncConnectionParams {
                provider: "plaid",
                user_id: &user_id,
                jwt_id,
            },
            &sync_service,
            &mut connection,
            None,
        )
        .await;

    assert!(result.is_ok());
    let batch_sizes = observed_batch_sizes.lock().unwrap().clone();
    assert_eq!(batch_sizes, vec![500, 100]);
}
