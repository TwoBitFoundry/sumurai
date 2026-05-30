use crate::models::auth::User;
use crate::services::cache_service::MockCacheService;
use crate::services::repository_service::MockDatabaseRepository;
use crate::services::AuthService;
use crate::test_fixtures::TestFixtures;
use axum::body::to_bytes;
use axum::http::Method;
use chrono::Utc;
use serde_json::json;
use tower::ServiceExt;
use uuid::Uuid;

fn legacy_user_with_password(hash: String) -> User {
    User {
        id: Uuid::new_v4(),
        email: "legacy@example.com".to_string(),
        password_hash: Some(hash),
        provider: String::new(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        onboarding_completed: true,
    }
}

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

#[tokio::test]
async fn given_legacy_user_without_passkey_when_password_login_then_200_and_cookie() {
    let auth_service =
        AuthService::new("test_jwt_secret_key_for_integration_testing".to_string()).unwrap();
    let password_hash = auth_service.hash_password("Test1234!").unwrap();
    let user = legacy_user_with_password(password_hash);
    let email = user.email.clone();

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
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache_for_login())
        .await
        .unwrap();

    let body = json!({
        "email": "legacy@example.com",
        "password": "Test1234!"
    });
    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/login/password")
        .header("content-type", "application/json")
        .header("X-Forwarded-For", "203.0.113.10")
        .body(axum::body::Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let set_cookie = response
        .headers()
        .get("set-cookie")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    assert!(set_cookie.contains("auth_token="));

    let response_body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let auth_json: serde_json::Value = serde_json::from_slice(&response_body).unwrap();
    assert!(auth_json.get("user_id").and_then(|v| v.as_str()).is_some());
}

#[tokio::test]
async fn given_legacy_user_when_wrong_password_then_401() {
    let auth_service =
        AuthService::new("test_jwt_secret_key_for_integration_testing".to_string()).unwrap();
    let password_hash = auth_service.hash_password("Test1234!").unwrap();
    let user = legacy_user_with_password(password_hash);

    let mut mock_db = MockDatabaseRepository::new();
    mock_db.expect_get_user_by_email().returning(move |_| {
        let u = user.clone();
        Box::pin(async move { Ok(Some(u)) })
    });
    mock_db
        .expect_list_webauthn_credentials_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache_for_login())
        .await
        .unwrap();

    let body = json!({
        "email": "legacy@example.com",
        "password": "wrong"
    });
    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/login/password")
        .header("content-type", "application/json")
        .header("X-Forwarded-For", "203.0.113.11")
        .body(axum::body::Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 401);
}

#[tokio::test]
async fn given_orphan_credential_row_when_password_login_then_200() {
    let auth_service =
        AuthService::new("test_jwt_secret_key_for_integration_testing".to_string()).unwrap();
    let password_hash = auth_service.hash_password("Test1234!").unwrap();
    let user = legacy_user_with_password(password_hash);
    let email = user.email.clone();
    let orphan = crate::models::auth::WebAuthnCredential {
        id: Uuid::new_v4(),
        user_id: user.id,
        credential_id: vec![1, 2, 3],
        passkey: json!({}),
        name: "Broken".to_string(),
        created_at: Utc::now(),
        last_used_at: None,
    };

    let mut mock_db = MockDatabaseRepository::new();
    mock_db.expect_get_user_by_email().returning(move |_| {
        let u = user.clone();
        Box::pin(async move { Ok(Some(u)) })
    });
    mock_db
        .expect_list_webauthn_credentials_for_user()
        .returning(move |_| {
            let c = orphan.clone();
            Box::pin(async move { Ok(vec![c]) })
        });

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache_for_login())
        .await
        .unwrap();

    let body = json!({
        "email": email,
        "password": "Test1234!"
    });
    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/login/password")
        .header("content-type", "application/json")
        .header("X-Forwarded-For", "203.0.113.14")
        .body(axum::body::Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn given_passkey_only_user_when_password_login_then_401() {
    let user = User {
        id: Uuid::new_v4(),
        email: "new@example.com".to_string(),
        password_hash: None,
        provider: String::new(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        onboarding_completed: true,
    };
    let email = user.email.clone();

    let mut mock_db = MockDatabaseRepository::new();
    mock_db.expect_get_user_by_email().returning(move |_| {
        let u = user.clone();
        Box::pin(async move { Ok(Some(u)) })
    });
    mock_db
        .expect_list_webauthn_credentials_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache_for_login())
        .await
        .unwrap();

    let body = json!({
        "email": email,
        "password": "anything"
    });
    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/login/password")
        .header("content-type", "application/json")
        .header("X-Forwarded-For", "203.0.113.12")
        .body(axum::body::Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 401);
}
