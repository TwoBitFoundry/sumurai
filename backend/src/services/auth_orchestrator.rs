use std::sync::Arc;

use chrono::Utc;
use uuid::Uuid;

#[cfg(feature = "dev-seed")]
use crate::models::auth::User;
use crate::models::auth::{
    AuthToken, DeleteAccountResponse, DeletedItemsSummary, OnboardingCompleteResponse,
};
use crate::services::repository_service::DatabaseRepository;
use crate::services::{AuthService, CacheService, ConnectionService, DemoModeService};
use crate::utils::seed_password_fallback::dev_password_auth_enabled;
use crate::utils::webauthn_credentials::has_usable_passkey;

#[derive(Debug, Clone, PartialEq)]
pub enum AuthOrchestrationError {
    #[cfg(feature = "dev-seed")]
    EmailAlreadyRegistered,
    #[cfg(feature = "dev-seed")]
    PasswordProcessingFailed,
    InvalidCredentials,
    AuthenticationServiceError,
    TokenGenerationFailed,
    Unauthorized,
    InvalidUserId,
    SessionCheckFailed,
    UserLookupFailed,
    OnboardingUpdateFailed,
    DemoUserLoadFailed,
    DemoActivationFailed,
    LoadConnectionsFailed,
    LoadBudgetsFailed,
    DeleteUserFailed,
}

pub struct AuthenticatedSession {
    pub auth_token: AuthToken,
    pub user_id: String,
    pub email: String,
    pub onboarding_completed: bool,
    pub demo_mode_active: bool,
    pub requires_passkey_enrollment: bool,
}

pub struct AuthOrchestrator {
    auth_service: Arc<AuthService>,
    repository: Arc<dyn DatabaseRepository>,
    cache: Arc<dyn CacheService>,
    connection_service: Arc<ConnectionService>,
}

impl AuthOrchestrator {
    pub fn new(
        auth_service: Arc<AuthService>,
        repository: Arc<dyn DatabaseRepository>,
        cache: Arc<dyn CacheService>,
        connection_service: Arc<ConnectionService>,
    ) -> Self {
        Self {
            auth_service,
            repository,
            cache,
            connection_service,
        }
    }

    #[cfg(feature = "dev-seed")]
    pub async fn register_with_password(
        &self,
        email: String,
        password: String,
    ) -> Result<AuthenticatedSession, AuthOrchestrationError> {
        if let Ok(Some(_)) = self.repository.get_user_by_email(&email).await {
            return Err(AuthOrchestrationError::EmailAlreadyRegistered);
        }

        let password_hash = self.auth_service.hash_password(&password).map_err(|e| {
            tracing::error!("Password hashing failed: {}", e);
            AuthOrchestrationError::PasswordProcessingFailed
        })?;

        let user_id = Uuid::new_v4();
        let user = User {
            id: user_id,
            email: email.clone(),
            password_hash: Some(password_hash),
            provider: String::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            onboarding_completed: false,
            demo_mode_active: true,
        };

        if let Err(e) = self.repository.create_user(&user).await {
            tracing::warn!(
                auth_operation = "register",
                auth_result = "failure",
                failure_reason = "user_creation_failed",
                user_id = %user_id,
                error = %e,
                "User creation failed"
            );
            return Err(AuthOrchestrationError::EmailAlreadyRegistered);
        }

        let auth_token = self.auth_service.generate_token(user_id).map_err(|e| {
            tracing::error!("Token generation failed for user {}: {}", user_id, e);
            AuthOrchestrationError::TokenGenerationFailed
        })?;

        self.cache_session(
            &auth_token,
            "Failed to set session validity in cache",
            "Failed to cache JWT token",
        )
        .await;

        tracing::info!("User {} registered with password in development", user_id);

        Ok(AuthenticatedSession {
            auth_token,
            user_id: user_id.to_string(),
            email,
            onboarding_completed: false,
            demo_mode_active: true,
            requires_passkey_enrollment: false,
        })
    }

