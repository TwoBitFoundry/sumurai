use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
};

use axum::{body::to_bytes, http::header::CONTENT_TYPE};
use tower::ServiceExt;
use uuid::Uuid;

use crate::{
    models::{
        account::Account,
        api_error::ApiErrorResponse,
        import::{ImportFileFormat, ImportResponse, ValidateResponse},
        transaction::Transaction,
    },
    services::{cache_service::MockCacheService, repository_service::MockDatabaseRepository},
    test_fixtures::TestFixtures,
};

fn owned_account(user_id: Uuid, account_id: Uuid) -> Account {
    Account {
        id: account_id,
        user_id: Some(user_id),
        provider_account_id: Some("acct-1".to_string()),
        provider_connection_id: None,
        name: "Test Checking".to_string(),
        account_type: "depository".to_string(),
        balance_current: None,
        mask: Some("1234".to_string()),
        institution_name: Some("Test Bank".to_string()),
        provider_conn_id: None,
    }
}

fn multipart_body(
    boundary: &str,
    file_name: &str,
    file_bytes: &[u8],
    account_id: Uuid,
    csv_mapping: Option<&str>,
) -> Vec<u8> {
    let mut body = Vec::new();

    body.extend_from_slice(
        format!(
            "--{}\r\nContent-Disposition: form-data; name=\"account_id\"\r\n\r\n{}\r\n",
            boundary, account_id
        )
        .as_bytes(),
    );

    if let Some(csv_mapping) = csv_mapping {
        body.extend_from_slice(
            format!(
                "--{}\r\nContent-Disposition: form-data; name=\"csv_mapping\"\r\n\r\n{}\r\n",
                boundary, csv_mapping
            )
            .as_bytes(),
        );
    }

    body.extend_from_slice(
        format!(
            "--{}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{}\"\r\nContent-Type: text/plain\r\n\r\n",
            boundary, file_name
        )
        .as_bytes(),
    );
    body.extend_from_slice(file_bytes);
    body.extend_from_slice(format!("\r\n--{}--\r\n", boundary).as_bytes());

    body
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn authenticated_multipart_request(
    token: &str,
    uri: &str,
    boundary: &str,
    file_name: &str,
    file_bytes: &[u8],
    account_id: Uuid,
    csv_mapping: Option<&str>,
) -> axum::http::Request<axum::body::Body> {
    axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri(uri)
        .header("Cookie", format!("auth_token={}", token))
        .header(
            CONTENT_TYPE,
            format!("multipart/form-data; boundary={boundary}"),
        )
        .body(axum::body::Body::from(multipart_body(
            boundary,
            file_name,
            file_bytes,
            account_id,
            csv_mapping,
        )))
        .unwrap()
}

#[tokio::test]
async fn given_no_auth_token_when_validating_import_then_returns_401() {
    let app = TestFixtures::create_test_app().await.unwrap();

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/transactions/import/validate")
        .header(CONTENT_TYPE, "multipart/form-data; boundary=BOUNDARY")
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), 401);
}

#[tokio::test]
async fn given_foreign_account_when_validating_import_then_returns_403() {
    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let account_id = Uuid::new_v4();
    let other_account_id = Uuid::new_v4();

    mock_db
        .expect_get_accounts_for_user()
        .with(mockall::predicate::eq(user.id))
        .times(1)
        .returning(move |_| {
            let accounts = vec![owned_account(user.id, other_account_id)];
            Box::pin(async move { Ok(accounts) })
        });

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();
    let request = authenticated_multipart_request(
        &token,
        "/api/transactions/import/validate",
        "BOUNDARY",
        "transactions.qfx",
        b"<OFX></OFX>",
        account_id,
        None,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 403);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let error: ApiErrorResponse = serde_json::from_slice(&body).unwrap();
    assert!(error.message.contains("Account does not belong"));
}

