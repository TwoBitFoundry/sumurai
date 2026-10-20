use std::sync::{Arc, Mutex};

use anyhow::anyhow;
use chrono::Utc;
use serde_json::json;
use uuid::Uuid;
use webauthn_authenticator_rs::prelude::WebauthnAuthenticator;
use webauthn_authenticator_rs::softpasskey::SoftPasskey;
use webauthn_rs::prelude::RequestChallengeResponse;

#[cfg(not(feature = "dev-seed"))]
use crate::models::auth::RegisterRequest;
use crate::models::auth::{
    AuthenticatedEnrollmentChallengePayload, LoginChallengePayload, RegistrationChallengePayload,
    User, WebAuthnCredential,
};
use crate::services::cache_service::{CacheService, MockCacheService};
use crate::services::passkey_orchestrator::{PasskeyOrchestrationError, PasskeyOrchestrator};
use crate::services::repository_service::{DatabaseRepository, MockDatabaseRepository};
use crate::services::webauthn_service::WebAuthnService;
use crate::services::AuthService;
use crate::test_fixtures::test_passkey_for_user;

const SECRET: &str = "this_is_a_very_long_secret_key_for_jwt_auth_service_testing_12345";

type CapturedChallenge = Arc<Mutex<Option<String>>>;

fn auth_service() -> Arc<AuthService> {
    Arc::new(AuthService::new(SECRET.to_string()).unwrap())
}

fn webauthn_service() -> Arc<WebAuthnService> {
    Arc::new(
        WebAuthnService::new(
            "localhost",
            &[url::Url::parse("http://localhost:8080").unwrap()],
        )
        .unwrap(),
    )
}

fn orchestrator(
    repository: MockDatabaseRepository,
    cache: MockCacheService,
) -> PasskeyOrchestrator {
    let db: Arc<dyn DatabaseRepository> = Arc::new(repository);
    let cache: Arc<dyn CacheService> = Arc::new(cache);
    PasskeyOrchestrator::new(auth_service(), db, cache, webauthn_service())
}

fn user(password_hash: Option<&str>) -> User {
    User {
        id: Uuid::new_v4(),
        email: "person@example.com".to_string(),
        password_hash: password_hash.map(str::to_string),
        provider: String::new(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        onboarding_completed: true,
        demo_mode_active: false,
    }
}

fn broken_credential(user_id: Uuid) -> WebAuthnCredential {
    WebAuthnCredential {
        id: Uuid::new_v4(),
        user_id,
        credential_id: vec![9, 9, 9],
        passkey: json!({}),
        name: "Broken".to_string(),
        created_at: Utc::now(),
        last_used_at: None,
    }
}

fn repository_with_user(found: Option<User>) -> MockDatabaseRepository {
    let mut repository = MockDatabaseRepository::new();
    repository.expect_get_user_by_id().returning(move |_| {
        let found = found.clone();
        Box::pin(async move { Ok(found) })
    });
    repository
}

fn repository_with_credentials(credentials: Vec<WebAuthnCredential>) -> MockDatabaseRepository {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_list_webauthn_credentials_for_user()
        .returning(move |_| {
            let credentials = credentials.clone();
            Box::pin(async move { Ok(credentials) })
        });
    repository
}

fn repository_for_login_begin(
    found: Option<User>,
    credentials: Vec<WebAuthnCredential>,
) -> MockDatabaseRepository {
    let mut repository = repository_with_credentials(credentials);
    repository.expect_get_user_by_email().returning(move |_| {
        let found = found.clone();
        Box::pin(async move { Ok(found) })
    });
    repository
}

fn capturing_cache() -> (MockCacheService, CapturedChallenge) {
    let captured: CapturedChallenge = Arc::new(Mutex::new(None));
    let sink = captured.clone();
    let mut cache = MockCacheService::new();
    cache
        .expect_set_webauthn_challenge()
        .times(1)
        .returning(move |_, payload| {
            *sink.lock().unwrap() = Some(payload.to_string());
            Box::pin(async { Ok(()) })
        });
    (cache, captured)
}

fn cache_serving(payload: Option<String>) -> MockCacheService {
    let mut cache = MockCacheService::new();
    cache
        .expect_take_webauthn_challenge()
        .times(1)
        .returning(move |_| {
            let payload = payload.clone();
            Box::pin(async move { Ok(payload) })
        });
    cache
}

fn cache_serving_with_session(payload: String) -> MockCacheService {
    let mut cache = cache_serving(Some(payload));
    cache
        .expect_set_session_valid()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));
    cache
        .expect_set_jwt_token()
        .times(1)
        .returning(|_, _, _| Box::pin(async { Ok(()) }));
    cache
}