    pub async fn login_with_password(
        &self,
        email: &str,
        password: &str,
    ) -> Result<AuthenticatedSession, AuthOrchestrationError> {
        let user = match self.repository.get_user_by_email(email).await {
            Ok(Some(user)) => user,
            Ok(None) => {
                return Err(AuthOrchestrationError::InvalidCredentials);
            }
            Err(e) => {
                tracing::error!(
                    "Failed to look up user by email during password login: {}",
                    e
                );
                return Err(AuthOrchestrationError::AuthenticationServiceError);
            }
        };

        let passkeys = self
            .repository
            .list_webauthn_credentials_for_user(&user.id)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to list passkeys for user {} during password login: {}",
                    user.id,
                    e
                );
                AuthOrchestrationError::AuthenticationServiceError
            })?;

        if has_usable_passkey(&passkeys) && !dev_password_auth_enabled() {
            return Err(AuthOrchestrationError::InvalidCredentials);
        }

        let password_hash = match user.password_hash.as_deref() {
            Some(hash) if !hash.is_empty() => hash,
            _ => return Err(AuthOrchestrationError::InvalidCredentials),
        };

        let password_valid = self
            .auth_service
            .verify_password(password, password_hash)
            .map_err(|e| {
                tracing::error!("Password verification error for user {}: {}", user.id, e);
                AuthOrchestrationError::AuthenticationServiceError
            })?;

        if !password_valid {
            return Err(AuthOrchestrationError::InvalidCredentials);
        }

        let user_id = user.id;
        let auth_token = self.auth_service.generate_token(user_id).map_err(|e| {
            tracing::error!("Token generation failed for user {}: {}", user_id, e);
            AuthOrchestrationError::TokenGenerationFailed
        })?;

        self.cache_session(
            &auth_token,
            "Failed to set session validity in cache",
            "Failed to cache JWT token",
        )
        .await;

        tracing::info!(
            "User {} authenticated via legacy password login (migration)",
            user_id
        );

        Ok(AuthenticatedSession {
            auth_token,
            user_id: user_id.to_string(),
            email: user.email.clone(),
            onboarding_completed: user.onboarding_completed,
            demo_mode_active: user.demo_mode_active,
            requires_passkey_enrollment: !dev_password_auth_enabled(),
        })
    }

    pub async fn logout(&self, token: &str) -> Result<String, AuthOrchestrationError> {
        let claims = self
            .auth_service
            .validate_token(token)
            .map_err(|_| AuthOrchestrationError::Unauthorized)?;

        if let Err(e) = self.cache.invalidate_session(&claims.jti).await {
            tracing::warn!("Failed to invalidate session during logout: {}", e);
        }

        if let Err(e) = self.cache.clear_jwt_scoped_data(&claims.jti).await {
            tracing::warn!("Failed to clear JWT-scoped data during logout: {}", e);
        }

        if let Err(e) = self.cache.clear_transactions(&claims.jti).await {
            tracing::warn!("Failed to clear transaction cache during logout: {}", e);
        }

        tracing::info!("User logged out successfully");

        Ok(claims.jti)
    }

    pub async fn refresh_session(
        &self,
        token: &str,
    ) -> Result<AuthenticatedSession, AuthOrchestrationError> {
        let claims = self
            .auth_service
            .validate_token_for_refresh(token)
            .map_err(|_| AuthOrchestrationError::Unauthorized)?;

        match self.cache.is_session_valid(&claims.jti).await {
            Ok(true) => {}
            Ok(false) => {
                tracing::warn!(
                    "Refresh rejected: Session not found in cache (app may have restarted)"
                );
                return Err(AuthOrchestrationError::Unauthorized);
            }
            Err(e) => {
                tracing::error!("Cache error during refresh session validation: {}", e);
                return Err(AuthOrchestrationError::SessionCheckFailed);
            }
        }

        let user_id = Uuid::parse_str(&claims.user_id())
            .map_err(|_| AuthOrchestrationError::InvalidUserId)?;

        let user = self
            .repository
            .get_user_by_id(&user_id)
            .await
            .map_err(|_| AuthOrchestrationError::UserLookupFailed)?
            .ok_or(AuthOrchestrationError::Unauthorized)?;

        let auth_token = self
            .auth_service
            .generate_token(user_id)
            .map_err(|_| AuthOrchestrationError::TokenGenerationFailed)?;

        self.cache_session(
            &auth_token,
            "Failed to set refreshed session validity in cache",
            "Failed to cache refreshed JWT token",
        )
        .await;

        tracing::info!("User session refreshed");

        Ok(AuthenticatedSession {
            auth_token,
            user_id: claims.user_id(),
            email: user.email.clone(),
            onboarding_completed: user.onboarding_completed,
            demo_mode_active: user.demo_mode_active,
            requires_passkey_enrollment: false,
        })
    }

    pub async fn complete_onboarding(
        &self,
        user_id: Uuid,
    ) -> Result<OnboardingCompleteResponse, AuthOrchestrationError> {
        match self.repository.mark_onboarding_complete(&user_id).await {
            Ok(_) => {
                tracing::info!("User {} completed onboarding", user_id);
                Ok(OnboardingCompleteResponse {
                    message: "Onboarding completed successfully".to_string(),
                    onboarding_completed: true,
                    demo_mode_active: false,
                })
            }
            Err(e) => {
                tracing::error!(
                    "Failed to mark onboarding complete for user {}: {}",
                    user_id,
                    e
                );
                Err(AuthOrchestrationError::OnboardingUpdateFailed)
            }
        }
    }

    pub async fn activate_demo_mode(
        &self,
        user_id: Uuid,
    ) -> Result<OnboardingCompleteResponse, AuthOrchestrationError> {
        let user = self
            .repository
            .get_user_by_id(&user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to load user {} for demo onboarding: {}", user_id, e);
                AuthOrchestrationError::DemoUserLoadFailed
            })?
            .ok_or(AuthOrchestrationError::DemoUserLoadFailed)?;

        DemoModeService::activate_demo_workspace_for_user(
            &self.repository,
            &self.cache,
            &user,
            true,
        )
        .await
        .map_err(|e| {
            tracing::error!("Failed to activate demo mode for user {}: {}", user_id, e);
            AuthOrchestrationError::DemoActivationFailed
        })?;

        Ok(OnboardingCompleteResponse {
            message: "Demo mode activated successfully".to_string(),
            onboarding_completed: true,
            demo_mode_active: true,
        })
    }

    pub async fn delete_account(
        &self,
        user_id: Uuid,
        jwt_id: &str,
    ) -> Result<DeleteAccountResponse, AuthOrchestrationError> {
        let connections = self
            .repository
            .get_all_provider_connections_by_user(&user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get connections for user {}: {}", user_id, e);
                AuthOrchestrationError::LoadConnectionsFailed
            })?;

        let mut deleted_connections = 0;
        let mut deleted_transactions = 0;
        let mut deleted_accounts = 0;

        for connection in connections {
            match self
                .connection_service
                .disconnect_connection_by_id(&connection.id, &user_id, jwt_id)
                .await
            {
                Ok(result) => {
                    if result.success {
                        deleted_connections += 1;
                        deleted_transactions += result.data_cleared.transactions;
                        deleted_accounts += result.data_cleared.accounts;
                    }
                }
                Err(e) => {
                    tracing::warn!(
                        "Failed to disconnect connection {} for user {}: {}",
                        connection.id,
                        user_id,
                        e
                    );
                }
            }
        }

        let budgets = self
            .repository
            .get_budgets_for_user(user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get budgets for user {}: {}", user_id, e);
                AuthOrchestrationError::LoadBudgetsFailed
            })?;

        let deleted_budgets = budgets.len() as i32;

        self.repository.delete_user(&user_id).await.map_err(|e| {
            tracing::error!("Failed to delete user {}: {}", user_id, e);
            AuthOrchestrationError::DeleteUserFailed
        })?;

        if let Err(e) = self
            .cache
            .invalidate_pattern(&format!("{}_*", jwt_id))
            .await
        {
            tracing::warn!(
                "Failed to invalidate cache for deleted user {}: {}",
                user_id,
                e
            );
        }

        tracing::info!(
            "User {} account deleted. Connections: {}, Transactions: {}, Accounts: {}, Budgets: {}",
            user_id,
            deleted_connections,
            deleted_transactions,
            deleted_accounts,
            deleted_budgets
        );

        Ok(DeleteAccountResponse {
            message: "Account deleted successfully".to_string(),
            deleted_items: DeletedItemsSummary {
                connections: deleted_connections,
                transactions: deleted_transactions,
                accounts: deleted_accounts,
                budgets: deleted_budgets,
            },
        })
    }

    async fn cache_session(
        &self,
        auth_token: &AuthToken,
        session_failure: &str,
        token_failure: &str,
    ) {
        let ttl = (auth_token.expires_at - Utc::now()).num_seconds().max(0) as u64;
        if ttl > 0 {
            if let Err(e) = self.cache.set_session_valid(&auth_token.jwt_id, ttl).await {
                tracing::warn!("{}: {}", session_failure, e);
            }
            if let Err(e) = self
                .cache
                .set_jwt_token(&auth_token.jwt_id, &auth_token.token, ttl)
                .await
            {
                tracing::warn!("{}: {}", token_failure, e);
            }
        }
    }
}