#[tokio::test]
async fn given_valid_qfx_when_validating_import_then_returns_preview_rows() {
    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let account_id = Uuid::new_v4();

    mock_db
        .expect_get_accounts_for_user()
        .with(mockall::predicate::eq(user.id))
        .times(1)
        .returning(move |_| {
            let accounts = vec![owned_account(user.id, account_id)];
            Box::pin(async move { Ok(accounts) })
        });

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();
    let file = b"<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20240115000000<TRNAMT>-12.34<FITID>fitid-1<NAME>COFFEE SHOP</STMTTRN><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20240116000000<TRNAMT>18.50<FITID>fitid-2<NAME>REFUND</STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>";
    let request = authenticated_multipart_request(
        &token,
        "/api/transactions/import/validate",
        "BOUNDARY",
        "transactions.qfx",
        file,
        account_id,
        None,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let validate: ValidateResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(validate.format, Some(ImportFileFormat::Qfx));
    assert!(validate.valid);
    assert_eq!(validate.transaction_count, 2);
    assert!(validate.preview_rows.len() <= 5);
}

#[tokio::test]
async fn given_valid_csv_when_validating_import_then_returns_mapping_and_samples() {
    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let account_id = Uuid::new_v4();

    mock_db
        .expect_get_accounts_for_user()
        .with(mockall::predicate::eq(user.id))
        .times(1)
        .returning(move |_| {
            let accounts = vec![owned_account(user.id, account_id)];
            Box::pin(async move { Ok(accounts) })
        });

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();
    let file = b"Date,Description,Debit Amount,Credit Amount\n01/15/2024,Coffee Shop,12.34,\n01/16/2024,Refund,,18.50\n";
    let request = authenticated_multipart_request(
        &token,
        "/api/transactions/import/validate",
        "BOUNDARY",
        "transactions.csv",
        file,
        account_id,
        None,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let validate: ValidateResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(validate.format, Some(ImportFileFormat::Csv));
    assert!(validate.valid);
    assert!(validate.suggested_csv_mapping.is_some());
    assert!(!validate.sample_csv_rows.is_empty());
}

#[tokio::test]
async fn given_unsupported_extension_when_validating_import_then_returns_400() {
    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let account_id = Uuid::new_v4();

    mock_db
        .expect_get_accounts_for_user()
        .with(mockall::predicate::eq(user.id))
        .times(1)
        .returning(move |_| {
            let accounts = vec![owned_account(user.id, account_id)];
            Box::pin(async move { Ok(accounts) })
        });

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();
    let request = authenticated_multipart_request(
        &token,
        "/api/transactions/import/validate",
        "BOUNDARY",
        "transactions.txt",
        b"hello",
        account_id,
        None,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 400);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let error: ApiErrorResponse = serde_json::from_slice(&body).unwrap();
    assert!(error.message.contains("Unsupported file extension"));
}

#[tokio::test]
async fn given_garbled_content_when_validating_import_then_marks_invalid() {
    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let account_id = Uuid::new_v4();

    mock_db
        .expect_get_accounts_for_user()
        .with(mockall::predicate::eq(user.id))
        .times(1)
        .returning(move |_| {
            let accounts = vec![owned_account(user.id, account_id)];
            Box::pin(async move { Ok(accounts) })
        });

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();
    let request = authenticated_multipart_request(
        &token,
        "/api/transactions/import/validate",
        "BOUNDARY",
        "transactions.qfx",
        b"garbled",
        account_id,
        None,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let validate: ValidateResponse = serde_json::from_slice(&body).unwrap();
    assert!(!validate.valid);
    assert!(!validate.errors.is_empty());
}

#[tokio::test]
async fn given_large_upload_when_validating_import_then_returns_400() {
    let mock_db = MockDatabaseRepository::new();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();
    let account_id = Uuid::new_v4();
    let huge_file = vec![b'a'; 10 * 1024 * 1024 + 16];

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = authenticated_multipart_request(
        &token,
        "/api/transactions/import/validate",
        "BOUNDARY",
        "transactions.qfx",
        &huge_file,
        account_id,
        None,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 400);
}

#[tokio::test]
async fn given_valid_qfx_when_importing_then_writes_transactions_and_sets_user() {
    let mut mock_db = MockDatabaseRepository::new();
    let mut mock_cache = MockCacheService::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let account_id = Uuid::new_v4();
    let boundary = "BOUNDARY";
    let call_count = Arc::new(AtomicUsize::new(0));

    mock_db
        .expect_get_accounts_for_user()
        .with(mockall::predicate::eq(user.id))
        .times(1)
        .returning(move |_| {
            let accounts = vec![owned_account(user.id, account_id)];
            Box::pin(async move { Ok(accounts) })
        });

    mock_db
        .expect_get_transaction_count_by_account_for_user()
        .times(2)
        .returning({
            let call_count = call_count.clone();
            move |_| {
                let call_count = call_count.clone();
                let account_id = account_id;
                Box::pin(async move {
                    let current = call_count.fetch_add(1, Ordering::SeqCst);
                    let mut counts = HashMap::new();
                    counts.insert(account_id, if current == 0 { 0 } else { 1 });
                    Ok(counts)
                })
            }
        });

    mock_db
        .expect_upsert_transactions_batch()
        .times(1)
        .returning(move |transactions, user_id| {
            assert_eq!(*user_id, user.id);
            assert_eq!(transactions.len(), 1);
            let txn = &transactions[0];
            assert_eq!(txn.user_id, Some(user.id));
            assert_eq!(txn.category_primary, "OTHER");
            assert_eq!(txn.category_detailed, "OTHER");
            assert!(!txn.pending);
            assert_eq!(
                txn.provider_transaction_id.as_deref(),
                Some(Transaction::import_provider_transaction_id(&account_id, "fitid-1").as_str())
            );
            Box::pin(async { Ok(()) })
        });

    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    mock_cache
        .expect_clear_transactions()
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let file = b"<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20240115000000<TRNAMT>-12.34<FITID>fitid-1<NAME>COFFEE SHOP</STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>";
    let request = authenticated_multipart_request(
        &token,
        "/api/transactions/import",
        boundary,
        "transactions.qfx",
        file,
        account_id,
        None,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let import: ImportResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(import.imported_count, 1);
    assert_eq!(import.skipped_count, 0);
    assert_eq!(import.total_parsed, 1);
    assert!(import.errors.is_empty());
}

#[tokio::test]
async fn given_duplicate_ofx_import_when_reimporting_then_reports_skipped_transactions() {
    let mut mock_db = MockDatabaseRepository::new();
    let mut mock_cache = MockCacheService::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let account_id = Uuid::new_v4();
    let boundary = "BOUNDARY";
    let call_count = Arc::new(AtomicUsize::new(0));

    mock_db
        .expect_get_accounts_for_user()
        .with(mockall::predicate::eq(user.id))
        .times(1)
        .returning(move |_| {
            let accounts = vec![owned_account(user.id, account_id)];
            Box::pin(async move { Ok(accounts) })
        });

    mock_db
        .expect_get_transaction_count_by_account_for_user()
        .times(2)
        .returning({
            let call_count = call_count.clone();
            move |_| {
                let call_count = call_count.clone();
                let account_id = account_id;
                Box::pin(async move {
                    let _current = call_count.fetch_add(1, Ordering::SeqCst);
                    let mut counts = HashMap::new();
                    counts.insert(account_id, 2);
                    Ok(counts)
                })
            }
        });

    mock_db
        .expect_upsert_transactions_batch()
        .times(1)
        .returning(move |transactions, user_id| {
            assert_eq!(*user_id, user.id);
            assert_eq!(transactions.len(), 2);
            Box::pin(async { Ok(()) })
        });

    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    mock_cache
        .expect_clear_transactions()
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let file = b"<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20240115000000<TRNAMT>-12.34<FITID>fitid-1<NAME>COFFEE SHOP</STMTTRN><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20240116000000<TRNAMT>18.50<FITID>fitid-2<NAME>REFUND</STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>";
    let request = authenticated_multipart_request(
        &token,
        "/api/transactions/import",
        boundary,
        "transactions.qfx",
        file,
        account_id,
        None,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let import: ImportResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(import.imported_count, 0);
    assert_eq!(import.skipped_count, 2);
    assert_eq!(import.total_parsed, 2);
}

#[tokio::test]
async fn given_csv_mapping_when_importing_then_creates_expected_transactions() {
    let mut mock_db = MockDatabaseRepository::new();
    let mut mock_cache = MockCacheService::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let account_id = Uuid::new_v4();
    let boundary = "BOUNDARY";
    let call_count = Arc::new(AtomicUsize::new(0));
    let csv_mapping = serde_json::json!({
        "date_column": "Posted On",
        "amount_column": null,
        "debit_column": "Debit Amount",
        "credit_column": "Credit Amount",
        "description_column": "Merchant"
    })
    .to_string();

    mock_db
        .expect_get_accounts_for_user()
        .with(mockall::predicate::eq(user.id))
        .times(1)
        .returning(move |_| {
            let accounts = vec![owned_account(user.id, account_id)];
            Box::pin(async move { Ok(accounts) })
        });

    mock_db
        .expect_get_transaction_count_by_account_for_user()
        .times(2)
        .returning({
            let call_count = call_count.clone();
            move |_| {
                let call_count = call_count.clone();
                let account_id = account_id;
                Box::pin(async move {
                    let current = call_count.fetch_add(1, Ordering::SeqCst);
                    let mut counts = HashMap::new();
                    counts.insert(account_id, if current == 0 { 0 } else { 1 });
                    Ok(counts)
                })
            }
        });

    mock_db
        .expect_upsert_transactions_batch()
        .times(1)
        .returning(move |transactions, user_id| {
            assert_eq!(*user_id, user.id);
            assert_eq!(transactions.len(), 1);
            let txn = &transactions[0];
            assert_eq!(txn.user_id, Some(user.id));
            assert_eq!(txn.merchant_name.as_deref(), Some("Coffee Shop"));
            assert_eq!(txn.amount.to_string(), "-12.34");
            Box::pin(async { Ok(()) })
        });

    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    mock_cache
        .expect_clear_transactions()
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let file = b"Posted On,Merchant,Debit Amount,Credit Amount\n01/15/2024,Coffee Shop,12.34,\n";
    let request = authenticated_multipart_request(
        &token,
        "/api/transactions/import",
        boundary,
        "transactions.csv",
        file,
        account_id,
        Some(&csv_mapping),
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let import: ImportResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(import.imported_count, 1);
    assert_eq!(import.skipped_count, 0);
    assert_eq!(import.total_parsed, 1);
}