fn enrollment_payload(user_id: Uuid, state: serde_json::Value) -> String {
    serde_json::to_string(&AuthenticatedEnrollmentChallengePayload { user_id, state }).unwrap()
}

fn registration_payload(user_id: Uuid, email: &str, recovery: bool) -> String {
    let (_, reg_state) = webauthn_service()
        .begin_registration(user_id, email, email, &[])
        .unwrap();
    serde_json::to_string(&RegistrationChallengePayload {
        user_id,
        email: email.to_string(),
        display_name: email.to_string(),
        state: serde_json::to_value(&reg_state).unwrap(),
        existing_user_recovery: recovery,
    })
    .unwrap()
}

#[tokio::test]
async fn given_unknown_email_when_beginning_login_then_returns_non_enumerating_response() {
    let response = orchestrator(
        repository_for_login_begin(None, Vec::new()),
        MockCacheService::new(),
    )
    .begin_login("Nobody@Example.com ")
    .await
    .ok()
    .unwrap();

    assert!(response.session_id.is_empty());
    assert!(response.challenge.is_null());
    assert!(!response.account_exists);
    assert!(!response.passkey_available);
    assert!(!response.password_available);
}

#[tokio::test]
async fn given_lookup_failure_when_beginning_login_then_reports_authentication_service_error() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_user_by_email()
        .returning(|_| Box::pin(async { Err(anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .begin_login("person@example.com")
        .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::AuthenticationServiceError)
    );
}

#[cfg(not(feature = "dev-seed"))]
#[tokio::test]
async fn given_password_only_account_when_beginning_login_then_offers_password_without_challenge() {
    let account = user(Some("hash"));

    let response = orchestrator(
        repository_for_login_begin(Some(account), Vec::new()),
        MockCacheService::new(),
    )
    .begin_login("person@example.com")
    .await
    .ok()
    .unwrap();

    assert!(response.session_id.is_empty());
    assert!(response.challenge.is_null());
    assert!(response.account_exists);
    assert!(!response.passkey_available);
    assert!(response.password_available);
}

#[tokio::test]
async fn given_account_without_usable_credentials_when_beginning_login_then_stores_recovery_challenge(
) {
    let account = user(None);
    let account_id = account.id;
    let (cache, captured) = capturing_cache();

    let response = orchestrator(
        repository_for_login_begin(Some(account), vec![broken_credential(account_id)]),
        cache,
    )
    .begin_login("person@example.com")
    .await
    .ok()
    .unwrap();

    assert!(!response.session_id.is_empty());
    assert!(!response.challenge.is_null());
    assert!(response.account_exists);
    assert!(!response.passkey_available);
    assert!(!response.password_available);

    let stored = captured.lock().unwrap().clone().unwrap();
    let payload: RegistrationChallengePayload = serde_json::from_str(&stored).unwrap();
    assert_eq!(payload.user_id, account_id);
    assert_eq!(payload.email, "person@example.com");
    assert_eq!(payload.display_name, "person@example.com");
    assert!(payload.existing_user_recovery);
}

#[tokio::test]
async fn given_usable_passkey_when_beginning_login_then_stores_login_challenge() {
    let account = user(None);
    let account_id = account.id;
    let credential = test_passkey_for_user(account_id);
    let (cache, captured) = capturing_cache();

    let response = orchestrator(
        repository_for_login_begin(Some(account), vec![credential]),
        cache,
    )
    .begin_login("person@example.com")
    .await
    .ok()
    .unwrap();

    assert!(!response.session_id.is_empty());
    assert!(!response.challenge.is_null());
    assert!(response.account_exists);
    assert!(response.passkey_available);
    assert!(!response.password_available);

    let stored = captured.lock().unwrap().clone().unwrap();
    let payload: LoginChallengePayload = serde_json::from_str(&stored).unwrap();
    assert_eq!(payload.user_id, account_id);
}

#[tokio::test]
async fn given_cache_failure_when_storing_login_challenge_then_reports_store_failure() {
    let account = user(None);
    let credential = test_passkey_for_user(account.id);
    let mut cache = MockCacheService::new();
    cache
        .expect_set_webauthn_challenge()
        .returning(|_, _| Box::pin(async { Err(anyhow!("redis down")) }));

    let result = orchestrator(
        repository_for_login_begin(Some(account), vec![credential]),
        cache,
    )
    .begin_login("person@example.com")
    .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::StoreAuthenticationChallengeFailed)
    );
}

