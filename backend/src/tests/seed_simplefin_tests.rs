use crate::models::auth::User;
use crate::models::plaid::ProviderConnection;
use crate::seed;
use crate::services::cache_service::MockCacheService;
use crate::services::repository_service::MockDatabaseRepository;
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

fn demo_user() -> User {
    User {
        id: Uuid::new_v4(),
        email: seed::DEMO_EMAIL.to_string(),
        password_hash: None,
        provider: String::new(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        onboarding_completed: true,
    }
}

fn demo_connection(user_id: Uuid) -> ProviderConnection {
    let item_id = format!("simplefin_{}_sumurai_demo", user_id);
    ProviderConnection {
        id: Uuid::new_v4(),
        user_id,
        item_id,
        provider: "simplefin".to_string(),
        is_connected: true,
        last_sync_at: None,
        connected_at: Some(Utc::now()),
        disconnected_at: None,
        institution_id: Some("sumurai_demo".to_string()),
        institution_name: Some("Sumurai Demo Bank".to_string()),
        institution_logo_url: None,
        sync_cursor: None,
        transaction_count: 0,
        account_count: 5,
        created_at: Some(Utc::now()),
        updated_at: Some(Utc::now()),
    }
}

#[tokio::test]
async fn skips_when_demo_user_not_found() {
    std::env::set_var("SEED_DEMO_USER", "true");

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_user_by_email()
        .with(mockall::predicate::eq(seed::DEMO_EMAIL))
        .times(1)
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_db
        .expect_get_all_provider_connections_by_user()
        .times(0);

    let mock_cache = MockCacheService::new();
    let db: Arc<dyn crate::services::repository_service::DatabaseRepository> = Arc::new(mock_db);
    let cache: Arc<dyn crate::services::CacheService> = Arc::new(mock_cache);

    seed::maybe_seed_demo_simplefin_data(&db, &cache)
        .await
        .unwrap();
}

#[tokio::test]
async fn skips_when_demo_connection_already_exists() {
    std::env::set_var("SEED_DEMO_USER", "true");

    let user = demo_user();
    let user_id = user.id;
    let existing = demo_connection(user_id);

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_user_by_email()
        .with(mockall::predicate::eq(seed::DEMO_EMAIL))
        .times(1)
        .returning(move |_| {
            let u = user.clone();
            Box::pin(async move { Ok(Some(u)) })
        });
    mock_db
        .expect_get_all_provider_connections_by_user()
        .with(mockall::predicate::eq(user_id))
        .times(1)
        .returning(move |_| {
            let conns = vec![existing.clone()];
            Box::pin(async move { Ok(conns) })
        });
    mock_db.expect_save_provider_connection().times(0);

    let mock_cache = MockCacheService::new();
    let db: Arc<dyn crate::services::repository_service::DatabaseRepository> = Arc::new(mock_db);
    let cache: Arc<dyn crate::services::CacheService> = Arc::new(mock_cache);

    seed::maybe_seed_demo_simplefin_data(&db, &cache)
        .await
        .unwrap();
}

#[tokio::test]
async fn seeds_connection_five_accounts_and_nineteen_transactions() {
    std::env::set_var("SEED_DEMO_USER", "true");

    let user = demo_user();
    let user_id = user.id;

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_user_by_email()
        .with(mockall::predicate::eq(seed::DEMO_EMAIL))
        .times(1)
        .returning(move |_| {
            let u = user.clone();
            Box::pin(async move { Ok(Some(u)) })
        });
    mock_db
        .expect_get_all_provider_connections_by_user()
        .with(mockall::predicate::eq(user_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock_db
        .expect_save_provider_connection()
        .times(1)
        .returning(|_| Box::pin(async { Ok(Uuid::new_v4()) }));
    mock_db
        .expect_upsert_account()
        .times(5)
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_db
        .expect_upsert_transactions_batch()
        .times(1)
        .returning(|transactions, _| {
            assert_eq!(transactions.len(), 19);
            Box::pin(async { Ok(()) })
        });

    let mock_cache = MockCacheService::new();
    let db: Arc<dyn crate::services::repository_service::DatabaseRepository> = Arc::new(mock_db);
    let cache: Arc<dyn crate::services::CacheService> = Arc::new(mock_cache);

    seed::maybe_seed_demo_simplefin_data(&db, &cache)
        .await
        .unwrap();
}

#[tokio::test]
async fn transaction_original_merchant_names_match_raw_descriptions() {
    std::env::set_var("SEED_DEMO_USER", "true");

    let user = demo_user();
    let mut mock_db = MockDatabaseRepository::new();
    mock_db.expect_get_user_by_email().returning(move |_| {
        let u = user.clone();
        Box::pin(async move { Ok(Some(u)) })
    });
    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock_db
        .expect_save_provider_connection()
        .returning(|_| Box::pin(async { Ok(Uuid::new_v4()) }));
    mock_db
        .expect_upsert_account()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_db
        .expect_upsert_transactions_batch()
        .times(1)
        .returning(|transactions, _| {
            for txn in transactions {
                assert_eq!(
                    txn.merchant_name, txn.original_merchant_name,
                    "merchant_name and original_merchant_name must match before normalization"
                );
                assert!(
                    txn.provider_transaction_id
                        .as_deref()
                        .unwrap_or("")
                        .starts_with("sumurai_demo_txn_"),
                    "provider_transaction_id must use stable sumurai_demo_txn_ prefix"
                );
            }
            Box::pin(async { Ok(()) })
        });

    let mock_cache = MockCacheService::new();
    let db: Arc<dyn crate::services::repository_service::DatabaseRepository> = Arc::new(mock_db);
    let cache: Arc<dyn crate::services::CacheService> = Arc::new(mock_cache);

    seed::maybe_seed_demo_simplefin_data(&db, &cache)
        .await
        .unwrap();
}
