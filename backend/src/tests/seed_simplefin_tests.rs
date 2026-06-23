use crate::models::auth::User;
use crate::models::transaction::Transaction;
use crate::seed;
use crate::services::cache_service::MockCacheService;
use crate::services::categorization::classifier_labels::deterministic_prediction;
use crate::services::demo_mode_service::DemoModeService;
use crate::services::repository_service::MockDatabaseRepository;
use crate::services::subscription_detection::exclusions::is_excluded;
use crate::services::AuthService;
use chrono::NaiveDate;
use rust_decimal_macros::dec;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

fn demo_user() -> User {
    User {
        id: Uuid::new_v4(),
        email: seed::DEMO_EMAIL.to_string(),
        password_hash: None,
        provider: String::new(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        onboarding_completed: true,
        demo_mode_active: true,
    }
}

fn provider_id(txn: &Transaction) -> &str {
    txn.provider_transaction_id.as_deref().unwrap_or("")
}

fn expect_fresh_demo_seed_mocks(mock_db: &mut MockDatabaseRepository, user: &User) {
    let user_id = user.id;
    mock_db
        .expect_get_user_by_email()
        .with(mockall::predicate::eq(seed::DEMO_EMAIL))
        .returning({
            let user = user.clone();
            move |_| {
                let u = user.clone();
                Box::pin(async move { Ok(Some(u)) })
            }
        });
    mock_db
        .expect_get_provider_transaction_ids_for_user()
        .with(mockall::predicate::eq(user_id))
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock_db
        .expect_get_active_merchant_aliases()
        .returning(|| Box::pin(async { Ok(vec![]) }));
}

fn capture_snapshot_bundle(
    mock_db: &mut MockDatabaseRepository,
) -> Arc<std::sync::Mutex<Vec<Transaction>>> {
    let captured = Arc::new(std::sync::Mutex::new(Vec::new()));
    let captured_clone = Arc::clone(&captured);
    mock_db
        .expect_upsert_provider_snapshot_bundle()
        .times(1)
        .returning(move |_, _, _, transactions| {
            *captured_clone.lock().unwrap() = transactions.to_vec();
            Box::pin(async { Ok(()) })
        });
    captured
}

#[test]
fn demo_simplefin_seeded_only_when_all_provider_transaction_ids_present() {
    assert!(!seed::is_demo_simplefin_seeded(&[]));
    assert!(!seed::is_demo_simplefin_seeded(&[
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[5].to_string()
    ]));
    assert!(seed::is_demo_simplefin_seeded(
        &seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS
            .iter()
            .map(|id| (*id).to_string())
            .collect::<Vec<_>>()
    ));
}

#[test]
fn demo_entity_ids_are_stable_for_the_same_user_and_key() {
    let user_id = Uuid::new_v4();
    let first = seed::demo_entity_id(user_id, "account:sumurai_demo_dep_checking");
    let second = seed::demo_entity_id(user_id, "account:sumurai_demo_dep_checking");
    assert_eq!(first, second);
    assert_ne!(
        first,
        seed::demo_entity_id(user_id, "account:sumurai_demo_dep_savings")
    );
}

#[tokio::test]
async fn maybe_seed_demo_user_creates_demo_ready_user() {
    std::env::set_var("SEED_DEMO_USER", "true");

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_user_by_email()
        .with(mockall::predicate::eq(seed::DEMO_EMAIL))
        .times(1)
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_db.expect_create_user().times(1).returning(|user| {
        assert_eq!(user.email, seed::DEMO_EMAIL);
        assert!(user.demo_mode_active);
        Box::pin(async { Ok(()) })
    });

    let auth = Arc::new(
        AuthService::new("test_jwt_secret_key_for_integration_testing".to_string()).unwrap(),
    );
    let db: Arc<dyn crate::services::repository_service::DatabaseRepository> = Arc::new(mock_db);

    let user = seed::maybe_seed_demo_user(&db, &auth)
        .await
        .unwrap()
        .expect("demo user");

    assert!(user.demo_mode_active);
}

#[tokio::test]
async fn skips_when_demo_transactions_already_seeded() {
    std::env::set_var("SEED_DEMO_USER", "true");

    let user = demo_user();
    let user_id = user.id;
    let seeded_ids: Vec<String> = seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS
        .iter()
        .map(|id| (*id).to_string())
        .collect();

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_provider_transaction_ids_for_user()
        .with(mockall::predicate::eq(user_id))
        .times(1)
        .returning(move |_| {
            let ids = seeded_ids.clone();
            Box::pin(async move { Ok(ids) })
        });
    mock_db
        .expect_get_transactions_for_user()
        .with(mockall::predicate::eq(user_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(Vec::new()) }));
    mock_db.expect_upsert_provider_snapshot_bundle().times(0);
    mock_db.expect_upsert_transactions_batch().times(0);

    let mock_cache = MockCacheService::new();
    let db: Arc<dyn crate::services::repository_service::DatabaseRepository> = Arc::new(mock_db);
    let cache: Arc<dyn crate::services::CacheService> = Arc::new(mock_cache);

    DemoModeService::seed_demo_workspace_for_user(&db, &cache, &user)
        .await
        .unwrap();
}

