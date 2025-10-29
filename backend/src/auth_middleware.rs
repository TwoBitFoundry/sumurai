use crate::middleware::telemetry_middleware::{
    attach_encrypted_token_to_current_span, hash_token,
};
use crate::models::api_error::ApiErrorResponse;
use crate::models::auth::AuthError;
pub use crate::models::auth::{AuthContext, AuthMiddlewareState};
use crate::services::auth_service::AuthService;
use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::{IntoResponse, Json, Response},
};
use uuid::Uuid;

const BEARER_PREFIX: &str = "Bearer ";
const BEARER_PREFIX_LEN: usize = 7;

pub async fn auth_middleware(
    State(middleware_state): State<AuthMiddlewareState>,
    headers: HeaderMap,
    mut request: Request,
    next: Next,
) -> Result<Response, Response> {
    let token = match extract_bearer_token(&headers) {
        Some(token) => token,
        None => {
            tracing::warn!(
                auth_error_type = "missing_header",
                path = %request.uri().path(),
                method = %request.method(),
                "Authentication failure: Missing Authorization header"
            );
            let error_response = ApiErrorResponse::with_code(
                "UNAUTHORIZED",
                "Authorization header is required",
                "MISSING_AUTH_HEADER",
            );
            return Err((StatusCode::UNAUTHORIZED, Json(error_response)).into_response());
        }
    };

    let encrypted_token = hash_token(token);
    attach_encrypted_token_to_current_span(&encrypted_token);

    let auth_context = match extract_user_context(&middleware_state.auth_service, token) {
        Ok(context) => context,
        Err(auth_error) => {
            let (error_message, error_code) = match auth_error {
                AuthError::InvalidToken => {
                    tracing::warn!(
                        auth_error_type = "invalid_token",
                        encrypted_token = %encrypted_token,
                        path = %request.uri().path(),
                        method = %request.method(),
                        "Authentication failure: Invalid JWT token"
                    );
                    ("Invalid or malformed authentication token", "INVALID_TOKEN")
                }
                AuthError::TokenExpired => {
                    tracing::info!(
                        auth_error_type = "expired_token",
                        encrypted_token = %encrypted_token,
                        path = %request.uri().path(),
                        method = %request.method(),
                        "Authentication failure: Expired JWT token"
                    );
                    ("Authentication token has expired", "EXPIRED_TOKEN")
                }
                _ => {
                    tracing::error!(
                        auth_error_type = "auth_error",
                        auth_error = ?auth_error,
                        encrypted_token = %encrypted_token,
                        path = %request.uri().path(),
                        method = %request.method(),
                        "Authentication failure: Unexpected error"
                    );
                    ("Authentication failed", "AUTH_ERROR")
                }
            };

            let error_response =
                ApiErrorResponse::with_code("UNAUTHORIZED", error_message, error_code);
            return Err((StatusCode::UNAUTHORIZED, Json(error_response)).into_response());
        }
    };

    match middleware_state
        .cache_service
        .is_session_valid(&auth_context.jwt_id)
        .await
    {
        Ok(true) => {
            tracing::debug!(
                encrypted_token = %encrypted_token,
                path = %request.uri().path(),
                method = %request.method(),
                "Session validated successfully"
            );
        }
        Ok(false) => {
            tracing::warn!(
                auth_error_type = "session_invalid",
                encrypted_token = %encrypted_token,
                path = %request.uri().path(),
                method = %request.method(),
                "Authentication failure: Session not found in cache"
            );
            let error_response = ApiErrorResponse::with_code(
                "UNAUTHORIZED",
                "Session expired or invalid",
                "SESSION_INVALID",
            );
            return Err((StatusCode::UNAUTHORIZED, Json(error_response)).into_response());
        }
        Err(e) => {
            tracing::error!(
                auth_error_type = "session_error",
                encrypted_token = %encrypted_token,
                path = %request.uri().path(),
                method = %request.method(),
                error = %e,
                "Authentication failure: Cache error during session validation"
            );
            let error_response = ApiErrorResponse::with_code(
                "UNAUTHORIZED",
                "Session validation failed",
                "SESSION_ERROR",
            );
            return Err((StatusCode::UNAUTHORIZED, Json(error_response)).into_response());
        }
    }

    request.extensions_mut().insert(auth_context);

    Ok(next.run(request).await)
}

pub fn extract_bearer_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .and_then(|auth_header| {
            if auth_header.starts_with(BEARER_PREFIX) {
                Some(&auth_header[BEARER_PREFIX_LEN..])
            } else {
                None
            }
        })
}

pub fn extract_user_context(
    auth_service: &AuthService,
    token: &str,
) -> Result<AuthContext, AuthError> {
    let claims = auth_service.validate_token(token)?;

    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AuthError::InvalidToken)?;

    Ok(AuthContext {
        user_id,
        jwt_id: claims.jti,
    })
}
