use crate::services::repository_service::MockDatabaseRepository;
use crate::test_fixtures::TestFixtures;
use axum::body::to_bytes;
use axum::http::header::SET_COOKIE;
use axum::http::Method;
use serde_json::json;
use tower::ServiceExt;
use uuid::Uuid;

use crate::services::cache_service::MockCacheService;

fn create_auth_cookie_cache() -> MockCacheService {
    let mut mock_cache = MockCacheService::new();

    mock_cache
        .expect_health_check()
        .returning(|| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));

    mock_cache
        .expect_set_with_ttl()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_invalidate_pattern()
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_is_auth_ip_banned()
        .times(0..)
        .returning(|_| Box::pin(async { Ok(false) }));

    mock_cache
        .expect_record_auth_rate_limit_exceeded()
        .times(0..)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_cache
}

fn set_cookie_value(response: &axum::response::Response) -> Option<&str> {
    response
        .headers()
        .get(SET_COOKIE)
        .and_then(|value| value.to_str().ok())
}

#[tokio::test]
async fn given_valid_login_when_authenticating_then_sets_auth_cookie_and_omits_token() {
    let mut mock_db = MockDatabaseRepository::new();
    let (user, _) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let email = "login@example.com".to_string();
    let expected_email = email.clone();

    mock_db
        .expect_get_user_by_email()
        .withf(move |candidate| candidate == expected_email)
        .returning(move |_| {
            let user = user.clone();
            Box::pin(async move { Ok(Some(user)) })
        });

    let mut mock_cache = create_auth_cookie_cache();
    mock_cache
        .expect_set_session_valid()
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_set_jwt_token()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request_body = json!({
        "email": email,
        "password": "SecurePass123!"
    });

    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/login")
        .header("X-Forwarded-For", "127.0.0.1")
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&request_body).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let set_cookie = set_cookie_value(&response).expect("expected auth cookie");
    assert!(set_cookie.contains("auth_token="));

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let response_json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(response_json.get("token").is_none());
    assert_eq!(
        response_json.get("user_id").unwrap(),
        &json!(user_id.to_string())
    );
    assert_eq!(
        response_json.get("onboarding_completed").unwrap(),
        &json!(false)
    );
}

#[tokio::test]
async fn given_valid_registration_when_registering_then_sets_auth_cookie_and_omits_token() {
    let mut mock_db = MockDatabaseRepository::new();

    mock_db
        .expect_create_user()
        .returning(|_| Box::pin(async { Ok(()) }));

    let mut mock_cache = create_auth_cookie_cache();
    mock_cache
        .expect_set_session_valid()
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_set_jwt_token()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request_body = json!({
        "email": "register@example.com",
        "password": "SecurePass123!"
    });

    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/register")
        .header("X-Forwarded-For", "127.0.0.1")
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&request_body).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let set_cookie = set_cookie_value(&response).expect("expected auth cookie");
    assert!(set_cookie.contains("auth_token="));

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let response_json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(response_json.get("token").is_none());
    assert_eq!(
        response_json.get("onboarding_completed").unwrap(),
        &json!(false)
    );
}

#[tokio::test]
async fn given_valid_auth_cookie_when_refreshing_then_returns_replacement_cookie_and_omits_token() {
    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;

    mock_db
        .expect_get_user_by_id()
        .withf(move |id| *id == user_id)
        .returning(move |_| {
            let user = user.clone();
            Box::pin(async move { Ok(Some(user)) })
        });

    let mut mock_cache = create_auth_cookie_cache();
    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    mock_cache
        .expect_set_session_valid()
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_set_jwt_token()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/refresh")
        .header("Cookie", format!("auth_token={}", token))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let set_cookie = set_cookie_value(&response).expect("expected auth cookie");
    assert!(set_cookie.contains("auth_token="));

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let response_json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(response_json.get("token").is_none());
    assert_eq!(
        response_json.get("user_id").unwrap(),
        &json!(user_id.to_string())
    );
    assert_eq!(
        response_json.get("onboarding_completed").unwrap(),
        &json!(false)
    );
}

#[tokio::test]
async fn given_valid_auth_cookie_when_logging_out_then_clears_cookie_and_returns_session_id() {
    let mock_db = MockDatabaseRepository::new();
    let auth_service = crate::services::auth_service::AuthService::new(
        "test_jwt_secret_key_for_integration_testing".to_string(),
    )
    .unwrap();
    let token = auth_service.generate_token(Uuid::new_v4()).unwrap();
    let jwt_id = token.jwt_id.clone();
    let expected_invalidate_jwt_id = jwt_id.clone();
    let expected_clear_jwt_id = jwt_id.clone();

    let mut mock_cache = create_auth_cookie_cache();
    mock_cache
        .expect_invalidate_session()
        .withf(move |candidate| candidate == expected_invalidate_jwt_id)
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_clear_jwt_scoped_data()
        .withf(move |candidate| candidate == expected_clear_jwt_id)
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_clear_transactions()
        .returning(|| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/logout")
        .header("Cookie", format!("auth_token={}", token.token))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let set_cookie = set_cookie_value(&response).expect("expected clearing auth cookie");
    assert!(set_cookie.contains("auth_token="));

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let response_json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(
        response_json.get("cleared_session").unwrap(),
        &json!(jwt_id)
    );
}

#[tokio::test]
async fn given_missing_auth_cookie_when_refreshing_then_returns_401() {
    let app = TestFixtures::create_test_app().await.unwrap();

    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/refresh")
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 401);
}

#[tokio::test]
async fn given_missing_auth_cookie_when_logging_out_then_returns_401() {
    let app = TestFixtures::create_test_app().await.unwrap();

    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/logout")
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 401);
}

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
        .header("Cookie", format!("auth_token={}", token))
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
        .header("Cookie", format!("auth_token={}", token))
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
        .header("Cookie", format!("auth_token={}", token))
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
        .header("Cookie", format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
}
