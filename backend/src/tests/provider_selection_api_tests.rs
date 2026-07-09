use std::sync::Arc;

use axum::body::to_bytes;
use serde_json::json;
use tower::ServiceExt;
use uuid::Uuid;

use crate::config::MockEnvironment;
use crate::models::account::Account;
use crate::models::auth::User;
use crate::models::plaid::ProviderConnection;
use crate::openapi::init_openapi;
use crate::providers::{FinancialDataProvider, MockFinancialDataProvider, ProviderRegistry};
use crate::services::cache_service::MockCacheService;
use crate::services::repository_service::MockDatabaseRepository;
use crate::services::sync_service::SyncService;
use crate::services::{
    analytics_service::AnalyticsService, auth_service::AuthService,
    authorization_service::AuthorizationService, budget_service::BudgetService,
    cache_service::CacheService, category_management::service::CategoryManagementService,
    connection_service::ConnectionService, otel_traces_relay::OtlpTracesRelay,
    plaid_service::PlaidService, plaid_service::RealPlaidClient,
    repository_service::DatabaseRepository, sync_service_factory::SyncServiceFactory,
};
use crate::test_fixtures::{
    apply_passkey_enrollment_mock_defaults, build_credential_resolvers, noop_categorizer,
};
use crate::{create_app, AppState, Config, Router};

