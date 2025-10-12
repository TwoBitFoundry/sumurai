use crate::models::{account::Account, transaction::Transaction};
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;

#[test]
fn given_teller_account_json_when_from_teller_then_maps_fields_correctly() {
    let teller_json = serde_json::json!({
        "id": "acc_test_123",
        "name": "Test Checking Account",
        "type": "depository",
        "subtype": "checking",
        "last_four": "9876",
        "status": "open",
        "currency": "USD",
        "institution": {
            "id": "test_bank",
            "name": "Test Bank"
        }
    });

    let account = Account::from_teller(&teller_json);

    assert_eq!(
        account.provider_account_id,
        Some("acc_test_123".to_string())
    );
    assert_eq!(account.name, "Test Checking Account");
    assert_eq!(account.account_type, "depository");
    assert_eq!(account.mask, Some("9876".to_string()));
    assert_eq!(account.institution_name, Some("Test Bank".to_string()));
    assert_eq!(account.balance_current, None);
}

#[test]
fn given_teller_account_with_missing_fields_when_from_teller_then_uses_defaults() {
    let teller_json = serde_json::json!({
        "id": "acc_456",
        "institution": {}
    });

    let account = Account::from_teller(&teller_json);

    assert_eq!(account.name, "Unknown");
    assert_eq!(account.account_type, "other");
    assert_eq!(account.mask, None);
    assert_eq!(account.institution_name, None);
}

#[test]
fn given_teller_transaction_json_when_from_teller_then_maps_fields_correctly() {
    let account_id = Uuid::new_v4();
    let teller_json = serde_json::json!({
        "id": "txn_test_123",
        "date": "2024-01-15",
        "amount": "-89.40",
        "description": "Coffee Shop",
        "status": "posted",
        "details": {
            "category": "general",
            "counterparty": {
                "type": "merchant",
                "name": "Starbucks"
            }
        }
    });

    let transaction = Transaction::from_teller(&teller_json, &account_id);

    assert_eq!(transaction.account_id, account_id);
    assert_eq!(
        transaction.provider_transaction_id,
        Some("txn_test_123".to_string())
    );
    assert_eq!(transaction.amount, Decimal::from_str("89.40").unwrap());
    assert_eq!(
        transaction.date.to_string(),
        "2024-01-15"
    );
    assert_eq!(transaction.merchant_name, Some("Starbucks".to_string()));
    assert_eq!(transaction.category_primary, "GENERAL_MERCHANDISE");
    assert_eq!(transaction.category_detailed, "");
    assert_eq!(transaction.category_confidence, "");
    assert_eq!(transaction.pending, false);
}

#[test]
fn given_teller_transaction_with_positive_amount_when_from_teller_then_converts_to_absolute() {
    let account_id = Uuid::new_v4();
    let teller_json = serde_json::json!({
        "id": "txn_deposit",
        "date": "2024-01-20",
        "amount": "1500.00",
        "description": "Paycheck",
        "status": "posted",
        "details": {
            "category": "service"
        }
    });

    let transaction = Transaction::from_teller(&teller_json, &account_id);

    assert_eq!(transaction.amount, Decimal::from_str("1500.00").unwrap());
}

#[test]
fn given_teller_transaction_with_service_category_when_from_teller_then_normalizes_to_general_services()
{
    let account_id = Uuid::new_v4();
    let teller_json = serde_json::json!({
        "id": "txn_service",
        "date": "2024-01-10",
        "amount": "-45.00",
        "description": "Haircut",
        "status": "posted",
        "details": {
            "category": "service"
        }
    });

    let transaction = Transaction::from_teller(&teller_json, &account_id);

    assert_eq!(transaction.category_primary, "GENERAL_SERVICES");
}

#[test]
fn given_teller_transaction_with_unknown_category_when_from_teller_then_normalizes_to_other() {
    let account_id = Uuid::new_v4();
    let teller_json = serde_json::json!({
        "id": "txn_unknown",
        "date": "2024-01-05",
        "amount": "-25.00",
        "description": "Unknown",
        "status": "posted",
        "details": {
            "category": "some_unknown_category"
        }
    });

    let transaction = Transaction::from_teller(&teller_json, &account_id);

    assert_eq!(transaction.category_primary, "OTHER");
}

#[test]
fn given_teller_transaction_with_pending_status_when_from_teller_then_pending_is_true() {
    let account_id = Uuid::new_v4();
    let teller_json = serde_json::json!({
        "id": "txn_pending",
        "date": "2024-01-25",
        "amount": "-100.00",
        "description": "Pending Purchase",
        "status": "pending",
        "details": {
            "category": "general"
        }
    });

    let transaction = Transaction::from_teller(&teller_json, &account_id);

    assert_eq!(transaction.pending, true);
}

#[test]
fn given_teller_transaction_without_counterparty_when_from_teller_then_uses_description_as_merchant()
{
    let account_id = Uuid::new_v4();
    let teller_json = serde_json::json!({
        "id": "txn_no_counterparty",
        "date": "2024-01-12",
        "amount": "-75.00",
        "description": "Generic Store",
        "status": "posted",
        "details": {
            "category": "general"
        }
    });

    let transaction = Transaction::from_teller(&teller_json, &account_id);

    assert_eq!(transaction.merchant_name, Some("Generic Store".to_string()));
}

#[test]
fn given_teller_transaction_with_invalid_date_when_from_teller_then_uses_current_date() {
    let account_id = Uuid::new_v4();
    let teller_json = serde_json::json!({
        "id": "txn_bad_date",
        "date": "invalid-date",
        "amount": "-50.00",
        "description": "Test",
        "status": "posted",
        "details": {
            "category": "general"
        }
    });

    let transaction = Transaction::from_teller(&teller_json, &account_id);

    let today = chrono::Utc::now().date_naive();
    assert_eq!(transaction.date, today);
}

#[test]
fn given_teller_transaction_with_zero_amount_when_from_teller_then_handles_gracefully() {
    let account_id = Uuid::new_v4();
    let teller_json = serde_json::json!({
        "id": "txn_zero",
        "date": "2024-01-15",
        "amount": "0.00",
        "description": "Fee Reversal",
        "status": "posted",
        "details": {
            "category": "general"
        }
    });

    let transaction = Transaction::from_teller(&teller_json, &account_id);

    assert_eq!(transaction.amount, Decimal::ZERO);
}
