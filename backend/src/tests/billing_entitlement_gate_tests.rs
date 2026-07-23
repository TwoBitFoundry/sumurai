use axum::body::to_bytes;
use chrono::Utc;
use serde_json::json;
use tower::ServiceExt;
use uuid::Uuid;

use crate::config::{Config, MockEnvironment};
use crate::models::auth::User;
use crate::models::billing::BillingEntitlement;
use crate::models::plaid::ProviderConnection;
use crate::services::cache_service::MockCacheService;
use crate::services::repository_service::MockDatabaseRepository;
use crate::test_fixtures::{noop_categorizer, TestFixtures};

fn billing_cache() -> MockCacheService {
    let mut mock_cache = MockCacheService::new();
    mock_cache
        .expect_health_check()
        .returning(|| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    mock_cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_get_counter()
        .times(0..)
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_increment_counter()
        .times(0..)
        .returning(|_, _| Box::pin(async { Ok(1) }));
    mock_cache
        .expect_set_with_ttl()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_invalidate_pattern()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_delete_access_token()
        .times(0..)
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_clear_jwt_scoped_bank_connection_cache()
        .times(0..)
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_get_budgets()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_set_budgets()
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_clear_budgets()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_is_auth_ip_banned()
        .times(0..)
        .returning(|_| Box::pin(async { Ok(false) }));
    mock_cache
        .expect_record_auth_rate_limit_exceeded()
        .times(0..)
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
}

async fn billing_app(mock_db: MockDatabaseRepository) -> crate::Router {
    TestFixtures::create_test_app_with_db_cache_config_and_categorizer(
        mock_db,
        billing_cache(),
        noop_categorizer(),
        TestFixtures::create_paddle_test_config(),
    )
    .await
    .unwrap()
}

fn entitlement(user_id: Uuid, status: &str) -> BillingEntitlement {
    BillingEntitlement {
        user_id,
        access_status: status.to_string(),
        source: "paddle".to_string(),
        paddle_subscription_id: Some("sub_123".to_string()),
        paddle_customer_id: Some("ctm_123".to_string()),
        paddle_price_id: Some("pri_monthly".to_string()),
        trial_ends_at: None,
        current_period_ends_at: None,
        canceled_at: None,
        scheduled_cancel_at: None,
        last_event_at: None,
        payment_method_required: false,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

fn disabled_billing_config() -> Config {
    let mut env = MockEnvironment::new();
    env.set("AUTH_COOKIE_SAME_SITE", "Lax");
    env.set("APP_ORIGIN", "http://localhost:8080");
    Config::from_env_provider(&env).unwrap()
}

#[tokio::test]
async fn given_unpaid_billing_user_when_starting_plaid_link_then_returns_paid_access_required() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let mut mock_db = MockDatabaseRepository::new();

    mock_db
        .expect_get_billing_entitlement()
        .with(mockall::predicate::eq(user_id))
        .returning(|_| Box::pin(async { Ok(None) }));

    let app = billing_app(mock_db).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/plaid/link-token")
        .header("Cookie", format!("auth_token={token}"))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from("{}"))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 402);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload["code"], json!("PAID_ACCESS_REQUIRED"));
}

#[tokio::test]
async fn given_unpaid_demo_user_when_creating_diy_institution_then_returns_paid_access_without_exiting_demo(
) {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let mut mock_db = MockDatabaseRepository::new();

    mock_db
        .expect_get_billing_entitlement()
        .with(mockall::predicate::eq(user_id))
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_db.expect_set_demo_mode_active().never();
    mock_db.expect_save_provider_connection().never();

    let app = billing_app(mock_db).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/diy/institutions")
        .header("Cookie", format!("auth_token={token}"))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({"name": "My Cash"})).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 402);
}

