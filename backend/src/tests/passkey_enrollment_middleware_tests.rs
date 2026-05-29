use crate::models::auth::{User, WebAuthnCredential};
use crate::services::cache_service::MockCacheService;
use crate::services::repository_service::MockDatabaseRepository;
use crate::test_fixtures::{test_passkey_for_user, TestFixtures};
use axum::body::to_bytes;
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

fn legacy_user() -> User {
    User {
        id: Uuid::new_v4(),
        email: "legacy@example.com".to_string(),
        password_hash: Some("argon2_hash".to_string()),
        provider: String::new(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        onboarding_completed: true,
    }
}

fn passkey_only_user() -> User {
    User {
        id: Uuid::new_v4(),
        email: "new@example.com".to_string(),
        password_hash: None,
        provider: String::new(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        onboarding_completed: true,
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
async fn given_legacy_user_without_passkey_when_protected_request_then_403_enrollment_required() {
    let user = legacy_user();
    let (_, token) = TestFixtures::create_authenticated_user_with_token_for_user(user);

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
    assert_eq!(response.status(), 403);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        payload.get("code").and_then(|v| v.as_str()),
        Some("passkey_enrollment_required")
    );
}

#[tokio::test]
async fn given_legacy_user_when_begin_passkey_registration_then_200() {
    let user = legacy_user();
    let (_, token) = TestFixtures::create_authenticated_user_with_token_for_user(user.clone());
    let mut mock_db = MockDatabaseRepository::new();
    mock_db.expect_get_user_by_id().returning(move |_| {
        let u = user.clone();
        Box::pin(async move { Ok(Some(u)) })
    });
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
}

#[tokio::test]
async fn given_authenticated_user_without_passkey_when_protected_request_then_403() {
    let user = passkey_only_user();
    let (_, token) = TestFixtures::create_authenticated_user_with_token_for_user(user);

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
    assert_eq!(response.status(), 403);
}

#[tokio::test]
async fn given_legacy_user_with_passkey_when_protected_request_then_200() {
    let user = legacy_user();
    let user_id = user.id;
    let cred = test_passkey_for_user(user_id);
    let (_, token) = TestFixtures::create_authenticated_user_with_token_for_user(user);

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
        .method(Method::GET)
        .uri("/api/auth/passkey")
        .header("Cookie", format!("auth_token={}", token))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn given_legacy_user_when_enrollment_finishes_then_password_cleared_and_requests_succeed() {
    let legacy = legacy_user();
    let user_id = legacy.id;
    let (_, token) = TestFixtures::create_authenticated_user_with_token_for_user(legacy.clone());

    let stored_users: Arc<Mutex<HashMap<Uuid, User>>> =
        Arc::new(Mutex::new(HashMap::from([(user_id, legacy)])));
    let stored_credentials: Arc<Mutex<Vec<WebAuthnCredential>>> = Arc::new(Mutex::new(Vec::new()));
    let challenge_store: Arc<Mutex<HashMap<String, String>>> = Arc::new(Mutex::new(HashMap::new()));
    let password_cleared: Arc<Mutex<bool>> = Arc::new(Mutex::new(false));

    let users_for_get = stored_users.clone();
    let mut mock_db = MockDatabaseRepository::new();
    mock_db.expect_get_user_by_id().returning(move |id| {
        let user = users_for_get.lock().unwrap().get(id).cloned();
        Box::pin(async move { Ok(user) })
    });

    let creds_for_list = stored_credentials.clone();
    mock_db
        .expect_list_webauthn_credentials_for_user()
        .returning(move |id| {
            let items = creds_for_list
                .lock()
                .unwrap()
                .iter()
                .filter(|c| c.user_id == *id)
                .cloned()
                .collect();
            Box::pin(async move { Ok(items) })
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

    let users_for_clear = stored_users.clone();
    let cleared_flag = password_cleared.clone();
    mock_db
        .expect_clear_user_password_hash()
        .withf(move |id| *id == user_id)
        .times(1)
        .returning(move |id| {
            let users = users_for_clear.clone();
            let cleared = cleared_flag.clone();
            let id = *id;
            Box::pin(async move {
                if let Some(user) = users.lock().unwrap().get_mut(&id) {
                    user.password_hash = None;
                }
                *cleared.lock().unwrap() = true;
                Ok(())
            })
        });

    let challenges_for_set = challenge_store.clone();
    let challenges_for_take = challenge_store.clone();
    let mut mock_cache = mock_cache_for_auth();
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

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let blocked_request = axum::http::Request::builder()
        .method(Method::GET)
        .uri("/api/auth/passkey")
        .header("Cookie", format!("auth_token={}", token))
        .body(axum::body::Body::empty())
        .unwrap();
    let blocked_response = app.clone().oneshot(blocked_request).await.unwrap();
    assert_eq!(blocked_response.status(), 403);

    let begin_request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/passkey/enroll/begin")
        .header("Cookie", format!("auth_token={}", token))
        .body(axum::body::Body::empty())
        .unwrap();
    let begin_response = app.clone().oneshot(begin_request).await.unwrap();
    assert_eq!(begin_response.status(), 200);

    let begin_body = to_bytes(begin_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let begin_json: serde_json::Value = serde_json::from_slice(&begin_body).unwrap();
    let session_id = begin_json
        .get("session_id")
        .and_then(|v| v.as_str())
        .expect("session_id")
        .to_string();
    let challenge: CreationChallengeResponse =
        serde_json::from_value(begin_json.get("challenge").cloned().unwrap()).unwrap();

    let credential_response = simulate_passkey_registration(challenge);
    let finish_body = json!({
        "session_id": session_id,
        "response": credential_response,
        "name": "Migration Key"
    });
    let finish_request = axum::http::Request::builder()
        .method(Method::POST)
        .uri("/api/auth/passkey/enroll/finish")
        .header("X-Forwarded-For", "198.51.100.33")
        .header("Cookie", format!("auth_token={}", token))
        .header("content-type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_vec(&finish_body).unwrap(),
        ))
        .unwrap();
    let finish_response = app.clone().oneshot(finish_request).await.unwrap();
    assert_eq!(finish_response.status(), 200);
    assert!(*password_cleared.lock().unwrap());

    let list_request = axum::http::Request::builder()
        .method(Method::GET)
        .uri("/api/auth/passkey")
        .header("Cookie", format!("auth_token={}", token))
        .body(axum::body::Body::empty())
        .unwrap();
    let list_response = app.oneshot(list_request).await.unwrap();
    assert_eq!(list_response.status(), 200);

    let list_body = to_bytes(list_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let list_json: serde_json::Value = serde_json::from_slice(&list_body).unwrap();
    assert_eq!(list_json.as_array().unwrap().len(), 1);
    assert!(stored_users
        .lock()
        .unwrap()
        .get(&user_id)
        .unwrap()
        .password_hash
        .is_none());
}
