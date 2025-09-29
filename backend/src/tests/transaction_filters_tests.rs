use crate::models::transaction::Transaction;
use crate::utils::transaction_filters::filter_transactions_by_account_ids;
use chrono::NaiveDate;
use rust_decimal_macros::dec;
use uuid::Uuid;

#[test]
fn given_empty_account_filter_when_filtering_then_returns_all_transactions() {
    let account_id = Uuid::new_v4();
    let transactions = vec![Transaction::new_mock(
        account_id,
        dec!(100.00),
        NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
        Some("Test".to_string()),
        "Food".to_string(),
        "Restaurants".to_string(),
    )];

    let result = filter_transactions_by_account_ids(transactions.clone(), &[]);
    assert_eq!(result.len(), 1);
    assert_eq!(result, transactions);
}

#[test]
fn given_matching_account_filter_when_filtering_then_returns_filtered_transactions() {
    let account_id_1 = Uuid::new_v4();
    let account_id_2 = Uuid::new_v4();

    let transactions = vec![
        Transaction::new_mock(
            account_id_1,
            dec!(100.00),
            NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
            Some("Test 1".to_string()),
            "Food".to_string(),
            "Restaurants".to_string(),
        ),
        Transaction::new_mock(
            account_id_2,
            dec!(200.00),
            NaiveDate::from_ymd_opt(2024, 1, 2).unwrap(),
            Some("Test 2".to_string()),
            "Food".to_string(),
            "Restaurants".to_string(),
        ),
    ];

    let filter = vec![account_id_1.to_string()];
    let result = filter_transactions_by_account_ids(transactions, &filter);

    assert_eq!(result.len(), 1);
    assert_eq!(result[0].account_id, account_id_1);
}

#[test]
fn given_non_matching_account_filter_when_filtering_then_returns_empty() {
    let account_id = Uuid::new_v4();
    let other_account_id = Uuid::new_v4();

    let transactions = vec![Transaction::new_mock(
        account_id,
        dec!(100.00),
        NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
        Some("Test".to_string()),
        "Food".to_string(),
        "Restaurants".to_string(),
    )];

    let filter = vec![other_account_id.to_string()];
    let result = filter_transactions_by_account_ids(transactions, &filter);

    assert!(result.is_empty());
}

#[test]
fn given_invalid_uuid_in_filter_when_filtering_then_ignores_invalid_uuid() {
    let account_id = Uuid::new_v4();

    let transactions = vec![Transaction::new_mock(
        account_id,
        dec!(100.00),
        NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
        Some("Test".to_string()),
        "Food".to_string(),
        "Restaurants".to_string(),
    )];

    let filter = vec!["invalid-uuid".to_string(), account_id.to_string()];
    let result = filter_transactions_by_account_ids(transactions, &filter);

    assert_eq!(result.len(), 1);
    assert_eq!(result[0].account_id, account_id);
}
