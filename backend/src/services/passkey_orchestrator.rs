use std::sync::Arc;

use chrono::Utc;
use uuid::Uuid;
use webauthn_rs::prelude::{
    PasskeyAuthentication, PasskeyRegistration, PublicKeyCredential, RegisterPublicKeyCredential,
};

use crate::models::auth::{
    AuthToken, PasskeyItem, PasskeyLoginBeginResponse, PasskeyRegisterBeginResponse, User,
    WebAuthnCredential,
};
#[cfg(not(feature = "dev-seed"))]
use crate::models::auth::{RegisterBeginResponse, RegisterRequest};
use crate::services::auth_orchestrator::AuthenticatedSession;
use crate::services::repository_service::DatabaseRepository;
use crate::services::webauthn_service::WebAuthnService;
use crate::services::{AuthService, CacheService};
use crate::utils::seed_password_fallback::{dev_password_auth_enabled, user_has_password};
use crate::utils::webauthn_credentials::{
    count_usable_credentials, has_usable_passkey, is_usable_credential, usable_passkeys,
};

#[derive(serde::Serialize, serde::Deserialize)]
pub struct LoginChallengePayload {
    pub user_id: Uuid,
    pub state: serde_json::Value,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct RegistrationChallengePayload {
    pub user_id: Uuid,
    pub email: String,
    pub display_name: String,
    pub state: serde_json::Value,
    #[serde(default)]
    pub existing_user_recovery: bool,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct AuthenticatedEnrollmentChallengePayload {
    pub user_id: Uuid,
    pub state: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq)]
pub enum PasskeyOrchestrationError {
    #[cfg(not(feature = "dev-seed"))]
    PasswordRegistrationUnsupported,
    AuthenticatedEnrollmentRequired,
    EmailAlreadyRegistered,
    AuthenticationFailed,
    AuthenticationServiceError,
    BeginRegistrationFailed,
    BeginEnrollmentFailed,
    BeginAuthenticationFailed,
    LoadExistingCredentialsFailed,
    SerializeRegistrationStateFailed,
    SerializeAuthenticationStateFailed,
    StoreRegistrationChallengeFailed,
    StoreAuthenticationChallengeFailed,
    SerializeChallengeFailed,
    RetrieveChallengeFailed,
    ChallengeNotFound,
    InvalidEnrollmentChallenge,
    InvalidRegistrationChallenge,
    InvalidChallengeState,
    InvalidAuthenticationState,
    InvalidCredentialResponse,
    ChallengeUserMismatch,
    PasskeyVerificationFailed,
    SerializePasskeyFailed,
    SavePasskeyFailed,
    CompleteEnrollmentFailed,
    UserNotFound,
    PasskeyAlreadyAvailable,
    AccountNotFound,
    PasswordSignInAvailable,
    TokenGenerationFailed,
    LoadPasskeysFailed,
    PasskeyNotFound,
    LastPasskey,
    DeletePasskeyFailed,
}

pub struct PasskeyOrchestrator {
    auth_service: Arc<AuthService>,
    repository: Arc<dyn DatabaseRepository>,
    cache: Arc<dyn CacheService>,
    webauthn_service: Arc<WebAuthnService>,
}

impl PasskeyOrchestrator {
    pub fn new(
        auth_service: Arc<AuthService>,
        repository: Arc<dyn DatabaseRepository>,
        cache: Arc<dyn CacheService>,
        webauthn_service: Arc<WebAuthnService>,
    ) -> Self {
        Self {
            auth_service,
            repository,
            cache,
            webauthn_service,
        }
    }

