use chrono::NaiveDate;
use rust_decimal_macros::dec;
use uuid::Uuid;

use crate::models::transaction::Transaction;
use crate::services::bill_detection::service::detect_and_assign_for_user;
use crate::services::repository_service::MockDatabaseRepository;

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
        normalization_source: None,
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
async fn detector_assigns_bill_for_stable_monthly_utility() {
    let user_id = Uuid::new_v4();
    let dates = monthly_dates(3);
    let transactions: Vec<Transaction> = dates
        .iter()
        .map(|&d| {
            make_txn(
                Uuid::new_v4(),
                user_id,
                "comcast",
                "RENT_AND_UTILITIES",
                d,
                dec!(-89.99),
            )
        })
        .collect();

    let ids: Vec<Uuid> = transactions.iter().map(|t| t.id).collect();
    let txns_clone = transactions.clone();

    let mut repo = MockDatabaseRepository::new();
    repo.expect_get_transactions_for_bill_detection()
        .times(1)
        .returning(move |_, _| {
            let t = txns_clone.clone();
            Box::pin(async move { Ok(t) })
        });
    repo.expect_update_transaction_categories_batch()
        .withf(move |_, updates| {
            updates.len() == 3
                && updates
                    .iter()
                    .all(|u| ids.contains(&u.transaction_id) && u.category_primary == "BILL")
        })
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let count = detect_and_assign_for_user(&repo, &user_id).await.unwrap();
    assert_eq!(count, 3);
}

#[tokio::test]
async fn detector_accepts_high_variance_within_35_pct_cv() {
    let user_id = Uuid::new_v4();
    let dates = monthly_dates(3);
    let amounts = [dec!(-80.00), dec!(-95.00), dec!(-105.00)];
    let transactions: Vec<Transaction> = dates
        .iter()
        .zip(amounts.iter())
        .map(|(&d, &a)| {
            make_txn(
                Uuid::new_v4(),
                user_id,
                "electricco",
                "RENT_AND_UTILITIES",
                d,
                a,
            )
        })
        .collect();

    let ids: Vec<Uuid> = transactions.iter().map(|t| t.id).collect();
    let txns_clone = transactions.clone();

    let mut repo = MockDatabaseRepository::new();
    repo.expect_get_transactions_for_bill_detection()
        .times(1)
        .returning(move |_, _| {
            let t = txns_clone.clone();
            Box::pin(async move { Ok(t) })
        });
    repo.expect_update_transaction_categories_batch()
        .withf(move |_, updates| {
            updates.len() == 3
                && updates
                    .iter()
                    .all(|u| ids.contains(&u.transaction_id) && u.category_primary == "BILL")
        })
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let count = detect_and_assign_for_user(&repo, &user_id).await.unwrap();
    assert_eq!(count, 3);
}

#[tokio::test]
async fn detector_rejects_variance_above_35_pct() {
    let user_id = Uuid::new_v4();
    let dates = monthly_dates(3);
    let amounts = [dec!(-20.00), dec!(-150.00), dec!(-80.00)];
    let transactions: Vec<Transaction> = dates
        .iter()
        .zip(amounts.iter())
        .map(|(&d, &a)| {
            make_txn(
                Uuid::new_v4(),
                user_id,
                "erraticutility",
                "RENT_AND_UTILITIES",
                d,
                a,
            )
        })
        .collect();

    let mut repo = MockDatabaseRepository::new();
    repo.expect_get_transactions_for_bill_detection()
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
async fn detector_skips_transactions_already_categorized_as_subscription() {
    let user_id = Uuid::new_v4();
    let dates = monthly_dates(3);
    let transactions: Vec<Transaction> = dates
        .iter()
        .map(|&d| {
            make_txn(
                Uuid::new_v4(),
                user_id,
                "xfinity",
                "SUBSCRIPTION",
                d,
                dec!(-89.99),
            )
        })
        .collect();

    let mut repo = MockDatabaseRepository::new();
    repo.expect_get_transactions_for_bill_detection()
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
        "statefarm",
        "INSURANCE",
        NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
        dec!(-120.00),
    )];

    let mut repo = MockDatabaseRepository::new();
    repo.expect_get_transactions_for_bill_detection()
        .times(1)
        .returning(move |_, _| {
            let t = transactions.clone();
            Box::pin(async move { Ok(t) })
        });
    repo.expect_update_transaction_categories_batch().times(0);

    let count = detect_and_assign_for_user(&repo, &user_id).await.unwrap();
    assert_eq!(count, 0);
}
