use crate::models::{
    account::Account,
    plaid::ProviderConnection,
    provider_connect::ProviderConnectRequest,
    transaction::{ProviderTransactionsResult, Transaction},
};
use crate::providers::{FinancialDataProvider, MockFinancialDataProvider, ProviderRegistry};
use crate::services::cache_service::MockCacheService;
use crate::services::connection_service::{ConnectionService, SyncConnectionParams};
use crate::services::repository_service::MockDatabaseRepository;
use crate::services::sync_service::SyncService;
use crate::test_fixtures::{build_credential_resolvers, noop_categorizer};
use chrono::{NaiveDate, Utc};
use rust_decimal::Decimal;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

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
            original_merchant_name: None,
            normalized_merchant: Some("merchant".to_string()),
            normalization_source: Some("sumurai_engine".to_string()),
        })
        .collect()
}

fn build_provider_mock(
    provider_name: &'static str,
    accounts: Vec<Account>,
    transactions: Vec<Transaction>,
) -> Arc<dyn FinancialDataProvider> {
    let access_token = "mock_access_token".to_string();
    let item_id = if provider_name == "teller" {
        "teller_enroll_123".to_string()
    } else {
        "item_123".to_string()
    };
    let institution_id = if provider_name == "teller" {
        "teller".to_string()
    } else {
        "ins_123".to_string()
    };
    let institution_name = if provider_name == "teller" {
        "Teller Demo Bank".to_string()
    } else {
        "Test Bank".to_string()
    };

    let mut provider = MockFinancialDataProvider::new();
    provider
        .expect_provider_name()
        .return_const(provider_name.to_string());
    provider
        .expect_create_link_token()
        .returning(|_| Ok("mock_link_token".to_string()));
    provider.expect_exchange_public_token().returning(move |_| {
        let provider = provider_name.to_string();
        let access_token = access_token.clone();
        let item_id = item_id.clone();
        Ok(crate::providers::ProviderCredentials {
            provider,
            access_token,
            item_id,
            certificate: None,
            private_key: None,
        })
    });
    provider.expect_get_accounts().returning(move |_| {
        let accounts = accounts.clone();
        Ok(accounts)
    });
    provider
        .expect_get_transactions()
        .returning(move |_, _, _| {
            let transactions = transactions.clone();
            Ok(ProviderTransactionsResult {
                transactions,
                page_count: 1,
            })
        });
    provider.expect_get_institution_info().returning(move |_| {
        let institution_id = institution_id.clone();
        let institution_name = institution_name.clone();
        Ok(crate::providers::InstitutionInfo {
            institution_id,
            name: institution_name,
            logo: None,
            color: None,
        })
    });

    Arc::new(provider)
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
    let provider = build_provider_mock("plaid", accounts.clone(), transactions.clone());
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
        .times(..)
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_db
        .expect_get_transactions_for_subscription_detection()
        .times(..)
        .returning(|_, _| Box::pin(async { Ok(vec![]) }));

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

#[tokio::test]
async fn given_provider_sync_with_raw_only_merchant_when_persisting_then_normalizes_before_upsert()
{
    let user_id = Uuid::new_v4();
    let account_id = Uuid::new_v4();
    let connection_id = Uuid::new_v4();
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

    let transactions = vec![Transaction {
        id: Uuid::new_v4(),
        account_id,
        user_id: None,
        provider_account_id: Some("provider_acc_1".to_string()),
        provider_transaction_id: Some("provider_txn_raw".to_string()),
        amount: Decimal::new(-1_250, 2),
        date: NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
        merchant_name: None,
        category_primary: "Food".to_string(),
        category_detailed: "Restaurant".to_string(),
        category_confidence: "HIGH".to_string(),
        payment_channel: Some("in_store".to_string()),
        pending: false,
        created_at: Some(Utc::now()),
        original_merchant_name: Some("POS DEBIT STARBUCKS #12345 SEATTLE WA 06/03".to_string()),
        normalized_merchant: None,
        normalization_source: None,
    }];
    let provider = build_provider_mock("plaid", accounts.clone(), transactions);
    let provider_registry = Arc::new(ProviderRegistry::from_providers([(
        "plaid",
        Arc::clone(&provider),
    )]));

    let mut mock_db = MockDatabaseRepository::new();
    let mut mock_cache = MockCacheService::new();

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
        .expect_get_active_merchant_aliases()
        .times(1)
        .returning(|| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_upsert_transactions_batch()
        .times(1)
        .returning(move |transactions, _| {
            assert_eq!(transactions.len(), 1);
            let txn = &transactions[0];
            assert_eq!(txn.merchant_name.as_deref(), Some("Starbucks"));
            assert_eq!(txn.normalized_merchant.as_deref(), Some("starbucks"));
            assert_eq!(txn.normalization_source.as_deref(), Some("sumurai_engine"));
            assert_eq!(
                txn.original_merchant_name.as_deref(),
                Some("POS DEBIT STARBUCKS #12345 SEATTLE WA 06/03")
            );
            Box::pin(async { Ok(()) })
        });

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
        .returning(|_, _, _, _, _, _| Box::pin(async { Ok(1) }));

    mock_db
        .expect_save_provider_connection()
        .times(1)
        .returning(|_| Box::pin(async { Ok(Uuid::new_v4()) }));

    mock_db
        .expect_get_transactions_for_subscription_detection()
        .times(..)
        .returning(|_, _| Box::pin(async { Ok(vec![]) }));

    mock_cache
        .expect_get_string()
        .times(1)
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_set_with_ttl()
        .times(1)
        .returning(|_, _, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_add_transaction()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_invalidate_pattern()
        .times(2)
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_clear_transactions()
        .times(..)
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
                jwt_id: "jwt_123",
            },
            &sync_service,
            &mut connection,
            None,
        )
        .await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn given_existing_user_provider_when_connecting_teller_then_overwrites_active_provider() {
    let user_id = Uuid::new_v4();
    let connection_id = Uuid::new_v4();
    let accounts = vec![];

    let teller_provider = build_provider_mock("teller", accounts.clone(), vec![]);
    let provider_registry = Arc::new(ProviderRegistry::from_providers([(
        "teller",
        teller_provider,
    )]));

    let mut mock_db = MockDatabaseRepository::new();
    crate::test_fixtures::apply_demo_mode_exit_mock_defaults(&mut mock_db);
    mock_db
        .expect_update_user_provider()
        .with(
            mockall::predicate::eq(user_id),
            mockall::predicate::eq("teller"),
        )
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_db
        .expect_store_provider_credentials_for_user()
        .returning(|_, _, _| Box::pin(async { Ok(Uuid::new_v4()) }));
    mock_db
        .expect_save_provider_connection()
        .returning(move |_| Box::pin(async move { Ok(connection_id) }));

    let db_repository = Arc::new(mock_db);
    let credential_resolvers = build_credential_resolvers(db_repository.clone());
    let connection_service = ConnectionService::new(
        db_repository,
        Arc::new(MockCacheService::new()),
        provider_registry,
        noop_categorizer(),
        credential_resolvers,
    );

    let response = connection_service
        .connect_teller_provider(
            &user_id,
            "jwt_123",
            &ProviderConnectRequest {
                provider: "teller".to_string(),
                access_token: "access-sandbox-xyz".to_string(),
                enrollment_id: "enroll-123".to_string(),
                institution_name: Some("Teller Demo Bank".to_string()),
                simplefin: Default::default(),
            },
        )
        .await
        .expect("teller connect should succeed");

    assert_eq!(response.institution_name, "Teller Demo Bank");
    assert!(!response.connection_id.is_empty());
}
