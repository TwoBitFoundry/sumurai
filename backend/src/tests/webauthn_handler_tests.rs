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

fn make_credential(user_id: Uuid) -> crate::models::auth::WebAuthnCredential {
    test_passkey_for_user(user_id)
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
async fn given_no_auth_when_begin_registration_then_401() {
    let mock_db = MockDatabaseRepository::new();
    let mock_cache = MockCacheService::new();

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
async fn given_no_auth_when_list_passkeys_then_401() {
    let mock_db = MockDatabaseRepository::new();
    let mock_cache = MockCacheService::new();

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::GET)
        .uri("/api/auth/passkey")
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 401);
}

#[tokio::test]
async fn given_no_auth_when_delete_passkey_then_401() {
    let mock_db = MockDatabaseRepository::new();
    let mock_cache = MockCacheService::new();

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::DELETE)
        .uri(format!("/api/auth/passkey/{}", Uuid::new_v4()))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 401);
}

#[tokio::test]
async fn given_authenticated_when_begin_registration_then_200_with_challenge() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_list_webauthn_credentials_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

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
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(json.get("session_id").is_some(), "must have session_id");
    assert!(
        json.get("challenge").is_some(),
        "must have challenge for user {}",
        user_id
    );
}

#[tokio::test]
async fn given_authenticated_when_list_passkeys_then_200_with_passkeys() {
    let (_, token) = TestFixtures::create_authenticated_user_with_token();

    let mock_db = MockDatabaseRepository::new();
    let mock_cache = mock_cache_for_auth();

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
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

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(json.is_array());
}

#[tokio::test]
async fn given_two_credentials_when_list_then_returns_both() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let cred_a = make_credential(user_id);
    let cred_b = make_credential(user_id);

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_list_webauthn_credentials_for_user()
        .returning(move |_| {
            let a = cred_a.clone();
            let b = cred_b.clone();
            Box::pin(async move { Ok(vec![a, b]) })
        });

    let mock_cache = mock_cache_for_auth();

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
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

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json.as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn given_only_one_credential_when_delete_then_409() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let cred = make_credential(user_id);
    let cred_id = cred.id;

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_list_webauthn_credentials_for_user()
        .returning(move |_| {
            let c = cred.clone();
            Box::pin(async move { Ok(vec![c]) })
        });

    let mock_cache = mock_cache_for_auth();

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::DELETE)
        .uri(format!("/api/auth/passkey/{}", cred_id))
        .header("Cookie", format!("auth_token={}", token))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 409);
}

#[tokio::test]
async fn given_two_credentials_when_delete_one_then_200() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let cred_a = make_credential(user_id);
    let cred_b = make_credential(user_id);
    let delete_id = cred_a.id;

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_list_webauthn_credentials_for_user()
        .returning(move |_| {
            let a = cred_a.clone();
            let b = cred_b.clone();
            Box::pin(async move { Ok(vec![a, b]) })
        });
    mock_db
        .expect_delete_webauthn_credential()
        .returning(|_, _| Box::pin(async { Ok(true) }));

    let mock_cache = mock_cache_for_auth();

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::DELETE)
        .uri(format!("/api/auth/passkey/{}", delete_id))
        .header("Cookie", format!("auth_token={}", token))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 204);
}

#[tokio::test]
async fn given_one_usable_and_one_broken_when_delete_broken_then_204() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let usable = make_credential(user_id);
    let broken = crate::models::auth::WebAuthnCredential {
        id: uuid::Uuid::new_v4(),
        user_id,
        credential_id: vec![9, 9, 9],
        passkey: serde_json::json!({}),
        name: "Broken entry".to_string(),
        created_at: chrono::Utc::now(),
        last_used_at: None,
    };
    let delete_id = broken.id;

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_list_webauthn_credentials_for_user()
        .returning(move |_| {
            let u = usable.clone();
            let b = broken.clone();
            Box::pin(async move { Ok(vec![u, b]) })
        });
    mock_db
        .expect_delete_webauthn_credential()
        .returning(|_, _| Box::pin(async { Ok(true) }));

    let mock_cache = mock_cache_for_auth();

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::DELETE)
        .uri(format!("/api/auth/passkey/{}", delete_id))
        .header("Cookie", format!("auth_token={}", token))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 204);
}

