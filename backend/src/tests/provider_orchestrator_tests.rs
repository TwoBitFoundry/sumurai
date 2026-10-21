use std::sync::Arc;

use anyhow::anyhow;
use chrono::{NaiveDate, Utc};
use mockall::predicate::eq;
use uuid::Uuid;

use crate::config::{Config, MockEnvironment};
use crate::models::auth::User;
use crate::models::plaid::ProviderConnection;
use crate::models::provider_connect::{ProviderConnectRequest, ProviderSyncRequest};
use crate::models::simplefin::SimpleFinIgnoredInstitution;
use crate::providers::{FinancialDataProvider, MockFinancialDataProvider, ProviderRegistry};
use crate::services::cache_service::{CacheService, MockCacheService};
use crate::services::connection_service::{ConnectionService, ProviderSyncError};
use crate::services::provider_orchestrator::{
    ProviderAvailability, ProviderOrchestrationError, ProviderOrchestrator, SyncDependencies,
};
use crate::services::provider_sync_rate_limit_service::ProviderSyncRateLimitService;
use crate::services::repository_service::{DatabaseRepository, MockDatabaseRepository};
use crate::services::sync_service::SyncService;
use crate::test_fixtures::{build_credential_resolvers, noop_categorizer};

fn config(allowlist: Option<&str>) -> Config {
    let mut env = MockEnvironment::new();
    env.set("AUTH_COOKIE_SAME_SITE", "Lax");
    env.set("APP_ORIGIN", "http://localhost:8080");
    if let Some(allowlist) = allowlist {
        env.set("ENABLED_FINANCIAL_PROVIDERS", allowlist);
    }
    Config::from_env_provider(&env).unwrap()
}

