use crate::services::repository_service::MockDatabaseRepository;
use crate::test_fixtures::TestFixtures;
use axum::body::to_bytes;
use axum::http::Method;
use serde_json::json;
use tower::ServiceExt;

#[tokio::test]
async fn given_valid_current_password_when_change_password_then_returns_200() {
    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;

    mock_db
        .expect_get_user_by_id()
        .withf(move |id| *id == user_id)
        .returning(move |_| {
            let u = user.clone();
            Box::pin(async move { Ok(Some(u)) })
        });

    mock_db
        .expect_update_user_password()
        .withf(move |id, _| *id == user_id)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_transactions_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request_body = json!({
        "current_password": "SecurePass123!",
        "new_password": "NewSecurePass456!"
    });

    let body_json = serde_json::to_string(&request_body).unwrap();
    let request = axum::http::Request::builder()
        .method(Method::PUT)
        .uri("/api/auth/change-password")
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(body_json))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let response_json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(response_json.get("message").is_some());
    assert_eq!(response_json.get("requires_reauth").unwrap(), &json!(true));
}

#[tokio::test]
async fn given_invalid_current_password_when_change_password_then_returns_401() {
    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;

    mock_db
        .expect_get_user_by_id()
        .withf(move |id| *id == user_id)
        .returning(move |_| {
            let u = user.clone();
            Box::pin(async move { Ok(Some(u)) })
        });

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_transactions_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request_body = json!({
        "current_password": "WrongPassword123!",
        "new_password": "NewSecurePass456!"
    });

    let body_json = serde_json::to_string(&request_body).unwrap();
    let request = axum::http::Request::builder()
        .method(Method::PUT)
        .uri("/api/auth/change-password")
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(body_json))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 401);
}

#[tokio::test]
async fn given_no_auth_token_when_change_password_then_returns_401() {
    let app = TestFixtures::create_test_app().await.unwrap();

    let request_body = json!({
        "current_password": "SecurePass123!",
        "new_password": "NewSecurePass456!"
    });

    let body_json = serde_json::to_string(&request_body).unwrap();
    let request = axum::http::Request::builder()
        .method(Method::PUT)
        .uri("/api/auth/change-password")
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(body_json))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 401);
}

#[tokio::test]
async fn given_authenticated_user_when_delete_account_then_returns_200() {
    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;

    mock_db
        .expect_get_all_provider_connections_by_user()
        .withf(move |id| *id == user_id)
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_budgets_for_user()
        .withf(move |id| *id == user_id)
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_delete_user()
        .withf(move |id| *id == user_id)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_db
        .expect_get_transactions_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::DELETE)
        .uri("/api/auth/account")
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let response_json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(response_json.get("message").is_some());
    assert!(response_json.get("deleted_items").is_some());
}

#[tokio::test]
async fn given_no_auth_token_when_delete_account_then_returns_401() {
    let app = TestFixtures::create_test_app().await.unwrap();

    let request = axum::http::Request::builder()
        .method(Method::DELETE)
        .uri("/api/auth/account")
        .header("Content-Type", "application/json")
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 401);
}

#[tokio::test]
async fn given_user_deletion_when_cache_invalidation_fails_then_still_returns_200() {
    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;

    mock_db
        .expect_get_all_provider_connections_by_user()
        .withf(move |id| *id == user_id)
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_budgets_for_user()
        .withf(move |id| *id == user_id)
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_delete_user()
        .withf(move |id| *id == user_id)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_db
        .expect_get_transactions_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::DELETE)
        .uri("/api/auth/account")
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
}