fn provider_registry(names: &[&'static str]) -> Arc<ProviderRegistry> {
    let providers = names.iter().map(|name| {
        let mut provider = MockFinancialDataProvider::new();
        provider
            .expect_provider_name()
            .return_const((*name).to_string());
        (*name, Arc::new(provider) as Arc<dyn FinancialDataProvider>)
    });

    Arc::new(ProviderRegistry::from_providers(providers))
}

fn create_auth_cookie_cache() -> MockCacheService {
    let mut mock_cache = MockCacheService::new();

    mock_cache
        .expect_health_check()
        .returning(|| Box::pin(async { Ok(()) }));

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
        .returning(|_, _| Box::pin(async { Ok(1i64) }));

    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));

    mock_cache
        .expect_set_with_ttl()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_set_session_valid()
        .returning(|_, _| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_set_jwt_token()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_invalidate_pattern()
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

fn build_test_config() -> Config {
    let mut env = MockEnvironment::new();
    env.set("AUTH_COOKIE_SAME_SITE", "Lax");
    env.set("APP_ORIGIN", "http://localhost:8080");
    Config::from_env_provider(&env).unwrap()
}

fn build_test_config_with_provider_allowlist(providers: &str) -> Config {
    let mut env = MockEnvironment::new();
    env.set("AUTH_COOKIE_SAME_SITE", "Lax");
    env.set("APP_ORIGIN", "http://localhost:8080");
    env.set("ENABLED_FINANCIAL_PROVIDERS", providers);
    Config::from_env_provider(&env).unwrap()
}

async fn build_test_app(
    mock_db: MockDatabaseRepository,
    provider_registry: Arc<ProviderRegistry>,
) -> Router {
    build_test_app_with_config(mock_db, provider_registry, build_test_config()).await
}

async fn build_test_app_with_config(
    mut mock_db: MockDatabaseRepository,
    provider_registry: Arc<ProviderRegistry>,
    config: Config,
) -> Router {
    apply_passkey_enrollment_mock_defaults(&mut mock_db);
    let plaid_client = Arc::new(RealPlaidClient::new(
        "test_client_id".to_string(),
        "test_secret".to_string(),
        "sandbox".to_string(),
    ));
    let plaid_service = Arc::new(PlaidService::new(plaid_client.clone()));
    let plaid_service_arc = plaid_service.clone();
    let plaid_client_arc = plaid_client.clone();
    let sync_service = Arc::new(SyncService::new(provider_registry.clone()));
    let analytics_service = Arc::new(AnalyticsService::new());

    let db_repository: Arc<dyn DatabaseRepository> = Arc::new(mock_db);
    let cache_service: Arc<dyn CacheService> = Arc::new(create_auth_cookie_cache());
    let credential_resolvers = build_credential_resolvers(db_repository.clone());
    let connection_service = Arc::new(ConnectionService::new(
        db_repository.clone(),
        cache_service.clone(),
        provider_registry.clone(),
        noop_categorizer(),
        credential_resolvers,
    ));
    let sync_service_factory = Arc::new(SyncServiceFactory::new(
        connection_service.clone(),
        sync_service.clone(),
    ));
    let auth_service = Arc::new(
        AuthService::new("test_jwt_secret_key_for_integration_testing".to_string()).unwrap(),
    );
    let budget_service = Arc::new(BudgetService::new());
    let authorization_service = Arc::new(AuthorizationService::new());
    let auto_categorization_service = Arc::new(crate::services::AutoCategorizationService::new(
        db_repository.clone(),
        cache_service.clone(),
        noop_categorizer(),
    ));
    let provider_sync_rate_limit_service = Arc::new(
        crate::services::provider_sync_rate_limit_service::ProviderSyncRateLimitService::new(
            cache_service.clone(),
        ),
    );
    let diy_service = Arc::new(crate::services::diy_service::DiyService::new(
        db_repository.clone(),
        connection_service.clone(),
    ));

    let state = AppState {
        plaid_service: plaid_service_arc,
        plaid_client: plaid_client_arc,
        billing_service: crate::test_fixtures::build_billing_service(
            config.clone(),
            db_repository.clone(),
            crate::test_fixtures::noop_paddle_client(),
        ),
        sync_service,
        sync_service_factory,
        analytics_service,
        budget_service,
        authorization_service,
        config,
        db_repository,
        cache_service,
        provider_sync_rate_limit_service,
        categorizer: noop_categorizer(),
        connection_service,
        auth_service,
        provider_registry,
        otlp_traces_relay: Arc::new(OtlpTracesRelay::bogus_for_tests()),
        category_management_service: Arc::new(CategoryManagementService::new(
            crate::services::categorization::category_descriptors::SYSTEM_CATEGORY_SLUGS,
        )),
        auto_categorization_service,
        webauthn_service: Arc::new(
            crate::services::webauthn_service::WebAuthnService::new(
                "localhost",
                &[url::Url::parse("http://localhost:8080").unwrap()],
            )
            .unwrap(),
        ),
        diy_service,
    };

    create_app(state)
}

#[tokio::test]
async fn given_registering_user_when_creating_account_then_persists_empty_provider() {
    let mut mock_db = MockDatabaseRepository::new();

    mock_db
        .expect_get_user_by_email()
        .returning(|_| Box::pin(async { Ok(None) }));

    let mut mock_cache = create_auth_cookie_cache();
    mock_cache
        .expect_set_webauthn_challenge()
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let app =
        crate::test_fixtures::TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
            .await
            .unwrap();

    let request_body = json!({
        "email": "register@example.com",
        "name": "Register User"
    });

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/auth/register")
        .header("X-Forwarded-For", "203.0.113.50")
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&request_body).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn given_unregistered_provider_when_selecting_then_returns_bad_request() {
    let (user, token) = crate::test_fixtures::TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let mut mock_db = MockDatabaseRepository::new();

    mock_db
        .expect_get_user_by_id()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let user = user.clone();
            Box::pin(async move {
                Ok(Some(User {
                    provider: String::new(),
                    ..user
                }))
            })
        });

    let app = build_test_app(mock_db, provider_registry(&["simplefin"])).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/providers/select")
        .header("Cookie", format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({ "provider": "made-up" })).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 400);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(payload["message"]
        .as_str()
        .unwrap_or_default()
        .contains("not registered"));
}

#[tokio::test]
async fn given_active_connections_when_switching_provider_then_returns_conflict() {
    let (user, token) = crate::test_fixtures::TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let mut mock_db = MockDatabaseRepository::new();
    let mut connection = ProviderConnection::new(user_id, "item-1");
    connection.provider = "teller".to_string();
    connection.mark_connected("Test Bank");

    mock_db
        .expect_get_user_by_id()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let user = User {
                provider: "teller".to_string(),
                ..user.clone()
            };
            Box::pin(async move { Ok(Some(user)) })
        });

    mock_db
        .expect_get_all_provider_connections_by_user()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let connection = connection.clone();
            Box::pin(async move { Ok(vec![connection]) })
        });

    let app = build_test_app(mock_db, provider_registry(&["plaid"])).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/providers/select")
        .header("Cookie", format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({ "provider": "plaid" })).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 409);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(payload["message"]
        .as_str()
        .unwrap_or_default()
        .contains("Disconnect all teller accounts before switching"));
}

#[tokio::test]
async fn given_no_active_connections_when_switching_provider_then_updates_provider() {
    let (user, token) = crate::test_fixtures::TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let mut mock_db = MockDatabaseRepository::new();

    mock_db
        .expect_get_user_by_id()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let user = User {
                provider: "teller".to_string(),
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

    let app = build_test_app(mock_db, provider_registry(&["plaid"])).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/providers/select")
        .header("Cookie", format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({ "provider": "plaid" })).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload["user_provider"], json!("plaid"));
}

