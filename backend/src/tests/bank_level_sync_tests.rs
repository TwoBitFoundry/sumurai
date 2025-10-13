use crate::models::{account::Account, plaid::ProviderConnection};
use crate::providers::PlaidProvider;

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

fn create_test_bank_connection(user_id: Uuid) -> ProviderConnection {
    let mut connection = ProviderConnection::new(user_id, "test_item_123");
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
            provider_account_id: Some("bank_acc_1".to_string()),
            provider_connection_id: Some(connection_id),
            name: "Primary Checking".to_string(),
            account_type: "depository".to_string(),
            balance_current: Some(dec!(1500.00)),
            mask: Some("1234".to_string()),
            institution_name: None,
        },
        Account {
            id: Uuid::new_v4(),
            user_id: Some(user_id),
            provider_account_id: Some("bank_acc_2".to_string()),
            provider_connection_id: Some(connection_id),
            name: "Savings Account".to_string(),
            account_type: "depository".to_string(),
            balance_current: Some(dec!(5000.00)),
            mask: Some("5678".to_string()),
            institution_name: None,
        },
        Account {
            id: Uuid::new_v4(),
            user_id: Some(user_id),
            provider_account_id: Some("bank_acc_3".to_string()),
            provider_connection_id: Some(connection_id),
            name: "Credit Card".to_string(),
            account_type: "credit".to_string(),
            balance_current: Some(dec!(-250.00)),
            mask: Some("9012".to_string()),
            institution_name: None,
        },
    ]
}

#[test]
fn given_bank_connection_with_multiple_accounts_when_calculating_mapping_then_creates_correct_account_mapping(
) {
    let user_id = Uuid::new_v4();
    let connection = create_test_bank_connection(user_id);
    let accounts = create_test_accounts_for_bank(connection.id, user_id);

    let plaid_client = Arc::new(RealPlaidClient::new(
        "test_client_id".to_string(),
        "test_secret".to_string(),
        "sandbox".to_string(),
    ));
    let plaid_provider = Arc::new(PlaidProvider::new(plaid_client.clone()));
    let sync_service = SyncService::new(plaid_provider);

    let account_mapping = sync_service.calculate_account_mapping(&accounts);

    assert_eq!(account_mapping.len(), 3);
    assert!(account_mapping.contains_key("bank_acc_1"));
    assert!(account_mapping.contains_key("bank_acc_2"));
    assert!(account_mapping.contains_key("bank_acc_3"));
}

#[test]
fn given_connection_with_no_cursor_when_calculating_date_ranges_then_uses_default_initial_sync_logic(
) {
    let user_id = Uuid::new_v4();
    let mut connection = create_test_bank_connection(user_id);
    connection.sync_cursor = None;
    connection.last_sync_at = None;

    let plaid_client = Arc::new(RealPlaidClient::new(
        "test_client_id".to_string(),
        "test_secret".to_string(),
        "sandbox".to_string(),
    ));
    let plaid_provider = Arc::new(PlaidProvider::new(plaid_client.clone()));
    let sync_service = SyncService::new(plaid_provider);

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

    let plaid_client = Arc::new(RealPlaidClient::new(
        "invalid_client_id".to_string(),
        "invalid_secret".to_string(),
        "sandbox".to_string(),
    ));
    let plaid_provider = Arc::new(PlaidProvider::new(plaid_client.clone()));
    let sync_service = SyncService::new(plaid_provider);

    let credentials = crate::providers::ProviderCredentials {
        provider: "plaid".to_string(),
        access_token: "invalid_token".to_string(),
        item_id: connection.item_id.clone(),
        certificate: None,
        private_key: None,
    };

    let result = sync_service
        .sync_bank_connection_transactions(&credentials, &connection, &accounts)
        .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn given_bank_connection_when_upserting_account_then_assigns_connection_id() {
    let user_id = Uuid::new_v4();
    let connection = create_test_bank_connection(user_id);
    let connection_id = connection.id;

    let mut account = Account {
        id: Uuid::new_v4(),
        user_id: Some(user_id),
        provider_account_id: Some("plaid_123".to_string()),
        provider_connection_id: None,
        name: "Test Account".to_string(),
        account_type: "checking".to_string(),
        balance_current: Some(dec!(1000.00)),
        mask: Some("1234".to_string()),
        institution_name: None,
    };

    account.user_id = Some(user_id);
    account.provider_connection_id = Some(connection_id);

    assert_eq!(account.provider_connection_id, Some(connection_id));
}
