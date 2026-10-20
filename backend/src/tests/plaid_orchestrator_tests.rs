use std::collections::HashMap;
use std::sync::Arc;

use anyhow::anyhow;
use rust_decimal_macros::dec;
use uuid::Uuid;

use crate::models::account::Account;
use crate::models::plaid::ProviderConnection;
use crate::providers::{FinancialDataProvider, MockFinancialDataProvider, ProviderRegistry};
use crate::services::cache_service::{CacheService, MockCacheService};
use crate::services::connection_service::ConnectionService;
use crate::services::plaid_orchestrator::{PlaidOrchestrationError, PlaidOrchestrator};
use crate::services::repository_service::{DatabaseRepository, MockDatabaseRepository};
use crate::test_fixtures::{build_credential_resolvers, noop_categorizer};

fn orchestrator(
    repository: MockDatabaseRepository,
    cache: MockCacheService,
    registry: ProviderRegistry,
) -> PlaidOrchestrator {
    let db: Arc<dyn DatabaseRepository> = Arc::new(repository);
    let cache: Arc<dyn CacheService> = Arc::new(cache);
    let connection_service = Arc::new(ConnectionService::new(
        db.clone(),
        cache.clone(),
        Arc::new(registry),
        noop_categorizer(),
        build_credential_resolvers(db.clone()),
    ));
    PlaidOrchestrator::new(connection_service, db, cache)
}

fn registry_with(provider: MockFinancialDataProvider) -> ProviderRegistry {
    let provider: Arc<dyn FinancialDataProvider> = Arc::new(provider);
    ProviderRegistry::from_providers([("plaid", provider)])
}

fn account(user_id: Uuid, connection_id: Option<Uuid>, name: &str) -> Account {
    Account {
        id: Uuid::new_v4(),
        user_id: Some(user_id),
        provider_account_id: Some("provider-acc".to_string()),
        provider_connection_id: connection_id,
        name: name.to_string(),
        account_type: "depository".to_string(),
        balance_current: Some(dec!(25.50)),
        mask: Some("4321".to_string()),
        institution_name: Some("Test Bank".to_string()),
        provider_conn_id: None,
    }
}

#[tokio::test]
async fn given_registered_plaid_provider_when_creating_link_token_then_returns_token() {
    let mut provider = MockFinancialDataProvider::new();
    provider
        .expect_create_link_token()
        .times(1)
        .returning(|_| Ok("link-token".to_string()));

    let token = orchestrator(
        MockDatabaseRepository::new(),
        MockCacheService::new(),
        registry_with(provider),
    )
    .create_link_token(Uuid::new_v4())
    .await
    .unwrap();

    assert_eq!(token, "link-token");
}

#[tokio::test]
async fn given_no_plaid_provider_when_creating_link_token_then_reports_unsupported_provider() {
    let result = orchestrator(
        MockDatabaseRepository::new(),
        MockCacheService::new(),
        ProviderRegistry::new(),
    )
    .create_link_token(Uuid::new_v4())
    .await;

    assert_eq!(
        result.err(),
        Some(PlaidOrchestrationError::UnsupportedProvider)
    );
}

#[tokio::test]
async fn given_provider_failure_when_creating_link_token_then_reports_request_failed() {
    let mut provider = MockFinancialDataProvider::new();
    provider
        .expect_create_link_token()
        .returning(|_| Err(anyhow!("plaid down")));

    let result = orchestrator(
        MockDatabaseRepository::new(),
        MockCacheService::new(),
        registry_with(provider),
    )
    .create_link_token(Uuid::new_v4())
    .await;

    assert_eq!(
        result.err(),
        Some(PlaidOrchestrationError::LinkTokenRequestFailed)
    );
}

#[tokio::test]
async fn given_no_plaid_provider_when_exchanging_token_then_reports_unsupported_provider() {
    let result = orchestrator(
        MockDatabaseRepository::new(),
        MockCacheService::new(),
        ProviderRegistry::new(),
    )
    .exchange_public_token(Uuid::new_v4(), "jwt", "public-token")
    .await;

    assert_eq!(
        result.err(),
        Some(PlaidOrchestrationError::UnsupportedProvider)
    );
}

#[tokio::test]
async fn given_provider_exchange_failure_when_exchanging_token_then_reports_exchange_failed() {
    let mut provider = MockFinancialDataProvider::new();
    provider
        .expect_exchange_public_token()
        .times(1)
        .returning(|_| Err(anyhow!("bad token")));

    let result = orchestrator(
        MockDatabaseRepository::new(),
        MockCacheService::new(),
        registry_with(provider),
    )
    .exchange_public_token(Uuid::new_v4(), "jwt", "public-token")
    .await;

    assert_eq!(
        result.err(),
        Some(PlaidOrchestrationError::TokenExchangeFailed)
    );
}

