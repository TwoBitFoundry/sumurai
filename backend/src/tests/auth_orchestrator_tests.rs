use std::sync::Arc;

use anyhow::anyhow;
use chrono::Utc;
use uuid::Uuid;

use crate::models::auth::User;
use crate::models::domain_error::DomainError;
use crate::models::plaid::ProviderConnection;
use crate::providers::ProviderRegistry;
use crate::services::auth_orchestrator::AuthOrchestrator;
use crate::services::cache_service::{CacheService, MockCacheService};
use crate::services::repository_service::{DatabaseRepository, MockDatabaseRepository};
use crate::services::{AuthService, ConnectionService};
use crate::test_fixtures::{build_credential_resolvers, noop_categorizer};

const SECRET: &str = "this_is_a_very_long_secret_key_for_jwt_auth_service_testing_12345";

fn auth_service() -> Arc<AuthService> {
    Arc::new(AuthService::new(SECRET.to_string()).unwrap())
}

fn orchestrator(repository: MockDatabaseRepository, cache: MockCacheService) -> AuthOrchestrator {
    let db: Arc<dyn DatabaseRepository> = Arc::new(repository);
    let cache: Arc<dyn CacheService> = Arc::new(cache);
    let connection_service = Arc::new(ConnectionService::new(
        db.clone(),
        cache.clone(),
        Arc::new(ProviderRegistry::new()),
        noop_categorizer(),
        build_credential_resolvers(db.clone()),
    ));
    AuthOrchestrator::new(auth_service(), db, cache, connection_service)
}

fn user_with_password(password: Option<&str>) -> User {
    User {
        id: Uuid::new_v4(),
        email: "person@example.com".to_string(),
        password_hash: password.map(|value| auth_service().hash_password(value).unwrap()),
        provider: String::new(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        onboarding_completed: true,
        demo_mode_active: false,
    }
}

fn repository_returning_user(user: Option<User>) -> MockDatabaseRepository {
    let mut repository = MockDatabaseRepository::new();
    repository.expect_get_user_by_email().returning(move |_| {
        let user = user.clone();
        Box::pin(async move { Ok(user) })
    });
    repository
        .expect_list_webauthn_credentials_for_user()
        .returning(|_| Box::pin(async { Ok(Vec::new()) }));
    repository
}

fn session_caching() -> MockCacheService {
    let mut cache = MockCacheService::new();
    cache
        .expect_set_session_valid()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));
    cache
        .expect_set_jwt_token()
        .times(1)
        .returning(|_, _, _| Box::pin(async { Ok(()) }));
    cache
}

#[tokio::test]
async fn given_valid_password_when_logging_in_then_returns_session_and_caches_it() {
    let user = user_with_password(Some("correct horse"));
    let user_id = user.id;

    let session = orchestrator(repository_returning_user(Some(user)), session_caching())
        .login_with_password("person@example.com", "correct horse")
        .await
        .ok()
        .unwrap();

    assert_eq!(session.user_id, user_id.to_string());
    assert_eq!(session.email, "person@example.com");
    assert!(session.onboarding_completed);
    assert!(!session.demo_mode_active);
    assert!(!session.auth_token.token.is_empty());
}

#[tokio::test]
async fn given_unknown_email_when_logging_in_then_reports_invalid_credentials() {
    let result = orchestrator(repository_returning_user(None), MockCacheService::new())
        .login_with_password("nobody@example.com", "whatever")
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::unauthorized("Invalid email or password").with_code("AUTH_REQUIRED"))
    );
}

#[tokio::test]
async fn given_wrong_password_when_logging_in_then_reports_invalid_credentials() {
    let user = user_with_password(Some("correct horse"));

    let result = orchestrator(
        repository_returning_user(Some(user)),
        MockCacheService::new(),
    )
    .login_with_password("person@example.com", "battery staple")
    .await;

    assert_eq!(
        result.err(),
        Some(DomainError::unauthorized("Invalid email or password").with_code("AUTH_REQUIRED"))
    );
}

