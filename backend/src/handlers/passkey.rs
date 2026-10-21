use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Json, Response},
};
use uuid::Uuid;

use crate::auth_middleware::extract_auth_cookie_token;
use crate::handlers::auth::{auth_cookie_headers, authenticated_session_response};
use crate::models::api_error::ApiErrorResponse;
use crate::models::app_state::AppState;
use crate::models::auth as auth_models;
use crate::models::auth::AuthContext;
use crate::utils::auth_cookie::build_auth_cookie;

#[cfg(not(feature = "dev-seed"))]
pub(crate) async fn register_user_with_passkey(
    state: AppState,
    headers: HeaderMap,
    req: auth_models::RegisterRequest,
) -> Result<Response, (StatusCode, Json<ApiErrorResponse>)> {
    let session_token = extract_auth_cookie_token(&headers);

    let response = state
        .passkeys()
        .begin_registration(&req, session_token.as_deref())
        .await?;

    Ok(Json(response).into_response())
}

#[utoipa::path(
    post,
    path = "/api/auth/passkey/enroll/begin",
    description = "Begin passkey enrollment for the authenticated user (settings or migration). Requires an auth_token cookie; complete with enroll/finish.",
    responses(
        (status = 200, description = "Registration challenge", body = auth_models::PasskeyRegisterBeginResponse),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    tag = "Authentication"
)]
pub async fn begin_passkey_enroll(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<auth_models::PasskeyRegisterBeginResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .passkeys()
        .begin_enrollment(auth_context.user_id)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/auth/passkey/enroll/finish",
    description = "Complete authenticated passkey enrollment and return the enrolled passkey.",
    request_body = auth_models::PasskeyRegisterFinishRequest,
    responses(
        (status = 200, description = "Passkey enrolled", body = auth_models::PasskeyItem),
        (status = 400, description = "Invalid response or expired challenge", body = ApiErrorResponse),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    tag = "Authentication"
)]
pub async fn finish_passkey_enroll(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<auth_models::PasskeyRegisterFinishRequest>,
) -> Result<Json<auth_models::PasskeyItem>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .passkeys()
        .finish_enrollment(
            auth_context.user_id,
            &req.session_id,
            req.response,
            &req.name,
        )
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/auth/passkey/register/finish",
    description = "Complete passkey signup or recovery enrollment without an auth cookie. Returns an auth_token cookie on success. Authenticated enrollment uses enroll/finish instead.",
    request_body = auth_models::PasskeyRegisterFinishRequest,
    responses(
        (status = 200, description = "Signup or recovery completed", body = auth_models::AuthResponse),
        (status = 400, description = "Invalid response or expired challenge", body = ApiErrorResponse),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    tag = "Authentication"
)]
pub async fn finish_passkey_registration(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<auth_models::PasskeyRegisterFinishRequest>,
) -> Result<Response, (StatusCode, Json<ApiErrorResponse>)> {
    let session_token = extract_auth_cookie_token(&headers);

    let session = state
        .passkeys()
        .finish_registration(
            &req.session_id,
            req.response,
            &req.name,
            session_token.as_deref(),
        )
        .await?;

    let mut response_headers = auth_cookie_headers(build_auth_cookie(
        &session.auth_token.token,
        session.auth_token.expires_at,
        &state.config,
    ));
    response_headers.insert(
        axum::http::header::CONTENT_TYPE,
        axum::http::HeaderValue::from_static("application/json"),
    );

    let body = serde_json::to_string(&auth_models::AuthResponse {
        user_id: session.user_id,
        email: session.email,
        expires_at: session.auth_token.expires_at.to_rfc3339(),
        onboarding_completed: session.onboarding_completed,
        demo_mode_active: session.demo_mode_active,
        requires_passkey_enrollment: session.requires_passkey_enrollment,
    })
    .map_err(|e| {
        tracing::error!("Failed to serialize auth response: {}", e);
        ApiErrorResponse::internal_server_error("Failed to serialize response")
    })?;

    Ok((
        StatusCode::OK,
        response_headers,
        axum::body::Body::from(body),
    )
        .into_response())
}

#[utoipa::path(
    get,
    path = "/api/auth/passkey",
    description = "List all enrolled passkeys for the authenticated user.",
    responses(
        (status = 200, description = "List of passkeys", body = Vec<auth_models::PasskeyItem>),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    tag = "Authentication"
)]
pub async fn list_user_passkeys(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<Vec<auth_models::PasskeyItem>>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .passkeys()
        .list_passkeys(auth_context.user_id)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    delete,
    path = "/api/auth/passkey/{id}",
    description = "Remove an enrolled passkey. Returns 409 if it is the last credential.",
    params(("id" = Uuid, Path, description = "Passkey ID")),
    responses(
        (status = 204, description = "Passkey removed"),
        (status = 404, description = "Passkey not found", body = ApiErrorResponse),
        (status = 409, description = "Cannot remove last passkey", body = ApiErrorResponse),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    tag = "Authentication"
)]
pub async fn delete_user_passkey(
    State(state): State<AppState>,
    auth_context: AuthContext,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .passkeys()
        .delete_passkey(auth_context.user_id, id)
        .await
        .map(|()| StatusCode::NO_CONTENT)
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/auth/passkey/login/begin",
    description = "Begin passkey authentication. Returns a challenge for any email; response shape is identical for unknown emails to prevent user enumeration.",
    request_body = auth_models::PasskeyLoginBeginRequest,
    responses(
        (status = 200, description = "Authentication challenge", body = auth_models::PasskeyLoginBeginResponse),
        (status = 429, description = "Too many requests", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    tag = "Authentication"
)]
pub async fn begin_passkey_login(
    State(state): State<AppState>,
    Json(req): Json<auth_models::PasskeyLoginBeginRequest>,
) -> Result<Json<auth_models::PasskeyLoginBeginResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .passkeys()
        .begin_login(&req.email)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/auth/passkey/login/finish",
    description = "Complete passkey authentication and receive an auth_token cookie.",
    request_body = auth_models::PasskeyLoginFinishRequest,
    responses(
        (status = 200, description = "Authentication successful", body = auth_models::AuthResponse),
        (status = 400, description = "Challenge not found, expired, or invalid response", body = ApiErrorResponse),
        (status = 401, description = "Authentication failed", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    tag = "Authentication"
)]
pub async fn finish_passkey_login(
    State(state): State<AppState>,
    Json(req): Json<auth_models::PasskeyLoginFinishRequest>,
) -> Result<(HeaderMap, Json<auth_models::AuthResponse>), (StatusCode, Json<ApiErrorResponse>)> {
    let session = state
        .passkeys()
        .finish_login(&req.session_id, req.response)
        .await?;

    Ok(authenticated_session_response(&state.config, session))
}
