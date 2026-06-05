use crate::models::subscription::SubscriptionSummary;
use crate::services::repository_service::MockDatabaseRepository;
use crate::test_fixtures::TestFixtures;
use axum::body::to_bytes;
use axum::http::StatusCode;
use chrono::NaiveDate;
use rust_decimal_macros::dec;
use tower::ServiceExt;

#[tokio::test]
async fn given_authenticated_user_when_get_subscriptions_then_returns_summaries() {
    let summaries = vec![SubscriptionSummary {
        merchant: "Spotify".to_string(),
        normalized_merchant: "spotify".to_string(),
        monthly_cost: dec!(9.99),
        cadence: "Monthly".to_string(),
        last_charged: NaiveDate::from_ymd_opt(2024, 3, 1).unwrap(),
        occurrence_count: 3,
    }];

    let mut mock = MockDatabaseRepository::new();
    mock.expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock.expect_get_transactions_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock.expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let summaries_clone = summaries.clone();
    mock.expect_get_subscription_summary()
        .times(1)
        .returning(move |_| {
            let s = summaries_clone.clone();
            Box::pin(async move { Ok(s) })
        });

    let app = TestFixtures::create_test_app_with_db(mock).await.unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let req = TestFixtures::create_authenticated_get_request("/api/subscriptions", &token);
    let res = app.oneshot(req).await.unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let body_bytes = to_bytes(res.into_body(), 1024 * 1024).await.unwrap();
    let v: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    assert!(v.is_array());
    assert_eq!(v.as_array().unwrap().len(), 1);
    assert_eq!(v[0]["merchant"], "Spotify");
    assert_eq!(v[0]["cadence"], "Monthly");
}

#[tokio::test]
async fn given_authenticated_user_when_get_subscriptions_with_empty_result_then_returns_empty_array(
) {
    let mut mock = MockDatabaseRepository::new();
    mock.expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock.expect_get_transactions_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock.expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock.expect_get_subscription_summary()
        .times(1)
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock).await.unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let req = TestFixtures::create_authenticated_get_request("/api/subscriptions", &token);
    let res = app.oneshot(req).await.unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let body_bytes = to_bytes(res.into_body(), 1024 * 1024).await.unwrap();
    let v: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    assert_eq!(v, serde_json::json!([]));
}
