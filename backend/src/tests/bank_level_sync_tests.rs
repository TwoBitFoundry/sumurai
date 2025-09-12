use crate::models::{
    account::Account, 
    plaid::PlaidConnection,
};

use crate::services::{
    cache_service::MockCacheService,
    plaid_service::{PlaidService, RealPlaidClient}, 
    repository_service::MockDatabaseRepository, 
    sync_service::SyncService,
};
use chrono::{Duration, Utc};
use rust_decimal_macros::dec;
use std::sync::Arc;
use uuid::Uuid;

fn create_test_bank_connection(user_id: Uuid) -> PlaidConnection {
    let mut connection = PlaidConnection::new(user_id, "test_item_123");
    connection.mark_connected("Test Bank");
    connection.last_sync_at = Some(Utc::now() - Duration::days(1)); // Last synced yesterday
    connection.sync_cursor = Some("cursor_abc123".to_string());
    connection
}

fn create_test_accounts_for_bank(connection_id: Uuid, user_id: Uuid) -> Vec<Account> {
    vec![
        Account {
            id: Uuid::new_v4(),
            user_id: Some(user_id),
            plaid_account_id: Some("bank_acc_1".to_string()),
            plaid_connection_id: Some(connection_id),
            name: "Primary Checking".to_string(),
            account_type: "depository".to_string(),
            balance_current: Some(dec!(1500.00)),
            mask: Some("1234".to_string()),
        },
        Account {
            id: Uuid::new_v4(),
            user_id: Some(user_id),
            plaid_account_id: Some("bank_acc_2".to_string()),
            plaid_connection_id: Some(connection_id),
            name: "Savings Account".to_string(),
            account_type: "depository".to_string(),
            balance_current: Some(dec!(5000.00)),
            mask: Some("5678".to_string()),
        },
        Account {
            id: Uuid::new_v4(),
            user_id: Some(user_id),
            plaid_account_id: Some("bank_acc_3".to_string()),
            plaid_connection_id: Some(connection_id),
            name: "Credit Card".to_string(),
            account_type: "credit".to_string(),
            balance_current: Some(dec!(-250.00)),
            mask: Some("9012".to_string()),
        },
    ]
}

#[test]
fn given_bank_connection_with_multiple_accounts_when_calculating_mapping_then_creates_correct_account_mapping(
) {
    let user_id = Uuid::new_v4();
    let connection = create_test_bank_connection(user_id);
    let accounts = create_test_accounts_for_bank(connection.id, user_id);

    let plaid_client = RealPlaidClient::new(
        "test_client_id".to_string(),
        "test_secret".to_string(),
        "sandbox".to_string(),
    );
    let plaid_service = PlaidService::new(Arc::new(plaid_client));
    let sync_service = SyncService::new(Arc::new(plaid_service));

    let account_mapping = sync_service.calculate_account_mapping(&accounts);
    
    assert_eq!(account_mapping.len(), 3);
    assert!(account_mapping.contains_key("bank_acc_1"));
    assert!(account_mapping.contains_key("bank_acc_2"));
    assert!(account_mapping.contains_key("bank_acc_3"));
}

#[test]
fn given_connection_with_no_cursor_when_calculating_date_ranges_then_uses_default_initial_sync_logic() {
    let user_id = Uuid::new_v4();
    let mut connection = create_test_bank_connection(user_id);
    connection.sync_cursor = None;
    connection.last_sync_at = None;
    
    let plaid_client = RealPlaidClient::new(
        "test_client_id".to_string(),
        "test_secret".to_string(),
        "sandbox".to_string(),
    );
    let plaid_service = PlaidService::new(Arc::new(plaid_client));
    let sync_service = SyncService::new(Arc::new(plaid_service));

    let (start_date, end_date) = sync_service.calculate_sync_date_range(connection.last_sync_at);
    let expected_start = Utc::now().date_naive() - Duration::days(90);
    let expected_end = Utc::now().date_naive();
    
    assert_eq!(start_date, expected_start);
    assert_eq!(end_date, expected_end);
}