#[tokio::test]
async fn given_empty_provider_when_active_connection_exists_for_different_provider_then_returns_conflict(
) {
    let (user, token) = crate::test_fixtures::TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let mut mock_db = MockDatabaseRepository::new();
    let mut connection = ProviderConnection::new(user_id, "item-1");
    connection.provider = "teller".to_string();
    connection.mark_connected("Test Bank");

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
        .returning(move |_| {
            let connection = connection.clone();
            Box::pin(async move { Ok(vec![connection]) })
        });

    let app = build_test_app(mock_db, provider_registry(&["plaid", "teller"])).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/providers/select")
        .header("Cookie", format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({ "provider": "plaid" })).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 409);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(payload["message"]
        .as_str()
        .unwrap_or_default()
        .contains("Disconnect all teller accounts before switching"));
}

#[tokio::test]
async fn given_orphan_connection_when_selecting_different_provider_then_returns_conflict() {
    let (user, token) = crate::test_fixtures::TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let mut mock_db = MockDatabaseRepository::new();
    let mut teller_connection = ProviderConnection::new(user_id, "item-teller");
    teller_connection.provider = "teller".to_string();
    teller_connection.mark_connected("Teller Bank");

    mock_db
        .expect_get_user_by_id()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let user = User {
                provider: "plaid".to_string(),
                ..user.clone()
            };
            Box::pin(async move { Ok(Some(user)) })
        });

    mock_db
        .expect_get_all_provider_connections_by_user()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let teller_connection = teller_connection.clone();
            Box::pin(async move { Ok(vec![teller_connection]) })
        });

    let app = build_test_app(mock_db, provider_registry(&["plaid", "teller"])).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/providers/select")
        .header("Cookie", format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({ "provider": "plaid" })).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 409);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(payload["message"]
        .as_str()
        .unwrap_or_default()
        .contains("Disconnect all teller accounts before switching"));
}

#[tokio::test]
async fn given_simplefin_when_selecting_then_returns_ok() {
    let (user, token) = crate::test_fixtures::TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let mut mock_db = MockDatabaseRepository::new();

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
            mockall::predicate::eq("simplefin"),
        )
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let app = build_test_app(mock_db, provider_registry(&["simplefin"])).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/providers/select")
        .header("Cookie", format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({ "provider": "simplefin" })).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload["user_provider"], json!("simplefin"));
}

