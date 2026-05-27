use crate::models::{account::Account, transaction::Transaction};
use crate::providers::{PlaidProvider, ProviderRegistry};

use crate::services::{plaid_service::RealPlaidClient, sync_service::SyncService};
use crate::test_fixtures::TestFixtures;

use chrono::{Duration, Months, NaiveDate, Utc};
use rust_decimal_macros::dec;
use std::sync::Arc;
use uuid::Uuid;

fn create_test_sync_service() -> SyncService {
    let plaid_client = Arc::new(RealPlaidClient::new(
        "test_client_id".to_string(),
        "test_secret".to_string(),
        "sandbox".to_string(),
    ));
    let plaid_provider: Arc<dyn crate::providers::FinancialDataProvider> =
        Arc::new(PlaidProvider::new(plaid_client.clone()));
    let provider_registry = Arc::new(ProviderRegistry::from_providers([(
        "plaid",
        Arc::clone(&plaid_provider),
    )]));
    SyncService::new(provider_registry)
}

#[test]
fn given_missing_provider_when_resolving_then_returns_error() {
    let sync_service = SyncService::new(Arc::new(ProviderRegistry::new()));

    let err = sync_service
        .resolve_provider(None)
        .err()
        .expect("missing provider error");

    assert!(err
        .to_string()
        .contains("No provider selected — connect an account first"));
}

#[test]
fn test_calculate_account_mapping_creates_correct_mapping() {
    let sync_service = create_test_sync_service();
    let accounts = vec![
        Account {
            id: Uuid::new_v4(),
            user_id: None,
            provider_account_id: Some("mock_account_123".to_string()),
            provider_connection_id: None,
            name: "Checking".into(),
            account_type: "depository".into(),
            balance_current: Some(dec!(100.00)),
            mask: Some("1234".to_string()),
            institution_name: None,
            provider_conn_id: None,
        },
        Account {
            id: Uuid::new_v4(),
            user_id: None,
            provider_account_id: Some("mock_account_456".to_string()),
            provider_connection_id: None,
            name: "Savings".into(),
            account_type: "depository".into(),
            balance_current: Some(dec!(200.00)),
            mask: Some("5678".to_string()),
            institution_name: None,
            provider_conn_id: None,
        },
    ];

    let mapping = sync_service.calculate_account_mapping(&accounts);

    assert_eq!(mapping.len(), 2);
    assert!(mapping.contains_key("mock_account_123"));
    assert!(mapping.contains_key("mock_account_456"));
}

#[test]
fn test_calculate_account_mapping_handles_accounts_without_plaid_ids() {
    let sync_service = create_test_sync_service();
    let account_id = Uuid::new_v4();

    let accounts = vec![Account {
        id: account_id,
        user_id: None,
        provider_account_id: None,
        provider_connection_id: None,
        name: "Manual Account".to_string(),
        account_type: "manual".to_string(),
        balance_current: Some(dec!(500.00)),
        mask: None,
        institution_name: None,
        provider_conn_id: None,
    }];

    let mapping = sync_service.calculate_account_mapping(&accounts);
    assert_eq!(mapping.len(), 0);
}

#[test]
fn test_map_transactions_to_accounts_updates_account_ids() {
    let sync_service = create_test_sync_service();
    let account_id = Uuid::new_v4();
    let mut account_mapping = std::collections::HashMap::new();
    account_mapping.insert("plaid_acc_1".to_string(), account_id);

    let mut transactions = vec![Transaction {
        id: Uuid::new_v4(),
        account_id: Uuid::new_v4(),
        user_id: None,
        provider_account_id: None,
        provider_transaction_id: Some("plaid_txn_1".to_string()),
        amount: dec!(100.00),
        date: NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
        merchant_name: Some("Store A".to_string()),
        category_primary: "Food".to_string(),
        category_detailed: "Restaurants".to_string(),
        category_confidence: "HIGH".to_string(),
        payment_channel: Some("in_store".to_string()),
        pending: false,
        created_at: Some(Utc::now()),
    }];

    sync_service.map_transactions_to_accounts(&mut transactions, &account_mapping);
    assert_eq!(transactions[0].account_id, account_id);
}

#[test]
fn test_filter_duplicate_transactions_filters_existing_transactions() {
    let sync_service = create_test_sync_service();
    let (existing, new_with_duplicates) = TestFixtures::duplicate_test_transactions();

    let unique_transactions =
        sync_service.filter_duplicate_transactions(&existing, &new_with_duplicates);

    assert_eq!(unique_transactions.len(), 1);
    assert_eq!(
        unique_transactions[0].provider_transaction_id.as_deref(),
        Some("new_txn_001")
    );
}

#[test]
fn test_filter_duplicate_transactions_by_provider_ids_filters_existing_ids() {
    let sync_service = create_test_sync_service();
    let existing_provider_transaction_ids = vec!["duplicate_txn_001".to_string()];
    let (_, new_transactions) = TestFixtures::duplicate_test_transactions();

    let unique_transactions = sync_service.filter_duplicate_transactions_by_provider_ids(
        &existing_provider_transaction_ids,
        &new_transactions,
    );

    assert_eq!(unique_transactions.len(), 1);
    assert_eq!(
        unique_transactions[0].provider_transaction_id.as_deref(),
        Some("new_txn_001")
    );
}

