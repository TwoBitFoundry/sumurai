#[cfg(feature = "dev-seed")]
use axum::response::IntoResponse;
use axum::{
    extract::State,
    http::{header::SET_COOKIE, HeaderMap, HeaderValue, StatusCode},
    response::{Json, Response},
};

use crate::auth_middleware::extract_auth_cookie_token;
use crate::config::Config;
use crate::models::api_error::ApiErrorResponse;
use crate::models::app_state::AppState;
use crate::models::auth as auth_models;
use crate::models::auth::{
    AuthContext, DeleteAccountResponse, LogoutResponse, OnboardingCompleteResponse,
};
use crate::utils::auth_cookie::{build_auth_cookie, build_clearing_auth_cookie};

pub(crate) fn auth_cookie_headers(cookie: String) -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(
        SET_COOKIE,
        HeaderValue::from_str(&cookie).expect("valid auth cookie header"),
    );
    headers
}

pub(crate) fn authenticated_session_response(
    config: &Config,
    session: auth_models::AuthenticatedSession,
) -> (HeaderMap, Json<auth_models::AuthResponse>) {
    (
        auth_cookie_headers(build_auth_cookie(
            &session.auth_token.token,
            session.auth_token.expires_at,
            config,
        )),
        Json(auth_models::AuthResponse {
            user_id: session.user_id,
            email: session.email,
            expires_at: session.auth_token.expires_at.to_rfc3339(),
            onboarding_completed: session.onboarding_completed,
            demo_mode_active: session.demo_mode_active,
            requires_passkey_enrollment: session.requires_passkey_enrollment,
        }),
    )
}

#[utoipa::path(
    post,
    path = "/api/auth/register",
    description = "Creates a new user and begins passkey enrollment. No auth cookie is issued until passkey registration completes.",
    request_body = auth_models::RegisterRequest,
    responses(
        (status = 200, description = "Registration challenge issued", body = auth_models::RegisterBeginResponse),
        (status = 400, description = "Invalid request body", body = ApiErrorResponse),
        (status = 409, description = "Email already registered", body = ApiErrorResponse),
        (status = 429, description = "Too many requests", body = ApiErrorResponse),
        (status = 403, description = "IP temporarily banned after repeated abuse", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    tag = "Authentication"
)]
pub async fn register_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<auth_models::RegisterRequest>,
) -> Result<Response, (StatusCode, Json<ApiErrorResponse>)> {
    #[cfg(feature = "dev-seed")]
    {
        let _ = headers;
        let password = req
            .password
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                ApiErrorResponse::bad_request("Password is required to register in development")
            })?;
        let email = req.email.trim().to_lowercase();
        return Ok(
            register_user_with_password(state, email, password.to_string())
                .await?
                .into_response(),
        );
    }

    #[cfg(not(feature = "dev-seed"))]
    {
        crate::handlers::passkey::register_user_with_passkey(state, headers, req).await
    }
}

#[cfg(feature = "dev-seed")]
async fn register_user_with_password(
    state: AppState,
    email: String,
    password: String,
) -> Result<(HeaderMap, Json<auth_models::AuthResponse>), (StatusCode, Json<ApiErrorResponse>)> {
    let session = state.auth().register_with_password(email, password).await?;

    Ok(authenticated_session_response(&state.config, session))
}

#[utoipa::path(
    post,
    path = "/api/auth/logout",
    description = "Invalidates the active JWT and clears cached session state.",
    responses(
        (status = 200, description = "Logout successful", body = LogoutResponse),
        (status = 401, description = "Unauthorized")
    ),
    security(("auth_cookie" = [])),
    tag = "Authentication"
)]
pub async fn logout_user(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<(HeaderMap, Json<LogoutResponse>), StatusCode> {
    let auth_header = extract_auth_cookie_token(&headers).ok_or(StatusCode::UNAUTHORIZED)?;

    let cleared_session = state.auth().logout(&auth_header).await?;

    Ok((
        auth_cookie_headers(build_clearing_auth_cookie(&state.config)),
        Json(LogoutResponse {
            message: "Logged out successfully".to_string(),
            cleared_session,
        }),
    ))
}

#[utoipa::path(
    post,
    path = "/api/auth/refresh",
    description = "Refreshes the auth_token HttpOnly cookie.",
    responses(
        (status = 200, description = "Session refreshed successfully", body = auth_models::AuthResponse),
        (status = 401, description = "Unauthorized or session expired"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Authentication"
)]
pub async fn refresh_user_session(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<(HeaderMap, Json<auth_models::AuthResponse>), StatusCode> {
    let auth_header = extract_auth_cookie_token(&headers).ok_or(StatusCode::UNAUTHORIZED)?;

    let session = state.auth().refresh_session(&auth_header).await?;

    Ok(authenticated_session_response(&state.config, session))
}

#[utoipa::path(
    put,
    path = "/api/auth/onboarding/complete",
    description = "Marks onboarding complete and refreshes user metadata.",
    responses(
        (status = 200, description = "Onboarding completed", body = OnboardingCompleteResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Authentication"
)]
pub async fn complete_user_onboarding(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<OnboardingCompleteResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .auth()
        .complete_onboarding(auth_context.user_id)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/auth/onboarding/demo",
    description = "Seeds the shared demo workspace for the authenticated user and marks onboarding complete.",
    responses(
        (status = 200, description = "Demo mode activated", body = OnboardingCompleteResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Authentication"
)]
pub async fn activate_demo_mode_onboarding(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<OnboardingCompleteResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .auth()
        .activate_demo_mode(auth_context.user_id)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    delete,
    path = "/api/auth/account",
    description = "Deletes the authenticated user's account and associated provider data.",
    responses(
        (status = 200, description = "Account deleted successfully", body = DeleteAccountResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Authentication"
)]
pub async fn delete_user_account(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<auth_models::DeleteAccountResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .auth()
        .delete_account(auth_context.user_id, &auth_context.jwt_id)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/auth/login/password",
    description = "Sign in with email and password when the account has no enrolled passkey. Returns the same auth_token cookie as passkey login. Rejected when a passkey exists or the password does not match.",
    request_body = auth_models::PasswordLoginRequest,
    responses(
        (status = 200, description = "Authentication successful", body = auth_models::AuthResponse),
        (status = 401, description = "Invalid credentials", body = ApiErrorResponse),
        (status = 429, description = "Too many requests", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    tag = "Authentication"
)]
pub async fn login_with_password(
    State(state): State<AppState>,
    Json(req): Json<auth_models::PasswordLoginRequest>,
) -> Result<(HeaderMap, Json<auth_models::AuthResponse>), (StatusCode, Json<ApiErrorResponse>)> {
    let session = state
        .auth()
        .login_with_password(&req.email, &req.password)
        .await?;

    Ok(authenticated_session_response(&state.config, session))
}
