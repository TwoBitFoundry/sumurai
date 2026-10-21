use std::collections::HashSet;

use anyhow::anyhow;
use axum::http::StatusCode;
use chrono::NaiveDate;
use tower::ServiceExt;
use uuid::Uuid;

use crate::handlers::transaction::{normalize_page_limit, parse_transaction_filter, trimmed};
use crate::models::auth::User;
use crate::models::transaction::CursorTransactionsResponse;
use crate::services::repository_service::MockDatabaseRepository;
use crate::test_fixtures::TestFixtures;

fn empty_page() -> CursorTransactionsResponse {
    CursorTransactionsResponse {
        transactions: vec![],
        next_cursor: None,
        prev_cursor: None,
        has_more: false,
    }
}

fn mock_with_user(user: User) -> MockDatabaseRepository {
    let mut repository = MockDatabaseRepository::new();
    repository.expect_get_user_by_id().returning(move |_| {
        let user = user.clone();
        Box::pin(async move { Ok(Some(user)) })
    });
    repository
}

async fn get_status(repository: MockDatabaseRepository, token: &str, uri: &str) -> StatusCode {
    let app = TestFixtures::create_test_app_with_db(repository)
        .await
        .unwrap();
    let request = TestFixtures::create_authenticated_get_request(uri, token);
    app.oneshot(request).await.unwrap().status()
}

#[test]
fn given_no_limit_when_normalizing_page_limit_then_uses_default_page_size() {
    assert_eq!(normalize_page_limit(None), 40);
}

#[test]
fn given_oversized_limit_when_normalizing_page_limit_then_clamps_to_maximum() {
    assert_eq!(normalize_page_limit(Some(500)), 100);
}

#[test]
fn given_non_positive_limit_when_normalizing_page_limit_then_clamps_to_minimum() {
    assert_eq!(normalize_page_limit(Some(0)), 1);
    assert_eq!(normalize_page_limit(Some(-5)), 1);
}

#[test]
fn given_in_range_limit_when_normalizing_page_limit_then_keeps_value() {
    assert_eq!(normalize_page_limit(Some(25)), 25);
}

#[test]
fn given_blank_values_when_trimming_then_returns_none() {
    assert_eq!(trimmed(Some("   ")), None);
    assert_eq!(trimmed(Some("\t")), None);
    assert_eq!(trimmed(Some("")), None);
    assert_eq!(trimmed(None), None);
}

#[test]
fn given_padded_value_when_trimming_then_returns_trimmed_text() {
    assert_eq!(trimmed(Some("  coffee  ")), Some("coffee"));
}

#[test]
fn given_valid_dates_when_parsing_filter_then_returns_parsed_dates() {
    let filter = parse_transaction_filter(
        Some("coffee".to_string()),
        Some("FOOD".to_string()),
        Some("2024-01-01"),
        Some("2024-01-31"),
        None,
    )
    .unwrap();

    assert_eq!(filter.search.as_deref(), Some("coffee"));
    assert_eq!(filter.category_primary.as_deref(), Some("FOOD"));
    assert_eq!(filter.start_date, NaiveDate::from_ymd_opt(2024, 1, 1));
    assert_eq!(filter.end_date, NaiveDate::from_ymd_opt(2024, 1, 31));
    assert!(filter.account_ids.is_none());
}

#[test]
fn given_malformed_date_when_parsing_filter_then_returns_bad_request() {
    let result = parse_transaction_filter(None, None, Some("01/02/2024"), None, None);

    assert_eq!(result, Err(StatusCode::BAD_REQUEST));
}

#[test]
fn given_end_before_start_when_parsing_filter_then_returns_bad_request() {
    let result = parse_transaction_filter(None, None, Some("2024-02-01"), Some("2024-01-01"), None);

    assert_eq!(result, Err(StatusCode::BAD_REQUEST));
}

#[test]
fn given_authorized_accounts_when_parsing_filter_then_carries_account_ids() {
    let account_id = Uuid::new_v4();
    let authorized: HashSet<Uuid> = [account_id].into_iter().collect();

    let filter = parse_transaction_filter(None, None, None, None, Some(&authorized)).unwrap();

    assert_eq!(filter.account_ids, Some(vec![account_id]));
}

