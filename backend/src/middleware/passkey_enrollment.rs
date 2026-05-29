use crate::models::api_error::ApiErrorResponse;
use crate::models::auth::AuthContext;
use crate::services::repository_service::DatabaseRepository;
use axum::{
    extract::{Request, State},
    middleware::Next,
    response::{IntoResponse, Response},
};
use std::sync::Arc;

#[derive(Clone)]
pub struct PasskeyEnrollmentMiddlewareState {
    pub db_repository: Arc<dyn DatabaseRepository>,
}

const EXEMPT_PATHS: &[&str] = &[
    "/api/auth/passkey/register/begin",
    "/api/auth/passkey/register/finish",
    "/api/auth/logout",
];

pub async fn passkey_enrollment_middleware(
    State(state): State<PasskeyEnrollmentMiddlewareState>,
    request: Request,
    next: Next,
) -> Result<Response, Response> {
    let path = request.uri().path();
    if EXEMPT_PATHS.contains(&path) {
        return Ok(next.run(request).await);
    }

    let auth_context = match request.extensions().get::<AuthContext>() {
        Some(context) => context.clone(),
        None => return Ok(next.run(request).await),
    };

    let user = match state
        .db_repository
        .get_user_by_id(&auth_context.user_id)
        .await
    {
        Ok(Some(user)) => user,
        Ok(None) => {
            return Err(ApiErrorResponse::unauthorized("Authentication failed").into_response())
        }
        Err(error) => {
            tracing::error!(
                "Failed to load user {} for passkey enrollment check: {}",
                auth_context.user_id,
                error
            );
            return Err(
                ApiErrorResponse::internal_server_error("Failed to verify account status")
                    .into_response(),
            );
        }
    };

    if user.password_hash.is_none() {
        return Ok(next.run(request).await);
    }

    let credentials = match state
        .db_repository
        .list_webauthn_credentials_for_user(&auth_context.user_id)
        .await
    {
        Ok(credentials) => credentials,
        Err(error) => {
            tracing::error!(
                "Failed to list passkeys for user {} during enrollment check: {}",
                auth_context.user_id,
                error
            );
            return Err(
                ApiErrorResponse::internal_server_error("Failed to verify account status")
                    .into_response(),
            );
        }
    };

    if credentials.is_empty() {
        return Err(ApiErrorResponse::passkey_enrollment_required(
            "Passkey enrollment is required before continuing",
        )
        .into_response());
    }

    Ok(next.run(request).await)
}