#[tokio::test]
async fn given_existing_user_when_beginning_enrollment_then_stores_enrollment_challenge() {
    let account = user(None);
    let account_id = account.id;
    let (cache, captured) = capturing_cache();
    let mut repository = repository_with_user(Some(account));
    repository
        .expect_list_webauthn_credentials_for_user()
        .returning(|_| Box::pin(async { Ok(Vec::new()) }));

    let response = orchestrator(repository, cache)
        .begin_enrollment(account_id)
        .await
        .ok()
        .unwrap();

    assert!(!response.session_id.is_empty());
    assert!(!response.challenge.is_null());
    let stored = captured.lock().unwrap().clone().unwrap();
    let payload: AuthenticatedEnrollmentChallengePayload = serde_json::from_str(&stored).unwrap();
    assert_eq!(payload.user_id, account_id);
}

#[tokio::test]
async fn given_missing_user_when_beginning_enrollment_then_reports_authentication_failed() {
    let result = orchestrator(repository_with_user(None), MockCacheService::new())
        .begin_enrollment(Uuid::new_v4())
        .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::AuthenticationFailed)
    );
}

#[tokio::test]
async fn given_user_lookup_failure_when_beginning_enrollment_then_reports_begin_failure() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_user_by_id()
        .returning(|_| Box::pin(async { Err(anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .begin_enrollment(Uuid::new_v4())
        .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::BeginEnrollmentFailed)
    );
}

#[cfg(not(feature = "dev-seed"))]
fn register_request(password: Option<&str>) -> RegisterRequest {
    RegisterRequest {
        email: " New@Example.com ".to_string(),
        name: " New Person ".to_string(),
        password: password.map(str::to_string),
    }
}

#[cfg(not(feature = "dev-seed"))]
#[tokio::test]
async fn given_password_when_beginning_registration_then_rejects_password_registration() {
    let result = orchestrator(MockDatabaseRepository::new(), MockCacheService::new())
        .begin_registration(&register_request(Some("secret")), None)
        .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::PasswordRegistrationUnsupported)
    );
}

#[cfg(not(feature = "dev-seed"))]
#[tokio::test]
async fn given_authenticated_session_when_beginning_registration_then_requires_enrollment_flow() {
    let token = auth_service().generate_token(Uuid::new_v4()).unwrap().token;

    let result = orchestrator(MockDatabaseRepository::new(), MockCacheService::new())
        .begin_registration(&register_request(None), Some(&token))
        .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::AuthenticatedEnrollmentRequired)
    );
}

#[cfg(not(feature = "dev-seed"))]
#[tokio::test]
async fn given_registered_email_when_beginning_registration_then_reports_conflict() {
    let result = orchestrator(
        repository_for_login_begin(Some(user(None)), Vec::new()),
        MockCacheService::new(),
    )
    .begin_registration(&register_request(None), None)
    .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::EmailAlreadyRegistered)
    );
}

