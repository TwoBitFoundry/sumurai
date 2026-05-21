use crate::models::predicted_category::Confidence;
use crate::services::categorization::classifier_labels::{
    classify_logits, format_classifier_input, pfc_primary_for_classifier_label,
};
use rust_decimal::Decimal;

struct ClassifierFixture {
    description: &'static str,
    amount: Decimal,
    model_label: &'static str,
    expected_primary: &'static str,
}

fn logits_for(labels: &[String], winning_label: &str, winning_score: f32) -> Vec<f32> {
    labels
        .iter()
        .map(|label| {
            if label == winning_label {
                winning_score
            } else {
                0.0
            }
        })
        .collect()
}

#[test]
fn given_classifier_labels_when_mapping_then_returns_pfc_primaries() {
    assert_eq!(
        pfc_primary_for_classifier_label("Groceries", "[debit] SAFEWAY #123"),
        Some("FOOD_AND_DRINK")
    );
    assert_eq!(
        pfc_primary_for_classifier_label("Restaurants", "[debit] STARBUCKS"),
        Some("FOOD_AND_DRINK")
    );
    assert_eq!(
        pfc_primary_for_classifier_label("Utilities", "[debit] PG&E WEB ONLINE"),
        Some("RENT_AND_UTILITIES")
    );
    assert_eq!(
        pfc_primary_for_classifier_label("Transfer", "[credit] VENMO CASHOUT"),
        Some("TRANSFER_IN")
    );
    assert_eq!(
        pfc_primary_for_classifier_label("Transfer", "[debit] CHASE CREDIT CRD AUTOPAY"),
        Some("TRANSFER_OUT")
    );
    assert_eq!(
        pfc_primary_for_classifier_label("Unsupported", "[debit] UNKNOWN"),
        None
    );
}

#[test]
fn given_amount_and_description_when_formatting_classifier_input_then_adds_direction_prefix() {
    assert_eq!(
        format_classifier_input(&Decimal::new(-1234, 2), "  STARBUCKS #1234  "),
        "[debit] STARBUCKS #1234"
    );
    assert_eq!(
        format_classifier_input(&Decimal::new(50000, 2), "ACME CORP PAYROLL"),
        "[credit] ACME CORP PAYROLL"
    );
}

#[test]
fn given_broad_classifier_fixtures_when_mapping_then_generalizes_without_merchant_overrides() {
    let fixtures = vec![
        ClassifierFixture {
            description: "WHOLE FOODS MARKET #123",
            amount: Decimal::new(-1234, 2),
            model_label: "Groceries",
            expected_primary: "FOOD_AND_DRINK",
        },
        ClassifierFixture {
            description: "SHELL OIL 5512",
            amount: Decimal::new(-4567, 2),
            model_label: "Transportation",
            expected_primary: "TRANSPORTATION",
        },
        ClassifierFixture {
            description: "PreApproved Payment Bill User Payment: Netflix",
            amount: Decimal::new(-1599, 2),
            model_label: "Subscription",
            expected_primary: "ENTERTAINMENT",
        },
        ClassifierFixture {
            description: "PG&E WEB ONLINE",
            amount: Decimal::new(-8215, 2),
            model_label: "Utilities",
            expected_primary: "RENT_AND_UTILITIES",
        },
        ClassifierFixture {
            description: "PAYMENT 1234",
            amount: Decimal::new(-25000, 2),
            model_label: "Transfer",
            expected_primary: "TRANSFER_OUT",
        },
        ClassifierFixture {
            description: "ACME CORP PAYROLL PPD ID: 123456789",
            amount: Decimal::new(420000, 2),
            model_label: "Income",
            expected_primary: "INCOME",
        },
        ClassifierFixture {
            description: "ATM FEE NON NETWORK",
            amount: Decimal::new(-350, 2),
            model_label: "Fees",
            expected_primary: "BANK_FEES",
        },
        ClassifierFixture {
            description: "KAISER PERMANENTE COPAY",
            amount: Decimal::new(-2500, 2),
            model_label: "Healthcare",
            expected_primary: "MEDICAL",
        },
        ClassifierFixture {
            description: "DELTA AIR LINES",
            amount: Decimal::new(-20317, 2),
            model_label: "Travel",
            expected_primary: "TRAVEL",
        },
        ClassifierFixture {
            description: "CHASE MORTGAGE AUTOPAY",
            amount: Decimal::new(-210000, 2),
            model_label: "Mortgage",
            expected_primary: "LOAN_PAYMENTS",
        },
    ];

    for fixture in fixtures {
        let input = format_classifier_input(&fixture.amount, fixture.description);
        assert_eq!(
            pfc_primary_for_classifier_label(fixture.model_label, &input),
            Some(fixture.expected_primary)
        );
    }
}

#[test]
fn given_classifier_logits_when_confident_then_returns_mapped_prediction() {
    let labels = vec![
        "Groceries".to_string(),
        "Utilities".to_string(),
        "Transfer".to_string(),
    ];
    let logits = logits_for(&labels, "Utilities", 8.0);

    let prediction = classify_logits(&labels, &logits, "[debit] PG&E WEB ONLINE");

    assert_eq!(prediction.primary, "RENT_AND_UTILITIES");
    assert_eq!(prediction.confidence, Confidence::High);
}

#[test]
fn given_classifier_logits_below_threshold_when_classifying_then_returns_other() {
    let labels = vec![
        "Groceries".to_string(),
        "Utilities".to_string(),
        "Transfer".to_string(),
    ];
    let logits = vec![0.2, 0.1, 0.0];

    let prediction = classify_logits(&labels, &logits, "[debit] UNKNOWN MARKET");

    assert_eq!(prediction.primary, "OTHER");
    assert_eq!(prediction.confidence, Confidence::Low);
}
