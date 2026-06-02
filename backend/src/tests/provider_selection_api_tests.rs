use std::sync::Arc;

use anyhow::Result;
use async_trait::async_trait;
use axum::body::to_bytes;
use serde_json::json;
use tower::ServiceExt;
use uuid::Uuid;

use crate::config::MockEnvironment;
use crate::models::account::Account;
use crate::models::auth::User;
use crate::models::plaid::ProviderConnection;
use crate::models::transaction::ProviderTransactionsResult;
use crate::openapi::init_openapi;
use crate::providers::{
    FinancialDataProvider, InstitutionInfo, ProviderCredentials, ProviderRegistry,
};
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

struct MockProvider {
    name: &'static str,
}

#[async_trait]
impl FinancialDataProvider for MockProvider {
    fn provider_name(&self) -> &str {
        self.name
    }

    async fn create_link_token(&self, _user_id: &Uuid) -> Result<String> {
        Ok(format!("{}_link_token", self.name))
    }

    async fn exchange_public_token(&self, _public_token: &str) -> Result<ProviderCredentials> {
        Ok(ProviderCredentials {
            provider: self.name.to_string(),
            access_token: format!("{}_access_token", self.name),
            item_id: format!("{}_item", self.name),
            certificate: None,
            private_key: None,
        })
    }

    async fn get_accounts(&self, _credentials: &ProviderCredentials) -> Result<Vec<Account>> {
        Ok(vec![])
    }

    async fn get_transactions(
        &self,
        _credentials: &ProviderCredentials,
        _start_date: chrono::NaiveDate,
        _end_date: chrono::NaiveDate,
    ) -> Result<ProviderTransactionsResult> {
        Ok(ProviderTransactionsResult {
            transactions: vec![],
            page_count: 0,
        })
    }

    async fn get_institution_info(
        &self,
        _credentials: &ProviderCredentials,
    ) -> Result<InstitutionInfo> {
        Ok(InstitutionInfo {
            institution_id: format!("{}_institution", self.name),
            name: format!("{} Bank", self.name),
            logo: None,
            color: None,
        })
    }
}

fn provider_registry(names: &[&'static str]) -> Arc<ProviderRegistry> {
    let providers = names.iter().map(|name| {
        (
            *name,
            Arc::new(MockProvider { name }) as Arc<dyn FinancialDataProvider>,
        )
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
    env.set("TELLER_ENV", "test");
    env.set("AUTH_COOKIE_SAME_SITE", "Lax");
    env.set("APP_ORIGIN", "http://localhost:8080");
    Config::from_env_provider(&env).unwrap()
}

async fn build_test_app(
    mut mock_db: MockDatabaseRepository,
    provider_registry: Arc<ProviderRegistry>,
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

    let state = AppState {
        plaid_service: plaid_service_arc,
        plaid_client: plaid_client_arc,
        sync_service,
        sync_service_factory,
        analytics_service,
        budget_service,
        authorization_service,
        config: build_test_config(),
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

#[test]
fn given_openapi_when_generating_spec_then_marks_user_provider_nullable() {
    let spec = serde_json::to_value(init_openapi()).unwrap();
    assert_eq!(
        spec["components"]["schemas"]["ProviderInfoResponse"]["properties"]["user_provider"]
            ["type"],
        json!(["string", "null"])
    );
}
