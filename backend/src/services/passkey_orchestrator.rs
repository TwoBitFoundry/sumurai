use std::sync::Arc;

use chrono::Utc;
use uuid::Uuid;
use webauthn_rs::prelude::{
    PasskeyAuthentication, PasskeyRegistration, PublicKeyCredential, RegisterPublicKeyCredential,
};

use crate::models::auth::{
    AuthToken, AuthenticatedEnrollmentChallengePayload, AuthenticatedSession,
    LoginChallengePayload, PasskeyItem, PasskeyLoginBeginResponse, PasskeyRegisterBeginResponse,
    RegistrationChallengePayload, User, WebAuthnCredential,
};
#[cfg(not(feature = "dev-seed"))]
use crate::models::auth::{RegisterBeginResponse, RegisterRequest};
use crate::models::domain_error::DomainError;
use crate::services::repository_service::DatabaseRepository;
use crate::services::webauthn_service::WebAuthnService;
use crate::services::{AuthService, CacheService};
use crate::utils::seed_password_fallback::{dev_password_auth_enabled, user_has_password};
use crate::utils::webauthn_credentials::{
    count_usable_credentials, has_usable_passkey, is_usable_credential, usable_passkeys,
};

fn authenticated_enrollment_required() -> DomainError {
    DomainError::bad_request(
        "Authenticated passkey enrollment must use /api/auth/passkey/enroll/finish",
    )
}

fn email_already_registered() -> DomainError {
    DomainError::conflict("Email address is already registered")
}

fn begin_registration_failed() -> DomainError {
    DomainError::internal("Failed to begin passkey registration")
}

fn serialize_registration_state_failed() -> DomainError {
    DomainError::internal("Failed to serialize registration state")
}

fn store_registration_challenge_failed() -> DomainError {
    DomainError::internal("Failed to store registration challenge")
}

fn serialize_challenge_failed() -> DomainError {
    DomainError::internal("Failed to serialize challenge")
}

fn begin_enrollment_failed() -> DomainError {
    DomainError::internal("Failed to begin passkey enrollment")
}

fn authentication_failed() -> DomainError {
    DomainError::unauthorized("Authentication failed").with_code("AUTH_REQUIRED")
}

fn invalid_challenge_state() -> DomainError {
    DomainError::bad_request("Invalid challenge state")
}

fn invalid_credential_response() -> DomainError {
    DomainError::bad_request("Invalid credential response")
}

fn passkey_verification_failed() -> DomainError {
    DomainError::bad_request("Passkey verification failed")
}

fn serialize_passkey_failed() -> DomainError {
    DomainError::internal("Failed to serialize passkey")
}

fn save_passkey_failed() -> DomainError {
    DomainError::internal("Failed to save passkey")
}

fn complete_enrollment_failed() -> DomainError {
    DomainError::internal("Failed to complete passkey enrollment")
}

fn token_generation_failed() -> DomainError {
    DomainError::internal("Failed to generate authentication token")
}

fn load_passkeys_failed() -> DomainError {
    DomainError::internal("Failed to retrieve passkeys")
}

fn passkey_not_found() -> DomainError {
    DomainError::not_found("Passkey not found")
}

fn last_passkey() -> DomainError {
    DomainError::conflict("Cannot remove the last enrolled passkey")
}

fn authentication_service_error() -> DomainError {
    DomainError::internal("Authentication service error")
}

