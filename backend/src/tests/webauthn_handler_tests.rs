use crate::models::auth::WebAuthnCredential;
use crate::services::cache_service::MockCacheService;
use crate::services::repository_service::MockDatabaseRepository;
use crate::test_fixtures::TestFixtures;
use axum::body::to_bytes;
use axum::http::Method;
use chrono::Utc;
use serde_json::json;
use tower::ServiceExt;
use uuid::Uuid;

fn make_credential(user_id: Uuid) -> WebAuthnCredential {
    WebAuthnCredential {
        id: Uuid::new_v4(),
        user_id,
        credential_id: vec![1, 2, 3, 4],
        passkey: json!({}),
        name: "Test Key".to_string(),
        created_at: Utc::now(),
        last_used_at: None,
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

#[tokio::test]
async fn given_no_auth_when_begin_registration_then_401() {
    let mock_db = MockDatabaseRepository::new();
    let mock_cache = MockCacheService::new();

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/passkey/register/begin")
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
        .uri("/api/auth/passkey/register/begin")
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
async fn given_authenticated_when_list_passkeys_then_200_empty_array() {
    let (_, token) = TestFixtures::create_authenticated_user_with_token();

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_list_webauthn_credentials_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

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
    assert_eq!(json.as_array().unwrap().len(), 0);
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
    assert_eq!(response.status(), 200);
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