fn registry(names: &[&'static str]) -> ProviderRegistry {
    let providers = names.iter().map(|name| {
        let mut provider = MockFinancialDataProvider::new();
        provider
            .expect_provider_name()
            .return_const((*name).to_string());
        let supports_sync = matches!(*name, "plaid" | "simplefin");
        provider
            .expect_supports_transaction_sync()
            .return_const(supports_sync);
        (*name, Arc::new(provider) as Arc<dyn FinancialDataProvider>)
    });
    ProviderRegistry::from_providers(providers)
}

struct Fixture {
    repository: MockDatabaseRepository,
    cache: MockCacheService,
    quota_cache: MockCacheService,
    registry: ProviderRegistry,
    config: Config,
}

impl Fixture {
    fn new() -> Self {
        Self {
            repository: MockDatabaseRepository::new(),
            cache: MockCacheService::new(),
            quota_cache: MockCacheService::new(),
            registry: registry(&["plaid", "simplefin", "diy"]),
            config: config(None),
        }
    }

    fn build(self) -> ProviderOrchestrator {
        let db: Arc<dyn DatabaseRepository> = Arc::new(self.repository);
        let cache: Arc<dyn CacheService> = Arc::new(self.cache);
        let quota_cache: Arc<dyn CacheService> = Arc::new(self.quota_cache);
        let registry = Arc::new(self.registry);
        let connection_service = Arc::new(ConnectionService::new(
            db.clone(),
            cache.clone(),
            registry.clone(),
            noop_categorizer(),
            build_credential_resolvers(db.clone()),
        ));
        let sync_service = Arc::new(SyncService::new(registry.clone()));
        ProviderOrchestrator::new(
            connection_service,
            db,
            cache,
            SyncDependencies {
                rate_limit_service: Arc::new(ProviderSyncRateLimitService::new(quota_cache)),
                sync_service,
            },
            ProviderAvailability {
                registry,
                config: self.config,
            },
        )
    }
}

fn user(id: Uuid, provider: &str) -> User {
    User {
        id,
        email: "user@example.com".to_string(),
        password_hash: None,
        provider: provider.to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        onboarding_completed: true,
        demo_mode_active: false,
    }
}

fn connection(user_id: Uuid, provider: &str, connected: bool) -> ProviderConnection {
    let mut connection = ProviderConnection::new(user_id, &format!("item-{provider}"));
    connection.provider = provider.to_string();
    if connected {
        connection.mark_connected("Test Bank");
    }
    connection
}

fn sync_request(client_timezone: &str) -> ProviderSyncRequest {
    ProviderSyncRequest {
        client_date: "2024-01-15".to_string(),
        client_timezone: client_timezone.to_string(),
        reference_date: NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
    }
}

fn expect_user(repository: &mut MockDatabaseRepository, user: User) {
    repository.expect_get_user_by_id().returning(move |_| {
        let user = user.clone();
        Box::pin(async move { Ok(Some(user)) })
    });
}

fn expect_connections(
    repository: &mut MockDatabaseRepository,
    connections: Vec<ProviderConnection>,
) {
    repository
        .expect_get_all_provider_connections_by_user()
        .returning(move |_| {
            let connections = connections.clone();
            Box::pin(async move { Ok(connections) })
        });
}

fn expect_quota_allowed(cache: &mut MockCacheService) {
    cache
        .expect_get_counter()
        .returning(|_| Box::pin(async { Ok(None) }));
    cache
        .expect_increment_counter()
        .returning(|_, _| Box::pin(async { Ok(1) }));
}

#[tokio::test]
async fn given_exhausted_quota_when_syncing_then_reports_quota_limited_with_retry_after() {
    let mut fixture = Fixture::new();
    fixture
        .quota_cache
        .expect_get_counter()
        .returning(|_| Box::pin(async { Ok(Some(i64::MAX)) }));
    let user_id = Uuid::new_v4();

    let result = fixture
        .build()
        .sync_transactions(
            user_id,
            "jwt",
            connection(user_id, "plaid", true),
            sync_request("UTC"),
        )
        .await;

    assert!(matches!(
        result,
        Err(ProviderOrchestrationError::SyncQuotaLimited { retry_after_secs }) if retry_after_secs >= 1
    ));
}

#[tokio::test]
async fn given_invalid_timezone_when_syncing_then_reports_invalid_client_input() {
    let fixture = Fixture::new();
    let user_id = Uuid::new_v4();

    let result = fixture
        .build()
        .sync_transactions(
            user_id,
            "jwt",
            connection(user_id, "plaid", true),
            sync_request("Not/AZone"),
        )
        .await;

    assert!(matches!(
        result,
        Err(ProviderOrchestrationError::InvalidSyncClientInput)
    ));
}

#[tokio::test]
async fn given_quota_cache_failure_when_syncing_then_reports_quota_check_failed() {
    let mut fixture = Fixture::new();
    fixture
        .quota_cache
        .expect_get_counter()
        .returning(|_| Box::pin(async { Err(anyhow!("redis down")) }));
    let user_id = Uuid::new_v4();

    let result = fixture
        .build()
        .sync_transactions(
            user_id,
            "jwt",
            connection(user_id, "plaid", true),
            sync_request("UTC"),
        )
        .await;

    assert!(matches!(
        result,
        Err(ProviderOrchestrationError::SyncQuotaCheckFailed)
    ));
}

#[tokio::test]
async fn given_provider_without_sync_support_when_syncing_then_reports_unsupported_provider() {
    let mut fixture = Fixture::new();
    expect_quota_allowed(&mut fixture.quota_cache);
    let user_id = Uuid::new_v4();

    let result = fixture
        .build()
        .sync_transactions(
            user_id,
            "jwt",
            connection(user_id, "diy", true),
            sync_request("UTC"),
        )
        .await;

    assert!(matches!(
        result,
        Err(ProviderOrchestrationError::UnsupportedSyncProvider)
    ));
}

#[tokio::test]
async fn given_missing_credentials_when_syncing_then_reports_sync_failed_with_item_context() {
    let mut fixture = Fixture::new();
    expect_quota_allowed(&mut fixture.quota_cache);
    fixture
        .repository
        .expect_get_provider_credentials_for_user()
        .returning(|_, _| Box::pin(async { Ok(None) }));
    let user_id = Uuid::new_v4();

    let result = fixture
        .build()
        .sync_transactions(
            user_id,
            "jwt",
            connection(user_id, "plaid", true),
            sync_request("UTC"),
        )
        .await;

    match result {
        Err(ProviderOrchestrationError::SyncFailed {
            error,
            user_id: failed_user,
            item_id,
        }) => {
            assert!(matches!(error, ProviderSyncError::CredentialsMissing));
            assert_eq!(failed_user, user_id);
            assert_eq!(item_id, "item-plaid");
        }
        other => panic!("unexpected result: {:?}", other.map(|_| ())),
    }
}

fn connect_request(provider: &str) -> ProviderConnectRequest {
    ProviderConnectRequest {
        provider: provider.to_string(),
        access_token: String::new(),
        enrollment_id: String::new(),
        institution_name: None,
        simplefin: Default::default(),
    }
}

#[tokio::test]
async fn given_unknown_provider_when_connecting_then_reports_unsupported_provider() {
    let result = Fixture::new()
        .build()
        .connect(Uuid::new_v4(), "jwt", &connect_request("plaid"))
        .await;

    assert!(matches!(
        result,
        Err(ProviderOrchestrationError::UnsupportedConnectProvider)
    ));
}

#[tokio::test]
async fn given_connected_and_disconnected_connections_when_reading_status_then_lists_connected_only(
) {
    let user_id = Uuid::new_v4();
    let mut fixture = Fixture::new();
    expect_user(&mut fixture.repository, user(user_id, "plaid"));
    expect_connections(
        &mut fixture.repository,
        vec![
            connection(user_id, "plaid", true),
            connection(user_id, "simplefin", false),
        ],
    );

    let status = fixture.build().status(user_id).await.unwrap();

    assert_eq!(status.provider, "plaid");
    assert_eq!(status.connections.len(), 1);
    assert_eq!(status.connections[0].provider, "plaid");
    assert!(status.connections[0].is_connected);
    assert!(!status.connections[0].sync_in_progress);
}

#[tokio::test]
async fn given_disabled_user_provider_when_reading_status_then_returns_empty_provider() {
    let user_id = Uuid::new_v4();
    let mut fixture = Fixture::new();
    fixture.config = config(Some("simplefin"));
    expect_user(&mut fixture.repository, user(user_id, "plaid"));
    expect_connections(&mut fixture.repository, vec![]);

    let status = fixture.build().status(user_id).await.unwrap();

    assert_eq!(status.provider, "");
}

#[tokio::test]
async fn given_missing_user_when_reading_status_then_returns_empty_provider() {
    let mut fixture = Fixture::new();
    fixture
        .repository
        .expect_get_user_by_id()
        .returning(|_| Box::pin(async { Ok(None) }));
    expect_connections(&mut fixture.repository, vec![]);

    let status = fixture.build().status(Uuid::new_v4()).await.unwrap();

    assert_eq!(status.provider, "");
    assert!(status.connections.is_empty());
}

#[tokio::test]
async fn given_user_lookup_failure_when_reading_status_then_reports_load_user_failed() {
    let mut fixture = Fixture::new();
    fixture
        .repository
        .expect_get_user_by_id()
        .returning(|_| Box::pin(async { Err(anyhow!("db down")) }));

    let result = fixture.build().status(Uuid::new_v4()).await;

    assert!(matches!(
        result,
        Err(ProviderOrchestrationError::LoadUserFailed)
    ));
}

#[tokio::test]
async fn given_connection_lookup_failure_when_reading_status_then_reports_load_connections_failed()
{
    let user_id = Uuid::new_v4();
    let mut fixture = Fixture::new();
    expect_user(&mut fixture.repository, user(user_id, "plaid"));
    fixture
        .repository
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Err(anyhow!("db down")) }));

    let result = fixture.build().status(user_id).await;

    assert!(matches!(
        result,
        Err(ProviderOrchestrationError::LoadConnectionsFailed)
    ));
}

