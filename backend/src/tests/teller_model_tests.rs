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
    assert_eq!(
        transaction.category_detailed,
        "GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE"
    );
    assert_eq!(transaction.category_confidence, "");
    assert!(!transaction.pending);
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
    assert_eq!(
        transaction.category_detailed,
        "GENERAL_SERVICES_OTHER_GENERAL_SERVICES"
    );
}

#[test]
fn given_teller_transaction_with_unknown_category_when_from_teller_then_normalizes_to_other() {
    let account_id = Uuid::new_v4();
    let teller_json =
        serde_json::from_str(TestFixtures::teller_transaction_unknown_category()).unwrap();

    let transaction = Transaction::from_teller(&teller_json, &account_id, Some("acc_test_123"));

    assert_eq!(transaction.category_primary, "OTHER");
    assert_eq!(transaction.category_detailed, "OTHER");
}

#[test]
fn given_teller_transaction_with_dining_category_when_from_teller_then_maps_to_food_and_drink() {
    let account_id = Uuid::new_v4();
    let teller_json = serde_json::from_str(TestFixtures::teller_transaction_dining()).unwrap();

    let transaction = Transaction::from_teller(&teller_json, &account_id, Some("acc_test_123"));

    assert_eq!(transaction.category_primary, "FOOD_AND_DRINK");
    assert_eq!(transaction.category_detailed, "FOOD_AND_DRINK_RESTAURANT");
}

#[test]
fn given_teller_transaction_with_fuel_category_when_from_teller_then_maps_to_transportation() {
    let account_id = Uuid::new_v4();
    let teller_json = serde_json::from_str(TestFixtures::teller_transaction_fuel()).unwrap();

    let transaction = Transaction::from_teller(&teller_json, &account_id, Some("acc_test_123"));

    assert_eq!(transaction.category_primary, "TRANSPORTATION");
    assert_eq!(transaction.category_detailed, "TRANSPORTATION_GAS");
}

#[test]
fn given_teller_transaction_with_income_category_when_from_teller_then_maps_to_income() {
    let account_id = Uuid::new_v4();
    let teller_json = serde_json::from_str(TestFixtures::teller_transaction_income()).unwrap();

    let transaction = Transaction::from_teller(&teller_json, &account_id, Some("acc_test_123"));

    assert_eq!(transaction.category_primary, "INCOME");
    assert_eq!(transaction.category_detailed, "INCOME_WAGES");
}

#[test]
fn given_teller_transaction_with_investment_inflow_when_from_teller_then_maps_to_transfer_in() {
    let account_id = Uuid::new_v4();
    let teller_json =
        serde_json::from_str(TestFixtures::teller_transaction_investment_inflow()).unwrap();

    let transaction = Transaction::from_teller(&teller_json, &account_id, Some("acc_test_123"));

    assert_eq!(transaction.category_primary, "TRANSFER_IN");
    assert_eq!(
        transaction.category_detailed,
        "TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS"
    );
}

#[test]
fn given_teller_transaction_with_investment_outflow_when_from_teller_then_maps_to_transfer_out() {
    let account_id = Uuid::new_v4();
    let teller_json =
        serde_json::from_str(TestFixtures::teller_transaction_investment_outflow()).unwrap();

    let transaction = Transaction::from_teller(&teller_json, &account_id, Some("acc_test_123"));

    assert_eq!(transaction.category_primary, "TRANSFER_OUT");
    assert_eq!(
        transaction.category_detailed,
        "TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS"
    );
}

#[test]
fn given_teller_transaction_with_utilities_category_when_from_teller_then_maps_to_rent_and_utilities(
) {
    let account_id = Uuid::new_v4();
    let teller_json = serde_json::from_str(TestFixtures::teller_transaction_utilities()).unwrap();

    let transaction = Transaction::from_teller(&teller_json, &account_id, Some("acc_test_123"));

    assert_eq!(transaction.category_primary, "RENT_AND_UTILITIES");
    assert_eq!(
        transaction.category_detailed,
        "RENT_AND_UTILITIES_GAS_AND_ELECTRICITY"
    );
}

#[test]
fn given_teller_transaction_with_null_category_when_from_teller_then_maps_to_other() {
    let account_id = Uuid::new_v4();
    let teller_json =
        serde_json::from_str(TestFixtures::teller_transaction_null_category()).unwrap();

    let transaction = Transaction::from_teller(&teller_json, &account_id, Some("acc_test_123"));

    assert_eq!(transaction.category_primary, "OTHER");
    assert_eq!(transaction.category_detailed, "OTHER");
}

#[test]
fn given_teller_transaction_with_pending_status_when_from_teller_then_pending_is_true() {
    let account_id = Uuid::new_v4();
    let teller_json =
        serde_json::from_str(TestFixtures::teller_transaction_pending_purchase()).unwrap();

    let transaction = Transaction::from_teller(&teller_json, &account_id, Some("acc_test_123"));

    assert!(transaction.pending);
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
fn merchant_name_from_teller_falls_back_when_counterparty_name_empty() {
    let v = serde_json::json!({
        "description": "Statement line text",
        "details": {
            "category": "general",
            "counterparty": { "name": "", "type": "organization" }
        }
    });
    assert_eq!(
        Transaction::merchant_name_from_teller(&v),
        Some("Statement Line Text".to_string())
    );
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
