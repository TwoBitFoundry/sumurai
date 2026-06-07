use crate::models::budget::Budget;
use crate::models::subscription::SubscriptionSummary;
use crate::services::{
    cache_service::MockCacheService, repository_service::MockDatabaseRepository,
};
use crate::test_fixtures::TestFixtures;
use axum::body::to_bytes;
use axum::http::StatusCode;
use chrono::NaiveDate;
use rust_decimal_macros::dec;
use tower::ServiceExt;
use uuid::Uuid;

#[tokio::test]
async fn given_authenticated_user_when_get_budgets_overview_then_returns_budgets_and_subscriptions()
{
    let user_id = Uuid::new_v4();
    let budgets = vec![Budget::new(user_id, "Groceries".to_string(), dec!(200))];
    let account_id_a = Uuid::new_v4();
    let account_id_b = Uuid::new_v4();
    let subscriptions = vec![SubscriptionSummary {
        merchant: "Spotify".to_string(),
        normalized_merchant: "spotify".to_string(),
        monthly_cost: dec!(9.99),
        cadence: "Monthly".to_string(),
        first_charged: NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
        last_charged: NaiveDate::from_ymd_opt(2024, 3, 1).unwrap(),
        occurrence_count: 3,
        account_ids: vec![account_id_a, account_id_b],
    }];

    let mut mock = MockDatabaseRepository::new();
    mock.expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock.expect_get_transactions_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let budgets_clone = budgets.clone();
    mock.expect_get_budgets_for_user()
        .times(1)
        .returning(move |_| {
            let b = budgets_clone.clone();
            Box::pin(async move { Ok(b) })
        });

    let subscriptions_clone = subscriptions.clone();
    mock.expect_get_subscription_summary()
        .times(1)
        .returning(move |_| {
            let s = subscriptions_clone.clone();
            Box::pin(async move { Ok(s) })
        });

    let mut mock_cache = MockCacheService::new();
    mock_cache
        .expect_health_check()
        .returning(|| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    mock_cache
        .expect_get_budgets()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_set_budgets()
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock, mock_cache)
        .await
        .unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let req = TestFixtures::create_authenticated_get_request("/api/budgets/overview", &token);
    let res = app.oneshot(req).await.unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let body_bytes = to_bytes(res.into_body(), 1024 * 1024).await.unwrap();
    let v: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    assert!(v["budgets"].is_array());
    assert_eq!(v["budgets"].as_array().unwrap().len(), 1);
    assert_eq!(v["budgets"][0]["category"], "Groceries");
    assert!(v["subscriptions"].is_array());
    assert_eq!(v["subscriptions"].as_array().unwrap().len(), 1);
    assert_eq!(v["subscriptions"][0]["merchant"], "Spotify");
    let ids = v["subscriptions"][0]["account_ids"].as_array().unwrap();
    assert_eq!(ids.len(), 2);
    assert_eq!(ids[0].as_str().unwrap(), account_id_a.to_string());
    assert_eq!(ids[1].as_str().unwrap(), account_id_b.to_string());
}

#[tokio::test]
async fn given_cache_hit_when_get_budgets_overview_then_uses_cached_budgets_and_live_subscriptions()
{
    let user_id = Uuid::new_v4();
    let budgets = vec![Budget::new(user_id, "Rent".to_string(), dec!(1200))];
    let serialized = serde_json::to_string(&budgets).unwrap();

    let subscriptions = vec![SubscriptionSummary {
        merchant: "Netflix".to_string(),
        normalized_merchant: "netflix".to_string(),
        monthly_cost: dec!(15.99),
        cadence: "Monthly".to_string(),
        first_charged: NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
        last_charged: NaiveDate::from_ymd_opt(2024, 3, 15).unwrap(),
        occurrence_count: 5,
        account_ids: vec![],
    }];

    let mock_db = MockDatabaseRepository::new();

    let mut mock_cache = MockCacheService::new();
    mock_cache
        .expect_health_check()
        .returning(|| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    mock_cache.expect_get_budgets().returning(move |_| {
        let s = serialized.clone();
        Box::pin(async move { Ok(Some(s)) })
    });

    let mut mock_db_with_subs = mock_db;
    mock_db_with_subs
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock_db_with_subs
        .expect_get_transactions_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let subscriptions_clone = subscriptions.clone();
    mock_db_with_subs
        .expect_get_subscription_summary()
        .times(1)
        .returning(move |_| {
            let s = subscriptions_clone.clone();
            Box::pin(async move { Ok(s) })
        });

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db_with_subs, mock_cache)
        .await
        .unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let req = TestFixtures::create_authenticated_get_request("/api/budgets/overview", &token);
    let res = app.oneshot(req).await.unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let body_bytes = to_bytes(res.into_body(), 1024 * 1024).await.unwrap();
    let v: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    assert_eq!(v["budgets"][0]["category"], "Rent");
    assert_eq!(v["subscriptions"][0]["merchant"], "Netflix");
}