#[tokio::test]
async fn given_accounts_with_counts_when_listing_then_attaches_provider_and_transaction_count() {
    let user_id = Uuid::new_v4();
    let connection_id = Uuid::new_v4();
    let linked = account(user_id, Some(connection_id), "Checking");
    let unlinked = account(user_id, None, "Manual");
    let linked_id = linked.id;
    let unlinked_id = unlinked.id;

    let mut repository = MockDatabaseRepository::new();
    let accounts = vec![linked, unlinked];
    repository
        .expect_get_accounts_for_user()
        .times(1)
        .returning(move |_| {
            let accounts = accounts.clone();
            Box::pin(async move { Ok(accounts) })
        });
    repository
        .expect_get_transaction_count_by_account_for_user()
        .times(1)
        .returning(move |_| Box::pin(async move { Ok(HashMap::from([(linked_id, 7_i64)])) }));
    repository
        .expect_get_all_provider_connections_by_user()
        .times(1)
        .returning(move |_| {
            Box::pin(async move {
                let mut connection = ProviderConnection::new(user_id, "item-1");
                connection.id = connection_id;
                connection.provider = "plaid".to_string();
                Ok(vec![connection])
            })
        });

    let responses = orchestrator(repository, MockCacheService::new(), ProviderRegistry::new())
        .list_accounts(user_id)
        .await
        .unwrap();

    assert_eq!(responses.len(), 2);
    assert_eq!(responses[0].provider.as_deref(), Some("plaid"));
    assert_eq!(responses[0].transaction_count, 7);
    assert_eq!(responses[0].user_id, Some(user_id));
    assert_eq!(responses[1].id, unlinked_id);
    assert_eq!(responses[1].provider, None);
    assert_eq!(responses[1].transaction_count, 0);
}

#[tokio::test]
async fn given_account_lookup_failure_when_listing_then_reports_load_failed() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_accounts_for_user()
        .returning(|_| Box::pin(async { Err(anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new(), ProviderRegistry::new())
        .list_accounts(Uuid::new_v4())
        .await;

    assert_eq!(
        result.err(),
        Some(PlaidOrchestrationError::LoadAccountsFailed)
    );
}

#[tokio::test]
async fn given_transaction_count_failure_when_listing_then_reports_load_failed() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_accounts_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    repository
        .expect_get_transaction_count_by_account_for_user()
        .returning(|_| Box::pin(async { Err(anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new(), ProviderRegistry::new())
        .list_accounts(Uuid::new_v4())
        .await;

    assert_eq!(
        result.err(),
        Some(PlaidOrchestrationError::LoadAccountsFailed)
    );
}

#[tokio::test]
async fn given_connection_lookup_failure_when_listing_then_reports_load_failed() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_accounts_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    repository
        .expect_get_transaction_count_by_account_for_user()
        .returning(|_| Box::pin(async { Ok(HashMap::new()) }));
    repository
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Err(anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new(), ProviderRegistry::new())
        .list_accounts(Uuid::new_v4())
        .await;

    assert_eq!(
        result.err(),
        Some(PlaidOrchestrationError::LoadAccountsFailed)
    );
}

#[tokio::test]
async fn given_cache_available_when_clearing_synced_data_then_returns_cleared_response() {
    let user_id = Uuid::new_v4();
    let mut cache = MockCacheService::new();
    cache
        .expect_clear_transactions()
        .withf(|jwt_id| jwt_id == "jwt")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let response = orchestrator(
        MockDatabaseRepository::new(),
        cache,
        ProviderRegistry::new(),
    )
    .clear_synced_data(user_id, "jwt")
    .await
    .unwrap();

    assert!(response.cleared);
    assert_eq!(response.user_id, user_id.to_string());
}

#[tokio::test]
async fn given_cache_failure_when_clearing_synced_data_then_reports_clear_failed() {
    let mut cache = MockCacheService::new();
    cache
        .expect_clear_transactions()
        .returning(|_| Box::pin(async { Err(anyhow!("redis down")) }));

    let result = orchestrator(
        MockDatabaseRepository::new(),
        cache,
        ProviderRegistry::new(),
    )
    .clear_synced_data(Uuid::new_v4(), "jwt")
    .await;

    assert_eq!(
        result.err(),
        Some(PlaidOrchestrationError::ClearSyncedDataFailed)
    );
}
