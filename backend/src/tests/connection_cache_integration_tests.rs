use crate::models::{
    account::Account, 
    cache::{CachedBankAccounts, CachedBankConnection}, 
    plaid::{DisconnectResult, PlaidConnection}
};
use crate::services::{
    cache_service::MockCacheService,
    connection_service::ConnectionService,
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
        },
    ]
}

#[tokio::test]
async fn given_bank_connection_when_disconnecting_then_clears_jwt_scoped_cache() {
    let mut mock_db = MockDatabaseRepository::new();
    let mut mock_cache = MockCacheService::new();

    let user_id = Uuid::new_v4();
    let jwt_id = "test-jwt-456";
    let connection = create_test_connection(user_id);
    let connection_id = connection.id;

    let connection_clone = connection.clone();
    mock_db
        .expect_get_plaid_connection_by_user()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let conn = connection_clone.clone();
            Box::pin(async move { Ok(Some(conn)) })
        });

    mock_db
        .expect_save_plaid_connection()
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_db
        .expect_delete_plaid_transactions()
        .returning(|_| Box::pin(async { Ok(3) }));

    mock_db
        .expect_delete_plaid_accounts()
        .returning(|_| Box::pin(async { Ok(2) }));

    mock_db
        .expect_delete_plaid_credentials()
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_delete_access_token()
        .returning(|_, _| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_invalidate_pattern()
        .times(2)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_clear_transactions()
        .returning(|| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_clear_jwt_scoped_bank_connection_cache()
        .with(
            mockall::predicate::eq(jwt_id),
            mockall::predicate::eq(connection_id),
        )
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_refresh_jwt_scoped_connections_cache()
        .with(
            mockall::predicate::eq(jwt_id),
            mockall::predicate::eq(Vec::<Uuid>::new()),
        )
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let service = ConnectionService::new(Arc::new(mock_db), Arc::new(mock_cache));

    let result = disconnect_plaid_with_jwt_context(&service, &user_id, jwt_id).await;

    assert!(result.is_ok());
    let disconnect_result = result.unwrap();
    assert!(disconnect_result.success);
    assert!(disconnect_result.data_cleared.accounts > 0);
    assert!(disconnect_result.data_cleared.transactions > 0);
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

    let connection_clone = connection.clone();
    mock_db
        .expect_get_plaid_connection_by_user()
        .returning(move |_| {
            let conn = connection_clone.clone();
            Box::pin(async move { Ok(Some(conn)) })
        });

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

#[tokio::test]
async fn given_multiple_connections_when_one_disconnects_then_updates_connection_list_cache() {
    let mut mock_db = MockDatabaseRepository::new();
    let mut mock_cache = MockCacheService::new();

    let user_id = Uuid::new_v4();
    let jwt_id = "test-jwt-multi";
    let connection1 = create_test_connection(user_id);
    let _connection2_id = Uuid::new_v4();
    let connection_id = connection1.id;

    let connection1_clone = connection1.clone();
    mock_db
        .expect_get_plaid_connection_by_user()
        .returning(move |_| {
            let conn = connection1_clone.clone();
            Box::pin(async move { Ok(Some(conn)) })
        });

    mock_db
        .expect_save_plaid_connection()
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_db
        .expect_delete_plaid_transactions()
        .returning(|_| Box::pin(async { Ok(1) }));

    mock_db
        .expect_delete_plaid_accounts()
        .returning(|_| Box::pin(async { Ok(1) }));

    mock_db
        .expect_delete_plaid_credentials()
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_delete_access_token()
        .returning(|_, _| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_invalidate_pattern()
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_clear_transactions()
        .returning(|| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_clear_jwt_scoped_bank_connection_cache()
        .with(
            mockall::predicate::eq(jwt_id),
            mockall::predicate::eq(connection_id),
        )
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_refresh_jwt_scoped_connections_cache()
        .with(
            mockall::predicate::eq(jwt_id),
            mockall::predicate::eq(Vec::<Uuid>::new()),
        )
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let service = ConnectionService::new(Arc::new(mock_db), Arc::new(mock_cache));

    let result = disconnect_plaid_with_jwt_context(&service, &user_id, jwt_id).await;

    assert!(result.is_ok());
}

async fn disconnect_plaid_with_jwt_context(
    service: &ConnectionService,
    user_id: &Uuid,
    jwt_id: &str,
) -> anyhow::Result<DisconnectResult> {
    service
        .disconnect_plaid_with_jwt_context(user_id, jwt_id)
        .await
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