#[tokio::test]
async fn given_user_without_password_hash_when_logging_in_then_reports_invalid_credentials() {
    let user = user_with_password(None);

    let result = orchestrator(
        repository_returning_user(Some(user)),
        MockCacheService::new(),
    )
    .login_with_password("person@example.com", "anything")
    .await;

    assert_eq!(
        result.err(),
        Some(DomainError::unauthorized("Invalid email or password").with_code("AUTH_REQUIRED"))
    );
}

#[tokio::test]
async fn given_user_lookup_failure_when_logging_in_then_reports_service_error() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_user_by_email()
        .returning(|_| Box::pin(async { Err(anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .login_with_password("person@example.com", "anything")
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::internal("Authentication service error"))
    );
}

#[tokio::test]
async fn given_passkey_listing_failure_when_logging_in_then_reports_service_error() {
    let user = user_with_password(Some("correct horse"));
    let mut repository = MockDatabaseRepository::new();
    repository.expect_get_user_by_email().returning(move |_| {
        let user = user.clone();
        Box::pin(async move { Ok(Some(user)) })
    });
    repository
        .expect_list_webauthn_credentials_for_user()
        .returning(|_| Box::pin(async { Err(anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .login_with_password("person@example.com", "correct horse")
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::internal("Authentication service error"))
    );
}

#[tokio::test]
async fn given_cache_write_failures_when_logging_in_then_still_returns_session() {
    let user = user_with_password(Some("correct horse"));
    let mut cache = MockCacheService::new();
    cache
        .expect_set_session_valid()
        .returning(|_, _| Box::pin(async { Err(anyhow!("redis down")) }));
    cache
        .expect_set_jwt_token()
        .returning(|_, _, _| Box::pin(async { Err(anyhow!("redis down")) }));

    let result = orchestrator(repository_returning_user(Some(user)), cache)
        .login_with_password("person@example.com", "correct horse")
        .await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn given_valid_token_when_logging_out_then_clears_session_state() {
    let token = auth_service().generate_token(Uuid::new_v4()).unwrap();
    let jwt_id = token.jwt_id.clone();

    let mut cache = MockCacheService::new();
    cache
        .expect_invalidate_session()
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));
    cache
        .expect_clear_jwt_scoped_data()
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));
    cache
        .expect_clear_transactions()
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let cleared = orchestrator(MockDatabaseRepository::new(), cache)
        .logout(&token.token)
        .await;

    assert_eq!(cleared, Ok(jwt_id));
}

#[tokio::test]
async fn given_cache_failures_when_logging_out_then_still_succeeds() {
    let token = auth_service().generate_token(Uuid::new_v4()).unwrap();

    let mut cache = MockCacheService::new();
    cache
        .expect_invalidate_session()
        .returning(|_| Box::pin(async { Err(anyhow!("redis down")) }));
    cache
        .expect_clear_jwt_scoped_data()
        .returning(|_| Box::pin(async { Err(anyhow!("redis down")) }));
    cache
        .expect_clear_transactions()
        .returning(|_| Box::pin(async { Err(anyhow!("redis down")) }));

    let result = orchestrator(MockDatabaseRepository::new(), cache)
        .logout(&token.token)
        .await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn given_invalid_token_when_logging_out_then_reports_unauthorized() {
    let result = orchestrator(MockDatabaseRepository::new(), MockCacheService::new())
        .logout("not-a-token")
        .await;

    assert_eq!(
        result,
        Err(DomainError::unauthorized("Authentication required").with_code("AUTH_REQUIRED"))
    );
}

#[tokio::test]
async fn given_invalid_token_when_refreshing_then_reports_unauthorized() {
    let result = orchestrator(MockDatabaseRepository::new(), MockCacheService::new())
        .refresh_session("not-a-token")
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::unauthorized("Authentication required").with_code("AUTH_REQUIRED"))
    );
}