#[tokio::test]
async fn given_inactive_provider_account_filter_when_getting_transactions_then_falls_back_to_active_provider(
) {
    let user = User {
        provider: "teller".to_string(),
        ..crate::test_fixtures::TestFixtures::create_authenticated_user_with_token().0
    };
    let (_user, token) =
        crate::test_fixtures::TestFixtures::create_authenticated_user_with_token_for_user(
            user.clone(),
        );
    let user_id = user.id;
    let teller_connection_id = Uuid::new_v4();
    let plaid_connection_id = Uuid::new_v4();
    let teller_account_id = Uuid::new_v4();
    let plaid_account_id = Uuid::new_v4();
    let mut teller_connection = ProviderConnection::new(user_id, "item-teller");
    teller_connection.provider = "teller".to_string();
    let mut plaid_connection = ProviderConnection::new(user_id, "item-plaid");
    plaid_connection.provider = "plaid".to_string();

    let mut mock_db = MockDatabaseRepository::new();

    mock_db
        .expect_get_user_by_id()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let user = user.clone();
            Box::pin(async move { Ok(Some(user)) })
        });

    mock_db.expect_get_accounts_for_user().returning(move |_| {
        let accounts = vec![
            Account {
                id: teller_account_id,
                user_id: Some(user_id),
                provider_account_id: Some("teller_acc_1".to_string()),
                provider_connection_id: Some(teller_connection_id),
                name: "Teller Account".to_string(),
                account_type: "checking".to_string(),
                balance_current: Some(rust_decimal_macros::dec!(1000.00)),
                mask: Some("1111".to_string()),
                institution_name: Some("Teller Bank".to_string()),
                provider_conn_id: None,
            },
            Account {
                id: plaid_account_id,
                user_id: Some(user_id),
                provider_account_id: Some("plaid_acc_1".to_string()),
                provider_connection_id: Some(plaid_connection_id),
                name: "Plaid Account".to_string(),
                account_type: "checking".to_string(),
                balance_current: Some(rust_decimal_macros::dec!(2000.00)),
                mask: Some("2222".to_string()),
                institution_name: Some("Plaid Bank".to_string()),
                provider_conn_id: None,
            },
        ];
        Box::pin(async move { Ok(accounts) })
    });

    mock_db
        .expect_get_all_provider_connections_by_user()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let teller_connection = teller_connection.clone();
            let plaid_connection = plaid_connection.clone();
            Box::pin(async move { Ok(vec![teller_connection, plaid_connection]) })
        });

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_transactions_keyset()
        .returning(|_, _, _, _, _, _, _, _, _| {
            Box::pin(async {
                Ok(crate::models::transaction::CursorTransactionsResponse {
                    transactions: vec![],
                    next_cursor: None,
                    prev_cursor: None,
                    has_more: false,
                })
            })
        });

    let app = build_test_app(mock_db, provider_registry(&["plaid", "teller"])).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::GET)
        .uri(format!("/api/transactions?account_ids={plaid_account_id}"))
        .header("Cookie", format!("auth_token={token}"))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn given_diy_account_filter_when_getting_transactions_then_keeps_diy_scope() {
    let user = User {
        provider: "teller".to_string(),
        ..crate::test_fixtures::TestFixtures::create_authenticated_user_with_token().0
    };
    let (_user, token) =
        crate::test_fixtures::TestFixtures::create_authenticated_user_with_token_for_user(
            user.clone(),
        );
    let user_id = user.id;
    let teller_connection_id = Uuid::new_v4();
    let diy_connection_id = Uuid::new_v4();
    let teller_account_id = Uuid::new_v4();
    let diy_account_id = Uuid::new_v4();
    let mut teller_connection = ProviderConnection::new(user_id, "item-teller");
    teller_connection.id = teller_connection_id;
    teller_connection.provider = "teller".to_string();
    let mut diy_connection = ProviderConnection::new(user_id, "diy_item");
    diy_connection.id = diy_connection_id;
    diy_connection.provider = "diy".to_string();

    let mut mock_db = MockDatabaseRepository::new();

    mock_db
        .expect_get_user_by_id()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let user = user.clone();
            Box::pin(async move { Ok(Some(user)) })
        });

    mock_db.expect_get_accounts_for_user().returning(move |_| {
        use crate::models::account::Account;
        let accounts = vec![
            Account {
                id: teller_account_id,
                user_id: Some(user_id),
                provider_account_id: Some("teller_acc_1".to_string()),
                provider_connection_id: Some(teller_connection_id),
                name: "Teller Account".to_string(),
                account_type: "checking".to_string(),
                balance_current: Some(rust_decimal_macros::dec!(1000.00)),
                mask: Some("1111".to_string()),
                institution_name: Some("Teller Bank".to_string()),
                provider_conn_id: None,
            },
            Account {
                id: diy_account_id,
                user_id: Some(user_id),
                provider_account_id: Some("diy_acc_1".to_string()),
                provider_connection_id: Some(diy_connection_id),
                name: "DIY Account".to_string(),
                account_type: "checking".to_string(),
                balance_current: Some(rust_decimal_macros::dec!(250.00)),
                mask: Some("3333".to_string()),
                institution_name: Some("My Bank".to_string()),
                provider_conn_id: None,
            },
        ];
        Box::pin(async move { Ok(accounts) })
    });

    mock_db
        .expect_get_all_provider_connections_by_user()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let teller_connection = teller_connection.clone();
            let diy_connection = diy_connection.clone();
            Box::pin(async move { Ok(vec![teller_connection, diy_connection]) })
        });

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db.expect_get_transactions_keyset().returning(
        move |_, _, _, _, account_ids, _, _, _, _| {
            assert_eq!(account_ids.map(|ids| ids.len()), Some(1));
            assert_eq!(
                account_ids.and_then(|ids| ids.first().copied()),
                Some(diy_account_id)
            );
            Box::pin(async {
                Ok(crate::models::transaction::CursorTransactionsResponse {
                    transactions: vec![],
                    next_cursor: None,
                    prev_cursor: None,
                    has_more: false,
                })
            })
        },
    );

    let app = build_test_app(mock_db, provider_registry(&["plaid", "teller", "diy"])).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::GET)
        .uri(format!("/api/transactions?account_ids={diy_account_id}"))
        .header("Cookie", format!("auth_token={token}"))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn given_empty_provider_when_fetching_provider_info_then_returns_null_user_provider() {
    let (user, token) = crate::test_fixtures::TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let mut mock_db = MockDatabaseRepository::new();

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

    let app = build_test_app(mock_db, provider_registry(&["simplefin"])).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::GET)
        .uri("/api/providers/info")
        .header("Cookie", format!("auth_token={}", token))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload["user_provider"], serde_json::Value::Null);
    assert_eq!(
        payload["available_providers"],
        json!(vec!["simplefin".to_string()])
    );
}