#[tokio::test]
async fn given_no_limit_when_listing_transactions_then_uses_default_page_size() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let mut repository = mock_with_user(user);
    repository
        .expect_get_transactions_keyset()
        .withf(|_, limit, _, _, _, _, _, _, _| *limit == 40)
        .times(1)
        .returning(|_, _, _, _, _, _, _, _, _| Box::pin(async { Ok(empty_page()) }));

    let status = get_status(repository, &token, "/api/transactions").await;

    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn given_oversized_limit_when_listing_transactions_then_clamps_to_maximum_page_size() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let mut repository = mock_with_user(user);
    repository
        .expect_get_transactions_keyset()
        .withf(|_, limit, _, _, _, _, _, _, _| *limit == 100)
        .times(1)
        .returning(|_, _, _, _, _, _, _, _, _| Box::pin(async { Ok(empty_page()) }));

    let status = get_status(repository, &token, "/api/transactions?limit=500").await;

    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn given_blank_filters_when_listing_transactions_then_passes_none_to_repository() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let mut repository = mock_with_user(user);
    repository
        .expect_get_transactions_keyset()
        .withf(|_, _, cursor, search, _, _, _, category, merchant| {
            cursor.is_none() && search.is_none() && category.is_none() && merchant.is_none()
        })
        .times(1)
        .returning(|_, _, _, _, _, _, _, _, _| Box::pin(async { Ok(empty_page()) }));

    let status = get_status(
        repository,
        &token,
        "/api/transactions?search=%20%20&category_primary=%09&merchant=",
    )
    .await;

    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn given_padded_search_when_listing_transactions_then_passes_trimmed_search() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let mut repository = mock_with_user(user);
    repository
        .expect_get_transactions_keyset()
        .withf(|_, _, _, search, _, _, _, _, _| *search == Some("coffee"))
        .times(1)
        .returning(|_, _, _, _, _, _, _, _, _| Box::pin(async { Ok(empty_page()) }));

    let status = get_status(repository, &token, "/api/transactions?search=%20coffee%20").await;

    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn given_repository_failure_when_listing_transactions_then_returns_internal_server_error() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let mut repository = mock_with_user(user);
    repository
        .expect_get_transactions_keyset()
        .returning(|_, _, _, _, _, _, _, _, _| Box::pin(async { Err(anyhow!("database down")) }));

    let status = get_status(repository, &token, "/api/transactions").await;

    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
}

#[tokio::test]
async fn given_invalid_date_when_listing_transactions_then_returns_bad_request() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let repository = mock_with_user(user);

    let status = get_status(repository, &token, "/api/transactions?start_date=nope").await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn given_repository_failure_when_loading_insights_then_returns_internal_server_error() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let mut repository = mock_with_user(user);
    repository
        .expect_get_transactions_insights()
        .returning(|_, _, _, _, _, _| Box::pin(async { Err(anyhow!("database down")) }));

    let status = get_status(repository, &token, "/api/transactions/insights").await;

    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
}

#[tokio::test]
async fn given_repository_failure_when_loading_contextual_insights_then_returns_internal_server_error(
) {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let mut repository = mock_with_user(user);
    repository
        .expect_get_transactions_contextual_insights()
        .returning(|_, _, _, _, _, _| Box::pin(async { Err(anyhow!("database down")) }));

    let status = get_status(repository, &token, "/api/transactions/contextual-insights").await;

    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
}

#[tokio::test]
async fn given_padded_filters_when_loading_insights_then_passes_trimmed_values() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let mut repository = mock_with_user(user);
    repository
        .expect_get_transactions_insights()
        .withf(|_, search, _, _, _, category| search.is_none() && *category == Some("FOOD"))
        .times(1)
        .returning(|_, _, _, _, _, _| {
            Box::pin(async { Err(anyhow!("stop after argument check")) })
        });

    let status = get_status(
        repository,
        &token,
        "/api/transactions/insights?search=%20&category_primary=%20FOOD%20",
    )
    .await;

    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
}
