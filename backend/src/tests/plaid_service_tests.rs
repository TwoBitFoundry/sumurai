use crate::services::plaid_service::{PlaidService, RealPlaidClient};
use crate::test_fixtures::TestFixtures;
use serde_json::Value;
use std::sync::Arc;

#[test]
fn test_detect_duplicates_filters_existing_transactions() {
    let plaid_client = RealPlaidClient::new(
        "test_client_id".to_string(),
        "test_secret".to_string(),
        "sandbox".to_string(),
    );
    let service = PlaidService::new(Arc::new(plaid_client));

    let (existing, new_with_duplicates) = TestFixtures::duplicate_test_transactions();
    let unique_transactions = service.detect_duplicates(&existing, &new_with_duplicates);

    assert_eq!(unique_transactions.len(), 1);
    assert_eq!(
        unique_transactions[0].provider_transaction_id.as_deref(),
        Some("new_txn_001")
    );
}

#[test]
fn test_detect_duplicates_handles_empty_collections() {
    let plaid_client = RealPlaidClient::new(
        "test_client_id".to_string(),
        "test_secret".to_string(),
        "sandbox".to_string(),
    );
    let service = PlaidService::new(Arc::new(plaid_client));

    let existing = TestFixtures::empty_transactions();
    let new_transactions = TestFixtures::empty_transactions();

    let unique_transactions = service.detect_duplicates(&existing, &new_transactions);
    assert_eq!(unique_transactions.len(), 0);
}

#[test]
fn test_detect_duplicates_handles_transactions_without_plaid_ids() {
    let plaid_client = RealPlaidClient::new(
        "test_client_id".to_string(),
        "test_secret".to_string(),
        "sandbox".to_string(),
    );
    let service = PlaidService::new(Arc::new(plaid_client));

    let existing = TestFixtures::empty_transactions();
    let mut new_transaction = TestFixtures::sample_transactions()[0].clone();
    new_transaction.provider_transaction_id = None;
    let new_transactions = vec![new_transaction.clone()];

    let unique_transactions = service.detect_duplicates(&existing, &new_transactions);
    assert_eq!(unique_transactions.len(), 1);
    assert_eq!(unique_transactions[0].amount, new_transaction.amount);
}

#[test]
fn test_category_parsing_logic_extracts_correct_values() {
    // Test the category extraction logic from Plaid API responses
    let plaid_transaction: Value =
        serde_json::from_str(TestFixtures::plaid_transaction_with_category_json()).unwrap();

    // This mirrors the category extraction logic from PlaidService::get_transactions
    let category_primary = plaid_transaction
        .get("personal_finance_category")
        .and_then(|pfc| pfc.get("primary"))
        .and_then(|v| v.as_str())
        .unwrap_or("OTHER")
        .to_string();

    let category_detailed = plaid_transaction
        .get("personal_finance_category")
        .and_then(|pfc| pfc.get("detailed"))
        .and_then(|v| v.as_str())
        .unwrap_or(&category_primary)
        .to_string();

    let category_confidence = plaid_transaction
        .get("personal_finance_category")
        .and_then(|pfc| pfc.get("confidence_level"))
        .and_then(|v| v.as_str())
        .unwrap_or("MEDIUM")
        .to_string();

    let payment_channel = plaid_transaction
        .get("payment_channel")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let pending = plaid_transaction
        .get("pending")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    // Verify extracted values match expected Plaid API format
    assert_eq!(category_primary, "FOOD_AND_DRINK");
    assert_eq!(category_detailed, "FOOD_AND_DRINK_RESTAURANTS");
    assert_eq!(category_confidence, "VERY_HIGH");
    assert_eq!(payment_channel, Some("in_store".to_string()));
    assert_eq!(pending, false);
}

#[test]
fn test_category_parsing_handles_missing_fields() {
    // Test with minimal transaction data (missing optional fields)
    let plaid_transaction: Value =
        serde_json::from_str(TestFixtures::plaid_transaction_minimal_json()).unwrap();

    let category_primary = plaid_transaction
        .get("personal_finance_category")
        .and_then(|pfc| pfc.get("primary"))
        .and_then(|v| v.as_str())
        .unwrap_or("OTHER")
        .to_string();

    let category_detailed = plaid_transaction
        .get("personal_finance_category")
        .and_then(|pfc| pfc.get("detailed"))
        .and_then(|v| v.as_str())
        .unwrap_or(&category_primary)
        .to_string();

    let category_confidence = plaid_transaction
        .get("personal_finance_category")
        .and_then(|pfc| pfc.get("confidence_level"))
        .and_then(|v| v.as_str())
        .unwrap_or("MEDIUM")
        .to_string();

    let payment_channel = plaid_transaction
        .get("payment_channel")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let pending = plaid_transaction
        .get("pending")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    // Verify defaults are used when fields are missing
    assert_eq!(category_primary, "OTHER");
    assert_eq!(category_detailed, "OTHER"); // Falls back to primary when detailed missing
    assert_eq!(category_confidence, "MEDIUM");
    assert_eq!(payment_channel, None);
    assert_eq!(pending, false);
}
