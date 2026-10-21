use std::sync::Arc;

use anyhow::anyhow;
use rust_decimal_macros::dec;
use uuid::Uuid;

use crate::models::account::Account;
use crate::models::diy::CreateDiyAccountRequest;
use crate::models::domain_error::DomainError;
use crate::models::plaid::ProviderConnection;
use crate::providers::ProviderRegistry;
use crate::services::cache_service::{CacheService, MockCacheService};
use crate::services::connection_service::ConnectionService;
use crate::services::diy_orchestrator::DiyOrchestrator;
use crate::services::diy_service::DiyService;
use crate::services::repository_service::{DatabaseRepository, MockDatabaseRepository};
use crate::test_fixtures::{build_credential_resolvers, noop_categorizer};

fn orchestrator(repository: MockDatabaseRepository) -> DiyOrchestrator {
    let db: Arc<dyn DatabaseRepository> = Arc::new(repository);
    let cache: Arc<dyn CacheService> = Arc::new(MockCacheService::new());
    let connection_service = Arc::new(ConnectionService::new(
        db.clone(),
        cache,
        Arc::new(ProviderRegistry::new()),
        noop_categorizer(),
        build_credential_resolvers(db.clone()),
    ));
    let diy_service = Arc::new(DiyService::new(db, connection_service.clone()));
    DiyOrchestrator::new(diy_service, connection_service)
}

fn connection(user_id: Uuid, provider: &str) -> ProviderConnection {
    let mut connection = ProviderConnection::new(user_id, "item-1");
    connection.provider = provider.to_string();
    connection
}

fn account_request(
    name: &str,
    account_type: &str,
    mask: Option<&str>,
    balance: Option<rust_decimal::Decimal>,
) -> CreateDiyAccountRequest {
    CreateDiyAccountRequest {
        name: name.to_string(),
        account_type: account_type.to_string(),
        mask: mask.map(str::to_string),
        balance,
    }
}

fn existing_account(user_id: Uuid, connection_id: Uuid, name: &str, mask: Option<&str>) -> Account {
    Account {
        id: Uuid::new_v4(),
        user_id: Some(user_id),
        provider_account_id: None,
        provider_connection_id: Some(connection_id),
        name: name.to_string(),
        account_type: "depository".to_string(),
        balance_current: None,
        mask: mask.map(str::to_string),
        institution_name: None,
        provider_conn_id: None,
    }
}

fn repository_with_connection(connection: ProviderConnection) -> MockDatabaseRepository {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_provider_connection_by_id()
        .returning(move |_, _| {
            let connection = connection.clone();
            Box::pin(async move { Ok(Some(connection)) })
        });
    repository
}

#[tokio::test]
async fn given_blank_institution_name_when_creating_then_reports_empty_name() {
    let result = orchestrator(MockDatabaseRepository::new())
        .create_institution(Uuid::new_v4(), "jwt", "   ")
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::bad_request("Institution name cannot be empty"))
    );
}

#[tokio::test]
async fn given_blank_account_name_when_creating_account_then_reports_empty_name() {
    let result = orchestrator(MockDatabaseRepository::new())
        .create_account(
            Uuid::new_v4(),
            Uuid::new_v4(),
            &account_request("  ", "depository", None, Some(dec!(10))),
        )
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::bad_request("Account name cannot be empty"))
    );
}

#[tokio::test]
async fn given_unknown_account_type_when_creating_account_then_reports_invalid_type() {
    let result = orchestrator(MockDatabaseRepository::new())
        .create_account(
            Uuid::new_v4(),
            Uuid::new_v4(),
            &account_request("Checking", "crypto", None, Some(dec!(10))),
        )
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::bad_request(
            "account_type must be one of: depository, credit, investment, loan"
        ))
    );
}

#[tokio::test]
async fn given_missing_balance_when_creating_account_then_reports_balance_required() {
    let result = orchestrator(MockDatabaseRepository::new())
        .create_account(
            Uuid::new_v4(),
            Uuid::new_v4(),
            &account_request("Checking", "depository", None, None),
        )
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::bad_request("Balance is required"))
    );
}

#[tokio::test]
async fn given_unknown_connection_when_creating_account_then_reports_connection_not_found() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_provider_connection_by_id()
        .returning(|_, _| Box::pin(async { Ok(None) }));

    let result = orchestrator(repository)
        .create_account(
            Uuid::new_v4(),
            Uuid::new_v4(),
            &account_request("Checking", "depository", None, Some(dec!(10))),
        )
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::not_found("Connection not found"))
    );
}