#[cfg(not(feature = "dev-seed"))]
#[tokio::test]
async fn given_new_email_when_beginning_registration_then_stores_signup_challenge() {
    let (cache, captured) = capturing_cache();

    let response = orchestrator(repository_for_login_begin(None, Vec::new()), cache)
        .begin_registration(&register_request(None), None)
        .await
        .ok()
        .unwrap();

    assert!(!response.session_id.is_empty());
    assert!(!response.challenge.is_null());
    let stored = captured.lock().unwrap().clone().unwrap();
    let payload: RegistrationChallengePayload = serde_json::from_str(&stored).unwrap();
    assert_eq!(payload.user_id.to_string(), response.user_id);
    assert_eq!(payload.email, "new@example.com");
    assert_eq!(payload.display_name, "New Person");
    assert!(!payload.existing_user_recovery);
}

#[tokio::test]
async fn given_cache_failure_when_taking_challenge_then_reports_retrieve_failure() {
    let mut cache = MockCacheService::new();
    cache
        .expect_take_webauthn_challenge()
        .returning(|_| Box::pin(async { Err(anyhow!("redis down")) }));

    let result = orchestrator(MockDatabaseRepository::new(), cache)
        .finish_enrollment(Uuid::new_v4(), "session", json!({}), "Laptop")
        .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::RetrieveChallengeFailed)
    );
}

#[tokio::test]
async fn given_consumed_challenge_when_finishing_enrollment_then_reports_challenge_not_found() {
    let result = orchestrator(MockDatabaseRepository::new(), cache_serving(None))
        .finish_enrollment(Uuid::new_v4(), "session", json!({}), "Laptop")
        .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::ChallengeNotFound)
    );
}

#[tokio::test]
async fn given_malformed_payload_when_finishing_enrollment_then_reports_invalid_challenge() {
    let result = orchestrator(
        MockDatabaseRepository::new(),
        cache_serving(Some("not json".to_string())),
    )
    .finish_enrollment(Uuid::new_v4(), "session", json!({}), "Laptop")
    .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::InvalidEnrollmentChallenge)
    );
}

#[tokio::test]
async fn given_other_users_challenge_when_finishing_enrollment_then_reports_mismatch() {
    let payload = enrollment_payload(Uuid::new_v4(), json!({}));

    let result = orchestrator(MockDatabaseRepository::new(), cache_serving(Some(payload)))
        .finish_enrollment(Uuid::new_v4(), "session", json!({}), "Laptop")
        .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::ChallengeUserMismatch)
    );
}

#[tokio::test]
async fn given_invalid_state_when_finishing_enrollment_then_reports_invalid_state() {
    let user_id = Uuid::new_v4();
    let payload = enrollment_payload(user_id, json!({"unexpected": true}));

    let result = orchestrator(MockDatabaseRepository::new(), cache_serving(Some(payload)))
        .finish_enrollment(user_id, "session", json!({}), "Laptop")
        .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::InvalidChallengeState)
    );
}

#[tokio::test]
async fn given_invalid_credential_response_when_finishing_enrollment_then_reports_invalid_response()
{
    let user_id = Uuid::new_v4();
    let (_, reg_state) = webauthn_service()
        .begin_registration(user_id, "person@example.com", "person@example.com", &[])
        .unwrap();
    let payload = enrollment_payload(user_id, serde_json::to_value(&reg_state).unwrap());

    let result = orchestrator(MockDatabaseRepository::new(), cache_serving(Some(payload)))
        .finish_enrollment(user_id, "session", json!({"bogus": 1}), "Laptop")
        .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::InvalidCredentialResponse)
    );
}

#[tokio::test]
async fn given_authenticated_session_when_finishing_registration_then_consumes_challenge_and_rejects(
) {
    let token = auth_service().generate_token(Uuid::new_v4()).unwrap().token;

    let result = orchestrator(
        MockDatabaseRepository::new(),
        cache_serving(Some("{}".to_string())),
    )
    .finish_registration("session", json!({}), "Laptop", Some(&token))
    .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::AuthenticatedEnrollmentRequired)
    );
}

