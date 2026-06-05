use chrono::NaiveDate;
use rust_decimal_macros::dec;
use uuid::Uuid;

use crate::models::predicted_category::Confidence;
use crate::models::transaction::Transaction;
use crate::services::categorization::category_descriptors::{
    system_category_display_label, SYSTEM_CATEGORY_SLUGS,
};
use crate::services::categorization::classifier_labels::{
    deterministic_prediction, pfc_primary_for_classifier_label,
};
use crate::services::repository_service::MockDatabaseRepository;
use crate::services::subscription_detection::service::detect_and_assign_for_user;

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

#[allow(clippy::too_many_arguments)]
fn make_txn(
    id: Uuid,
    user_id: Uuid,
    normalized: &str,
    category: &str,
    date: NaiveDate,
    amount: rust_decimal::Decimal,
) -> Transaction {
    Transaction {
        id,
        account_id: Uuid::new_v4(),
        user_id: Some(user_id),
        provider_account_id: None,
        provider_transaction_id: Some(id.to_string()),
        amount,
        date,
        merchant_name: Some(normalized.to_string()),
        category_primary: category.to_string(),
        category_detailed: category.to_string(),
        category_confidence: "HIGH".to_string(),
        payment_channel: None,
        pending: false,
        created_at: None,
        original_merchant_name: None,
        normalized_merchant: Some(normalized.to_string()),
    }
}

fn monthly_dates(count: u32) -> Vec<NaiveDate> {
    (0..count)
        .map(|i| {
            NaiveDate::from_ymd_opt(2024, 1, 1)
                .unwrap()
                .checked_add_months(chrono::Months::new(i))
                .unwrap()
        })
        .collect()
}

#[tokio::test]
async fn detector_assigns_subscription_for_stable_monthly_merchant_with_three_occurrences() {
    let user_id = Uuid::new_v4();
    let dates = monthly_dates(3);
    let transactions: Vec<Transaction> = dates
        .iter()
        .map(|&d| {
            make_txn(
                Uuid::new_v4(),
                user_id,
                "spotify",
                "ENTERTAINMENT",
                d,
                dec!(-9.99),
            )
        })
        .collect();

    let ids: Vec<Uuid> = transactions.iter().map(|t| t.id).collect();
    let txns_clone = transactions.clone();

    let mut repo = MockDatabaseRepository::new();
    repo.expect_get_transactions_for_subscription_detection()
        .times(1)
        .returning(move |_, _| {
            let t = txns_clone.clone();
            Box::pin(async move { Ok(t) })
        });
    repo.expect_update_transaction_categories_batch()
        .withf(move |_, updates| {
            updates.len() == 3
                && updates.iter().all(|u| {
                    ids.contains(&u.transaction_id) && u.category_primary == "SUBSCRIPTION"
                })
        })
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let count = detect_and_assign_for_user(&repo, &user_id).await.unwrap();
    assert_eq!(count, 3);
}

#[tokio::test]
async fn detector_rejects_high_variance_amounts() {
    let user_id = Uuid::new_v4();
    let dates = monthly_dates(3);
    let amounts = [dec!(-9.99), dec!(-19.99), dec!(-4.99)];
    let transactions: Vec<Transaction> = dates
        .iter()
        .zip(amounts.iter())
        .map(|(&d, &a)| {
            make_txn(
                Uuid::new_v4(),
                user_id,
                "varmerchant",
                "ENTERTAINMENT",
                d,
                a,
            )
        })
        .collect();

    let mut repo = MockDatabaseRepository::new();
    repo.expect_get_transactions_for_subscription_detection()
        .times(1)
        .returning(move |_, _| {
            let t = transactions.clone();
            Box::pin(async move { Ok(t) })
        });
    repo.expect_update_transaction_categories_batch().times(0);

    let count = detect_and_assign_for_user(&repo, &user_id).await.unwrap();
    assert_eq!(count, 0);
}

#[tokio::test]
async fn detector_rejects_sub_threshold_count() {
    let user_id = Uuid::new_v4();
    let transactions = vec![make_txn(
        Uuid::new_v4(),
        user_id,
        "somemerchant",
        "ENTERTAINMENT",
        NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
        dec!(-9.99),
    )];

    let mut repo = MockDatabaseRepository::new();
    repo.expect_get_transactions_for_subscription_detection()
        .times(1)
        .returning(move |_, _| {
            let t = transactions.clone();
            Box::pin(async move { Ok(t) })
        });
    repo.expect_update_transaction_categories_batch().times(0);

    let count = detect_and_assign_for_user(&repo, &user_id).await.unwrap();
    assert_eq!(count, 0);
}

#[tokio::test]
async fn detector_ignores_exclusion_list_merchants() {
    let user_id = Uuid::new_v4();
    let dates = monthly_dates(3);
    let transactions: Vec<Transaction> = dates
        .iter()
        .map(|&d| {
            make_txn(
                Uuid::new_v4(),
                user_id,
                "starbucks",
                "FOOD_AND_DRINK",
                d,
                dec!(-5.50),
            )
        })
        .collect();

    let mut repo = MockDatabaseRepository::new();
    repo.expect_get_transactions_for_subscription_detection()
        .times(1)
        .returning(move |_, _| {
            let t = transactions.clone();
            Box::pin(async move { Ok(t) })
        });
    repo.expect_update_transaction_categories_batch().times(0);

    let count = detect_and_assign_for_user(&repo, &user_id).await.unwrap();
    assert_eq!(count, 0);
}

#[tokio::test]
async fn detector_skips_already_subscription_transactions() {
    let user_id = Uuid::new_v4();
    let dates = monthly_dates(3);
    let transactions: Vec<Transaction> = dates
        .iter()
        .map(|&d| {
            make_txn(
                Uuid::new_v4(),
                user_id,
                "spotify",
                "SUBSCRIPTION",
                d,
                dec!(-9.99),
            )
        })
        .collect();

    let mut repo = MockDatabaseRepository::new();
    repo.expect_get_transactions_for_subscription_detection()
        .times(1)
        .returning(move |_, _| {
            let t = transactions.clone();
            Box::pin(async move { Ok(t) })
        });
    repo.expect_update_transaction_categories_batch().times(0);

    let count = detect_and_assign_for_user(&repo, &user_id).await.unwrap();
    assert_eq!(count, 0);
}