#[tokio::test]
async fn given_one_usable_and_one_broken_when_delete_usable_then_409() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let usable = make_credential(user_id);
    let broken = crate::models::auth::WebAuthnCredential {
        id: uuid::Uuid::new_v4(),
        user_id,
        credential_id: vec![9, 9, 9],
        passkey: serde_json::json!({}),
        name: "Broken entry".to_string(),
        created_at: chrono::Utc::now(),
        last_used_at: None,
    };
    let delete_id = usable.id;

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_list_webauthn_credentials_for_user()
        .returning(move |_| {
            let u = usable.clone();
            let b = broken.clone();
            Box::pin(async move { Ok(vec![u, b]) })
        });

    let mock_cache = mock_cache_for_auth();

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::DELETE)
        .uri(format!("/api/auth/passkey/{}", delete_id))
        .header("Cookie", format!("auth_token={}", token))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 409);
}

#[tokio::test]
async fn given_no_challenge_in_cache_when_finish_registration_then_400() {
    let (_, token) = TestFixtures::create_authenticated_user_with_token();

    let mock_db = MockDatabaseRepository::new();
    let mut mock_cache = mock_cache_for_auth();
    mock_cache
        .expect_take_webauthn_challenge()
        .returning(|_| Box::pin(async { Ok(None) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let body = serde_json::json!({
        "session_id": uuid::Uuid::new_v4().to_string(),
        "response": {},
        "name": "My Key"
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
async fn given_cross_user_credential_when_user_b_deletes_then_404() {
    let (user_a, _) = TestFixtures::create_authenticated_user_with_token();
    let (_, token_b) = TestFixtures::create_authenticated_user_with_token();
    let user_a_cred = make_credential(user_a.id);
    let cross_user_cred_id = user_a_cred.id;

    let mut mock_db = MockDatabaseRepository::new();
    let cred_b1 = make_credential(uuid::Uuid::new_v4());
    let cred_b2 = make_credential(uuid::Uuid::new_v4());
    mock_db
        .expect_list_webauthn_credentials_for_user()
        .returning(move |_| {
            let a = cred_b1.clone();
            let b = cred_b2.clone();
            Box::pin(async move { Ok(vec![a, b]) })
        });
    mock_db
        .expect_delete_webauthn_credential()
        .returning(|_, _| Box::pin(async { Ok(false) }));

    let mock_cache = mock_cache_for_auth();

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::DELETE)
        .uri(format!("/api/auth/passkey/{}", cross_user_cred_id))
        .header("Cookie", format!("auth_token={}", token_b))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 404);
}

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

#[tokio::test]
async fn given_old_login_endpoint_when_called_then_404() {
    let mock_db = MockDatabaseRepository::new();
    let mock_cache = MockCacheService::new();

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/login")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({"email": "a@b.com", "password": "x"})).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 404);
}

#[tokio::test]
async fn given_unknown_email_when_begin_login_then_200_same_shape() {
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_user_by_email()
        .returning(|_| Box::pin(async { Ok(None) }));

    let mock_cache = mock_cache_for_passkey_login();

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/passkey/login/begin")
        .header("content-type", "application/json")
        .header("X-Forwarded-For", "198.51.100.1")
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({"email": "nobody@example.com"})).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(json.get("session_id").is_some(), "must have session_id");
    assert!(json.get("challenge").is_some(), "must have challenge");
    assert_eq!(
        json.get("account_exists").and_then(|v| v.as_bool()),
        Some(false)
    );
    assert_eq!(
        json.get("passkey_available").and_then(|v| v.as_bool()),
        Some(false)
    );
    assert_eq!(
        json.get("password_available").and_then(|v| v.as_bool()),
        Some(false)
    );
}

#[tokio::test]
async fn given_known_email_when_begin_login_then_200_with_recovery_challenge() {
    let user = make_user();
    let user_id = user.id;

    let mut mock_db = MockDatabaseRepository::new();
    mock_db.expect_get_user_by_email().returning(move |_| {
        let u = user.clone();
        Box::pin(async move { Ok(Some(u)) })
    });
    mock_db
        .expect_list_webauthn_credentials_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

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
        .header("X-Forwarded-For", "198.51.100.2")
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({"email": "test@example.com"})).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(
        json.get("session_id").is_some(),
        "must have session_id for user {}",
        user_id
    );
    assert!(json.get("challenge").is_some(), "must have challenge");
    assert_eq!(
        json.get("account_exists").and_then(|v| v.as_bool()),
        Some(true)
    );
    assert_eq!(
        json.get("passkey_available").and_then(|v| v.as_bool()),
        Some(false)
    );
    assert_eq!(
        json.get("password_available").and_then(|v| v.as_bool()),
        Some(false)
    );
    assert!(
        !json
            .get("session_id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .is_empty(),
        "recovery should return a registration session"
    );
}

#[tokio::test]
async fn given_passkeyless_user_with_password_when_begin_login_then_password_available() {
    let auth_service = crate::services::AuthService::new(
        "test_jwt_secret_key_for_integration_testing".to_string(),
    )
    .unwrap();
    let mut user = make_user();
    user.password_hash = Some(auth_service.hash_password("Test1234!").unwrap());

    let mut mock_db = MockDatabaseRepository::new();
    mock_db.expect_get_user_by_email().returning(move |_| {
        let u = user.clone();
        Box::pin(async move { Ok(Some(u)) })
    });
    mock_db
        .expect_list_webauthn_credentials_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let mock_cache = mock_cache_for_passkey_login();

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/passkey/login/begin")
        .header("content-type", "application/json")
        .header("X-Forwarded-For", "198.51.100.3")
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({"email": "test@example.com"})).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        json.get("account_exists").and_then(|v| v.as_bool()),
        Some(true)
    );
    assert_eq!(
        json.get("passkey_available").and_then(|v| v.as_bool()),
        Some(false)
    );
    assert_eq!(
        json.get("password_available").and_then(|v| v.as_bool()),
        Some(true)
    );
    assert_eq!(json.get("session_id").and_then(|v| v.as_str()), Some(""));
}

#[tokio::test]
async fn given_no_challenge_when_finish_login_then_400() {
    let mock_db = MockDatabaseRepository::new();
    let mut mock_cache = mock_cache_for_passkey_login();
    mock_cache
        .expect_take_webauthn_challenge()
        .returning(|_| Box::pin(async { Ok(None) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let body = json!({
        "session_id": Uuid::new_v4().to_string(),
        "response": {}
    });

    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/passkey/login/finish")
        .header("content-type", "application/json")
        .header("X-Forwarded-For", "198.51.100.4")
        .body(axum::body::Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 400);
}

#[tokio::test]
async fn given_unknown_user_challenge_when_finish_login_then_401() {
    let mock_db = MockDatabaseRepository::new();
    let mut mock_cache = mock_cache_for_passkey_login();

    let payload = json!({
        "user_id": Uuid::nil().to_string(),
        "state": {}
    })
    .to_string();

    mock_cache
        .expect_take_webauthn_challenge()
        .returning(move |_| {
            let p = payload.clone();
            Box::pin(async move { Ok(Some(p)) })
        });

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let body = json!({
        "session_id": Uuid::new_v4().to_string(),
        "response": {}
    });

    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/passkey/login/finish")
        .header("content-type", "application/json")
        .header("X-Forwarded-For", "198.51.100.5")
        .body(axum::body::Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 401);
}

#[tokio::test]
async fn given_valid_challenge_but_invalid_response_when_finish_login_then_400() {
    use crate::services::webauthn_service::WebAuthnService;

    let service = WebAuthnService::new(
        "localhost",
        &[url::Url::parse("http://localhost:8080").unwrap()],
    )
    .unwrap();
    let (_, auth_state) = service.begin_authentication(&[]).unwrap();
    let state_json = serde_json::to_value(&auth_state).unwrap();

    let user_id = Uuid::new_v4();
    let payload = json!({
        "user_id": user_id.to_string(),
        "state": state_json
    })
    .to_string();

    let mock_db = MockDatabaseRepository::new();
    let mut mock_cache = mock_cache_for_passkey_login();
    mock_cache
        .expect_take_webauthn_challenge()
        .returning(move |_| {
            let p = payload.clone();
            Box::pin(async move { Ok(Some(p)) })
        });

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let body = json!({
        "session_id": Uuid::new_v4().to_string(),
        "response": {
            "id": "notvalidbase64url!!!",
            "rawId": "notvalidbase64url!!!",
            "type": "public-key",
            "response": {
                "authenticatorData": "bad",
                "clientDataJSON": "bad",
                "signature": "bad"
            }
        }
    });

    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/passkey/login/finish")
        .header("content-type", "application/json")
        .header("X-Forwarded-For", "198.51.100.6")
        .body(axum::body::Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    let status = response.status().as_u16();
    assert!(
        status == 400 || status == 401,
        "expected 400 or 401, got {}",
        status
    );
}