#[tokio::test]
async fn given_malformed_payload_when_finishing_registration_then_reports_invalid_challenge() {
    let result = orchestrator(
        MockDatabaseRepository::new(),
        cache_serving(Some("not json".to_string())),
    )
    .finish_registration("session", json!({}), "Laptop", None)
    .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::InvalidRegistrationChallenge)
    );
}

#[tokio::test]
async fn given_recovery_for_account_with_usable_passkey_when_finishing_registration_then_rejects() {
    let user_id = Uuid::new_v4();
    let payload = registration_payload(user_id, "person@example.com", true);

    let result = orchestrator(
        repository_with_credentials(vec![test_passkey_for_user(user_id)]),
        cache_serving(Some(payload)),
    )
    .finish_registration("session", json!({}), "Laptop", None)
    .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::PasskeyAlreadyAvailable)
    );
}

#[tokio::test]
async fn given_recovery_for_missing_account_when_finishing_registration_then_reports_not_found() {
    let payload = registration_payload(Uuid::new_v4(), "person@example.com", true);
    let mut repository = repository_with_credentials(Vec::new());
    repository
        .expect_get_user_by_id()
        .returning(|_| Box::pin(async { Ok(None) }));

    let result = orchestrator(repository, cache_serving(Some(payload)))
        .finish_registration("session", json!({}), "Laptop", None)
        .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::AccountNotFound)
    );
}

#[tokio::test]
async fn given_recovery_for_account_with_password_when_finishing_registration_then_rejects() {
    let account = user(Some("hash"));
    let payload = registration_payload(account.id, "person@example.com", true);
    let mut repository = repository_with_credentials(Vec::new());
    repository.expect_get_user_by_id().returning(move |_| {
        let account = account.clone();
        Box::pin(async move { Ok(Some(account)) })
    });

    let result = orchestrator(repository, cache_serving(Some(payload)))
        .finish_registration("session", json!({}), "Laptop", None)
        .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::PasswordSignInAvailable)
    );
}

#[tokio::test]
async fn given_consumed_challenge_when_finishing_login_then_reports_challenge_not_found() {
    let result = orchestrator(MockDatabaseRepository::new(), cache_serving(None))
        .finish_login("session", json!({}))
        .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::ChallengeNotFound)
    );
}

#[tokio::test]
async fn given_malformed_payload_when_finishing_login_then_reports_invalid_state() {
    let result = orchestrator(
        MockDatabaseRepository::new(),
        cache_serving(Some("not json".to_string())),
    )
    .finish_login("session", json!({}))
    .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::InvalidChallengeState)
    );
}

#[tokio::test]
async fn given_nil_user_challenge_when_finishing_login_then_reports_authentication_failed() {
    let payload = serde_json::to_string(&LoginChallengePayload {
        user_id: Uuid::nil(),
        state: json!({}),
    })
    .unwrap();

    let result = orchestrator(MockDatabaseRepository::new(), cache_serving(Some(payload)))
        .finish_login("session", json!({}))
        .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::AuthenticationFailed)
    );
}

#[tokio::test]
async fn given_invalid_authentication_state_when_finishing_login_then_reports_invalid_state() {
    let payload = serde_json::to_string(&LoginChallengePayload {
        user_id: Uuid::new_v4(),
        state: json!({"unexpected": true}),
    })
    .unwrap();

    let result = orchestrator(MockDatabaseRepository::new(), cache_serving(Some(payload)))
        .finish_login("session", json!({}))
        .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::InvalidAuthenticationState)
    );
}

