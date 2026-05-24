use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use anyhow::Result;
use async_trait::async_trait;
use axum::body::to_bytes;
use mockall::predicate::eq;
use tower::ServiceExt;
use uuid::Uuid;

use crate::models::{account::Account, import::ImportResponse};
use crate::services::{
    cache_service::MockCacheService, repository_service::MockDatabaseRepository, Categorizer,
};
use crate::test_fixtures::TestFixtures;
use crate::tests::transaction_import_api_tests::authenticated_multipart_request;

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

struct PanicCategorizer;

#[async_trait]
impl Categorizer for PanicCategorizer {
    async fn categorize_batch(
        &self,
        _descriptions: Vec<String>,
    ) -> Result<Vec<crate::models::predicted_category::PredictedCategory>> {
        panic!("categorizer should not be called for import ingestion");
    }
}

#[tokio::test]
async fn given_import_file_when_importing_then_persists_other_categories_without_categorizer() {
    let mut mock_db = MockDatabaseRepository::new();
    let mut mock_cache = MockCacheService::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let account_id = Uuid::new_v4();
    let boundary = "BOUNDARY";
    let call_count = Arc::new(AtomicUsize::new(0));

    mock_db
        .expect_get_accounts_for_user()
        .with(eq(user.id))
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
                    counts.insert(account_id, if current == 0 { 0 } else { 2 });
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

            assert_eq!(transactions[0].user_id, Some(user.id));
            assert_eq!(transactions[0].category_primary, "OTHER");
            assert!(transactions[0].category_confidence.is_empty());

            assert_eq!(transactions[1].category_primary, "OTHER");
            assert!(transactions[1].category_confidence.is_empty());

            Box::pin(async { Ok(()) })
        });

    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    mock_cache
        .expect_clear_transactions()
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db_cache_and_categorizer(
        mock_db,
        mock_cache,
        Arc::new(PanicCategorizer),
    )
    .await
    .unwrap();

    let file = b"Date,Description,Debit Amount,Credit Amount\n01/15/2024,WHOLE FOODS MARKET #123,12.34,\n01/16/2024,SHELL OIL 5512,45.67,\n";
    let request = authenticated_multipart_request(
        &token,
        "/api/transactions/import",
        boundary,
        "transactions.csv",
        file,
        account_id,
        None,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let import: ImportResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(import.imported_count, 2);
    assert_eq!(import.skipped_count, 0);
    assert_eq!(import.total_parsed, 2);
    assert!(import.errors.is_empty());
}

#[tokio::test]
async fn given_import_failure_when_importing_then_still_persists_other_categories() {
    let mut mock_db = MockDatabaseRepository::new();
    let mut mock_cache = MockCacheService::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let account_id = Uuid::new_v4();
    let boundary = "BOUNDARY";
    let call_count = Arc::new(AtomicUsize::new(0));

    mock_db
        .expect_get_accounts_for_user()
        .with(eq(user.id))
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
            assert_eq!(transactions[0].category_primary, "OTHER");
            assert!(transactions[0].category_confidence.is_empty());
            Box::pin(async { Ok(()) })
        });

    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    mock_cache
        .expect_clear_transactions()
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db_cache_and_categorizer(
        mock_db,
        mock_cache,
        Arc::new(PanicCategorizer),
    )
    .await
    .unwrap();

    let file = b"Date,Description,Debit Amount,Credit Amount\n01/15/2024,Unknown Merchant,12.34,\n";
    let request = authenticated_multipart_request(
        &token,
        "/api/transactions/import",
        boundary,
        "transactions.csv",
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
