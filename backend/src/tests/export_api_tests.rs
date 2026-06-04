use axum::body::to_bytes;
use axum::http::header::{CONTENT_DISPOSITION, CONTENT_TYPE};
use chrono::NaiveDate;
use tower::ServiceExt;
use uuid::Uuid;

use crate::models::account::Account;
use crate::models::transaction::TransactionWithAccount;
use crate::services::repository_service::MockDatabaseRepository;
use crate::test_fixtures::TestFixtures;

#[allow(clippy::too_many_arguments)]
fn sample_account(
    id: Uuid,
    provider_connection_id: Uuid,
    name: &str,
    account_type: &str,
    mask: &str,
    institution_name: &str,
) -> Account {
    Account {
        id,
        user_id: Some(Uuid::new_v4()),
        provider_account_id: Some(format!("provider-{id}")),
        provider_connection_id: Some(provider_connection_id),
        name: name.to_string(),
        account_type: account_type.to_string(),
        balance_current: Some(rust_decimal_macros::dec!(100.00)),
        mask: Some(mask.to_string()),
        institution_name: Some(institution_name.to_string()),
        provider_conn_id: None,
    }
}

#[allow(clippy::too_many_arguments)]
fn sample_transaction(
    account_id: Uuid,
    account_name: &str,
    amount: rust_decimal::Decimal,
    date: NaiveDate,
    merchant_name: &str,
    category_primary: &str,
    provider_transaction_id: &str,
) -> TransactionWithAccount {
    TransactionWithAccount {
        id: Uuid::new_v4(),
        account_id,
        user_id: Some(Uuid::new_v4()),
        provider_account_id: Some(format!("provider-{account_id}")),
        provider_transaction_id: Some(provider_transaction_id.to_string()),
        amount,
        date,
        merchant_name: Some(merchant_name.to_string()),
        category_primary: category_primary.to_string(),
        category_detailed: category_primary.to_string(),
        category_confidence: "high".to_string(),
        payment_channel: Some("online".to_string()),
        pending: false,
        created_at: None,
        account_name: account_name.to_string(),
        account_type: "depository".to_string(),
        account_mask: Some("1234".to_string()),
        is_custom: false,
        is_overridden: false,
    }
}

fn expected_attachment_filename(label: &str, start: &str, end: &str, extension: &str) -> String {
    format!(
        "attachment; filename=\"sumurai-export-{}-{}-{}.{}\"",
        label, start, end, extension
    )
}

#[tokio::test]
async fn given_authenticated_user_when_exporting_csv_then_returns_attachment_and_content() {
    let mut mock_db = MockDatabaseRepository::new();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();
    let account_id = Uuid::new_v4();
    let connection_id = Uuid::new_v4();
    let account = sample_account(
        account_id,
        connection_id,
        "Demo Checking",
        "depository",
        "1234",
        "Demo Bank",
    );
    let transaction = sample_transaction(
        account_id,
        "Demo Checking",
        rust_decimal_macros::dec!(-12.34),
        NaiveDate::from_ymd_opt(2024, 1, 10).unwrap(),
        "Coffee Shop",
        "FOOD",
        "txn-1",
    );
    let second_transaction = sample_transaction(
        account_id,
        "Demo Checking",
        rust_decimal_macros::dec!(-8.50),
        NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
        "Coffee Shop Two",
        "FOOD",
        "txn-2",
    );
    let expected_transactions = vec![transaction.clone(), second_transaction.clone()];

    mock_db.expect_get_accounts_for_user().returning(move |_| {
        let accounts = vec![account.clone()];
        Box::pin(async move { Ok(accounts) })
    });

    mock_db
        .expect_get_transactions_for_export()
        .returning(move |_, account_ids| {
            assert_eq!(account_ids, Some(&[account_id][..]));
            let txns = expected_transactions.clone();
            Box::pin(async move { Ok(txns) })
        });

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();
    let request = TestFixtures::create_authenticated_get_request("/api/export?format=csv", &token);

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), 200);
    assert_eq!(response.headers().get(CONTENT_TYPE).unwrap(), "text/csv");
    let content_disposition = response
        .headers()
        .get(CONTENT_DISPOSITION)
        .unwrap()
        .to_str()
        .unwrap();
    assert_eq!(
        content_disposition,
        expected_attachment_filename("all", "20240110", "20240115", "csv")
    );

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let csv = String::from_utf8(body.to_vec()).unwrap();
    assert!(csv.contains("Date,Institution,Account,Account Type,Mask,Balance,Description,Amount,Category,Pending,Transaction ID"));
    assert!(csv.contains("Demo Bank"));
    assert!(csv.contains("Coffee Shop"));
}