#[tokio::test]
async fn given_allowlist_when_reading_info_then_lists_registered_enabled_providers() {
    let user_id = Uuid::new_v4();
    let mut fixture = Fixture::new();
    fixture.registry = registry(&["plaid", "simplefin"]);
    fixture.config = config(Some("simplefin,diy"));
    expect_user(&mut fixture.repository, user(user_id, "simplefin"));

    let info = fixture.build().info(user_id).await.unwrap();

    assert_eq!(info.available_providers, vec!["simplefin".to_string()]);
    assert_eq!(info.user_provider.as_deref(), Some("simplefin"));
}

#[tokio::test]
async fn given_unavailable_user_provider_when_reading_info_then_user_provider_is_none() {
    let user_id = Uuid::new_v4();
    let mut fixture = Fixture::new();
    fixture.config = config(Some("simplefin"));
    expect_user(&mut fixture.repository, user(user_id, "plaid"));

    let info = fixture.build().info(user_id).await.unwrap();

    assert_eq!(info.user_provider, None);
}

#[tokio::test]
async fn given_missing_user_when_reading_info_then_reports_user_not_found() {
    let mut fixture = Fixture::new();
    fixture
        .repository
        .expect_get_user_by_id()
        .returning(|_| Box::pin(async { Ok(None) }));

    let result = fixture.build().info(Uuid::new_v4()).await;

    assert!(matches!(
        result,
        Err(ProviderOrchestrationError::UserNotFound)
    ));
}