#[tokio::test]
async fn given_mixed_credentials_when_listing_passkeys_then_returns_only_usable_ones() {
    let user_id = Uuid::new_v4();
    let usable = test_passkey_for_user(user_id);
    let usable_id = usable.id;

    let items = orchestrator(
        repository_with_credentials(vec![usable, broken_credential(user_id)]),
        MockCacheService::new(),
    )
    .list_passkeys(user_id)
    .await
    .ok()
    .unwrap();

    assert_eq!(items.len(), 1);
    assert_eq!(items[0].id, usable_id);
}

#[tokio::test]
async fn given_storage_failure_when_listing_passkeys_then_reports_load_failure() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_list_webauthn_credentials_for_user()
        .returning(|_| Box::pin(async { Err(anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .list_passkeys(Uuid::new_v4())
        .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::LoadPasskeysFailed)
    );
}

#[tokio::test]
async fn given_unknown_id_when_deleting_passkey_then_reports_not_found() {
    let user_id = Uuid::new_v4();

    let result = orchestrator(
        repository_with_credentials(vec![test_passkey_for_user(user_id)]),
        MockCacheService::new(),
    )
    .delete_passkey(user_id, Uuid::new_v4())
    .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::PasskeyNotFound)
    );
}

#[tokio::test]
async fn given_only_usable_passkey_when_deleting_it_then_reports_last_passkey() {
    let user_id = Uuid::new_v4();
    let only = test_passkey_for_user(user_id);
    let only_id = only.id;

    let result = orchestrator(
        repository_with_credentials(vec![only]),
        MockCacheService::new(),
    )
    .delete_passkey(user_id, only_id)
    .await;

    assert_eq!(result.err(), Some(PasskeyOrchestrationError::LastPasskey));
}

#[tokio::test]
async fn given_broken_credential_and_no_usable_passkey_when_deleting_then_reports_last_passkey() {
    let user_id = Uuid::new_v4();
    let broken = broken_credential(user_id);
    let broken_id = broken.id;

    let result = orchestrator(
        repository_with_credentials(vec![broken]),
        MockCacheService::new(),
    )
    .delete_passkey(user_id, broken_id)
    .await;

    assert_eq!(result.err(), Some(PasskeyOrchestrationError::LastPasskey));
}

#[tokio::test]
async fn given_additional_passkey_when_deleting_then_removes_it() {
    let user_id = Uuid::new_v4();
    let first = test_passkey_for_user(user_id);
    let second = test_passkey_for_user(user_id);
    let second_id = second.id;
    let mut repository = repository_with_credentials(vec![first, second]);
    repository
        .expect_delete_webauthn_credential()
        .times(1)
        .returning(move |_, id| {
            assert_eq!(*id, second_id);
            Box::pin(async { Ok(true) })
        });

    let result = orchestrator(repository, MockCacheService::new())
        .delete_passkey(user_id, second_id)
        .await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn given_delete_reporting_nothing_removed_when_deleting_then_reports_not_found() {
    let user_id = Uuid::new_v4();
    let first = test_passkey_for_user(user_id);
    let second = test_passkey_for_user(user_id);
    let second_id = second.id;
    let mut repository = repository_with_credentials(vec![first, second]);
    repository
        .expect_delete_webauthn_credential()
        .returning(|_, _| Box::pin(async { Ok(false) }));

    let result = orchestrator(repository, MockCacheService::new())
        .delete_passkey(user_id, second_id)
        .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::PasskeyNotFound)
    );
}

