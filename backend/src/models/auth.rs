use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::StatusCode;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[allow(unused_imports)]
use serde_json::json;

#[derive(Deserialize, ToSchema)]
#[schema(example = json!({"email": "user@example.com", "name": "Alex"}))]
pub struct RegisterRequest {
    pub email: String,
    pub name: String,
    #[serde(default)]
    pub password: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct RegisterBeginResponse {
    pub user_id: String,
    pub session_id: String,
    pub challenge: serde_json::Value,
}

#[derive(Serialize, ToSchema)]
#[schema(example = json!({"user_id": "11111111-2222-3333-4444-555555555555", "expires_at": "2024-01-01T12:00:00Z", "onboarding_completed": false, "requires_passkey_enrollment": true}))]
pub struct AuthResponse {
    pub user_id: String,
    pub expires_at: String,
    pub onboarding_completed: bool,
    pub requires_passkey_enrollment: bool,
}

#[derive(Debug, Clone)]
pub struct AuthContext {
    pub user_id: Uuid,
    pub jwt_id: String,
}

#[derive(Clone)]
pub struct AuthMiddlewareState {
    pub auth_service: std::sync::Arc<crate::services::AuthService>,
    pub cache_service: std::sync::Arc<dyn crate::services::CacheService>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub iat: usize,
    pub jti: String,
}

impl Claims {
    pub fn user_id(&self) -> String {
        self.sub.clone()
    }
}

pub struct AuthToken {
    pub token: String,
    pub jwt_id: String,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug)]
pub enum AuthError {
    TokenExpired,
    InvalidToken,
    HashingError,
    InvalidSecret,
}

impl std::fmt::Display for AuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuthError::TokenExpired => write!(f, "Token expired"),
            AuthError::InvalidToken => write!(f, "Invalid token"),
            AuthError::HashingError => write!(f, "Password hashing error"),
            AuthError::InvalidSecret => write!(f, "Invalid secret key"),
        }
    }
}

impl std::error::Error for AuthError {}

impl<S> FromRequestParts<S> for AuthContext
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<AuthContext>()
            .cloned()
            .ok_or(StatusCode::UNAUTHORIZED)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub password_hash: Option<String>,
    pub provider: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub onboarding_completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WebAuthnCredential {
    pub id: Uuid,
    pub user_id: Uuid,
    pub credential_id: Vec<u8>,
    pub passkey: serde_json::Value,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
}

impl User {
    pub fn active_provider(&self) -> Option<&str> {
        if self.provider.is_empty() {
            None
        } else {
            Some(&self.provider)
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct PasskeyRegisterBeginResponse {
    pub session_id: String,
    pub challenge: serde_json::Value,
}

#[derive(Deserialize, ToSchema)]
pub struct PasskeyRegisterFinishRequest {
    pub session_id: String,
    pub response: serde_json::Value,
    pub name: String,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct PasskeyItem {
    pub id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
}

#[derive(Deserialize, ToSchema)]
#[schema(example = json!({"email": "legacy@example.com", "password": "Test1234!"}))]
pub struct PasswordLoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Deserialize, ToSchema)]
#[schema(example = json!({"email": "user@example.com"}))]
pub struct PasskeyLoginBeginRequest {
    pub email: String,
}

#[derive(Serialize, ToSchema)]
pub struct PasskeyLoginBeginResponse {
    pub session_id: String,
    pub challenge: serde_json::Value,
    pub account_exists: bool,
    pub passkey_available: bool,
    pub password_available: bool,
}

#[derive(Deserialize, ToSchema)]
pub struct PasskeyLoginFinishRequest {
    pub session_id: String,
    pub response: serde_json::Value,
}

#[derive(Serialize, ToSchema)]
#[schema(example = json!({"message": "Logged out successfully", "cleared_session": "jwt-123"}))]
pub struct LogoutResponse {
    pub message: String,
    pub cleared_session: String,
}

#[derive(Serialize, ToSchema)]
#[schema(example = json!({"message": "Onboarding completed successfully", "onboarding_completed": true}))]
pub struct OnboardingCompleteResponse {
    pub message: String,
    pub onboarding_completed: bool,
}

#[derive(Serialize, ToSchema)]
#[schema(example = json!({"connections": 2, "transactions": 150, "accounts": 5, "budgets": 3}))]
pub struct DeletedItemsSummary {
    pub connections: i32,
    pub transactions: i32,
    pub accounts: i32,
    pub budgets: i32,
}

#[derive(Serialize, ToSchema)]
#[schema(example = json!({
    "message": "Account deleted successfully",
    "deleted_items": {
        "connections": 2,
        "transactions": 150,
        "accounts": 5,
        "budgets": 3
    }
}))]
pub struct DeleteAccountResponse {
    pub message: String,
    pub deleted_items: DeletedItemsSummary,
}
