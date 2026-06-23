use crate::models::auth::User;
use crate::models::budget::Budget;
use crate::models::transaction::Transaction;
use crate::seed;
use crate::services::cache_service::MockCacheService;
use crate::services::demo_mode_service::{
    runtime_offset_days, DemoModeService, AUTHORED_DEMO_PROVIDER_TXN_IDS,
    MIN_DEMO_DIY_TRANSACTION_COUNT, MIN_DEMO_TRANSACTION_COUNT,
};
use crate::services::repository_service::MockDatabaseRepository;
use crate::services::subscription_detection::exclusions::is_excluded;
use crate::services::AuthService;
use chrono::{Duration, NaiveDate, Utc};
use rust_decimal_macros::dec;
use std::collections::{BTreeSet, HashMap};
use std::sync::{Arc, Mutex};
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
        demo_mode_active: true,
    }
}

fn provider_id(txn: &Transaction) -> &str {
    txn.provider_transaction_id.as_deref().unwrap_or("")
}

fn expect_shared_demo_seed_mocks(
    mock_db: &mut MockDatabaseRepository,
    mock_cache: &mut MockCacheService,
    user: &User,
    capture_diy_transactions: Option<Arc<Mutex<Vec<Transaction>>>>,
) {
    let user_id = user.id;
    mock_db
        .expect_get_active_merchant_aliases()
        .returning(|| Box::pin(async { Ok(vec![]) }));
    mock_db
        .expect_save_provider_connection()
        .times(1)
        .returning(|connection| {
            assert_eq!(connection.provider, "diy");
            assert!(connection.transaction_count >= MIN_DEMO_DIY_TRANSACTION_COUNT as i32);
            let id = connection.id;
            Box::pin(async move { Ok(id) })
        });
    if let Some(captured) = capture_diy_transactions {
        let captured_clone = Arc::clone(&captured);
        mock_db
            .expect_upsert_transactions_batch()
            .times(1)
            .returning(move |transactions, _| {
                *captured_clone.lock().unwrap() = transactions.to_vec();
                Box::pin(async { Ok(()) })
            });
    } else {
        mock_db
            .expect_upsert_transactions_batch()
            .times(1)
            .returning(|transactions, _| {
                assert!(transactions.len() >= MIN_DEMO_DIY_TRANSACTION_COUNT);
                for transaction in transactions {
                    assert!(provider_id(transaction).starts_with("sumurai_demo_diy_"));
                }
                Box::pin(async { Ok(()) })
            });
    }
    mock_db
        .expect_upsert_account()
        .times(2)
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_db
        .expect_get_budgets_for_user()
        .with(mockall::predicate::eq(user_id))
        .times(13)
        .returning(|_| Box::pin(async { Ok(Vec::new()) }));
    mock_db
        .expect_create_budget_for_user()
        .times(12)
        .returning(|budget| {
            let budget = budget.clone();
            Box::pin(async move { Ok(budget) })
        });
    mock_db
        .expect_update_user_provider()
        .with(
            mockall::predicate::eq(user_id),
            mockall::predicate::eq("teller"),
        )
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_set_with_ttl()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));
}