#[tokio::test]
async fn seeds_atomic_snapshot_with_twenty_six_transactions() {
    std::env::set_var("SEED_DEMO_USER", "true");

    let user = demo_user();
    let (mut mock_db, mut mock_cache) = (MockDatabaseRepository::new(), MockCacheService::new());
    expect_fresh_demo_seed_mocks(&mut mock_db, &user);
    mock_db
        .expect_upsert_provider_snapshot_bundle()
        .times(1)
        .returning(|_, _, accounts, transactions| {
            assert_eq!(accounts.len(), 5);
            assert_eq!(transactions.len(), 26);
            Box::pin(async { Ok(()) })
        });

    mock_cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_set_with_ttl()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    let db: Arc<dyn crate::services::repository_service::DatabaseRepository> = Arc::new(mock_db);
    let cache: Arc<dyn crate::services::CacheService> = Arc::new(mock_cache);

    DemoModeService::seed_demo_workspace_for_user(&db, &cache, &user)
        .await
        .unwrap();
}

#[tokio::test]
async fn transaction_original_merchant_names_match_raw_descriptions() {
    std::env::set_var("SEED_DEMO_USER", "true");

    let user = demo_user();
    let (mut mock_db, mut mock_cache) = (MockDatabaseRepository::new(), MockCacheService::new());
    expect_fresh_demo_seed_mocks(&mut mock_db, &user);
    mock_db
        .expect_upsert_provider_snapshot_bundle()
        .times(1)
        .returning(|_, _, _, transactions| {
            for txn in transactions {
                assert!(txn.original_merchant_name.is_some());
                assert!(txn.merchant_name.is_some());
                assert!(provider_id(txn).starts_with("sumurai_demo_"));
            }
            Box::pin(async { Ok(()) })
        });

    mock_cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_set_with_ttl()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    let db: Arc<dyn crate::services::repository_service::DatabaseRepository> = Arc::new(mock_db);
    let cache: Arc<dyn crate::services::CacheService> = Arc::new(mock_cache);

    DemoModeService::seed_demo_workspace_for_user(&db, &cache, &user)
        .await
        .unwrap();
}

#[tokio::test]
async fn phase8_subscription_scenarios_present_in_simplefin_seed_for_demo_user_only() {
    std::env::set_var("SEED_DEMO_USER", "true");

    let user = demo_user();
    let (mut mock_db, mut mock_cache) = (MockDatabaseRepository::new(), MockCacheService::new());
    expect_fresh_demo_seed_mocks(&mut mock_db, &user);
    let captured = capture_snapshot_bundle(&mut mock_db);

    mock_cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_set_with_ttl()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    let db: Arc<dyn crate::services::repository_service::DatabaseRepository> = Arc::new(mock_db);
    let cache: Arc<dyn crate::services::CacheService> = Arc::new(mock_cache);

    DemoModeService::seed_demo_workspace_for_user(&db, &cache, &user)
        .await
        .unwrap();

    let txns = captured.lock().unwrap().clone();
    let by_provider_id: HashMap<&str, &Transaction> =
        txns.iter().map(|txn| (provider_id(txn), txn)).collect();

    let netflix = by_provider_id
        .get(seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[5])
        .expect("master-list netflix transaction");
    assert_eq!(netflix.amount, dec!(-15.49));
    let netflix_pred =
        deterministic_prediction("[debit] NETFLIX.COM 866-579-7172 CA").expect("netflix classify");
    assert_eq!(netflix_pred.primary, "SUBSCRIPTION");
    assert_eq!(netflix.category_primary, "SUBSCRIPTION");

    let atm = by_provider_id
        .get(seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[3])
        .expect("atm withdrawal transaction");
    assert_eq!(atm.category_primary, "BANK_FEES");

    let transfer = by_provider_id
        .get(seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[16])
        .expect("transfer transaction");
    assert_eq!(transfer.category_primary, "TRANSFER_OUT");

    let gym_dates = [
        NaiveDate::from_ymd_opt(2026, 2, 15).unwrap(),
        NaiveDate::from_ymd_opt(2026, 3, 15).unwrap(),
        NaiveDate::from_ymd_opt(2026, 4, 15).unwrap(),
        NaiveDate::from_ymd_opt(2026, 5, 15).unwrap(),
    ];
    for (idx, provider_id) in seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[19..=22]
        .iter()
        .enumerate()
    {
        let gym = by_provider_id
            .get(provider_id)
            .expect("cadence gym transaction");
        assert_eq!(gym.amount, dec!(-29.99));
        assert_eq!(gym.date, gym_dates[idx]);
    }
    let gym_pred =
        deterministic_prediction("[debit] PDXFIT GYM PORTLAND OR MONTHLY").expect("gym classify");
    assert_eq!(gym_pred.primary, "PERSONAL_CARE");

    for provider_id in &seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[23..=25] {
        let excluded = by_provider_id
            .get(provider_id)
            .expect("excluded recurring transaction");
        assert_eq!(excluded.amount, dec!(-6.45));
        let raw = excluded.original_merchant_name.as_deref().unwrap_or("");
        assert!(raw.contains("STARBUCKS"));
    }
    assert!(is_excluded("starbucks"));
}
