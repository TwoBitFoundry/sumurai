use crate::models::predicted_category::Confidence;
use crate::services::categorization::category_descriptors::{
    system_category_display_label, SYSTEM_CATEGORY_SLUGS,
};
use crate::services::categorization::classifier_labels::{
    deterministic_prediction, pfc_primary_for_classifier_label,
};

#[test]
fn subscription_category_in_slugs_and_has_display_label() {
    assert!(SYSTEM_CATEGORY_SLUGS.contains(&"SUBSCRIPTION"));
    assert_eq!(
        system_category_display_label("SUBSCRIPTION"),
        Some("Subscriptions")
    );
}

#[test]
fn subscription_classifier_label_maps_to_subscription_category() {
    assert_eq!(
        pfc_primary_for_classifier_label("Subscription", "[debit] NETFLIX.COM"),
        Some("SUBSCRIPTION")
    );
}

#[test]
fn entertainment_classifier_label_still_maps_to_entertainment() {
    assert_eq!(
        pfc_primary_for_classifier_label("Entertainment", "[debit] AMC THEATERS"),
        Some("ENTERTAINMENT")
    );
}

#[test]
fn known_master_list_brands_classify_as_subscription_deterministically() {
    let cases = vec![
        "[debit] NETFLIX.COM",
        "[debit] SPOTIFY USA",
        "[debit] HULU LLC",
        "[debit] DISNEY PLUS",
        "[debit] HBO MAX",
        "[debit] PARAMOUNT PLUS",
        "[debit] PEACOCK TV",
        "[debit] APPLE.COM/BILL",
        "[debit] YOUTUBE PREMIUM",
        "[debit] AMAZON PRIME",
        "[debit] DROPBOX",
        "[debit] AUDIBLE",
        "[debit] PATREON",
    ];
    for input in cases {
        let pred = deterministic_prediction(input);
        assert!(pred.is_some(), "expected prediction for {input}");
        let pred = pred.unwrap();
        assert_eq!(pred.primary, "SUBSCRIPTION", "{input}");
        assert_eq!(pred.confidence, Confidence::High, "{input}");
    }
}

#[test]
fn master_list_rule_fires_before_keyword_subscription_branch() {
    let pred = deterministic_prediction("[debit] NETFLIX.COM").unwrap();
    assert_eq!(pred.primary, "SUBSCRIPTION");
}

#[test]
fn non_subscription_merchants_not_matched_by_master_list() {
    assert!(deterministic_prediction("[debit] BLUE OAK MARKETPLACE").is_none());
    assert!(
        deterministic_prediction("[credit] ACME CORP PAYROLL")
            .unwrap()
            .primary
            == "INCOME"
    );
}