#[tokio::test]
async fn given_delete_failure_when_deleting_passkey_then_reports_delete_failure() {
    let user_id = Uuid::new_v4();
    let first = test_passkey_for_user(user_id);
    let second = test_passkey_for_user(user_id);
    let second_id = second.id;
    let mut repository = repository_with_credentials(vec![first, second]);
    repository
        .expect_delete_webauthn_credential()
        .returning(|_, _| Box::pin(async { Err(anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .delete_passkey(user_id, second_id)
        .await;

    assert_eq!(
        result.err(),
        Some(PasskeyOrchestrationError::DeletePasskeyFailed)
    );
}

#[tokio::test]
async fn given_signup_challenge_when_completing_signup_then_creates_user_and_logs_in_with_passkey()
{
    let origin = url::Url::parse("http://localhost:8080").unwrap();
    let service = webauthn_service();
    let user_id = Uuid::new_v4();
    let email = "new@example.com";
    let (challenge, reg_state) = service
        .begin_registration(user_id, email, "New Person", &[])
        .unwrap();
    let mut authenticator = WebauthnAuthenticator::new(SoftPasskey::new(true));
    let registration_response = authenticator
        .do_registration(origin.clone(), challenge)
        .unwrap();
    let payload = serde_json::to_string(&RegistrationChallengePayload {
        user_id,
        email: email.to_string(),
        display_name: "New Person".to_string(),
        state: serde_json::to_value(&reg_state).unwrap(),
        existing_user_recovery: false,
    })
    .unwrap();

    let stored_credential: Arc<Mutex<Option<WebAuthnCredential>>> = Arc::new(Mutex::new(None));
    let sink = stored_credential.clone();
    let created = User {
        email: email.to_string(),
        id: user_id,
        ..user(None)
    };
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_create_user()
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));
    repository
        .expect_insert_webauthn_credential()
        .times(1)
        .returning(move |user_id, credential_id, passkey, name| {
            let credential = WebAuthnCredential {
                id: Uuid::new_v4(),
                user_id: *user_id,
                credential_id,
                passkey,
                name: name.to_string(),
                created_at: Utc::now(),
                last_used_at: None,
            };
            *sink.lock().unwrap() = Some(credential.clone());
            Box::pin(async move { Ok(credential) })
        });
    let signup_user = created.clone();
    repository.expect_get_user_by_id().returning(move |_| {
        let signup_user = signup_user.clone();
        Box::pin(async move { Ok(Some(signup_user)) })
    });

    let session = orchestrator(repository, cache_serving_with_session(payload))
        .finish_registration(
            "session",
            serde_json::to_value(&registration_response).unwrap(),
            "Laptop",
            None,
        )
        .await
        .ok()
        .unwrap();

    assert_eq!(session.user_id, user_id.to_string());
    assert_eq!(session.email, email);
    assert!(!session.requires_passkey_enrollment);
    assert!(!session.auth_token.token.is_empty());

    let credential = stored_credential.lock().unwrap().clone().unwrap();
    let credential_id = credential.id;

    let (cache, captured) = capturing_cache();
    let login_repository = repository_for_login_begin(Some(created.clone()), vec![credential]);

    let begin = orchestrator(login_repository, cache)
        .begin_login(email)
        .await
        .ok()
        .unwrap();
    assert!(begin.passkey_available);

    let request_challenge: RequestChallengeResponse =
        serde_json::from_value(begin.challenge).unwrap();
    let auth_response = authenticator
        .do_authentication(origin, request_challenge)
        .unwrap();
    let stored_login = captured.lock().unwrap().clone().unwrap();

    let mut finish_repository = MockDatabaseRepository::new();
    let credential = stored_credential.lock().unwrap().clone().unwrap();
    finish_repository
        .expect_find_webauthn_credentials_by_credential_ids()
        .returning(move |_, _| {
            let credential = credential.clone();
            Box::pin(async move { Ok(vec![credential]) })
        });
    finish_repository
        .expect_update_webauthn_credential_counter_and_last_used()
        .times(1)
        .returning(move |_, id, _| {
            assert_eq!(*id, credential_id);
            Box::pin(async { Ok(()) })
        });
    let login_user = created;
    finish_repository
        .expect_get_user_by_id()
        .returning(move |_| {
            let login_user = login_user.clone();
            Box::pin(async move { Ok(Some(login_user)) })
        });

    let login_session = orchestrator(finish_repository, cache_serving_with_session(stored_login))
        .finish_login("session", serde_json::to_value(&auth_response).unwrap())
        .await
        .ok()
        .unwrap();

    assert_eq!(login_session.user_id, user_id.to_string());
    assert_eq!(login_session.email, email);
    assert!(!login_session.requires_passkey_enrollment);
}