#[tokio::test]
async fn given_user_lookup_failure_when_reading_info_then_reports_load_user_failed() {
    let mut fixture = Fixture::new();
    fixture
        .repository
        .expect_get_user_by_id()
        .returning(|_| Box::pin(async { Err(anyhow!("db down")) }));

    let result = fixture.build().info(Uuid::new_v4()).await;

    assert!(matches!(
        result,
        Err(ProviderOrchestrationError::LoadUserFailed)
    ));
}

#[tokio::test]
async fn given_unregistered_provider_when_selecting_then_reports_not_registered() {
    let mut fixture = Fixture::new();
    fixture.registry = registry(&["plaid"]);

    let result = fixture
        .build()
        .select(Uuid::new_v4(), "simplefin".to_string())
        .await;

    assert!(matches!(
        result,
        Err(ProviderOrchestrationError::ProviderNotRegistered(provider)) if provider == "simplefin"
    ));
}

#[tokio::test]
async fn given_disabled_provider_when_selecting_then_reports_provider_disabled() {
    let mut fixture = Fixture::new();
    fixture.config = config(Some("plaid"));

    let result = fixture
        .build()
        .select(Uuid::new_v4(), "simplefin".to_string())
        .await;

    assert!(matches!(
        result,
        Err(ProviderOrchestrationError::ProviderDisabled(provider)) if provider == "simplefin"
    ));
}

#[tokio::test]
async fn given_missing_user_when_selecting_then_reports_selection_user_missing() {
    let mut fixture = Fixture::new();
    fixture
        .repository
        .expect_get_user_by_id()
        .returning(|_| Box::pin(async { Ok(None) }));

    let result = fixture
        .build()
        .select(Uuid::new_v4(), "plaid".to_string())
        .await;

    assert!(matches!(
        result,
        Err(ProviderOrchestrationError::SelectionUserMissing)
    ));
}

#[tokio::test]
async fn given_user_lookup_failure_when_selecting_then_reports_load_user_failed() {
    let mut fixture = Fixture::new();
    fixture
        .repository
        .expect_get_user_by_id()
        .returning(|_| Box::pin(async { Err(anyhow!("db down")) }));

    let result = fixture
        .build()
        .select(Uuid::new_v4(), "plaid".to_string())
        .await;

    assert!(matches!(
        result,
        Err(ProviderOrchestrationError::LoadUserFailed)
    ));
}

#[tokio::test]
async fn given_connection_lookup_failure_when_selecting_then_reports_load_connections_failed() {
    let user_id = Uuid::new_v4();
    let mut fixture = Fixture::new();
    expect_user(&mut fixture.repository, user(user_id, ""));
    fixture
        .repository
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Err(anyhow!("db down")) }));

    let result = fixture.build().select(user_id, "plaid".to_string()).await;

    assert!(matches!(
        result,
        Err(ProviderOrchestrationError::LoadConnectionsFailed)
    ));
}

#[tokio::test]
async fn given_active_connection_on_other_provider_when_selecting_then_reports_conflict() {
    let user_id = Uuid::new_v4();
    let mut fixture = Fixture::new();
    expect_user(&mut fixture.repository, user(user_id, "plaid"));
    expect_connections(
        &mut fixture.repository,
        vec![connection(user_id, "plaid", true)],
    );

    let result = fixture
        .build()
        .select(user_id, "simplefin".to_string())
        .await;

    assert!(matches!(
        result,
        Err(ProviderOrchestrationError::ActiveConnectionConflict { conflicting_provider })
            if conflicting_provider == "plaid"
    ));
}

#[tokio::test]
async fn given_active_connection_when_selecting_diy_then_updates_provider() {
    let user_id = Uuid::new_v4();
    let mut fixture = Fixture::new();
    expect_user(&mut fixture.repository, user(user_id, "plaid"));
    expect_connections(
        &mut fixture.repository,
        vec![connection(user_id, "plaid", true)],
    );
    fixture
        .repository
        .expect_update_user_provider()
        .with(eq(user_id), eq("diy"))
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let response = fixture
        .build()
        .select(user_id, "diy".to_string())
        .await
        .unwrap();

    assert_eq!(response.user_provider, "diy");
}

