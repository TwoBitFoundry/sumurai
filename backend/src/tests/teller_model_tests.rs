use crate::models::{account::Account, transaction::Transaction};
use crate::test_fixtures::TestFixtures;
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;

#[test]
fn given_teller_account_json_when_from_teller_then_maps_fields_correctly() {
    let teller_json = serde_json::from_str(TestFixtures::teller_account_test_checking()).unwrap();

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
    let teller_json = serde_json::from_str(TestFixtures::teller_account_minimal()).unwrap();

    let account = Account::from_teller(&teller_json);

    assert_eq!(account.name, "Unknown");
    assert_eq!(account.account_type, "other");
    assert_eq!(account.mask, None);
    assert_eq!(account.institution_name, None);
}

#[test]
fn given_teller_transaction_json_when_from_teller_then_maps_fields_correctly() {
    let account_id = Uuid::new_v4();
    let provider_account_id = "acc_test_123";
    let teller_json = serde_json::from_str(TestFixtures::teller_transaction_coffee_shop()).unwrap();

    let transaction =
        Transaction::from_teller(&teller_json, &account_id, Some(provider_account_id));

    assert_eq!(transaction.account_id, account_id);
    assert_eq!(
        transaction.provider_transaction_id,
        Some("txn_test_123".to_string())
    );
    assert_eq!(
        transaction.provider_account_id,
        Some(provider_account_id.to_string())
    );
    assert_eq!(transaction.amount, Decimal::from_str("89.40").unwrap());
    assert_eq!(transaction.date.to_string(), "2024-01-15");
    assert_eq!(transaction.merchant_name, Some("Starbucks".to_string()));
    assert_eq!(transaction.category_primary, "GENERAL_MERCHANDISE");
    assert_eq!(transaction.category_detailed, "");
    assert_eq!(transaction.category_confidence, "");
    assert_eq!(transaction.pending, false);
}

#[test]
fn given_teller_transaction_with_positive_amount_when_from_teller_then_converts_to_absolute() {
    let account_id = Uuid::new_v4();
    let teller_json = serde_json::from_str(TestFixtures::teller_transaction_deposit()).unwrap();

    let transaction = Transaction::from_teller(&teller_json, &account_id, Some("acc_test_123"));

    assert_eq!(transaction.amount, Decimal::from_str("1500.00").unwrap());
}

#[test]
fn given_teller_transaction_with_service_category_when_from_teller_then_normalizes_to_general_services(
) {
    let account_id = Uuid::new_v4();
    let teller_json =
        serde_json::from_str(TestFixtures::teller_transaction_service_category()).unwrap();

    let transaction = Transaction::from_teller(&teller_json, &account_id, Some("acc_test_123"));

    assert_eq!(transaction.category_primary, "GENERAL_SERVICES");
}

#[test]
fn given_teller_transaction_with_unknown_category_when_from_teller_then_normalizes_to_other() {
    let account_id = Uuid::new_v4();
    let teller_json =
        serde_json::from_str(TestFixtures::teller_transaction_unknown_category()).unwrap();

    let transaction = Transaction::from_teller(&teller_json, &account_id, Some("acc_test_123"));

    assert_eq!(transaction.category_primary, "OTHER");
}

#[test]
fn given_teller_transaction_with_pending_status_when_from_teller_then_pending_is_true() {
    let account_id = Uuid::new_v4();
    let teller_json =
        serde_json::from_str(TestFixtures::teller_transaction_pending_purchase()).unwrap();

    let transaction = Transaction::from_teller(&teller_json, &account_id, Some("acc_test_123"));

    assert_eq!(transaction.pending, true);
}

#[test]
fn given_teller_transaction_without_counterparty_when_from_teller_then_uses_description_as_merchant(
) {
    let account_id = Uuid::new_v4();
    let teller_json =
        serde_json::from_str(TestFixtures::teller_transaction_generic_store()).unwrap();

    let transaction = Transaction::from_teller(&teller_json, &account_id, Some("acc_test_123"));

    assert_eq!(transaction.merchant_name, Some("Generic Store".to_string()));
}

#[test]
fn given_teller_transaction_with_invalid_date_when_from_teller_then_uses_current_date() {
    let account_id = Uuid::new_v4();
    let teller_json =
        serde_json::from_str(TestFixtures::teller_transaction_invalid_date()).unwrap();

    let transaction = Transaction::from_teller(&teller_json, &account_id, Some("acc_test_123"));

    let today = chrono::Utc::now().date_naive();
    assert_eq!(transaction.date, today);
}

#[test]
fn given_teller_transaction_with_zero_amount_when_from_teller_then_handles_gracefully() {
    let account_id = Uuid::new_v4();
    let teller_json = serde_json::from_str(TestFixtures::teller_transaction_zero_amount()).unwrap();

    let transaction = Transaction::from_teller(&teller_json, &account_id, Some("acc_test_123"));

    assert_eq!(transaction.amount, Decimal::ZERO);
}