    #[cfg(not(feature = "dev-seed"))]
    pub async fn begin_registration(
        &self,
        request: &RegisterRequest,
        session_token: Option<&str>,
    ) -> Result<RegisterBeginResponse, PasskeyOrchestrationError> {
        if request.password.is_some() {
            return Err(PasskeyOrchestrationError::PasswordRegistrationUnsupported);
        }

        if self.is_authenticated(session_token) {
            return Err(PasskeyOrchestrationError::AuthenticatedEnrollmentRequired);
        }

        let email = request.email.trim().to_lowercase();
        let display_name = request.name.trim().to_string();

        if let Ok(Some(_)) = self.repository.get_user_by_email(&email).await {
            return Err(PasskeyOrchestrationError::EmailAlreadyRegistered);
        }

        let user_id = Uuid::new_v4();

        let (challenge, reg_state) = self
            .webauthn_service
            .begin_registration(user_id, &email, &display_name, &[])
            .map_err(|e| {
                tracing::error!("begin_registration failed for user {}: {}", user_id, e);
                PasskeyOrchestrationError::BeginRegistrationFailed
            })?;

        let state_value = serde_json::to_value(&reg_state).map_err(|e| {
            tracing::error!("Failed to serialize registration state: {}", e);
            PasskeyOrchestrationError::SerializeRegistrationStateFailed
        })?;

        let payload = serde_json::to_string(&RegistrationChallengePayload {
            user_id,
            email: email.clone(),
            display_name: display_name.clone(),
            state: state_value,
            existing_user_recovery: false,
        })
        .map_err(|e| {
            tracing::error!("Failed to serialize registration challenge payload: {}", e);
            PasskeyOrchestrationError::StoreRegistrationChallengeFailed
        })?;

        let session_id = Uuid::new_v4().to_string();

        self.store_challenge(&session_id, &payload)
            .await
            .map_err(|_| PasskeyOrchestrationError::StoreRegistrationChallengeFailed)?;

        let challenge_json = serde_json::to_value(&challenge).map_err(|e| {
            tracing::error!("Failed to serialize challenge: {}", e);
            PasskeyOrchestrationError::SerializeChallengeFailed
        })?;

        tracing::info!(
            "Registration challenge issued; awaiting passkey enrollment to create account"
        );

        Ok(RegisterBeginResponse {
            user_id: user_id.to_string(),
            session_id,
            challenge: challenge_json,
        })
    }