fn capture_snapshot_bundle(mock_db: &mut MockDatabaseRepository) -> Arc<Mutex<Vec<Transaction>>> {
    let captured = Arc::new(Mutex::new(Vec::new()));
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

fn capture_seeded_budgets(mock_db: &mut MockDatabaseRepository) -> Arc<Mutex<Vec<Budget>>> {
    let captured = Arc::new(Mutex::new(Vec::new()));
    let captured_clone = Arc::clone(&captured);
    mock_db
        .expect_create_budget_for_user()
        .times(12)
        .returning(move |budget| {
            captured_clone.lock().unwrap().push(budget.clone());
            let budget = budget.clone();
            Box::pin(async move { Ok(budget) })
        });
    captured
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

#[test]
fn runtime_offset_stays_zero_before_authored_latest_date() {
    let current_date = NaiveDate::from_ymd_opt(2026, 6, 10).unwrap();
    assert_eq!(runtime_offset_days(current_date), 0);
}

#[test]
fn runtime_offset_advances_after_authored_latest_date() {
    let current_date = NaiveDate::from_ymd_opt(2026, 7, 4).unwrap();
    assert_eq!(runtime_offset_days(current_date), 7);
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
async fn maybe_seed_demo_user_skips_existing_user() {
    std::env::set_var("SEED_DEMO_USER", "true");

    let existing = demo_user();
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_user_by_email()
        .with(mockall::predicate::eq(seed::DEMO_EMAIL))
        .times(1)
        .returning({
            let existing = existing.clone();
            move |_| {
                let existing = existing.clone();
                Box::pin(async move { Ok(Some(existing)) })
            }
        });

    let auth = Arc::new(
        AuthService::new("test_jwt_secret_key_for_integration_testing".to_string()).unwrap(),
    );
    let db: Arc<dyn crate::services::repository_service::DatabaseRepository> = Arc::new(mock_db);

    assert!(seed::maybe_seed_demo_user(&db, &auth)
        .await
        .unwrap()
        .is_none());
}

#[tokio::test]
async fn maybe_seed_demo_dev_workspace_skips_when_demo_workspace_exists() {
    std::env::set_var("SEED_DEMO_USER", "true");

    let user = demo_user();
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_user_by_email()
        .with(mockall::predicate::eq(seed::DEMO_EMAIL))
        .times(1)
        .returning({
            let user = user.clone();
            move |_| {
                let user = user.clone();
                Box::pin(async move { Ok(Some(user)) })
            }
        });
    mock_db
        .expect_get_all_provider_connections_by_user()
        .with(mockall::predicate::eq(user.id))
        .times(1)
        .returning(|_| {
            let mut connection = crate::models::plaid::ProviderConnection::new(
                Uuid::new_v4(),
                seed::SUMURAI_DEMO_TELLER_ITEM_ID,
            );
            connection.provider = "teller".to_string();
            connection.mark_connected("Sumurai Demo Bank");
            Box::pin(async move { Ok(vec![connection]) })
        });

    let db: Arc<dyn crate::services::repository_service::DatabaseRepository> = Arc::new(mock_db);
    let cache: Arc<dyn crate::services::cache_service::CacheService> =
        Arc::new(MockCacheService::new());

    seed::maybe_seed_demo_dev_workspace(&db, &cache)
        .await
        .unwrap();
}

#[tokio::test]
async fn seeds_demo_dataset_with_synced_and_diy_accounts() {
    let user = demo_user();
    let (mut mock_db, mut mock_cache) = (MockDatabaseRepository::new(), MockCacheService::new());
    expect_shared_demo_seed_mocks(&mut mock_db, &mut mock_cache, &user, None);
    mock_db
        .expect_upsert_provider_snapshot_bundle()
        .times(1)
        .returning(|_, connection, accounts, transactions| {
            assert_eq!(connection.provider, "teller");
            assert_eq!(
                connection.institution_name.as_deref(),
                Some("Sumurai Demo Bank")
            );
            assert_eq!(accounts.len(), 5);
            assert!(transactions.len() >= MIN_DEMO_TRANSACTION_COUNT);
            Box::pin(async { Ok(()) })
        });

    let db: Arc<dyn crate::services::repository_service::DatabaseRepository> = Arc::new(mock_db);
    let cache: Arc<dyn crate::services::CacheService> = Arc::new(mock_cache);

    DemoModeService::seed_demo_workspace_for_user(&db, &cache, &user)
        .await
        .unwrap();
}

#[tokio::test]
async fn transaction_merchants_are_normalized_for_every_seeded_row() {
    let user = demo_user();
    let (mut mock_db, mut mock_cache) = (MockDatabaseRepository::new(), MockCacheService::new());
    expect_shared_demo_seed_mocks(&mut mock_db, &mut mock_cache, &user, None);
    mock_db
        .expect_upsert_provider_snapshot_bundle()
        .times(1)
        .returning(|_, _, _, transactions| {
            for txn in transactions {
                assert!(txn.original_merchant_name.is_some());
                assert!(txn.merchant_name.is_some());
                assert!(txn.normalized_merchant.is_some());
                assert!(provider_id(txn).starts_with("sumurai_demo_"));
            }
            Box::pin(async { Ok(()) })
        });

    let db: Arc<dyn crate::services::repository_service::DatabaseRepository> = Arc::new(mock_db);
    let cache: Arc<dyn crate::services::CacheService> = Arc::new(mock_cache);

    DemoModeService::seed_demo_workspace_for_user(&db, &cache, &user)
        .await
        .unwrap();
}

#[tokio::test]
async fn seeded_demo_dataset_preserves_category_coverage_and_date_offsets() {
    let user = demo_user();
    let (mut mock_db, mut mock_cache) = (MockDatabaseRepository::new(), MockCacheService::new());
    expect_shared_demo_seed_mocks(&mut mock_db, &mut mock_cache, &user, None);
    let captured = capture_snapshot_bundle(&mut mock_db);

    let db: Arc<dyn crate::services::repository_service::DatabaseRepository> = Arc::new(mock_db);
    let cache: Arc<dyn crate::services::CacheService> = Arc::new(mock_cache);

    DemoModeService::seed_demo_workspace_for_user(&db, &cache, &user)
        .await
        .unwrap();

    let txns = captured.lock().unwrap().clone();
    let categories = txns
        .iter()
        .map(|txn| txn.category_primary.as_str())
        .collect::<BTreeSet<_>>();
    for category in crate::services::categorization::category_descriptors::SYSTEM_CATEGORY_SLUGS {
        assert!(categories.contains(category));
    }

    let by_provider_id: HashMap<&str, &Transaction> =
        txns.iter().map(|txn| (provider_id(txn), txn)).collect();

    let latest_date = txns.iter().map(|txn| txn.date).max().unwrap();
    let authored_latest = NaiveDate::from_ymd_opt(2026, 6, 27).unwrap();
    let expected_latest = if Utc::now().date_naive() >= authored_latest {
        Utc::now().date_naive()
    } else {
        authored_latest
    };
    assert_eq!(latest_date, expected_latest);

    let gym_first = by_provider_id
        .get(AUTHORED_DEMO_PROVIDER_TXN_IDS[19])
        .unwrap()
        .date;
    let gym_second = by_provider_id
        .get(AUTHORED_DEMO_PROVIDER_TXN_IDS[20])
        .unwrap()
        .date;
    let gym_third = by_provider_id
        .get(AUTHORED_DEMO_PROVIDER_TXN_IDS[21])
        .unwrap()
        .date;
    let gym_fourth = by_provider_id
        .get(AUTHORED_DEMO_PROVIDER_TXN_IDS[22])
        .unwrap()
        .date;
    assert_eq!(gym_second - gym_first, Duration::days(28));
    assert_eq!(gym_third - gym_second, Duration::days(31));
    assert_eq!(gym_fourth - gym_third, Duration::days(30));
}

#[tokio::test]
async fn seeded_demo_dataset_keeps_expected_subscription_and_other_examples() {
    let user = demo_user();
    let (mut mock_db, mut mock_cache) = (MockDatabaseRepository::new(), MockCacheService::new());
    expect_shared_demo_seed_mocks(&mut mock_db, &mut mock_cache, &user, None);
    let captured = capture_snapshot_bundle(&mut mock_db);

    let db: Arc<dyn crate::services::repository_service::DatabaseRepository> = Arc::new(mock_db);
    let cache: Arc<dyn crate::services::CacheService> = Arc::new(mock_cache);

    DemoModeService::seed_demo_workspace_for_user(&db, &cache, &user)
        .await
        .unwrap();

    let txns = captured.lock().unwrap().clone();
    let by_provider_id: HashMap<&str, &Transaction> =
        txns.iter().map(|txn| (provider_id(txn), txn)).collect();

    let netflix = by_provider_id
        .get(AUTHORED_DEMO_PROVIDER_TXN_IDS[5])
        .unwrap();
    assert_eq!(netflix.amount, dec!(-15.49));
    assert_eq!(netflix.category_primary, "SUBSCRIPTION");

    let atm = by_provider_id
        .get(AUTHORED_DEMO_PROVIDER_TXN_IDS[3])
        .unwrap();
    assert_eq!(atm.category_primary, "BANK_FEES");

    let transfer = by_provider_id
        .get(AUTHORED_DEMO_PROVIDER_TXN_IDS[16])
        .unwrap();
    assert_eq!(transfer.category_primary, "TRANSFER_OUT");

    let repeated_other = txns
        .iter()
        .filter(|txn| txn.original_merchant_name.as_deref() == Some("CLOUD NINE COLLECTIVE"))
        .count();
    assert!(repeated_other >= 12);

    for provider_id in &AUTHORED_DEMO_PROVIDER_TXN_IDS[23..=25] {
        let excluded = by_provider_id.get(provider_id).unwrap();
        assert_eq!(excluded.amount, dec!(-6.45));
        let raw = excluded.original_merchant_name.as_deref().unwrap_or("");
        assert!(raw.contains("STARBUCKS"));
    }
    assert!(is_excluded("starbucks"));
}

#[tokio::test]
async fn seeded_diy_institution_includes_transactions() {
    let user = demo_user();
    let user_id = user.id;
    let (mut mock_db, mut mock_cache) = (MockDatabaseRepository::new(), MockCacheService::new());
    let captured_diy = Arc::new(Mutex::new(Vec::<Transaction>::new()));
    expect_shared_demo_seed_mocks(
        &mut mock_db,
        &mut mock_cache,
        &user,
        Some(Arc::clone(&captured_diy)),
    );
    mock_db
        .expect_upsert_provider_snapshot_bundle()
        .times(1)
        .returning(|_, _, _, _| Box::pin(async { Ok(()) }));

    let cash_account_id = seed::demo_entity_id(user_id, "account:sumurai_demo_diy_cash");
    let travel_account_id = seed::demo_entity_id(user_id, "account:sumurai_demo_diy_travel");

    let db: Arc<dyn crate::services::repository_service::DatabaseRepository> = Arc::new(mock_db);
    let cache: Arc<dyn crate::services::CacheService> = Arc::new(mock_cache);

    DemoModeService::seed_demo_workspace_for_user(&db, &cache, &user)
        .await
        .unwrap();

    let diy_txns = captured_diy.lock().unwrap().clone();
    assert!(diy_txns.len() >= MIN_DEMO_DIY_TRANSACTION_COUNT);
    assert!(diy_txns.iter().any(|txn| txn.account_id == cash_account_id));
    assert!(diy_txns
        .iter()
        .any(|txn| txn.account_id == travel_account_id));

    for txn in &diy_txns {
        assert!(txn.original_merchant_name.is_some());
        assert!(txn.merchant_name.is_some());
        assert!(txn.normalized_merchant.is_some());
        assert!(provider_id(txn).starts_with("sumurai_demo_diy_"));
    }
}

#[tokio::test]
async fn seeds_budgets_for_budgetable_demo_categories() {
    let user = demo_user();
    let (mut mock_db, mut mock_cache) = (MockDatabaseRepository::new(), MockCacheService::new());
    mock_db
        .expect_get_active_merchant_aliases()
        .returning(|| Box::pin(async { Ok(vec![]) }));
    mock_db
        .expect_upsert_provider_snapshot_bundle()
        .times(1)
        .returning(|_, _, _, _| Box::pin(async { Ok(()) }));
    mock_db
        .expect_save_provider_connection()
        .times(1)
        .returning(|connection| {
            assert_eq!(connection.provider, "diy");
            assert!(connection.transaction_count >= MIN_DEMO_DIY_TRANSACTION_COUNT as i32);
            let id = connection.id;
            Box::pin(async move { Ok(id) })
        });
    mock_db
        .expect_upsert_transactions_batch()
        .times(1)
        .returning(|transactions, _| {
            assert!(transactions.len() >= MIN_DEMO_DIY_TRANSACTION_COUNT);
            for transaction in transactions {
                assert!(provider_id(transaction).starts_with("sumurai_demo_diy_"));
            }
            Box::pin(async { Ok(()) })
        });
    mock_db
        .expect_upsert_account()
        .times(2)
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_db
        .expect_get_budgets_for_user()
        .times(13)
        .returning(|_| Box::pin(async { Ok(Vec::new()) }));
    let captured_budgets = capture_seeded_budgets(&mut mock_db);
    mock_db
        .expect_update_user_provider()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

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

    let budgets = captured_budgets.lock().unwrap();
    let categories = budgets
        .iter()
        .map(|budget| budget.category.clone())
        .collect::<BTreeSet<_>>();
    let expected = BTreeSet::from([
        "ENTERTAINMENT".to_string(),
        "FOOD_AND_DRINK".to_string(),
        "GENERAL_MERCHANDISE".to_string(),
        "GENERAL_SERVICES".to_string(),
        "HOME_IMPROVEMENT".to_string(),
        "MEDICAL".to_string(),
        "PERSONAL_CARE".to_string(),
        "RENT_AND_UTILITIES".to_string(),
        "SHOPPING".to_string(),
        "SUBSCRIPTION".to_string(),
        "TRANSPORTATION".to_string(),
        "TRAVEL".to_string(),
    ]);
    assert_eq!(categories, expected);
}
