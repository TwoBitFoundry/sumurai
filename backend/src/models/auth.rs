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
#[schema(example = json!({"email": "user@example.com", "password": "SecurePass123!"}))]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
}

#[derive(Deserialize, ToSchema)]
#[schema(example = json!({"email": "user@example.com", "password": "SecurePass123!"}))]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize, ToSchema)]
#[schema(example = json!({"token": "jwt-token-value", "user_id": "11111111-2222-3333-4444-555555555555", "expires_at": "2024-01-01T12:00:00Z", "onboarding_completed": false}))]
pub struct AuthResponse {
    pub token: String,
    pub user_id: String,
    pub expires_at: String,
    pub onboarding_completed: bool,
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
    pub password_hash: String,
    pub provider: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub onboarding_completed: bool,
}

#[derive(Deserialize, ToSchema)]
#[schema(example = json!({"current_password": "OldPass123!", "new_password": "NewPass456!"}))]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Serialize, ToSchema)]
#[schema(example = json!({"message": "Password updated successfully", "requires_reauth": true}))]
pub struct ChangePasswordResponse {
    pub message: String,
    pub requires_reauth: bool,
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