#[tokio::test]
async fn given_missing_cached_session_when_refreshing_then_reports_unauthorized() {
    let token = auth_service().generate_token(Uuid::new_v4()).unwrap();
    let mut cache = MockCacheService::new();
    cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(false) }));

    let result = orchestrator(MockDatabaseRepository::new(), cache)
        .refresh_session(&token.token)
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::unauthorized("Authentication required").with_code("AUTH_REQUIRED"))
    );
}

#[tokio::test]
async fn given_session_cache_failure_when_refreshing_then_reports_session_check_failed() {
    let token = auth_service().generate_token(Uuid::new_v4()).unwrap();
    let mut cache = MockCacheService::new();
    cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Err(anyhow!("redis down")) }));

    let result = orchestrator(MockDatabaseRepository::new(), cache)
        .refresh_session(&token.token)
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::internal("Authentication service error"))
    );
}

#[tokio::test]
async fn given_deleted_user_when_refreshing_then_reports_unauthorized() {
    let token = auth_service().generate_token(Uuid::new_v4()).unwrap();
    let mut cache = MockCacheService::new();
    cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_user_by_id()
        .returning(|_| Box::pin(async { Ok(None) }));

    let result = orchestrator(repository, cache)
        .refresh_session(&token.token)
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::unauthorized("Authentication required").with_code("AUTH_REQUIRED"))
    );
}

#[tokio::test]
async fn given_user_lookup_failure_when_refreshing_then_reports_user_lookup_failed() {
    let token = auth_service().generate_token(Uuid::new_v4()).unwrap();
    let mut cache = MockCacheService::new();
    cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_user_by_id()
        .returning(|_| Box::pin(async { Err(anyhow!("db down")) }));

    let result = orchestrator(repository, cache)
        .refresh_session(&token.token)
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::internal("Authentication service error"))
    );
}

#[tokio::test]
async fn given_live_session_when_refreshing_then_issues_new_token_and_caches_it() {
    let user = user_with_password(None);
    let old_token = auth_service().generate_token(user.id).unwrap();
    let user_id = user.id;

    let mut cache = session_caching();
    cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    let mut repository = MockDatabaseRepository::new();
    repository.expect_get_user_by_id().returning(move |_| {
        let user = user.clone();
        Box::pin(async move { Ok(Some(user)) })
    });

    let session = orchestrator(repository, cache)
        .refresh_session(&old_token.token)
        .await
        .ok()
        .unwrap();

    assert_eq!(session.user_id, user_id.to_string());
    assert_eq!(session.email, "person@example.com");
    assert!(!session.requires_passkey_enrollment);
    assert_ne!(session.auth_token.jwt_id, old_token.jwt_id);
}

#[tokio::test]
async fn given_repository_success_when_completing_onboarding_then_returns_completed_response() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_mark_onboarding_complete()
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let response = orchestrator(repository, MockCacheService::new())
        .complete_onboarding(Uuid::new_v4())
        .await
        .unwrap();

    assert_eq!(response.message, "Onboarding completed successfully");
    assert!(response.onboarding_completed);
    assert!(!response.demo_mode_active);
}

#[tokio::test]
async fn given_repository_failure_when_completing_onboarding_then_reports_update_failed() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_mark_onboarding_complete()
        .returning(|_| Box::pin(async { Err(anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .complete_onboarding(Uuid::new_v4())
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::internal("Failed to update onboarding status"))
    );
}

#[tokio::test]
async fn given_missing_user_when_activating_demo_mode_then_reports_user_load_failed() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_user_by_id()
        .returning(|_| Box::pin(async { Ok(None) }));

    let result = orchestrator(repository, MockCacheService::new())
        .activate_demo_mode(Uuid::new_v4())
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::internal("Failed to load user"))
    );
}

