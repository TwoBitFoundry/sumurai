use crate::models::auth::User;
use crate::models::budget::Budget;
use crate::models::plaid::ProviderConnection;
use crate::services::cache_service::MockCacheService;
use crate::services::connection_service::ConnectionService;
use crate::services::demo_mode_service::DemoModeService;
use crate::services::repository_service::MockDatabaseRepository;
use crate::test_fixtures::{build_credential_resolvers, noop_categorizer};
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

fn demo_user() -> User {
    User {
        id: Uuid::new_v4(),
        email: "demo@example.com".to_string(),
        password_hash: None,
        provider: "teller".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        onboarding_completed: true,
        demo_mode_active: true,
    }
}

fn demo_connection(user_id: Uuid) -> ProviderConnection {
    let mut connection = ProviderConnection::new(user_id, crate::seed::SUMURAI_DEMO_TELLER_ITEM_ID);
    connection.provider = "teller".to_string();
    connection.mark_connected("Sumurai Demo Bank");
    connection
}

#[tokio::test]
async fn given_inactive_demo_mode_when_exiting_then_is_noop() {
    let user_id = Uuid::new_v4();
    let mut user = demo_user();
    user.id = user_id;
    user.demo_mode_active = false;

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_user_by_id()
        .with(mockall::predicate::eq(user_id))
        .times(1)
        .returning(move |_| {
            let user = user.clone();
            Box::pin(async move { Ok(Some(user)) })
        });

    let mock_cache = MockCacheService::new();
    let db: Arc<dyn crate::services::repository_service::DatabaseRepository> = Arc::new(mock_db);
    let cache: Arc<dyn crate::services::cache_service::CacheService> = Arc::new(mock_cache);
    let connection_service = ConnectionService::new(
        db.clone(),
        cache.clone(),
        Arc::new(crate::providers::ProviderRegistry::new()),
        noop_categorizer(),
        build_credential_resolvers(db.clone()),
    );

    let exited = DemoModeService::exit_demo_mode_if_active(
        &db,
        &cache,
        &connection_service,
        &user_id,
        "jwt-1",
    )
    .await
    .unwrap();

    assert!(!exited);
}

#[tokio::test]
async fn given_active_demo_mode_when_exiting_then_clears_financial_data_and_demo_flag() {
    let user = demo_user();
    let user_id = user.id;
    let connection = demo_connection(user_id);
    let connection_id = connection.id;
    let budget = Budget {
        id: Uuid::new_v4(),
        user_id,
        category: "FOOD_AND_DRINK".to_string(),
        amount: rust_decimal_macros::dec!(100),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_user_by_id()
        .with(mockall::predicate::eq(user_id))
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
        .with(mockall::predicate::eq(user_id))
        .times(2..)
        .returning({
            let connection = connection.clone();
            let call_count = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
            move |_| {
                let connection = connection.clone();
                let call_count = call_count.clone();
                Box::pin(async move {
                    if call_count.fetch_add(1, std::sync::atomic::Ordering::SeqCst) == 0 {
                        Ok(vec![connection])
                    } else {
                        Ok(vec![])
                    }
                })
            }
        });
    mock_db
        .expect_get_provider_connection_by_id()
        .with(
            mockall::predicate::eq(connection_id),
            mockall::predicate::eq(user_id),
        )
        .times(1)
        .returning({
            let connection = connection.clone();
            move |_, _| {
                let connection = connection.clone();
                Box::pin(async move { Ok(Some(connection)) })
            }
        });
    mock_db
        .expect_disconnect_provider_connection_cascade()
        .with(
            mockall::predicate::eq(user_id),
            mockall::predicate::eq(crate::seed::SUMURAI_DEMO_TELLER_ITEM_ID),
        )
        .times(1)
        .returning(|_, _| Box::pin(async { Ok((12, 3)) }));
    mock_db
        .expect_update_user_provider()
        .with(mockall::predicate::eq(user_id), mockall::predicate::eq(""))
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_db
        .expect_get_budgets_for_user()
        .with(mockall::predicate::eq(user_id))
        .times(1)
        .returning({
            let budget = budget.clone();
            move |_| {
                let budget = budget.clone();
                Box::pin(async move { Ok(vec![budget]) })
            }
        });
    mock_db
        .expect_delete_budget_for_user()
        .with(
            mockall::predicate::eq(budget.id),
            mockall::predicate::eq(user_id),
        )
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_db
        .expect_list_custom_categories_for_user()
        .with(mockall::predicate::eq(user_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock_db
        .expect_delete_all_transaction_category_overrides_for_user()
        .with(mockall::predicate::eq(user_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(2) }));
    mock_db
        .expect_list_simplefin_hidden_orgs()
        .with(mockall::predicate::eq(user_id))
        .times(1..)
        .returning(|_| Box::pin(async { Ok(std::collections::HashSet::new()) }));
    mock_db
        .expect_delete_simplefin_root_credential()
        .with(mockall::predicate::eq(user_id))
        .times(1..)
        .returning(|_| Box::pin(async { Ok(true) }));
    mock_db
        .expect_set_demo_mode_active()
        .with(
            mockall::predicate::eq(user_id),
            mockall::predicate::eq(false),
        )
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let mut mock_cache = MockCacheService::new();
    mock_cache
        .expect_clear_jwt_scoped_bank_connection_cache()
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_delete_access_token()
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_cache.expect_invalidate_session().times(0);
    mock_cache
        .expect_invalidate_pattern()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_clear_jwt_scoped_financial_data()
        .with(mockall::predicate::eq("jwt-1"))
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let db: Arc<dyn crate::services::repository_service::DatabaseRepository> = Arc::new(mock_db);
    let cache: Arc<dyn crate::services::cache_service::CacheService> = Arc::new(mock_cache);
    let connection_service = ConnectionService::new(
        db.clone(),
        cache.clone(),
        Arc::new(crate::providers::ProviderRegistry::new()),
        noop_categorizer(),
        build_credential_resolvers(db.clone()),
    );

    let exited = DemoModeService::exit_demo_mode_if_active(
        &db,
        &cache,
        &connection_service,
        &user_id,
        "jwt-1",
    )
    .await
    .unwrap();

    assert!(exited);
}
