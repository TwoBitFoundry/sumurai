use crate::models::predicted_category::Confidence;
use crate::services::categorization::category_descriptors::PFC_CATEGORY_DESCRIPTORS;
use std::collections::BTreeSet;

#[test]
fn given_descriptor_table_when_collecting_keys_then_matches_expected_primary_set() {
    let expected = BTreeSet::from([
        "BANK_FEES",
        "ENTERTAINMENT",
        "FOOD_AND_DRINK",
        "GENERAL_MERCHANDISE",
        "GENERAL_SERVICES",
        "GOVERNMENT_AND_NON_PROFIT",
        "HOME_IMPROVEMENT",
        "INCOME",
        "LOAN_PAYMENTS",
        "MEDICAL",
        "PERSONAL_CARE",
        "RENT_AND_UTILITIES",
        "SHOPPING",
        "TRANSPORTATION",
        "TRANSFER_IN",
        "TRANSFER_OUT",
        "TRAVEL",
    ]);
    let actual = PFC_CATEGORY_DESCRIPTORS
        .iter()
        .map(|(primary, _)| *primary)
        .collect::<BTreeSet<_>>();

    assert_eq!(actual, expected);
}

#[test]
fn given_confidence_variant_when_converting_then_returns_expected_label() {
    assert_eq!(Confidence::High.as_str(), "HIGH");
    assert_eq!(Confidence::Medium.as_str(), "MEDIUM");
    assert_eq!(Confidence::Low.as_str(), "LOW");
}
