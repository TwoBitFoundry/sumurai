use crate::models::transaction::Transaction;
use crate::utils::merchant_name::normalize_merchant_display_case;
use serde_json::json;

#[test]
fn normalize_merchant_display_case_all_caps_words() {
    assert_eq!(
        normalize_merchant_display_case("EXXON MOBIL"),
        "Exxon Mobil"
    );
    assert_eq!(
        normalize_merchant_display_case("BANK OF ALL"),
        "Bank Of All"
    );
}

#[test]
fn normalize_merchant_display_case_hyphenated() {
    assert_eq!(
        normalize_merchant_display_case("WATER-SUPPLY COMPANY"),
        "Water-Supply Company"
    );
}

#[test]
fn normalize_merchant_display_case_preserves_already_mixed() {
    assert_eq!(normalize_merchant_display_case("Starbucks"), "Starbucks");
}

#[test]
fn merchant_name_from_plaid_normalizes() {
    let v = json!({ "merchant_name": "AMERICAN EXPRESS" });
    assert_eq!(
        Transaction::merchant_name_from_plaid(&v),
        Some("American Express".to_string())
    );
}