#[test]
fn test_filter_duplicate_transactions_handles_empty_collections() {
    let sync_service = create_test_sync_service();
    let existing = TestFixtures::empty_transactions();
    let new_transactions = TestFixtures::empty_transactions();

    let unique_transactions =
        sync_service.filter_duplicate_transactions(&existing, &new_transactions);
    assert_eq!(unique_transactions.len(), 0);
}

#[test]
fn test_filter_duplicate_transactions_handles_transactions_without_ids() {
    let sync_service = create_test_sync_service();
    let existing = TestFixtures::empty_transactions();
    let mut new_transaction = TestFixtures::sample_transactions()[0].clone();
    new_transaction.provider_transaction_id = None;
    let new_transactions = vec![new_transaction.clone()];

    let unique_transactions =
        sync_service.filter_duplicate_transactions(&existing, &new_transactions);
    assert_eq!(unique_transactions.len(), 1);
    assert_eq!(unique_transactions[0].amount, new_transaction.amount);
}

mod date_range_calculation_tests {
    use super::*;

    #[test]
    fn given_no_previous_sync_when_calculating_range_then_returns_90_day_default() {
        let sync_service = create_test_sync_service();
        let now = Utc::now().date_naive();

        let (start_date, end_date) = sync_service.calculate_sync_date_range(None, None);
        let expected_start = now.checked_sub_days(chrono::Days::new(90)).unwrap();
        let expected_end = now;

        assert_eq!(start_date, expected_start);
        assert_eq!(end_date, expected_end);
    }

    #[test]
    fn given_recent_last_sync_when_calculating_range_then_returns_incremental_window() {
        let sync_service = create_test_sync_service();
        let last_sync = Utc::now() - Duration::days(7); // 7 days ago
        let now = Utc::now().date_naive();

        let (start_date, end_date) = sync_service.calculate_sync_date_range(Some(last_sync), None);
        let expected_start = (last_sync - Duration::days(2)).date_naive();
        let expected_end = now;

        assert_eq!(start_date, expected_start);
        assert_eq!(end_date, expected_end);
    }

    #[test]
    fn given_old_last_sync_over_5_years_when_calculating_range_then_caps_at_5_year_window() {
        let sync_service = create_test_sync_service();
        let last_sync = Utc::now() - Duration::days(365 * 6); // 6 years ago
        let now = Utc::now().date_naive();

        let (start_date, end_date) = sync_service.calculate_sync_date_range(Some(last_sync), None);
        let expected_start = now.checked_sub_months(Months::new(60)).unwrap();
        let expected_end = now;

        assert_eq!(start_date, expected_start);
        assert_eq!(end_date, expected_end);
    }

    #[test]
    fn given_future_last_sync_when_calculating_range_then_handles_gracefully() {
        let sync_service = create_test_sync_service();
        let future_sync = Utc::now() + Duration::days(1);
        let expected_end = Utc::now().date_naive();

        let (start_date, end_date) =
            sync_service.calculate_sync_date_range(Some(future_sync), None);

        assert!(start_date <= expected_end);
        assert_eq!(end_date, expected_end);
    }

    #[test]
    fn given_reference_date_when_calculating_range_then_anchors_to_client_calendar_day() {
        let reference_date = NaiveDate::from_ymd_opt(2025, 6, 15).unwrap();

        let (start_date, end_date) =
            SyncService::calculate_sync_date_range_static(None, Some(reference_date));

        assert_eq!(end_date, reference_date);
        let expected_start = reference_date
            .checked_sub_days(chrono::Days::new(90))
            .unwrap();
        assert_eq!(start_date, expected_start);
    }
}

mod sync_recent_transactions_integration_tests {
    use super::*;

    fn create_test_sync_service_for_integration() -> SyncService {
        let plaid_client = Arc::new(RealPlaidClient::new(
            "test_client_id".to_string(),
            "test_secret".to_string(),
            "sandbox".to_string(),
        ));
        let plaid_provider: Arc<dyn crate::providers::FinancialDataProvider> =
            Arc::new(PlaidProvider::new(plaid_client.clone()));
        let provider_registry = Arc::new(ProviderRegistry::from_providers([(
            "plaid",
            Arc::clone(&plaid_provider),
        )]));
        SyncService::new(provider_registry)
    }

    #[tokio::test]
    async fn given_no_last_sync_when_calling_sync_recent_transactions_then_uses_90_day_window() {
        let sync_service = create_test_sync_service_for_integration();
        let now = Utc::now().date_naive();

        let (start_date, end_date) = sync_service.calculate_sync_date_range(None, None);
        let expected_start = now.checked_sub_days(chrono::Days::new(90)).unwrap();
        let expected_end = now;

        assert_eq!(start_date, expected_start);
        assert_eq!(end_date, expected_end);
    }

    #[tokio::test]
    async fn given_recent_last_sync_when_calling_sync_recent_transactions_then_uses_incremental_window(
    ) {
        let last_sync = Utc::now() - Duration::days(3);
        let sync_service = create_test_sync_service_for_integration();
        let expected_end = Utc::now().date_naive();

        let (start_date, end_date) = sync_service.calculate_sync_date_range(Some(last_sync), None);
        let expected_start = (last_sync - Duration::days(2)).date_naive();

        assert_eq!(start_date, expected_start);
        assert_eq!(end_date, expected_end);
    }
}
