use crate::models::auth::User;
use crate::services::cache_service::MockCacheService;
use crate::services::repository_service::MockDatabaseRepository;
use crate::test_fixtures::{test_passkey_for_user, TestFixtures};
use axum::body::to_bytes;
use axum::http::Method;
use chrono::Utc;
use serde_json::json;
use tower::ServiceExt;
use uuid::Uuid;

fn make_user() -> User {
    User {
        id: Uuid::new_v4(),
        email: "test@example.com".to_string(),
        password_hash: None,
        provider: String::new(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        onboarding_completed: false,
    }
}

fn mock_cache_for_auth() -> MockCacheService {
    let mut cache = MockCacheService::new();
    cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    cache
        .expect_is_auth_ip_banned()
        .times(0..)
        .returning(|_| Box::pin(async { Ok(false) }));
    cache
        .expect_record_auth_rate_limit_exceeded()
        .times(0..)
        .returning(|_| Box::pin(async { Ok(()) }));
    cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));
    cache
        .expect_set_with_ttl()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));
    cache
        .expect_invalidate_pattern()
        .returning(|_| Box::pin(async { Ok(()) }));
    cache
}

fn mock_cache_for_passkey_login() -> MockCacheService {
    let mut cache = MockCacheService::new();
    cache
        .expect_is_auth_ip_banned()
        .times(0..)
        .returning(|_| Box::pin(async { Ok(false) }));
    cache
        .expect_record_auth_rate_limit_exceeded()
        .times(0..)
        .returning(|_| Box::pin(async { Ok(()) }));
    cache
}

#[tokio::test]
async fn given_user_with_passkey_when_begin_passkey_enroll_then_200() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let cred = test_passkey_for_user(user_id);

    let mut mock_db = MockDatabaseRepository::new();
    mock_db.expect_get_user_by_id().returning(move |_| {
        let u = user.clone();
        Box::pin(async move { Ok(Some(u)) })
    });
    mock_db
        .expect_list_webauthn_credentials_for_user()
        .returning(move |_| {
            let c = cred.clone();
            Box::pin(async move { Ok(vec![c]) })
        });

    let mut mock_cache = mock_cache_for_auth();
    mock_cache
        .expect_set_webauthn_challenge()
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/passkey/enroll/begin")
        .header("Cookie", format!("auth_token={}", token))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(payload.get("session_id").is_some());
    assert!(payload.get("challenge").is_some());
}

#[tokio::test]
async fn given_no_cookie_when_begin_passkey_enroll_then_401() {
    let mock_db = MockDatabaseRepository::new();
    let mock_cache = mock_cache_for_auth();

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/passkey/enroll/begin")
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 401);
}

#[tokio::test]
async fn given_auth_cookie_when_public_register_finish_then_400() {
    let (_, token) = TestFixtures::create_authenticated_user_with_token();
    let session_id = Uuid::new_v4().to_string();

    let mut mock_cache = mock_cache_for_auth();
    mock_cache
        .expect_take_webauthn_challenge()
        .returning(|_| Box::pin(async { Ok(Some("{}".to_string())) }));

    let mock_db = MockDatabaseRepository::new();
    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let body = json!({
        "session_id": session_id,
        "response": {},
        "name": "Key"
    });

    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/passkey/register/finish")
        .header("Cookie", format!("auth_token={}", token))
        .header("content-type", "application/json")
        .body(axum::body::Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 400);
}

#[tokio::test]
async fn given_recovery_challenge_when_user_already_has_passkey_then_finish_registration_400() {
    let user_id = Uuid::new_v4();
    let cred = test_passkey_for_user(user_id);
    let session_id = Uuid::new_v4().to_string();
    let challenge_payload = serde_json::to_string(&json!({
        "user_id": user_id.to_string(),
        "email": "test@example.com",
        "display_name": "Test",
        "state": {},
        "existing_user_recovery": true,
    }))
    .unwrap();

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_list_webauthn_credentials_for_user()
        .returning(move |_| {
            let c = cred.clone();
            Box::pin(async move { Ok(vec![c]) })
        });

    let mut mock_cache = mock_cache_for_auth();
    mock_cache
        .expect_take_webauthn_challenge()
        .returning(move |_| {
            let payload = challenge_payload.clone();
            Box::pin(async move { Ok(Some(payload)) })
        });

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let body = json!({
        "session_id": session_id,
        "response": {},
        "name": "Recovery Key"
    });

    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/passkey/register/finish")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 400);
}

#[tokio::test]
async fn given_user_with_passkey_when_begin_login_then_passkey_available() {
    let user = make_user();
    let user_id = user.id;
    let cred = test_passkey_for_user(user_id);

    let mut mock_db = MockDatabaseRepository::new();
    mock_db.expect_get_user_by_email().returning(move |_| {
        let u = user.clone();
        Box::pin(async move { Ok(Some(u)) })
    });
    mock_db
        .expect_list_webauthn_credentials_for_user()
        .returning(move |_| {
            let c = cred.clone();
            Box::pin(async move { Ok(vec![c]) })
        });

    let mut mock_cache = mock_cache_for_passkey_login();
    mock_cache
        .expect_set_webauthn_challenge()
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/passkey/login/begin")
        .header("content-type", "application/json")
        .header("X-Forwarded-For", "198.51.100.7")
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({"email": "test@example.com"})).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        payload.get("passkey_available").and_then(|v| v.as_bool()),
        Some(true)
    );
    assert!(!payload
        .get("session_id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .is_empty());
}
