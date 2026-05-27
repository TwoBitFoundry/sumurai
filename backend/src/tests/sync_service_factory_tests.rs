use std::sync::Arc;

use crate::providers::{FinancialDataProvider, PlaidProvider, ProviderRegistry};
use crate::services::connection_service::ConnectionService;
use crate::services::plaid_service::RealPlaidClient;
use crate::services::sync_service::SyncService;
use crate::services::sync_service_factory::SyncServiceFactory;
use crate::services::{
    cache_service::MockCacheService, repository_service::DatabaseRepository,
    repository_service::MockDatabaseRepository, CacheService,
};
use crate::test_fixtures::{build_credential_resolvers, noop_categorizer};

fn build_test_sync_service_factory() -> SyncServiceFactory {
    let plaid_client = Arc::new(RealPlaidClient::new(
        "test_client_id".to_string(),
        "test_secret".to_string(),
        "sandbox".to_string(),
    ));
    let plaid_provider: Arc<dyn FinancialDataProvider> = Arc::new(PlaidProvider::new(plaid_client));
    let provider_registry = Arc::new(ProviderRegistry::from_providers([(
        "plaid",
        plaid_provider,
    )]));
    let sync_service = Arc::new(SyncService::new(provider_registry.clone()));
    let db_repository: Arc<dyn DatabaseRepository> = Arc::new(MockDatabaseRepository::new());
    let cache_service: Arc<dyn CacheService> = Arc::new(MockCacheService::new());
    let credential_resolvers = build_credential_resolvers(db_repository.clone());
    let connection_service = Arc::new(ConnectionService::new(
        db_repository,
        cache_service,
        provider_registry,
        noop_categorizer(),
        credential_resolvers,
    ));
    SyncServiceFactory::new(connection_service, sync_service)
}

#[test]
fn given_known_providers_when_get_dispatcher_then_returns_some() {
    let factory = build_test_sync_service_factory();
    assert!(factory.get_dispatcher("plaid").is_some());
    assert!(factory.get_dispatcher("teller").is_some());
    assert!(factory.get_dispatcher("simplefin").is_some());
}

#[test]
fn given_unknown_provider_when_get_dispatcher_then_returns_none() {
    let factory = build_test_sync_service_factory();
    assert!(factory.get_dispatcher("unknown").is_none());
}
