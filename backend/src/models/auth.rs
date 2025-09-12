use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::StatusCode;

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user_id: String,
    pub expires_at: String,
}

#[derive(Debug, Clone)]
pub struct AuthContext {
    pub user_id: Uuid,
    #[allow(dead_code)]
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
    #[allow(dead_code)]
    pub user_id: Uuid,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug)]
pub enum AuthError {
    #[allow(dead_code)]
    InvalidCredentials,
    TokenExpired,
    InvalidToken,
    HashingError,
    InvalidSecret,
}

impl std::fmt::Display for AuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuthError::InvalidCredentials => write!(f, "Invalid credentials"),
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
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