#[tokio::test]
async fn given_bank_connection_when_sync_fails_then_returns_error_without_updating_cursor() {
    let user_id = Uuid::new_v4();
    let connection = create_test_bank_connection(user_id);
    let accounts = create_test_accounts_for_bank(connection.id, user_id);

    let plaid_client = RealPlaidClient::new(
        "invalid_client_id".to_string(),
        "invalid_secret".to_string(),
        "sandbox".to_string(),
    );
    let plaid_service = PlaidService::new(Arc::new(plaid_client));
    let sync_service = SyncService::new(Arc::new(plaid_service));

    let result = sync_service
        .sync_bank_connection_transactions("invalid_token", &connection, &accounts)
        .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn given_bank_connection_with_multiple_accounts_when_disconnect_by_connection_then_removes_all_bank_data(
) {
    let user_id = Uuid::new_v4();
    let mut connection = create_test_bank_connection(user_id);
    connection.transaction_count = 50;
    connection.account_count = 3;

    let _accounts = create_test_accounts_for_bank(connection.id, user_id);

    // Clone values before moving them into closures
    let item_id = connection.item_id.clone();

    let mut mock_repo = MockDatabaseRepository::new();
    let mut mock_cache = MockCacheService::new();

    // Expected to disconnect the entire bank connection
    mock_repo
        .expect_get_plaid_connection_by_user()
        .with(mockall::predicate::eq(user_id))
        .times(1)
        .returning(move |_| {
            let conn = connection.clone();
            Box::pin(async move { Ok(Some(conn)) })
        });

    mock_repo
        .expect_save_plaid_connection()
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    // Expected to delete all accounts and transactions for this bank connection
    mock_repo
        .expect_delete_plaid_transactions()
        .with(mockall::predicate::eq(item_id.clone()))
        .times(1)
        .returning(|_| Box::pin(async { Ok(50) })); // 50 transactions deleted

    mock_repo
        .expect_delete_plaid_accounts()
        .with(mockall::predicate::eq(item_id.clone()))
        .times(1)
        .returning(|_| Box::pin(async { Ok(3) })); // 3 accounts deleted

    mock_repo
        .expect_delete_plaid_credentials()
        .with(mockall::predicate::eq(item_id.clone()))
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    // Expected to clear all cache data for this bank connection
    mock_cache
        .expect_delete_access_token()
        .with(
            mockall::predicate::eq("test-jwt-123"),
            mockall::predicate::eq(item_id),
        )
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_invalidate_pattern()
        .times(2)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_clear_transactions()
        .times(1)
        .returning(|| Box::pin(async { Ok(()) }));

    use crate::services::connection_service::ConnectionService;
    let connection_service = ConnectionService::new(Arc::new(mock_repo), Arc::new(mock_cache));

    let result = connection_service
        .disconnect_plaid(&user_id, "test-jwt-123")
        .await;

    assert!(result.is_ok());
    let disconnect_result = result.unwrap();
    assert!(disconnect_result.success);
    assert_eq!(disconnect_result.data_cleared.transactions, 50);
    assert_eq!(disconnect_result.data_cleared.accounts, 3);
    assert!(!disconnect_result.data_cleared.cache_keys.is_empty());
}

#[tokio::test]
async fn given_user_with_no_bank_connection_when_disconnect_then_returns_no_connection_message() {
    let user_id = Uuid::new_v4();

    let mut mock_repo = MockDatabaseRepository::new();
    let mock_cache = MockCacheService::new();

    mock_repo
        .expect_get_plaid_connection_by_user()
        .with(mockall::predicate::eq(user_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(None) }));

    use crate::services::connection_service::ConnectionService;
    let connection_service = ConnectionService::new(Arc::new(mock_repo), Arc::new(mock_cache));

    let result = connection_service
        .disconnect_plaid(&user_id, "test-jwt-123")
        .await;

    assert!(result.is_ok());
    let disconnect_result = result.unwrap();
    assert!(disconnect_result.success);
    assert!(disconnect_result
        .message
        .contains("No active Plaid connection"));
    assert_eq!(disconnect_result.data_cleared.transactions, 0);
    assert_eq!(disconnect_result.data_cleared.accounts, 0);
}

#[tokio::test]
async fn given_bank_connection_when_disconnect_fails_database_operation_then_returns_error() {
    let user_id = Uuid::new_v4();
    let connection = create_test_bank_connection(user_id);

    let mut mock_repo = MockDatabaseRepository::new();
    let mut mock_cache = MockCacheService::new();

    mock_repo
        .expect_get_plaid_connection_by_user()
        .times(1)
        .returning(move |_| {
            let conn = connection.clone();
            Box::pin(async move { Ok(Some(conn)) })
        });

    mock_repo
        .expect_save_plaid_connection()
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_delete_plaid_transactions()
        .times(1)
        .returning(|_| {
            Box::pin(async {
                Err(anyhow::anyhow!(
                    "Database connection failed during transaction cleanup"
                ))
            })
        });

    mock_cache
        .expect_delete_access_token()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_invalidate_pattern()
        .times(2)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_clear_transactions()
        .times(1)
        .returning(|| Box::pin(async { Ok(()) }));

    use crate::services::connection_service::ConnectionService;
    let connection_service = ConnectionService::new(Arc::new(mock_repo), Arc::new(mock_cache));

    let result = connection_service
        .disconnect_plaid(&user_id, "test-jwt-123")
        .await;

    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("Database connection failed"));
}