#[tokio::test]
async fn given_user_lookup_failure_when_activating_demo_mode_then_reports_user_load_failed() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_user_by_id()
        .returning(|_| Box::pin(async { Err(anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .activate_demo_mode(Uuid::new_v4())
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::internal("Failed to load user"))
    );
}

#[tokio::test]
async fn given_connection_listing_failure_when_deleting_account_then_reports_load_connections_failed(
) {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Err(anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .delete_account(Uuid::new_v4(), "jwt")
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::internal("Failed to retrieve user connections"))
    );
}

#[tokio::test]
async fn given_budget_listing_failure_when_deleting_account_then_reports_load_budgets_failed() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(Vec::new()) }));
    repository
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Err(anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .delete_account(Uuid::new_v4(), "jwt")
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::internal("Failed to retrieve user budgets"))
    );
}

#[tokio::test]
async fn given_user_deletion_failure_when_deleting_account_then_reports_delete_failed() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(Vec::new()) }));
    repository
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(Vec::new()) }));
    repository
        .expect_delete_user()
        .returning(|_| Box::pin(async { Err(anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .delete_account(Uuid::new_v4(), "jwt")
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::internal("Failed to delete user account"))
    );
}

#[tokio::test]
async fn given_unreachable_connection_when_deleting_account_then_still_deletes_user_and_invalidates_cache(
) {
    let user_id = Uuid::new_v4();
    let connection = ProviderConnection::new(user_id, "item-1");

    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_all_provider_connections_by_user()
        .returning(move |_| {
            let connection = connection.clone();
            Box::pin(async move { Ok(vec![connection]) })
        });
    repository
        .expect_get_provider_connection_by_id()
        .returning(|_, _| Box::pin(async { Err(anyhow!("db down")) }));
    repository
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(Vec::new()) }));
    repository
        .expect_delete_user()
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));
    let mut cache = MockCacheService::new();
    cache
        .expect_invalidate_pattern()
        .withf(|pattern| pattern == "jwt-1_*")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let response = orchestrator(repository, cache)
        .delete_account(user_id, "jwt-1")
        .await
        .unwrap();

    assert_eq!(response.message, "Account deleted successfully");
    assert_eq!(response.deleted_items.connections, 0);
    assert_eq!(response.deleted_items.budgets, 0);
}

#[cfg(feature = "dev-seed")]
#[tokio::test]
async fn given_new_email_when_registering_with_password_then_creates_user_and_session() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_user_by_email()
        .returning(|_| Box::pin(async { Ok(None) }));
    repository
        .expect_create_user()
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let session = orchestrator(repository, session_caching())
        .register_with_password("new@example.com".to_string(), "hunter2hunter2".to_string())
        .await
        .ok()
        .unwrap();

    assert_eq!(session.email, "new@example.com");
    assert!(!session.onboarding_completed);
    assert!(session.demo_mode_active);
    assert!(!session.requires_passkey_enrollment);
}

#[cfg(feature = "dev-seed")]
#[tokio::test]
async fn given_existing_email_when_registering_with_password_then_reports_already_registered() {
    let mut repository = MockDatabaseRepository::new();
    let existing = user_with_password(None);
    repository.expect_get_user_by_email().returning(move |_| {
        let existing = existing.clone();
        Box::pin(async move { Ok(Some(existing)) })
    });

    let result = orchestrator(repository, MockCacheService::new())
        .register_with_password("new@example.com".to_string(), "hunter2hunter2".to_string())
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::conflict("Email address is already registered"))
    );
}

#[cfg(feature = "dev-seed")]
#[tokio::test]
async fn given_user_creation_failure_when_registering_with_password_then_reports_already_registered(
) {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_user_by_email()
        .returning(|_| Box::pin(async { Ok(None) }));
    repository
        .expect_create_user()
        .returning(|_| Box::pin(async { Err(anyhow!("duplicate")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .register_with_password("new@example.com".to_string(), "hunter2hunter2".to_string())
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::conflict("Email address is already registered"))
    );
}
