use crate::models::{
    account::Account,
    cache::{CachedBankAccounts, CachedBankConnection},
    plaid::{DisconnectResult, PlaidConnection},
};
use crate::services::{
    cache_service::MockCacheService, connection_service::ConnectionService,
    repository_service::MockDatabaseRepository,
};
use chrono::Utc;
use rust_decimal::Decimal;
use std::sync::Arc;
use uuid::Uuid;

fn create_test_connection(user_id: Uuid) -> PlaidConnection {
    PlaidConnection {
        id: Uuid::new_v4(),
        user_id,
        item_id: "test_item_123".to_string(),
        is_connected: true,
        last_sync_at: Some(Utc::now()),
        connected_at: Some(Utc::now()),
        disconnected_at: None,
        institution_id: Some("ins_123".to_string()),
        institution_name: Some("Test Bank".to_string()),
        institution_logo_url: Some("https://logo.url".to_string()),
        sync_cursor: Some("cursor123".to_string()),
        transaction_count: 5,
        account_count: 2,
        created_at: Some(Utc::now()),
        updated_at: Some(Utc::now()),
    }
}

fn create_test_accounts() -> Vec<Account> {
    vec![
        Account {
            id: Uuid::new_v4(),
            user_id: Some(Uuid::new_v4()),
            plaid_account_id: Some("acc1".to_string()),
            plaid_connection_id: None,
            name: "Checking".to_string(),
            account_type: "depository".to_string(),
            balance_current: Some(Decimal::new(150000, 2)),
            mask: Some("1234".to_string()),
            institution_name: None,
        },
        Account {
            id: Uuid::new_v4(),
            user_id: Some(Uuid::new_v4()),
            plaid_account_id: Some("acc2".to_string()),
            plaid_connection_id: None,
            name: "Savings".to_string(),
            account_type: "depository".to_string(),
            balance_current: Some(Decimal::new(300000, 2)),
            mask: Some("5678".to_string()),
            institution_name: None,
        },
    ]
}

#[tokio::test]
async fn given_bank_sync_operation_when_completing_then_updates_jwt_scoped_cache() {
    let mut mock_db = MockDatabaseRepository::new();
    let mut mock_cache = MockCacheService::new();

    let user_id = Uuid::new_v4();
    let jwt_id = "test-jwt-789";
    let connection = create_test_connection(user_id);
    let connection_id = connection.id;
    let accounts = create_test_accounts();

    mock_cache
        .expect_cache_jwt_scoped_bank_connection()
        .with(
            mockall::predicate::eq(jwt_id),
            mockall::predicate::function(move |cached_conn: &CachedBankConnection| {
                !cached_conn.sync_status.in_progress
                    && cached_conn.sync_status.last_sync_at.is_some()
                    && cached_conn.connection.id == connection_id
            }),
        )
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_cache_jwt_scoped_bank_accounts()
        .with(
            mockall::predicate::eq(jwt_id),
            mockall::predicate::eq(connection_id),
            mockall::predicate::function(|cached_accounts: &CachedBankAccounts| {
                cached_accounts.accounts.len() == 2
            }),
        )
        .times(1)
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_invalidate_pattern()
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let service = ConnectionService::new(Arc::new(mock_db), Arc::new(mock_cache));

    let result =
        complete_sync_with_jwt_cache_update(&service, &user_id, jwt_id, &connection, &accounts)
            .await;

    assert!(result.is_ok());
}

async fn complete_sync_with_jwt_cache_update(
    service: &ConnectionService,
    user_id: &Uuid,
    jwt_id: &str,
    connection: &PlaidConnection,
    accounts: &[Account],
) -> anyhow::Result<()> {
    service
        .complete_sync_with_jwt_cache_update(user_id, jwt_id, connection, accounts)
        .await
}
