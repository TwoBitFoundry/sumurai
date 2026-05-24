use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use axum::body::to_bytes;
use axum::http::{Method, StatusCode};
use chrono::NaiveDate;
use mockall::predicate::{always, eq};
use rust_decimal_macros::dec;
use tower::ServiceExt;
use uuid::Uuid;

use crate::models::auto_categorization_job::{
    AutoCategorizationJobState, AutoCategorizationJobStatus,
};
use crate::models::transaction::Transaction;
use crate::services::repository_service::MockDatabaseRepository;
use crate::test_fixtures::TestFixtures;

fn in_memory_cache_mock() -> crate::services::cache_service::MockCacheService {
    let values = Arc::new(Mutex::new(HashMap::<String, String>::new()));
    let get_values = Arc::clone(&values);
    let set_values = Arc::clone(&values);

    let mut mock = crate::services::cache_service::MockCacheService::new();
    mock.expect_health_check()
        .returning(|| Box::pin(async { Ok(()) }));
    mock.expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    mock.expect_is_auth_ip_banned()
        .returning(|_| Box::pin(async { Ok(false) }));
    mock.expect_record_auth_rate_limit_exceeded()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock.expect_set_with_ttl()
        .times(..)
        .returning(move |key, value, _ttl| {
            get_values
                .lock()
                .unwrap()
                .insert(key.to_string(), value.to_string());
            Box::pin(async { Ok(()) })
        });
    mock.expect_get_string().times(..).returning(move |key| {
        let value = set_values.lock().unwrap().get(key).cloned();
        Box::pin(async move { Ok(value) })
    });
    mock.expect_clear_transactions()
        .times(..)
        .returning(|_| Box::pin(async { Ok(()) }));
    mock.expect_clear_budgets()
        .times(..)
        .returning(|_| Box::pin(async { Ok(()) }));
    mock.expect_invalidate_pattern()
        .times(..)
        .returning(|_| Box::pin(async { Ok(()) }));
    mock
}

fn make_other_transaction(user_id: Uuid, id: Uuid) -> Transaction {
    Transaction {
        id,
        account_id: Uuid::new_v4(),
        user_id: Some(user_id),
        provider_account_id: None,
        provider_transaction_id: Some(format!("txn-{id}")),
        amount: dec!(-5.00),
        date: NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
        merchant_name: Some("Coffee Shop".to_string()),
        category_primary: "OTHER".to_string(),
        category_detailed: "OTHER".to_string(),
        category_confidence: String::new(),
        payment_channel: None,
        pending: false,
        created_at: None,
    }
}

fn expect_eligible_single_transaction(
    mock_db: &mut MockDatabaseRepository,
    user_id: Uuid,
    txn: Transaction,
) {
    let txn_for_fetch = txn.clone();
    mock_db
        .expect_count_eligible_auto_categorize_transactions()
        .with(eq(user_id))
        .times(..)
        .returning(|_| Box::pin(async { Ok(1) }));
    mock_db
        .expect_fetch_eligible_auto_categorize_transactions()
        .with(eq(user_id), always(), always(), always())
        .times(..)
        .returning(move |_, _, _, _| {
            let txn = txn_for_fetch.clone();
            Box::pin(async move { Ok(vec![txn]) })
        });
    mock_db
        .expect_update_transaction_categories_batch()
        .times(..)
        .returning(|_, _| Box::pin(async { Ok(()) }));
}

#[tokio::test]
async fn given_no_prior_job_when_get_status_then_returns_null() {
    let mock_db = MockDatabaseRepository::new();
    let mock_cache = in_memory_cache_mock();
    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();
    let (_, token) = TestFixtures::create_authenticated_user_with_token();

    let request =
        TestFixtures::create_authenticated_get_request("/api/transactions/auto-categorize", &token);
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert_eq!(body.as_ref(), b"null");
}

#[tokio::test]
async fn given_no_active_job_when_start_then_returns_running_job() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let txn_id = Uuid::new_v4();
    let txn = make_other_transaction(user.id, txn_id);

    let mut mock_db = MockDatabaseRepository::new();
    expect_eligible_single_transaction(&mut mock_db, user.id, txn);

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, in_memory_cache_mock())
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_request(
        Method::POST,
        "/api/transactions/auto-categorize",
        &token,
    );
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let state: AutoCategorizationJobState = serde_json::from_slice(&body).unwrap();
    assert_eq!(state.status, AutoCategorizationJobStatus::Running);
    assert_eq!(state.total, 1);
}

#[tokio::test]
async fn given_active_job_when_start_again_then_returns_conflict_with_job_state() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let txn_id = Uuid::new_v4();
    let txn = make_other_transaction(user.id, txn_id);

    let mut mock_db = MockDatabaseRepository::new();
    expect_eligible_single_transaction(&mut mock_db, user.id, txn);

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, in_memory_cache_mock())
        .await
        .unwrap();

    let start = TestFixtures::create_authenticated_request(
        Method::POST,
        "/api/transactions/auto-categorize",
        &token,
    );
    let first = app.clone().oneshot(start).await.unwrap();
    assert_eq!(first.status(), StatusCode::OK);
    let first_body = to_bytes(first.into_body(), usize::MAX).await.unwrap();
    let first_state: AutoCategorizationJobState = serde_json::from_slice(&first_body).unwrap();

    let duplicate = TestFixtures::create_authenticated_request(
        Method::POST,
        "/api/transactions/auto-categorize",
        &token,
    );
    let second = app.oneshot(duplicate).await.unwrap();

    assert_eq!(second.status(), StatusCode::CONFLICT);
    let second_body = to_bytes(second.into_body(), usize::MAX).await.unwrap();
    let conflict_state: AutoCategorizationJobState = serde_json::from_slice(&second_body).unwrap();
    assert_eq!(conflict_state.job_id, first_state.job_id);
    assert!(conflict_state.status.is_active());
}

#[tokio::test]
async fn given_active_job_when_cancel_then_returns_cancelling_state() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let txn_id = Uuid::new_v4();
    let txn = make_other_transaction(user.id, txn_id);

    let mut mock_db = MockDatabaseRepository::new();
    expect_eligible_single_transaction(&mut mock_db, user.id, txn);

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, in_memory_cache_mock())
        .await
        .unwrap();

    let start = TestFixtures::create_authenticated_request(
        Method::POST,
        "/api/transactions/auto-categorize",
        &token,
    );
    let started = app.clone().oneshot(start).await.unwrap();
    assert_eq!(started.status(), StatusCode::OK);

    let cancel = TestFixtures::create_authenticated_request(
        Method::DELETE,
        "/api/transactions/auto-categorize",
        &token,
    );
    let response = app.oneshot(cancel).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let state: AutoCategorizationJobState = serde_json::from_slice(&body).unwrap();
    assert_eq!(state.status, AutoCategorizationJobStatus::Cancelling);
}

#[tokio::test]
async fn given_no_active_job_when_cancel_then_returns_not_found() {
    let mock_db = MockDatabaseRepository::new();
    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, in_memory_cache_mock())
        .await
        .unwrap();
    let (_, token) = TestFixtures::create_authenticated_user_with_token();

    let request = TestFixtures::create_authenticated_request(
        Method::DELETE,
        "/api/transactions/auto-categorize",
        &token,
    );
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}