#[tokio::test]
async fn given_only_diy_connection_when_selecting_other_provider_then_updates_provider() {
    let user_id = Uuid::new_v4();
    let mut fixture = Fixture::new();
    expect_user(&mut fixture.repository, user(user_id, "diy"));
    expect_connections(
        &mut fixture.repository,
        vec![connection(user_id, "diy", true)],
    );
    fixture
        .repository
        .expect_update_user_provider()
        .with(eq(user_id), eq("simplefin"))
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let response = fixture
        .build()
        .select(user_id, "simplefin".to_string())
        .await
        .unwrap();

    assert_eq!(response.user_provider, "simplefin");
}

#[tokio::test]
async fn given_update_failure_when_selecting_then_reports_update_failed() {
    let user_id = Uuid::new_v4();
    let mut fixture = Fixture::new();
    expect_user(&mut fixture.repository, user(user_id, ""));
    expect_connections(&mut fixture.repository, vec![]);
    fixture
        .repository
        .expect_update_user_provider()
        .returning(|_, _| Box::pin(async { Err(anyhow!("db down")) }));

    let result = fixture.build().select(user_id, "plaid".to_string()).await;

    assert!(matches!(
        result,
        Err(ProviderOrchestrationError::UpdateProviderFailed)
    ));
}

#[tokio::test]
async fn given_connection_owned_by_other_user_when_disconnecting_then_reports_disconnect_failed() {
    let connection = connection(Uuid::new_v4(), "plaid", true);

    let result = Fixture::new()
        .build()
        .disconnect(Uuid::new_v4(), "jwt", &connection)
        .await;

    assert!(matches!(
        result,
        Err(ProviderOrchestrationError::DisconnectFailed)
    ));
}

#[tokio::test]
async fn given_ignored_institutions_when_listing_then_returns_institutions() {
    let user_id = Uuid::new_v4();
    let mut fixture = Fixture::new();
    fixture
        .repository
        .expect_list_simplefin_ignored_institutions()
        .times(1)
        .returning(|_| {
            Box::pin(async {
                Ok(vec![SimpleFinIgnoredInstitution {
                    org_conn_id: "org-1".to_string(),
                    institution_name: Some("Bank".to_string()),
                    hidden_at: "2024-01-01T00:00:00Z".to_string(),
                }])
            })
        });

    let institutions = fixture
        .build()
        .list_simplefin_ignored_institutions(user_id)
        .await
        .unwrap();

    assert_eq!(institutions.len(), 1);
    assert_eq!(institutions[0].org_conn_id, "org-1");
}

#[tokio::test]
async fn given_repository_failure_when_listing_ignored_institutions_then_reports_list_failed() {
    let mut fixture = Fixture::new();
    fixture
        .repository
        .expect_list_simplefin_ignored_institutions()
        .returning(|_| Box::pin(async { Err(anyhow!("db down")) }));

    let result = fixture
        .build()
        .list_simplefin_ignored_institutions(Uuid::new_v4())
        .await;

    assert!(matches!(
        result,
        Err(ProviderOrchestrationError::ListIgnoredInstitutionsFailed)
    ));
}

#[tokio::test]
async fn given_blank_org_conn_id_when_restoring_then_reports_invalid_org_conn_id() {
    let result = Fixture::new()
        .build()
        .restore_simplefin_ignored_institution(Uuid::new_v4(), "   ")
        .await;

    assert!(matches!(
        result,
        Err(ProviderOrchestrationError::InvalidOrgConnId)
    ));
}

#[tokio::test]
async fn given_padded_org_conn_id_when_restoring_then_trims_and_reports_restored() {
    let user_id = Uuid::new_v4();
    let mut fixture = Fixture::new();
    fixture
        .repository
        .expect_remove_simplefin_hidden_org()
        .withf(|_, org_conn_id| org_conn_id == "org-1")
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(true) }));
    fixture
        .cache
        .expect_invalidate_pattern()
        .returning(|_| Box::pin(async { Ok(()) }));

    let restored = fixture
        .build()
        .restore_simplefin_ignored_institution(user_id, " org-1 ")
        .await;

    assert!(matches!(restored, Ok(true)));
}

#[tokio::test]
async fn given_repository_failure_when_restoring_then_reports_restore_failed() {
    let mut fixture = Fixture::new();
    fixture
        .repository
        .expect_remove_simplefin_hidden_org()
        .returning(|_, _| Box::pin(async { Err(anyhow!("db down")) }));

    let result = fixture
        .build()
        .restore_simplefin_ignored_institution(Uuid::new_v4(), "org-1")
        .await;

    assert!(matches!(
        result,
        Err(ProviderOrchestrationError::RestoreIgnoredInstitutionFailed)
    ));
}