#[tokio::test]
async fn given_non_diy_connection_when_creating_account_then_reports_connection_not_diy() {
    let user_id = Uuid::new_v4();
    let repository = repository_with_connection(connection(user_id, "plaid"));

    let result = orchestrator(repository)
        .create_account(
            user_id,
            Uuid::new_v4(),
            &account_request("Checking", "depository", None, Some(dec!(10))),
        )
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::forbidden("Connection is not a DIY connection"))
    );
}

#[tokio::test]
async fn given_duplicate_account_name_when_creating_account_then_reports_name_taken() {
    let user_id = Uuid::new_v4();
    let connection_record = connection(user_id, "diy");
    let connection_id = connection_record.id;
    let mut repository = repository_with_connection(connection_record);
    repository
        .expect_get_accounts_for_user()
        .returning(move |_| {
            let existing = existing_account(user_id, connection_id, "Checking", None);
            Box::pin(async move { Ok(vec![existing]) })
        });

    let result = orchestrator(repository)
        .create_account(
            user_id,
            connection_id,
            &account_request("checking", "depository", None, Some(dec!(10))),
        )
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::conflict(
            "Account name already exists in this institution"
        ))
    );
}

#[tokio::test]
async fn given_duplicate_mask_when_creating_account_then_reports_mask_taken() {
    let user_id = Uuid::new_v4();
    let connection_record = connection(user_id, "diy");
    let connection_id = connection_record.id;
    let mut repository = repository_with_connection(connection_record);
    repository
        .expect_get_accounts_for_user()
        .returning(move |_| {
            let existing = existing_account(user_id, connection_id, "Savings", Some("1234"));
            Box::pin(async move { Ok(vec![existing]) })
        });

    let result = orchestrator(repository)
        .create_account(
            user_id,
            connection_id,
            &account_request("Checking", "depository", Some("1234"), Some(dec!(10))),
        )
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::conflict(
            "Account mask already exists in this institution"
        ))
    );
}

#[tokio::test]
async fn given_valid_request_when_creating_account_then_persists_and_returns_account() {
    let user_id = Uuid::new_v4();
    let connection_record = connection(user_id, "diy");
    let connection_id = connection_record.id;
    let mut repository = repository_with_connection(connection_record);
    repository
        .expect_get_accounts_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    repository
        .expect_upsert_account()
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let account = orchestrator(repository)
        .create_account(
            user_id,
            connection_id,
            &account_request("  Savings  ", "depository", Some("0042"), Some(dec!(250))),
        )
        .await
        .unwrap();

    assert_eq!(account.name, "Savings");
    assert_eq!(account.account_type, "depository");
    assert_eq!(account.provider_connection_id, Some(connection_id));
}

#[tokio::test]
async fn given_unknown_connection_when_disconnecting_then_reports_institution_not_found() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_provider_connection_by_id()
        .returning(|_, _| Box::pin(async { Ok(None) }));

    let result = orchestrator(repository)
        .disconnect(Uuid::new_v4(), "jwt", Uuid::new_v4())
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::not_found("Institution not found"))
    );
}

#[tokio::test]
async fn given_non_diy_connection_when_disconnecting_then_reports_not_diy_institution() {
    let user_id = Uuid::new_v4();
    let repository = repository_with_connection(connection(user_id, "simplefin"));

    let result = orchestrator(repository)
        .disconnect(user_id, "jwt", Uuid::new_v4())
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::forbidden(
            "Connection is not a DIY institution"
        ))
    );
}

#[tokio::test]
async fn given_repository_failure_when_disconnecting_then_reports_resolve_failed() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_provider_connection_by_id()
        .returning(|_, _| Box::pin(async { Err(anyhow!("database down")) }));

    let result = orchestrator(repository)
        .disconnect(Uuid::new_v4(), "jwt", Uuid::new_v4())
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::internal("Failed to disconnect institution"))
    );
}

#[tokio::test]
async fn given_service_failure_when_creating_institution_then_reports_internal_error() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_user_by_id()
        .returning(|_| Box::pin(async { Err(anyhow!("database down")) }));

    let result = orchestrator(repository)
        .create_institution(Uuid::new_v4(), "jwt", "Bank")
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::internal("Failed to create institution"))
    );
}
