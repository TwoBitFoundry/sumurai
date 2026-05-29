use crate::models::auth::{User, WebAuthnCredential};
use crate::services::cache_service::MockCacheService;
use crate::services::repository_service::MockDatabaseRepository;
use crate::test_fixtures::TestFixtures;
use axum::body::to_bytes;
use axum::http::header::SET_COOKIE;
use axum::http::Method;
use chrono::Utc;
use serde_json::json;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tower::ServiceExt;
use uuid::Uuid;
use webauthn_authenticator_rs::prelude::{CreationChallengeResponse, WebauthnAuthenticator};
use webauthn_authenticator_rs::softpasskey::SoftPasskey;
use webauthn_rs::prelude::RegisterPublicKeyCredential;

const TEST_ORIGIN: &str = "http://localhost:8080";

fn simulate_passkey_registration(
    challenge: CreationChallengeResponse,
) -> RegisterPublicKeyCredential {
    let origin = url::Url::parse(TEST_ORIGIN).unwrap();
    let mut authenticator = WebauthnAuthenticator::new(SoftPasskey::new(true));
    authenticator
        .do_registration(origin, challenge)
        .expect("SoftPasskey registration should succeed")
}

fn mock_public_auth_cache() -> MockCacheService {
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
async fn given_password_in_register_body_when_registering_then_400() {
    let mock_db = MockDatabaseRepository::new();
    let mock_cache = mock_public_auth_cache();

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/register")
        .header("X-Forwarded-For", "198.51.100.30")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({
                "email": "user@example.com",
                "name": "User",
                "password": "SecurePass123!"
            }))
            .unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 400);
}

#[tokio::test]
async fn given_register_without_finish_when_accessing_protected_route_then_401() {
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_user_by_email()
        .returning(|_| Box::pin(async { Ok(None) }));

    let mut mock_cache = mock_public_auth_cache();
    mock_cache
        .expect_set_webauthn_challenge()
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let register_request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/register")
        .header("X-Forwarded-For", "198.51.100.31")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({
                "email": "partial@example.com",
                "name": "Partial User"
            }))
            .unwrap(),
        ))
        .unwrap();

    let register_response = app.clone().oneshot(register_request).await.unwrap();
    assert_eq!(register_response.status(), 200);
    assert!(register_response.headers().get(SET_COOKIE).is_none());

    let protected_request = axum::http::Request::builder()
        .method(Method::GET)
        .uri("/api/auth/passkey")
        .body(axum::body::Body::empty())
        .unwrap();

    let protected_response = app.oneshot(protected_request).await.unwrap();
    assert_eq!(protected_response.status(), 401);
}

#[tokio::test]
async fn given_register_and_finish_when_authenticated_request_then_succeeds() {
    let stored_users: Arc<Mutex<HashMap<Uuid, User>>> = Arc::new(Mutex::new(HashMap::new()));
    let stored_credentials: Arc<Mutex<Vec<WebAuthnCredential>>> = Arc::new(Mutex::new(Vec::new()));
    let challenge_store: Arc<Mutex<HashMap<String, String>>> = Arc::new(Mutex::new(HashMap::new()));

    let users_for_create = stored_users.clone();
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_user_by_email()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_db.expect_create_user().returning(move |user| {
        users_for_create
            .lock()
            .unwrap()
            .insert(user.id, user.clone());
        Box::pin(async { Ok(()) })
    });

    let users_for_get = stored_users.clone();
    mock_db.expect_get_user_by_id().returning(move |user_id| {
        let user = users_for_get.lock().unwrap().get(user_id).cloned();
        Box::pin(async move { Ok(user) })
    });

    let creds_for_insert = stored_credentials.clone();
    mock_db.expect_insert_webauthn_credential().returning(
        move |user_id, credential_id, passkey, name| {
            let credential = WebAuthnCredential {
                id: Uuid::new_v4(),
                user_id: *user_id,
                credential_id,
                passkey,
                name: name.to_string(),
                created_at: Utc::now(),
                last_used_at: None,
            };
            creds_for_insert.lock().unwrap().push(credential.clone());
            Box::pin(async move { Ok(credential) })
        },
    );

    let creds_for_list = stored_credentials.clone();
    mock_db
        .expect_list_webauthn_credentials_for_user()
        .returning(move |user_id| {
            let items = creds_for_list
                .lock()
                .unwrap()
                .iter()
                .filter(|c| c.user_id == *user_id)
                .cloned()
                .collect();
            Box::pin(async move { Ok(items) })
        });

    let challenges_for_set = challenge_store.clone();
    let challenges_for_take = challenge_store.clone();
    let mut mock_cache = mock_public_auth_cache();
    mock_cache
        .expect_set_webauthn_challenge()
        .returning(move |session_id, payload| {
            challenges_for_set
                .lock()
                .unwrap()
                .insert(session_id.to_string(), payload.to_string());
            Box::pin(async { Ok(()) })
        });
    mock_cache
        .expect_take_webauthn_challenge()
        .returning(move |session_id| {
            let payload = challenges_for_take.lock().unwrap().remove(session_id);
            Box::pin(async move { Ok(payload) })
        });
    mock_cache
        .expect_set_session_valid()
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_set_jwt_token()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let register_request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/register")
        .header("X-Forwarded-For", "198.51.100.32")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({
                "email": "new@example.com",
                "name": "New User"
            }))
            .unwrap(),
        ))
        .unwrap();

    let register_response = app.clone().oneshot(register_request).await.unwrap();
    assert_eq!(register_response.status(), 200);

    let register_body = to_bytes(register_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let register_json: serde_json::Value = serde_json::from_slice(&register_body).unwrap();
    let session_id = register_json
        .get("session_id")
        .and_then(|v| v.as_str())
        .expect("session_id")
        .to_string();
    let challenge: CreationChallengeResponse =
        serde_json::from_value(register_json.get("challenge").cloned().unwrap()).unwrap();

    let credential_response = simulate_passkey_registration(challenge);
    let finish_body = json!({
        "session_id": session_id,
        "response": credential_response,
        "name": "Laptop"
    });

    let finish_request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/passkey/register/finish")
        .header("X-Forwarded-For", "198.51.100.32")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_vec(&finish_body).unwrap(),
        ))
        .unwrap();

    let finish_response = app.clone().oneshot(finish_request).await.unwrap();
    assert_eq!(finish_response.status(), 200);

    let set_cookie = finish_response
        .headers()
        .get(SET_COOKIE)
        .and_then(|value| value.to_str().ok())
        .expect("signup finish should set auth cookie")
        .split(';')
        .next()
        .unwrap()
        .to_string();
    assert!(set_cookie.contains("auth_token="));

    let finish_body = to_bytes(finish_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let finish_json: serde_json::Value = serde_json::from_slice(&finish_body).unwrap();
    assert!(finish_json.get("user_id").is_some());
    assert!(finish_json.get("expires_at").is_some());

    let list_request = axum::http::Request::builder()
        .method(Method::GET)
        .uri("/api/auth/passkey")
        .header("Cookie", set_cookie)
        .body(axum::body::Body::empty())
        .unwrap();

    let list_response = app.oneshot(list_request).await.unwrap();
    assert_eq!(list_response.status(), 200);

    let list_body = to_bytes(list_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let list_json: serde_json::Value = serde_json::from_slice(&list_body).unwrap();
    assert_eq!(list_json.as_array().unwrap().len(), 1);
}