#[tokio::test]
async fn given_authenticated_user_when_exporting_ofx_then_returns_attachment_and_xml() {
    let mut mock_db = MockDatabaseRepository::new();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();
    let account_id = Uuid::new_v4();
    let connection_id = Uuid::new_v4();
    let account = sample_account(
        account_id,
        connection_id,
        "Demo Checking",
        "depository",
        "1234",
        "Demo Bank",
    );
    let transaction = sample_transaction(
        account_id,
        "Demo Checking",
        rust_decimal_macros::dec!(-12.34),
        NaiveDate::from_ymd_opt(2024, 1, 10).unwrap(),
        "Coffee Shop",
        "FOOD",
        "txn-1",
    );
    let second_transaction = sample_transaction(
        account_id,
        "Demo Checking",
        rust_decimal_macros::dec!(-8.50),
        NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
        "Coffee Shop Two",
        "FOOD",
        "txn-2",
    );

    mock_db.expect_get_accounts_for_user().returning(move |_| {
        let accounts = vec![account.clone()];
        Box::pin(async move { Ok(accounts) })
    });

    mock_db
        .expect_get_transactions_for_export()
        .returning(move |_, account_ids| {
            assert_eq!(account_ids, Some(&[account_id][..]));
            let txns = vec![transaction.clone(), second_transaction.clone()];
            Box::pin(async move { Ok(txns) })
        });

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();
    let request = TestFixtures::create_authenticated_get_request("/api/export?format=ofx", &token);

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), 200);
    assert_eq!(
        response.headers().get(CONTENT_TYPE).unwrap(),
        "application/x-ofx"
    );
    let content_disposition = response
        .headers()
        .get(CONTENT_DISPOSITION)
        .unwrap()
        .to_str()
        .unwrap();
    assert_eq!(
        content_disposition,
        expected_attachment_filename("all", "20240110", "20240115", "ofx")
    );

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let ofx = String::from_utf8(body.to_vec()).unwrap();
    assert!(ofx.starts_with("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>"));
    assert!(ofx.contains("<OFX>"));
    assert!(ofx.contains("<TRNTYPE>DEBIT</TRNTYPE>"));
}

#[tokio::test]
async fn given_connection_id_when_exporting_then_limits_results_to_matching_accounts() {
    let mut mock_db = MockDatabaseRepository::new();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();
    let matching_connection_id = Uuid::new_v4();
    let other_connection_id = Uuid::new_v4();
    let matching_account_id = Uuid::new_v4();
    let other_account_id = Uuid::new_v4();
    let matching_account = sample_account(
        matching_account_id,
        matching_connection_id,
        "Demo Checking",
        "depository",
        "1234",
        "Demo Bank",
    );
    let other_account = sample_account(
        other_account_id,
        other_connection_id,
        "Other Checking",
        "depository",
        "5678",
        "Other Bank",
    );
    let expected_transactions = vec![
        sample_transaction(
            matching_account_id,
            "Demo Checking",
            rust_decimal_macros::dec!(-12.34),
            NaiveDate::from_ymd_opt(2024, 1, 10).unwrap(),
            "Coffee Shop",
            "FOOD",
            "txn-1",
        ),
        sample_transaction(
            matching_account_id,
            "Demo Checking",
            rust_decimal_macros::dec!(-8.50),
            NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
            "Coffee Shop Two",
            "FOOD",
            "txn-2",
        ),
    ];
    let expected_accounts = vec![matching_account.clone(), other_account];

    mock_db.expect_get_accounts_for_user().returning(move |_| {
        let accounts = expected_accounts.clone();
        Box::pin(async move { Ok(accounts) })
    });

    mock_db
        .expect_get_transactions_for_export()
        .returning(move |_, account_ids| {
            let ids = account_ids.expect("expected filtered account ids");
            assert_eq!(ids, &[matching_account_id]);
            let txns = expected_transactions.clone();
            Box::pin(async move { Ok(txns) })
        });

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();
    let request = TestFixtures::create_authenticated_get_request(
        &format!("/api/export?format=csv&connection_id={matching_connection_id}"),
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let content_disposition = response
        .headers()
        .get(CONTENT_DISPOSITION)
        .unwrap()
        .to_str()
        .unwrap();
    assert_eq!(
        content_disposition,
        expected_attachment_filename("demo-bank", "20240110", "20240115", "csv")
    );

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let csv = String::from_utf8(body.to_vec()).unwrap();
    assert!(csv.contains("Demo Checking"));
    assert!(!csv.contains("Other Checking"));
}