#[tokio::test]
async fn given_unregistered_stored_provider_when_fetching_provider_info_then_returns_null_user_provider(
) {
    let (user, token) = crate::test_fixtures::TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let mut mock_db = MockDatabaseRepository::new();

    mock_db
        .expect_get_user_by_id()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let user = User {
                provider: "diy".to_string(),
                ..user.clone()
            };
            Box::pin(async move { Ok(Some(user)) })
        });

    let app = build_test_app(mock_db, provider_registry(&["plaid", "teller"])).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::GET)
        .uri("/api/providers/info")
        .header("Cookie", format!("auth_token={}", token))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload["user_provider"], serde_json::Value::Null);
    assert_eq!(
        payload["available_providers"],
        json!(vec!["plaid".to_string()])
    );
}

#[test]
fn given_openapi_when_generating_spec_then_marks_user_provider_nullable() {
    let spec = serde_json::to_value(init_openapi()).unwrap();
    assert_eq!(
        spec["components"]["schemas"]["ProviderInfoResponse"]["properties"]["user_provider"]
            ["type"],
        json!(["string", "null"])
    );
}

#[tokio::test]
async fn given_diy_registered_when_fetching_provider_info_then_lists_diy() {
    let (user, token) = crate::test_fixtures::TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let mut mock_db = MockDatabaseRepository::new();

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

    let app = build_test_app(mock_db, provider_registry(&["simplefin", "diy"])).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::GET)
        .uri("/api/providers/info")
        .header("Cookie", format!("auth_token={}", token))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let available = payload["available_providers"]
        .as_array()
        .expect("available_providers array");
    assert!(
        available.iter().any(|v| v == "diy"),
        "diy should be listed in available_providers"
    );
}

#[tokio::test]
async fn given_provider_allowlist_when_fetching_provider_info_then_filters_registered_providers() {
    let (user, token) = crate::test_fixtures::TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let mut mock_db = MockDatabaseRepository::new();

    mock_db
        .expect_get_user_by_id()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let user = User {
                provider: "simplefin".to_string(),
                ..user.clone()
            };
            Box::pin(async move { Ok(Some(user)) })
        });

    let app = build_test_app_with_config(
        mock_db,
        provider_registry(&["plaid", "teller", "simplefin", "diy"]),
        build_test_config_with_provider_allowlist("diy,plaid"),
    )
    .await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::GET)
        .uri("/api/providers/info")
        .header("Cookie", format!("auth_token={}", token))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        payload["available_providers"],
        json!(vec!["plaid".to_string(), "diy".to_string()])
    );
    assert_eq!(payload["user_provider"], serde_json::Value::Null);
}

#[tokio::test]
async fn given_provider_allowlist_when_selecting_disabled_provider_then_returns_forbidden() {
    let (_user, token) = crate::test_fixtures::TestFixtures::create_authenticated_user_with_token();
    let mock_db = MockDatabaseRepository::new();

    let app = build_test_app_with_config(
        mock_db,
        provider_registry(&["plaid", "simplefin", "diy"]),
        build_test_config_with_provider_allowlist("diy,plaid"),
    )
    .await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/providers/select")
        .header("Cookie", format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({ "provider": "simplefin" })).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 403);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload["code"], json!("PROVIDER_DISABLED"));
}

#[tokio::test]
async fn given_provider_allowlist_when_connecting_disabled_provider_then_returns_forbidden() {
    let (_user, token) = crate::test_fixtures::TestFixtures::create_authenticated_user_with_token();
    let mock_db = MockDatabaseRepository::new();

    let app = build_test_app_with_config(
        mock_db,
        provider_registry(&["plaid", "simplefin", "diy"]),
        build_test_config_with_provider_allowlist("diy,plaid"),
    )
    .await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/providers/connect")
        .header("Cookie", format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({
                "provider": "simplefin",
                "access_token": "unused",
                "enrollment_id": "unused",
                "institution_name": "Unused",
                "simplefin": {
                    "simplefin_setup_token": "setup-token"
                }
            }))
            .unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 403);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload["code"], json!("PROVIDER_DISABLED"));
}