fn store_authentication_challenge_failed() -> DomainError {
    DomainError::internal("Failed to store authentication challenge")
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
    ) -> Result<RegisterBeginResponse, DomainError> {
        if request.password.is_some() {
            return Err(DomainError::bad_request(
                "Password registration is no longer supported; enroll a passkey instead",
            ));
        }

        if self.is_authenticated(session_token) {
            return Err(authenticated_enrollment_required());
        }

        let email = request.email.trim().to_lowercase();
        let display_name = request.name.trim().to_string();

        if let Ok(Some(_)) = self.repository.get_user_by_email(&email).await {
            return Err(email_already_registered());
        }

        let user_id = Uuid::new_v4();

        let (challenge, reg_state) = self
            .webauthn_service
            .begin_registration(user_id, &email, &display_name, &[])
            .map_err(|e| {
                tracing::error!("begin_registration failed for user {}: {}", user_id, e);
                begin_registration_failed()
            })?;

        let state_value = serde_json::to_value(&reg_state).map_err(|e| {
            tracing::error!("Failed to serialize registration state: {}", e);
            serialize_registration_state_failed()
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
            store_registration_challenge_failed()
        })?;

        let session_id = Uuid::new_v4().to_string();

        self.store_challenge(&session_id, &payload)
            .await
            .map_err(|_| store_registration_challenge_failed())?;

        let challenge_json = serde_json::to_value(&challenge).map_err(|e| {
            tracing::error!("Failed to serialize challenge: {}", e);
            serialize_challenge_failed()
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
    ) -> Result<PasskeyRegisterBeginResponse, DomainError> {
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
                begin_enrollment_failed()
            })?
            .ok_or(authentication_failed())?;

        let existing = self
            .repository
            .list_webauthn_credentials_for_user(&user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to list credentials for user {}: {}", user_id, e);
                DomainError::internal("Failed to retrieve existing credentials")
            })?;

        let existing_ids: Vec<Vec<u8>> = existing.iter().map(|c| c.credential_id.clone()).collect();

        let (challenge, reg_state) = self
            .webauthn_service
            .begin_registration(user_id, &user.email, &user.email, &existing_ids)
            .map_err(|e| {
                tracing::error!("begin_registration failed for user {}: {}", user_id, e);
                begin_enrollment_failed()
            })?;

        let state_value = serde_json::to_value(&reg_state).map_err(|e| {
            tracing::error!("Failed to serialize registration state: {}", e);
            serialize_registration_state_failed()
        })?;

        let challenge_payload = serde_json::to_string(&AuthenticatedEnrollmentChallengePayload {
            user_id,
            state: state_value,
        })
        .map_err(|e| {
            tracing::error!("Failed to serialize enrollment challenge payload: {}", e);
            serialize_registration_state_failed()
        })?;

        let session_id = Uuid::new_v4().to_string();

        self.store_challenge(&session_id, &challenge_payload)
            .await
            .map_err(|_| store_registration_challenge_failed())?;

        let challenge_json = serde_json::to_value(&challenge).map_err(|e| {
            tracing::error!("Failed to serialize challenge: {}", e);
            serialize_challenge_failed()
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
    ) -> Result<PasskeyItem, DomainError> {
        let challenge_json = self.take_challenge(session_id).await?;

        let payload =
            serde_json::from_str::<AuthenticatedEnrollmentChallengePayload>(&challenge_json)
                .map_err(|e| {
                    tracing::error!("Failed to deserialize enrollment challenge payload: {}", e);
                    DomainError::bad_request("Invalid enrollment challenge")
                })?;

        if payload.user_id != user_id {
            return Err(DomainError::unauthorized(
                "Challenge does not belong to the authenticated user",
            )
            .with_code("AUTH_REQUIRED"));
        }

        let reg_state: PasskeyRegistration =
            serde_json::from_value(payload.state).map_err(|e| {
                tracing::error!("Failed to deserialize registration state: {}", e);
                invalid_challenge_state()
            })?;

        let credential_response: RegisterPublicKeyCredential = serde_json::from_value(response)
            .map_err(|e| {
                tracing::error!("Failed to deserialize credential response: {}", e);
                invalid_credential_response()
            })?;

        let passkey = self
            .webauthn_service
            .finish_registration(&reg_state, &credential_response)
            .map_err(|e| {
                tracing::warn!("finish_registration failed for user {}: {}", user_id, e);
                passkey_verification_failed()
            })?;

        let credential_id = passkey.cred_id().to_vec();
        let passkey_json = serde_json::to_value(&passkey).map_err(|e| {
            tracing::error!("Failed to serialize passkey: {}", e);
            serialize_passkey_failed()
        })?;

        let credential = self
            .repository
            .insert_webauthn_credential(&user_id, credential_id, passkey_json, name)
            .await
            .map_err(|e| {
                tracing::error!("Failed to insert credential for user {}: {}", user_id, e);
                save_passkey_failed()
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
    ) -> Result<AuthenticatedSession, DomainError> {
        let challenge_json = self.take_challenge(session_id).await?;

        if self.is_authenticated(session_token) {
            return Err(authenticated_enrollment_required());
        }

        let payload = serde_json::from_str::<RegistrationChallengePayload>(&challenge_json)
            .map_err(|e| {
                tracing::error!(
                    "Failed to deserialize registration challenge payload: {}",
                    e
                );
                DomainError::bad_request("Invalid registration challenge")
            })?;

        let reg_state: PasskeyRegistration =
            serde_json::from_value(payload.state).map_err(|e| {
                tracing::error!("Failed to deserialize registration state: {}", e);
                invalid_challenge_state()
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
                    complete_enrollment_failed()
                })?;

            if has_usable_passkey(&passkeys) {
                return Err(DomainError::bad_request(
                    "Passkey sign-in is already available for this account",
                ));
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
                    complete_enrollment_failed()
                })?
                .ok_or(DomainError::bad_request("Account not found"))?;

            if user
                .password_hash
                .as_ref()
                .is_some_and(|hash| !hash.is_empty())
            {
                return Err(DomainError::bad_request(
                    "Password sign-in is available for this account",
                ));
            }
        }

        let credential_response: RegisterPublicKeyCredential = serde_json::from_value(response)
            .map_err(|e| {
                tracing::error!("Failed to deserialize credential response: {}", e);
                invalid_credential_response()
            })?;

        let passkey = self
            .webauthn_service
            .finish_registration(&reg_state, &credential_response)
            .map_err(|e| {
                tracing::warn!("finish_registration failed for user {}: {}", user_id, e);
                passkey_verification_failed()
            })?;

        let credential_id = passkey.cred_id().to_vec();
        let passkey_json = serde_json::to_value(&passkey).map_err(|e| {
            tracing::error!("Failed to serialize passkey: {}", e);
            serialize_passkey_failed()
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
                return Err(email_already_registered());
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
                return Err(save_passkey_failed());
            }
        };

        let user = self.clear_legacy_password(user_id).await?;

        let auth_token = self.auth_service.generate_token(user_id).map_err(|e| {
            tracing::error!("Token generation failed for user {}: {}", user_id, e);
            token_generation_failed()
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

    pub async fn list_passkeys(&self, user_id: Uuid) -> Result<Vec<PasskeyItem>, DomainError> {
        let credentials = self
            .repository
            .list_webauthn_credentials_for_user(&user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to list passkeys for user {}: {}", user_id, e);
                load_passkeys_failed()
            })?;

        Ok(credentials
            .into_iter()
            .filter(is_usable_credential)
            .map(passkey_item)
            .collect())
    }

    pub async fn delete_passkey(&self, user_id: Uuid, id: Uuid) -> Result<(), DomainError> {
        let existing = self
            .repository
            .list_webauthn_credentials_for_user(&user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to list passkeys for user {}: {}", user_id, e);
                load_passkeys_failed()
            })?;

        let target = existing
            .iter()
            .find(|credential| credential.id == id)
            .ok_or(passkey_not_found())?;

        if is_usable_credential(target) {
            let remaining_usable = existing
                .iter()
                .filter(|credential| credential.id != id && is_usable_credential(credential))
                .count();

            if remaining_usable == 0 {
                return Err(last_passkey());
            }
        } else if count_usable_credentials(&existing) == 0 {
            return Err(last_passkey());
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
                DomainError::internal("Failed to delete passkey")
            })?;

        if deleted {
            Ok(())
        } else {
            Err(passkey_not_found())
        }
    }

    pub async fn begin_login(&self, email: &str) -> Result<PasskeyLoginBeginResponse, DomainError> {
        let email = email.trim().to_lowercase();

        let user_lookup = match self.repository.get_user_by_email(&email).await {
            Ok(user) => user,
            Err(e) => {
                tracing::error!(
                    "Failed to look up user by email during passkey login begin: {}",
                    e
                );
                return Err(authentication_service_error());
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
                authentication_service_error()
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
                DomainError::internal("Failed to begin authentication")
            })?;

        let state_value = serde_json::to_value(&auth_state).map_err(|e| {
            tracing::error!("Failed to serialize auth state: {}", e);
            DomainError::internal("Failed to serialize authentication state")
        })?;

        let payload = serde_json::to_string(&LoginChallengePayload {
            user_id,
            state: state_value,
        })
        .map_err(|e| {
            tracing::error!("Failed to serialize challenge payload: {}", e);
            store_authentication_challenge_failed()
        })?;

        let session_id = Uuid::new_v4().to_string();

        self.store_challenge(&session_id, &payload)
            .await
            .map_err(|_| store_authentication_challenge_failed())?;

        let challenge_json = serde_json::to_value(&challenge).map_err(|e| {
            tracing::error!("Failed to serialize challenge: {}", e);
            serialize_challenge_failed()
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
    ) -> Result<AuthenticatedSession, DomainError> {
        let challenge_json = self.take_challenge(session_id).await?;

        let payload: LoginChallengePayload =
            serde_json::from_str(&challenge_json).map_err(|e| {
                tracing::error!("Failed to deserialize challenge payload: {}", e);
                invalid_challenge_state()
            })?;

        if payload.user_id == Uuid::nil() {
            return Err(authentication_failed());
        }

        let user_id = payload.user_id;

        let auth_state: PasskeyAuthentication =
            serde_json::from_value(payload.state).map_err(|e| {
                tracing::error!("Failed to deserialize authentication state: {}", e);
                DomainError::bad_request("Invalid authentication state")
            })?;

        let credential_response: PublicKeyCredential =
            serde_json::from_value(response).map_err(|e| {
                tracing::error!("Failed to deserialize credential response: {}", e);
                invalid_credential_response()
            })?;

        let auth_result = self
            .webauthn_service
            .finish_authentication(&auth_state, &credential_response)
            .map_err(|e| {
                tracing::warn!("finish_authentication failed for user {}: {}", user_id, e);
                authentication_failed()
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
                authentication_service_error()
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
                authentication_service_error()
            })?
            .ok_or(authentication_failed())?;

        let auth_token = self.auth_service.generate_token(user_id).map_err(|e| {
            tracing::error!("Token generation failed for user {}: {}", user_id, e);
            token_generation_failed()
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
    ) -> Result<PasskeyLoginBeginResponse, DomainError> {
        let existing_ids: Vec<Vec<u8>> = creds.iter().map(|c| c.credential_id.clone()).collect();

        let (challenge, reg_state) = self
            .webauthn_service
            .begin_registration(user.id, &user.email, &user.email, &existing_ids)
            .map_err(|e| {
                tracing::error!("begin_registration failed for user {}: {}", user.id, e);
                begin_registration_failed()
            })?;

        let state_value = serde_json::to_value(&reg_state).map_err(|e| {
            tracing::error!("Failed to serialize registration state: {}", e);
            serialize_registration_state_failed()
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
            store_registration_challenge_failed()
        })?;

        let session_id = Uuid::new_v4().to_string();

        self.store_challenge(&session_id, &payload)
            .await
            .map_err(|_| store_registration_challenge_failed())?;

        let challenge_json = serde_json::to_value(&challenge).map_err(|e| {
            tracing::error!("Failed to serialize challenge: {}", e);
            serialize_challenge_failed()
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

    async fn take_challenge(&self, session_id: &str) -> Result<String, DomainError> {
        self.cache
            .take_webauthn_challenge(session_id)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to retrieve challenge for session {}: {}",
                    session_id,
                    e
                );
                DomainError::internal("Failed to retrieve challenge")
            })?
            .ok_or(DomainError::bad_request(
                "Challenge not found or already used",
            ))
    }

    async fn clear_legacy_password(&self, user_id: Uuid) -> Result<User, DomainError> {
        let enrolled_user = self
            .repository
            .get_user_by_id(&user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch user {} after enrollment: {}", user_id, e);
                complete_enrollment_failed()
            })?
            .ok_or(DomainError::internal("User not found"))?;

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
                    complete_enrollment_failed()
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