    pub async fn begin_enrollment(
        &self,
        user_id: Uuid,
    ) -> Result<PasskeyRegisterBeginResponse, PasskeyOrchestrationError> {
        let user = self
            .repository
            .get_user_by_id(&user_id)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to load user {} for passkey enrollment: {}",
                    user_id,
                    e
                );
                PasskeyOrchestrationError::BeginEnrollmentFailed
            })?
            .ok_or(PasskeyOrchestrationError::AuthenticationFailed)?;

        let existing = self
            .repository
            .list_webauthn_credentials_for_user(&user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to list credentials for user {}: {}", user_id, e);
                PasskeyOrchestrationError::LoadExistingCredentialsFailed
            })?;

        let existing_ids: Vec<Vec<u8>> = existing.iter().map(|c| c.credential_id.clone()).collect();

        let (challenge, reg_state) = self
            .webauthn_service
            .begin_registration(user_id, &user.email, &user.email, &existing_ids)
            .map_err(|e| {
                tracing::error!("begin_registration failed for user {}: {}", user_id, e);
                PasskeyOrchestrationError::BeginEnrollmentFailed
            })?;

        let state_value = serde_json::to_value(&reg_state).map_err(|e| {
            tracing::error!("Failed to serialize registration state: {}", e);
            PasskeyOrchestrationError::SerializeRegistrationStateFailed
        })?;

        let challenge_payload = serde_json::to_string(&AuthenticatedEnrollmentChallengePayload {
            user_id,
            state: state_value,
        })
        .map_err(|e| {
            tracing::error!("Failed to serialize enrollment challenge payload: {}", e);
            PasskeyOrchestrationError::SerializeRegistrationStateFailed
        })?;

        let session_id = Uuid::new_v4().to_string();

        self.store_challenge(&session_id, &challenge_payload)
            .await
            .map_err(|_| PasskeyOrchestrationError::StoreRegistrationChallengeFailed)?;

        let challenge_json = serde_json::to_value(&challenge).map_err(|e| {
            tracing::error!("Failed to serialize challenge: {}", e);
            PasskeyOrchestrationError::SerializeChallengeFailed
        })?;

        Ok(PasskeyRegisterBeginResponse {
            session_id,
            challenge: challenge_json,
        })
    }

    pub async fn finish_enrollment(
        &self,
        user_id: Uuid,
        session_id: &str,
        response: serde_json::Value,
        name: &str,
    ) -> Result<PasskeyItem, PasskeyOrchestrationError> {
        let challenge_json = self.take_challenge(session_id).await?;

        let payload =
            serde_json::from_str::<AuthenticatedEnrollmentChallengePayload>(&challenge_json)
                .map_err(|e| {
                    tracing::error!("Failed to deserialize enrollment challenge payload: {}", e);
                    PasskeyOrchestrationError::InvalidEnrollmentChallenge
                })?;

        if payload.user_id != user_id {
            return Err(PasskeyOrchestrationError::ChallengeUserMismatch);
        }

        let reg_state: PasskeyRegistration =
            serde_json::from_value(payload.state).map_err(|e| {
                tracing::error!("Failed to deserialize registration state: {}", e);
                PasskeyOrchestrationError::InvalidChallengeState
            })?;

        let credential_response: RegisterPublicKeyCredential = serde_json::from_value(response)
            .map_err(|e| {
                tracing::error!("Failed to deserialize credential response: {}", e);
                PasskeyOrchestrationError::InvalidCredentialResponse
            })?;

        let passkey = self
            .webauthn_service
            .finish_registration(&reg_state, &credential_response)
            .map_err(|e| {
                tracing::warn!("finish_registration failed for user {}: {}", user_id, e);
                PasskeyOrchestrationError::PasskeyVerificationFailed
            })?;

        let credential_id = passkey.cred_id().to_vec();
        let passkey_json = serde_json::to_value(&passkey).map_err(|e| {
            tracing::error!("Failed to serialize passkey: {}", e);
            PasskeyOrchestrationError::SerializePasskeyFailed
        })?;

        let credential = self
            .repository
            .insert_webauthn_credential(&user_id, credential_id, passkey_json, name)
            .await
            .map_err(|e| {
                tracing::error!("Failed to insert credential for user {}: {}", user_id, e);
                PasskeyOrchestrationError::SavePasskeyFailed
            })?;

        self.clear_legacy_password(user_id).await?;

        tracing::info!("User {} enrolled an additional passkey", user_id);

        Ok(passkey_item(credential))
    }

    pub async fn finish_registration(
        &self,
        session_id: &str,
        response: serde_json::Value,
        name: &str,
        session_token: Option<&str>,
    ) -> Result<AuthenticatedSession, PasskeyOrchestrationError> {
        let challenge_json = self.take_challenge(session_id).await?;

        if self.is_authenticated(session_token) {
            return Err(PasskeyOrchestrationError::AuthenticatedEnrollmentRequired);
        }

        let payload = serde_json::from_str::<RegistrationChallengePayload>(&challenge_json)
            .map_err(|e| {
                tracing::error!(
                    "Failed to deserialize registration challenge payload: {}",
                    e
                );
                PasskeyOrchestrationError::InvalidRegistrationChallenge
            })?;

        let reg_state: PasskeyRegistration =
            serde_json::from_value(payload.state).map_err(|e| {
                tracing::error!("Failed to deserialize registration state: {}", e);
                PasskeyOrchestrationError::InvalidChallengeState
            })?;

        let user_id = payload.user_id;
        let recovery_signin = payload.existing_user_recovery;
        let complete_signup = !recovery_signin;

        if !complete_signup {
            let passkeys = self
                .repository
                .list_webauthn_credentials_for_user(&user_id)
                .await
                .map_err(|e| {
                    tracing::error!(
                        "Failed to list passkeys for user {} during passkey enrollment: {}",
                        user_id,
                        e
                    );
                    PasskeyOrchestrationError::CompleteEnrollmentFailed
                })?;

            if has_usable_passkey(&passkeys) {
                return Err(PasskeyOrchestrationError::PasskeyAlreadyAvailable);
            }
        }

        if recovery_signin {
            let user = self
                .repository
                .get_user_by_id(&user_id)
                .await
                .map_err(|e| {
                    tracing::error!(
                        "Failed to load user {} for recovery enrollment: {}",
                        user_id,
                        e
                    );
                    PasskeyOrchestrationError::CompleteEnrollmentFailed
                })?
                .ok_or(PasskeyOrchestrationError::AccountNotFound)?;

            if user
                .password_hash
                .as_ref()
                .is_some_and(|hash| !hash.is_empty())
            {
                return Err(PasskeyOrchestrationError::PasswordSignInAvailable);
            }
        }

        let credential_response: RegisterPublicKeyCredential = serde_json::from_value(response)
            .map_err(|e| {
                tracing::error!("Failed to deserialize credential response: {}", e);
                PasskeyOrchestrationError::InvalidCredentialResponse
            })?;

        let passkey = self
            .webauthn_service
            .finish_registration(&reg_state, &credential_response)
            .map_err(|e| {
                tracing::warn!("finish_registration failed for user {}: {}", user_id, e);
                PasskeyOrchestrationError::PasskeyVerificationFailed
            })?;

        let credential_id = passkey.cred_id().to_vec();
        let passkey_json = serde_json::to_value(&passkey).map_err(|e| {
            tracing::error!("Failed to serialize passkey: {}", e);
            PasskeyOrchestrationError::SerializePasskeyFailed
        })?;

        if complete_signup {
            let new_user = User {
                id: user_id,
                email: payload.email,
                password_hash: None,
                provider: String::new(),
                created_at: Utc::now(),
                updated_at: Utc::now(),
                onboarding_completed: false,
                demo_mode_active: true,
            };
            if let Err(e) = self.repository.create_user(&new_user).await {
                tracing::warn!(
                    auth_operation = "register_finish",
                    auth_result = "failure",
                    failure_reason = "user_creation_failed",
                    user_id = %user_id,
                    error = %e,
                    "User creation failed during passkey finish"
                );
                return Err(PasskeyOrchestrationError::EmailAlreadyRegistered);
            }
        }

        match self
            .repository
            .insert_webauthn_credential(&user_id, credential_id, passkey_json, name)
            .await
        {
            Ok(_) => {}
            Err(e) => {
                tracing::error!("Failed to insert credential for user {}: {}", user_id, e);
                if complete_signup {
                    if let Err(del_err) = self.repository.delete_user(&user_id).await {
                        tracing::error!(
                            "Failed to clean up user {} after credential insert failure: {}",
                            user_id,
                            del_err
                        );
                    }
                }
                return Err(PasskeyOrchestrationError::SavePasskeyFailed);
            }
        };

        let user = self.clear_legacy_password(user_id).await?;

        let auth_token = self.auth_service.generate_token(user_id).map_err(|e| {
            tracing::error!("Token generation failed for user {}: {}", user_id, e);
            PasskeyOrchestrationError::TokenGenerationFailed
        })?;

        self.cache_session(&auth_token).await;

        if complete_signup {
            tracing::info!("User {} completed passkey signup", user_id);
        } else {
            tracing::info!("User {} completed passkey recovery sign-in", user_id);
        }

        Ok(AuthenticatedSession {
            auth_token,
            user_id: user_id.to_string(),
            email: user.email.clone(),
            onboarding_completed: user.onboarding_completed,
            demo_mode_active: user.demo_mode_active,
            requires_passkey_enrollment: false,
        })
    }

    pub async fn list_passkeys(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<PasskeyItem>, PasskeyOrchestrationError> {
        let credentials = self
            .repository
            .list_webauthn_credentials_for_user(&user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to list passkeys for user {}: {}", user_id, e);
                PasskeyOrchestrationError::LoadPasskeysFailed
            })?;

        Ok(credentials
            .into_iter()
            .filter(is_usable_credential)
            .map(passkey_item)
            .collect())
    }

    pub async fn delete_passkey(
        &self,
        user_id: Uuid,
        id: Uuid,
    ) -> Result<(), PasskeyOrchestrationError> {
        let existing = self
            .repository
            .list_webauthn_credentials_for_user(&user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to list passkeys for user {}: {}", user_id, e);
                PasskeyOrchestrationError::LoadPasskeysFailed
            })?;

        let target = existing
            .iter()
            .find(|credential| credential.id == id)
            .ok_or(PasskeyOrchestrationError::PasskeyNotFound)?;

        if is_usable_credential(target) {
            let remaining_usable = existing
                .iter()
                .filter(|credential| credential.id != id && is_usable_credential(credential))
                .count();

            if remaining_usable == 0 {
                return Err(PasskeyOrchestrationError::LastPasskey);
            }
        } else if count_usable_credentials(&existing) == 0 {
            return Err(PasskeyOrchestrationError::LastPasskey);
        }

        let deleted = self
            .repository
            .delete_webauthn_credential(&user_id, &id)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to delete passkey {} for user {}: {}",
                    id,
                    user_id,
                    e
                );
                PasskeyOrchestrationError::DeletePasskeyFailed
            })?;

        if deleted {
            Ok(())
        } else {
            Err(PasskeyOrchestrationError::PasskeyNotFound)
        }
    }

    pub async fn begin_login(
        &self,
        email: &str,
    ) -> Result<PasskeyLoginBeginResponse, PasskeyOrchestrationError> {
        let email = email.trim().to_lowercase();

        let user_lookup = match self.repository.get_user_by_email(&email).await {
            Ok(user) => user,
            Err(e) => {
                tracing::error!(
                    "Failed to look up user by email during passkey login begin: {}",
                    e
                );
                return Err(PasskeyOrchestrationError::AuthenticationServiceError);
            }
        };

        let Some(user) = user_lookup else {
            return Ok(PasskeyLoginBeginResponse {
                session_id: String::new(),
                challenge: serde_json::Value::Null,
                account_exists: false,
                passkey_available: false,
                password_available: false,
            });
        };

        let creds = self
            .repository
            .list_webauthn_credentials_for_user(&user.id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to list credentials for user {}: {}", user.id, e);
                PasskeyOrchestrationError::AuthenticationServiceError
            })?;

        if dev_password_auth_enabled() && user_has_password(&user) {
            return Ok(PasskeyLoginBeginResponse {
                session_id: String::new(),
                challenge: serde_json::Value::Null,
                account_exists: true,
                passkey_available: false,
                password_available: true,
            });
        }

        let passkeys = usable_passkeys(&creds);
        let password_available = passkeys.is_empty() && user_has_password(&user);

        if passkeys.is_empty() {
            if password_available {
                return Ok(PasskeyLoginBeginResponse {
                    session_id: String::new(),
                    challenge: serde_json::Value::Null,
                    account_exists: true,
                    passkey_available: false,
                    password_available: true,
                });
            }

            return self.begin_recovery_registration(&user, &creds).await;
        }

        let user_id = user.id;
        let (challenge, auth_state) = self
            .webauthn_service
            .begin_authentication(&passkeys)
            .map_err(|e| {
                tracing::error!("begin_authentication failed: {}", e);
                PasskeyOrchestrationError::BeginAuthenticationFailed
            })?;

        let state_value = serde_json::to_value(&auth_state).map_err(|e| {
            tracing::error!("Failed to serialize auth state: {}", e);
            PasskeyOrchestrationError::SerializeAuthenticationStateFailed
        })?;

        let payload = serde_json::to_string(&LoginChallengePayload {
            user_id,
            state: state_value,
        })
        .map_err(|e| {
            tracing::error!("Failed to serialize challenge payload: {}", e);
            PasskeyOrchestrationError::StoreAuthenticationChallengeFailed
        })?;

        let session_id = Uuid::new_v4().to_string();

        self.store_challenge(&session_id, &payload)
            .await
            .map_err(|_| PasskeyOrchestrationError::StoreAuthenticationChallengeFailed)?;

        let challenge_json = serde_json::to_value(&challenge).map_err(|e| {
            tracing::error!("Failed to serialize challenge: {}", e);
            PasskeyOrchestrationError::SerializeChallengeFailed
        })?;

        Ok(PasskeyLoginBeginResponse {
            session_id,
            challenge: challenge_json,
            account_exists: true,
            passkey_available: true,
            password_available: false,
        })
    }

    pub async fn finish_login(
        &self,
        session_id: &str,
        response: serde_json::Value,
    ) -> Result<AuthenticatedSession, PasskeyOrchestrationError> {
        let challenge_json = self.take_challenge(session_id).await?;

        let payload: LoginChallengePayload =
            serde_json::from_str(&challenge_json).map_err(|e| {
                tracing::error!("Failed to deserialize challenge payload: {}", e);
                PasskeyOrchestrationError::InvalidChallengeState
            })?;

        if payload.user_id == Uuid::nil() {
            return Err(PasskeyOrchestrationError::AuthenticationFailed);
        }

        let user_id = payload.user_id;

        let auth_state: PasskeyAuthentication =
            serde_json::from_value(payload.state).map_err(|e| {
                tracing::error!("Failed to deserialize authentication state: {}", e);
                PasskeyOrchestrationError::InvalidAuthenticationState
            })?;

        let credential_response: PublicKeyCredential =
            serde_json::from_value(response).map_err(|e| {
                tracing::error!("Failed to deserialize credential response: {}", e);
                PasskeyOrchestrationError::InvalidCredentialResponse
            })?;

        let auth_result = self
            .webauthn_service
            .finish_authentication(&auth_state, &credential_response)
            .map_err(|e| {
                tracing::warn!("finish_authentication failed for user {}: {}", user_id, e);
                PasskeyOrchestrationError::AuthenticationFailed
            })?;

        let cred_id_bytes: Vec<u8> = auth_result.cred_id().to_vec();
        let new_count = auth_result.counter();

        let matching = self
            .repository
            .find_webauthn_credentials_by_credential_ids(&user_id, &[cred_id_bytes])
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to find matched credential for user {}: {}",
                    user_id,
                    e
                );
                PasskeyOrchestrationError::AuthenticationServiceError
            })?;

        if let Some(credential) = matching.first() {
            if let Err(e) = self
                .repository
                .update_webauthn_credential_counter_and_last_used(
                    &user_id,
                    &credential.id,
                    new_count,
                )
                .await
            {
                tracing::warn!(
                    "Failed to update sign counter for credential {}: {}",
                    credential.id,
                    e
                );
            }
        }

        let user = self
            .repository
            .get_user_by_id(&user_id)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to fetch user {} after authentication: {}",
                    user_id,
                    e
                );
                PasskeyOrchestrationError::AuthenticationServiceError
            })?
            .ok_or(PasskeyOrchestrationError::AuthenticationFailed)?;

        let auth_token = self.auth_service.generate_token(user_id).map_err(|e| {
            tracing::error!("Token generation failed for user {}: {}", user_id, e);
            PasskeyOrchestrationError::TokenGenerationFailed
        })?;

        self.cache_session(&auth_token).await;

        tracing::info!("User {} authenticated successfully via passkey", user_id);

        Ok(AuthenticatedSession {
            auth_token,
            user_id: user_id.to_string(),
            email: user.email.clone(),
            onboarding_completed: user.onboarding_completed,
            demo_mode_active: user.demo_mode_active,
            requires_passkey_enrollment: false,
        })
    }

    async fn begin_recovery_registration(
        &self,
        user: &User,
        creds: &[WebAuthnCredential],
    ) -> Result<PasskeyLoginBeginResponse, PasskeyOrchestrationError> {
        let existing_ids: Vec<Vec<u8>> = creds.iter().map(|c| c.credential_id.clone()).collect();

        let (challenge, reg_state) = self
            .webauthn_service
            .begin_registration(user.id, &user.email, &user.email, &existing_ids)
            .map_err(|e| {
                tracing::error!("begin_registration failed for user {}: {}", user.id, e);
                PasskeyOrchestrationError::BeginRegistrationFailed
            })?;

        let state_value = serde_json::to_value(&reg_state).map_err(|e| {
            tracing::error!("Failed to serialize registration state: {}", e);
            PasskeyOrchestrationError::SerializeRegistrationStateFailed
        })?;

        let payload = serde_json::to_string(&RegistrationChallengePayload {
            user_id: user.id,
            email: user.email.clone(),
            display_name: user.email.clone(),
            state: state_value,
            existing_user_recovery: true,
        })
        .map_err(|e| {
            tracing::error!("Failed to serialize registration challenge payload: {}", e);
            PasskeyOrchestrationError::StoreRegistrationChallengeFailed
        })?;

        let session_id = Uuid::new_v4().to_string();

        self.store_challenge(&session_id, &payload)
            .await
            .map_err(|_| PasskeyOrchestrationError::StoreRegistrationChallengeFailed)?;

        let challenge_json = serde_json::to_value(&challenge).map_err(|e| {
            tracing::error!("Failed to serialize challenge: {}", e);
            PasskeyOrchestrationError::SerializeChallengeFailed
        })?;

        Ok(PasskeyLoginBeginResponse {
            session_id,
            challenge: challenge_json,
            account_exists: true,
            passkey_available: false,
            password_available: false,
        })
    }

    fn is_authenticated(&self, session_token: Option<&str>) -> bool {
        session_token
            .and_then(|token| self.auth_service.validate_token(token).ok())
            .and_then(|claims| Uuid::parse_str(&claims.sub).ok())
            .is_some()
    }

    async fn store_challenge(&self, session_id: &str, payload: &str) -> Result<(), ()> {
        self.cache
            .set_webauthn_challenge(session_id, payload)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to store challenge for session {}: {}",
                    session_id,
                    e
                );
            })
    }

    async fn take_challenge(&self, session_id: &str) -> Result<String, PasskeyOrchestrationError> {
        self.cache
            .take_webauthn_challenge(session_id)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to retrieve challenge for session {}: {}",
                    session_id,
                    e
                );
                PasskeyOrchestrationError::RetrieveChallengeFailed
            })?
            .ok_or(PasskeyOrchestrationError::ChallengeNotFound)
    }

    async fn clear_legacy_password(
        &self,
        user_id: Uuid,
    ) -> Result<User, PasskeyOrchestrationError> {
        let enrolled_user = self
            .repository
            .get_user_by_id(&user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch user {} after enrollment: {}", user_id, e);
                PasskeyOrchestrationError::CompleteEnrollmentFailed
            })?
            .ok_or(PasskeyOrchestrationError::UserNotFound)?;

        if enrolled_user.password_hash.is_some() {
            self.repository
                .clear_user_password_hash(&user_id)
                .await
                .map_err(|e| {
                    tracing::error!(
                        "Failed to clear password hash for user {} after passkey enrollment: {}",
                        user_id,
                        e
                    );
                    PasskeyOrchestrationError::CompleteEnrollmentFailed
                })?;
        }

        Ok(enrolled_user)
    }

    async fn cache_session(&self, auth_token: &AuthToken) {
        let ttl = (auth_token.expires_at - Utc::now()).num_seconds().max(0) as u64;
        if ttl > 0 {
            if let Err(e) = self.cache.set_session_valid(&auth_token.jwt_id, ttl).await {
                tracing::warn!("Failed to set session validity in cache: {}", e);
            }
            if let Err(e) = self
                .cache
                .set_jwt_token(&auth_token.jwt_id, &auth_token.token, ttl)
                .await
            {
                tracing::warn!("Failed to cache JWT token: {}", e);
            }
        }
    }
}

fn passkey_item(credential: WebAuthnCredential) -> PasskeyItem {
    PasskeyItem {
        id: credential.id,
        name: credential.name,
        created_at: credential.created_at,
        last_used_at: credential.last_used_at,
    }
}