#[tokio::test]
async fn given_provider_allowlist_when_syncing_disabled_provider_then_returns_forbidden() {
    let (user, token) = crate::test_fixtures::TestFixtures::create_authenticated_user_with_token();
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

    let app = build_test_app_with_config(
        mock_db,
        provider_registry(&["plaid", "diy"]),
        build_test_config_with_provider_allowlist("diy"),
    )
    .await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/providers/sync-transactions")
        .header("Cookie", format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({
                "connection_id": connection_id.to_string(),
                "client_date": "2026-07-06",
                "client_timezone": "America/Chicago"
            }))
            .unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 403);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload["code"], json!("PROVIDER_DISABLED"));
}

#[tokio::test]
async fn given_legacy_teller_connection_when_syncing_then_returns_no_longer_supported() {
    let (user, token) = crate::test_fixtures::TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let connection_id = Uuid::new_v4();
    let mut connection = ProviderConnection::new(user_id, "item-teller");
    connection.id = connection_id;
    connection.provider = "teller".to_string();
    connection.mark_connected("Teller Bank");
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

    let app = build_test_app(mock_db, provider_registry(&["plaid", "diy"])).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/providers/sync-transactions")
        .header("Cookie", format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({
                "connection_id": connection_id.to_string(),
                "client_date": "2026-07-06",
                "client_timezone": "America/Chicago"
            }))
            .unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 400);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload["code"], json!("TELLER_NO_LONGER_SUPPORTED"));
}

#[tokio::test]
async fn given_active_aggregator_when_selecting_diy_then_returns_ok() {
    let (user, token) = crate::test_fixtures::TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let mut mock_db = MockDatabaseRepository::new();
    let mut teller_connection = ProviderConnection::new(user_id, "item-teller");
    teller_connection.provider = "teller".to_string();
    teller_connection.mark_connected("Teller Bank");

    mock_db
        .expect_get_user_by_id()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let user = User {
                provider: "teller".to_string(),
                ..user.clone()
            };
            Box::pin(async move { Ok(Some(user)) })
        });

    mock_db
        .expect_get_all_provider_connections_by_user()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let conn = teller_connection.clone();
            Box::pin(async move { Ok(vec![conn]) })
        });

    mock_db
        .expect_update_user_provider()
        .with(
            mockall::predicate::eq(user_id),
            mockall::predicate::eq("diy"),
        )
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let app = build_test_app(mock_db, provider_registry(&["diy"])).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/providers/select")
        .header("Cookie", format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({ "provider": "diy" })).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload["user_provider"], json!("diy"));
}

#[tokio::test]
async fn given_diy_connection_when_selecting_aggregator_then_returns_ok() {
    let (user, token) = crate::test_fixtures::TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let mut mock_db = MockDatabaseRepository::new();
    let mut diy_connection = ProviderConnection::new(user_id, "diy_item-1");
    diy_connection.provider = "diy".to_string();
    diy_connection.mark_connected("My Cash");

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
        .returning(move |_| {
            let conn = diy_connection.clone();
            Box::pin(async move { Ok(vec![conn]) })
        });

    let app = build_test_app(mock_db, provider_registry(&["diy", "plaid"])).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/providers/select")
        .header("Cookie", format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({ "provider": "teller" })).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 400);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload["code"], json!("TELLER_NO_LONGER_SUPPORTED"));
}

#[tokio::test]
async fn given_active_teller_connection_when_selecting_plaid_then_conflict_preserved() {
    let (user, token) = crate::test_fixtures::TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let mut mock_db = MockDatabaseRepository::new();
    let mut teller_connection = ProviderConnection::new(user_id, "item-teller");
    teller_connection.provider = "teller".to_string();
    teller_connection.mark_connected("Teller Bank");

    mock_db
        .expect_get_user_by_id()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let user = User {
                provider: "teller".to_string(),
                ..user.clone()
            };
            Box::pin(async move { Ok(Some(user)) })
        });

    mock_db
        .expect_get_all_provider_connections_by_user()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let conn = teller_connection.clone();
            Box::pin(async move { Ok(vec![conn]) })
        });

    let app = build_test_app(mock_db, provider_registry(&["plaid", "diy"])).await;

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/providers/select")
        .header("Cookie", format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({ "provider": "plaid" })).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 409);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(payload["message"]
        .as_str()
        .unwrap_or_default()
        .contains("Disconnect all teller accounts before switching"));
}
