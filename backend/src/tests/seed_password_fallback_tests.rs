#![cfg(feature = "dev-seed")]

use crate::models::auth::User;
use crate::seed::DEMO_EMAIL;
use crate::services::cache_service::MockCacheService;
use crate::services::repository_service::MockDatabaseRepository;
use crate::services::AuthService;
use crate::test_fixtures::{test_passkey_for_user, TestFixtures};
use axum::body::to_bytes;
use axum::http::Method;
use chrono::Utc;
use serde_json::json;
use tower::ServiceExt;
use uuid::Uuid;

fn mock_cache_for_login() -> MockCacheService {
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
        .expect_set_session_valid()
        .times(0..)
        .returning(|_, _| Box::pin(async { Ok(()) }));
    cache
        .expect_set_jwt_token()
        .times(0..)
        .returning(|_, _, _| Box::pin(async { Ok(()) }));
    cache
}

fn mock_cache_for_auth() -> MockCacheService {
    let mut cache = mock_cache_for_login();
    cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
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

async fn demo_user_with_password() -> User {
    let auth_service =
        AuthService::new("test_jwt_secret_key_for_integration_testing".to_string()).unwrap();
    User {
        id: Uuid::new_v4(),
        email: DEMO_EMAIL.to_string(),
        password_hash: Some(auth_service.hash_password("Test1234!").unwrap()),
        provider: String::new(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        onboarding_completed: true,
    }
}

#[tokio::test]
async fn given_seed_user_without_passkey_when_protected_request_then_200() {
    let user = demo_user_with_password().await;
    let (_, token) = TestFixtures::create_authenticated_user_with_token_for_user(user.clone());

    let mut mock_db = MockDatabaseRepository::new();
    mock_db.expect_get_user_by_id().returning(move |_| {
        let u = user.clone();
        Box::pin(async move { Ok(Some(u)) })
    });
    mock_db
        .expect_list_webauthn_credentials_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache_for_auth())
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::GET)
        .uri("/api/auth/passkey")
        .header("Cookie", format!("auth_token={}", token))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn given_seed_user_with_passkey_when_password_login_then_200() {
    let user = demo_user_with_password().await;
    let user_id = user.id;
    let email = user.email.clone();
    let cred = test_passkey_for_user(user_id);

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_user_by_email()
        .withf(move |e| e == email)
        .returning(move |_| {
            let u = user.clone();
            Box::pin(async move { Ok(Some(u)) })
        });
    mock_db
        .expect_list_webauthn_credentials_for_user()
        .returning(move |_| {
            let c = cred.clone();
            Box::pin(async move { Ok(vec![c]) })
        });

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache_for_login())
        .await
        .unwrap();

    let body = json!({
        "email": DEMO_EMAIL,
        "password": "Test1234!"
    });
    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/login/password")
        .header("content-type", "application/json")
        .header("X-Forwarded-For", "203.0.113.20")
        .body(axum::body::Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        payload
            .get("requires_passkey_enrollment")
            .and_then(|v| v.as_bool()),
        Some(false)
    );
}

#[tokio::test]
async fn given_seed_user_with_passkey_when_begin_login_then_password_available() {
    let user = demo_user_with_password().await;
    let user_id = user.id;
    let email = user.email.clone();
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

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache_for_login())
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/passkey/login/begin")
        .header("content-type", "application/json")
        .header("X-Forwarded-For", "198.51.100.8")
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({"email": DEMO_EMAIL})).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        payload.get("password_available").and_then(|v| v.as_bool()),
        Some(true)
    );
    assert_eq!(
        payload.get("passkey_available").and_then(|v| v.as_bool()),
        Some(false)
    );
}

#[tokio::test]
async fn given_other_user_without_passkey_when_protected_request_then_403() {
    let user = User {
        id: Uuid::new_v4(),
        email: "legacy@example.com".to_string(),
        password_hash: Some("argon2_hash".to_string()),
        provider: String::new(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        onboarding_completed: true,
    };
    let (_, token) = TestFixtures::create_authenticated_user_with_token_for_user(user.clone());

    let mut mock_db = MockDatabaseRepository::new();
    mock_db.expect_get_user_by_id().returning(move |_| {
        let u = user.clone();
        Box::pin(async move { Ok(Some(u)) })
    });
    mock_db
        .expect_list_webauthn_credentials_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache_for_auth())
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::GET)
        .uri("/api/auth/passkey")
        .header("Cookie", format!("auth_token={}", token))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 403);
}