#[tokio::test]
async fn given_active_billing_user_when_selecting_plaid_then_updates_provider() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let mut mock_db = MockDatabaseRepository::new();

    mock_db
        .expect_get_billing_entitlement()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let entitlement = entitlement(user_id, "active");
            Box::pin(async move { Ok(Some(entitlement)) })
        });
    mock_db
        .expect_get_user_by_id()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let user = User {
                provider: String::new(),
                ..user.clone()
            };
            Box::pin(async move { Ok(Some(user)) })
        });
    mock_db
        .expect_get_all_provider_connections_by_user()
        .with(mockall::predicate::eq(user_id))
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock_db
        .expect_update_user_provider()
        .with(
            mockall::predicate::eq(user_id),
            mockall::predicate::eq("plaid"),
        )
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let app = billing_app(mock_db).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/providers/select")
        .header("Cookie", format!("auth_token={token}"))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({ "provider": "plaid" })).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn given_trialing_billing_user_when_creating_diy_institution_then_persists_connection() {
    let (mut user, token) = TestFixtures::create_authenticated_user_with_token();
    user.demo_mode_active = false;
    let user_id = user.id;
    let mut mock_db = MockDatabaseRepository::new();

    mock_db
        .expect_get_billing_entitlement()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let entitlement = entitlement(user_id, "trialing");
            Box::pin(async move { Ok(Some(entitlement)) })
        });
    mock_db
        .expect_get_user_by_id()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let user = user.clone();
            Box::pin(async move { Ok(Some(user)) })
        });
    mock_db
        .expect_get_all_provider_connections_by_user()
        .with(mockall::predicate::eq(user_id))
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock_db
        .expect_save_provider_connection()
        .returning(|_| Box::pin(async { Ok(Uuid::new_v4()) }));

    let app = billing_app(mock_db).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/diy/institutions")
        .header("Cookie", format!("auth_token={token}"))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({"name": "My Cash"})).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn given_expired_billing_user_when_syncing_then_returns_paid_access_required() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let connection_id = Uuid::new_v4();
    let mut connection = ProviderConnection::new(user_id, "item-plaid");
    connection.id = connection_id;
    connection.provider = "plaid".to_string();
    connection.mark_connected("Plaid Bank");
    let mut mock_db = MockDatabaseRepository::new();

    mock_db
        .expect_get_provider_connection_by_id()
        .with(
            mockall::predicate::eq(connection_id),
            mockall::predicate::eq(user_id),
        )
        .returning(move |_, _| {
            let connection = connection.clone();
            Box::pin(async move { Ok(Some(connection)) })
        });
    mock_db
        .expect_get_billing_entitlement()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let entitlement = entitlement(user_id, "expired");
            Box::pin(async move { Ok(Some(entitlement)) })
        });

    let app = billing_app(mock_db).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/providers/sync-transactions")
        .header("Cookie", format!("auth_token={token}"))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({
                "connection_id": connection_id.to_string(),
                "client_date": "2026-07-07",
                "client_timezone": "America/Chicago"
            }))
            .unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 402);
}

#[tokio::test]
async fn given_expired_billing_user_when_reading_accounts_then_read_access_remains_available() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let mut mock_db = MockDatabaseRepository::new();

    mock_db.expect_get_billing_entitlement().never();
    mock_db
        .expect_get_accounts_for_user()
        .with(mockall::predicate::eq(user_id))
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock_db
        .expect_get_transaction_count_by_account_for_user()
        .with(mockall::predicate::eq(user_id))
        .returning(|_| Box::pin(async { Ok(std::collections::HashMap::new()) }));
    mock_db
        .expect_get_all_provider_connections_by_user()
        .with(mockall::predicate::eq(user_id))
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = billing_app(mock_db).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::GET)
        .uri("/api/plaid/accounts")
        .header("Cookie", format!("auth_token={token}"))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn given_expired_billing_user_when_disconnecting_then_disconnect_remains_available() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let connection_id = Uuid::new_v4();
    let mut connection = ProviderConnection::new(user_id, "item-plaid");
    connection.id = connection_id;
    connection.provider = "plaid".to_string();
    connection.mark_connected("Plaid Bank");
    let mut mock_db = MockDatabaseRepository::new();

    mock_db.expect_get_billing_entitlement().never();
    mock_db
        .expect_get_provider_connection_by_id()
        .with(
            mockall::predicate::eq(connection_id),
            mockall::predicate::eq(user_id),
        )
        .returning(move |_, _| {
            let connection = connection.clone();
            Box::pin(async move { Ok(Some(connection)) })
        });
    mock_db
        .expect_disconnect_provider_connection_cascade()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok((0, 0)) }));
    mock_db
        .expect_get_all_provider_connections_by_user()
        .with(mockall::predicate::eq(user_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock_db
        .expect_update_user_provider()
        .with(mockall::predicate::eq(user_id), mockall::predicate::eq(""))
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let app = billing_app(mock_db).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/providers/disconnect")
        .header("Cookie", format!("auth_token={token}"))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({"connection_id": connection_id.to_string()})).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_ne!(response.status(), 402);
}

#[tokio::test]
async fn given_expired_billing_user_when_starting_auto_categorize_then_returns_paid_access_required(
) {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let mut mock_db = MockDatabaseRepository::new();

    mock_db
        .expect_get_billing_entitlement()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let entitlement = entitlement(user_id, "expired");
            Box::pin(async move { Ok(Some(entitlement)) })
        });

    let app = billing_app(mock_db).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/transactions/auto-categorize")
        .header("Cookie", format!("auth_token={token}"))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 402);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload["code"], json!("PAID_ACCESS_REQUIRED"));
}

#[tokio::test]
async fn given_billing_disabled_when_creating_budget_then_preserves_existing_behavior() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let mut mock_db = MockDatabaseRepository::new();

    mock_db
        .expect_get_billing_entitlement()
        .with(mockall::predicate::eq(user_id))
        .never();
    mock_db
        .expect_create_budget_for_user()
        .returning(|budget| Box::pin(async move { Ok(budget) }));
    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db_cache_config_and_categorizer(
        mock_db,
        billing_cache(),
        noop_categorizer(),
        disabled_billing_config(),
    )
    .await
    .unwrap();

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/budgets")
        .header("Cookie", format!("auth_token={token}"))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({"category": "groceries", "amount": "500.00"})).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
}
