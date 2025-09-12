use crate::models::budget::Budget;
use crate::services::{
    cache_service::MockCacheService, 
    repository_service::MockDatabaseRepository
};
use crate::test_fixtures::TestFixtures;
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use rust_decimal_macros::dec;
use serde_json::json;
use tower::ServiceExt;
use uuid::Uuid;

#[tokio::test]
async fn given_authenticated_user_when_get_budgets_then_returns_array() {
    let app = TestFixtures::create_test_app().await.unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let req = TestFixtures::create_authenticated_get_request("/api/budgets", &token);
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body_bytes = to_bytes(res.into_body(), 1024 * 1024).await.unwrap();
    let v: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    assert!(v.is_array());
}

#[tokio::test]
async fn given_valid_payload_when_create_budget_then_returns_budget() {
    let mut mock = MockDatabaseRepository::new();
    mock.expect_get_plaid_connection_by_user()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock.expect_get_transactions_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock.expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock.expect_create_budget_for_user()
        .returning(|b: Budget| Box::pin(async move { Ok(b) }));

    let app = TestFixtures::create_test_app_with_db(mock).await.unwrap();

    let (_user, token) = TestFixtures::create_authenticated_user_with_token();
    let payload = json!({ "category": "Groceries", "amount": "200.00" });

    let req = Request::builder()
        .method("POST")
        .uri("/api/budgets")
        .header("authorization", format!("Bearer {}", token))
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
}

#[tokio::test]
async fn given_valid_payload_when_update_budget_then_returns_budget() {
    let budget_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();

    let mut mock = MockDatabaseRepository::new();
    mock.expect_get_plaid_connection_by_user()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock.expect_get_transactions_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock.expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock.expect_update_budget_for_user()
        .returning(move |id, _uid, amount| {
            let user_id = user_id;
            Box::pin(async move {
                Ok(Budget::new(user_id, "Groceries".to_string(), amount).into_with_id(id))
            })
        });

    let app = TestFixtures::create_test_app_with_db(mock).await.unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let payload = json!({ "amount": "250.00" });
    let req = Request::builder()
        .method("PUT")
        .uri(&format!("/api/budgets/{}", budget_id))
        .header("authorization", format!("Bearer {}", token))
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
}

#[tokio::test]
async fn given_duplicate_category_when_create_budget_then_conflict() {
    let mut mock = MockDatabaseRepository::new();
    mock.expect_get_plaid_connection_by_user()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock.expect_get_transactions_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock.expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock.expect_create_budget_for_user()
        .returning(|_b| Box::pin(async { Err(anyhow::anyhow!("already exists")) }));

    let app = TestFixtures::create_test_app_with_db(mock).await.unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();
    let payload = json!({ "category": "Groceries", "amount": "100.00" });

    let req = Request::builder()
        .method("POST")
        .uri("/api/budgets")
        .header("authorization", format!("Bearer {}", token))
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn given_non_positive_amount_when_create_budget_then_bad_request() {
    let app = TestFixtures::create_test_app().await.unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();
    let payload = json!({ "category": "Groceries", "amount": "0" });

    let req = Request::builder()
        .method("POST")
        .uri("/api/budgets")
        .header("authorization", format!("Bearer {}", token))
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn given_invalid_amount_when_update_budget_then_bad_request() {
    let app = TestFixtures::create_test_app().await.unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();
    let budget_id = Uuid::new_v4();
    let payload = json!({ "amount": "-1" });

    let req = Request::builder()
        .method("PUT")
        .uri(&format!("/api/budgets/{}", budget_id))
        .header("authorization", format!("Bearer {}", token))
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn given_invalid_budget_id_when_update_then_bad_request() {
    let app = TestFixtures::create_test_app().await.unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();
    let payload = json!({ "amount": "10" });

    let req = Request::builder()
        .method("PUT")
        .uri("/api/budgets/not-a-uuid")
        .header("authorization", format!("Bearer {}", token))
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn given_no_token_when_access_budgets_then_unauthorized() {
    let app = TestFixtures::create_test_app().await.unwrap();
    let req = Request::builder()
        .method("GET")
        .uri("/api/budgets")
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn given_cache_hit_when_get_budgets_then_skips_db() {
    let mock_db = MockDatabaseRepository::new();

    let mut mock_cache = MockCacheService::new();
    mock_cache
        .expect_health_check()
        .returning(|| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));

    let user_id = Uuid::new_v4();
    let budgets = vec![Budget::new(user_id, "Groceries".to_string(), dec!(100))];
    let serialized = serde_json::to_string(&budgets).unwrap();
    mock_cache.expect_get_string().returning(move |key| {
        let _ = key; // ignore
        let serialized = serialized.clone();
        Box::pin(async move { Ok(Some(serialized)) })
    });

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let req = TestFixtures::create_authenticated_get_request("/api/budgets", &token);
    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
}

#[tokio::test]
async fn given_create_budget_when_success_then_invalidate_cache() {
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_plaid_connection_by_user()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_db
        .expect_get_transactions_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock_db
        .expect_create_budget_for_user()
        .returning(|b: Budget| Box::pin(async move { Ok(b) }));

    let mut mock_cache = MockCacheService::new();
    mock_cache
        .expect_health_check()
        .returning(|| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    mock_cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_set_with_ttl()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_invalidate_pattern()
        .returning(|_| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();
    let payload = json!({ "category": "Rent", "amount": "1200.00" });

    let req = Request::builder()
        .method("POST")
        .uri("/api/budgets")
        .header("authorization", format!("Bearer {}", token))
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
}

trait BudgetTestExt {
    fn into_with_id(self, id: Uuid) -> Budget;
}

impl BudgetTestExt for Budget {
    fn into_with_id(mut self, id: Uuid) -> Budget {
        self.id = id;
        self
    }
}
