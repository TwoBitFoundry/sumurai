use axum::{extract::State, http::StatusCode, response::Json};

use crate::handlers::provider::provider_disabled_response;
use crate::models::account::AccountResponse;
use crate::models::api_error::ApiErrorResponse;
use crate::models::app_state::AppState;
use crate::models::auth::AuthContext;
use crate::models::plaid::{
    ClearSyncedDataResponse, ExchangeTokenRequest, ExchangeTokenResponse, LinkTokenRequest,
    LinkTokenResponse,
};

#[utoipa::path(
    post,
    path = "/api/plaid/link-token",
    description = "Generates a provider-specific link token for Plaid flows.",
    request_body = LinkTokenRequest,
    responses(
        (status = 200, description = "Link token created successfully", body = LinkTokenResponse),
        (status = 400, description = "Unsupported provider"),
        (status = 401, description = "Unauthorized"),
        (status = 424, description = "Provider request failed", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Plaid"
)]
pub async fn create_authenticated_link_token(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(_req): Json<LinkTokenRequest>,
) -> Result<Json<LinkTokenResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    let provider = "plaid";
    if !state.config.is_financial_provider_enabled(provider) {
        return Err(provider_disabled_response(provider));
    }

    state
        .plaid()
        .create_link_token(auth_context.user_id)
        .await
        .map(|link_token| Json(LinkTokenResponse { link_token }))
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/plaid/exchange-token",
    description = "Exchanges a Plaid public token for a persisted access token.",
    request_body = ExchangeTokenRequest,
    responses(
        (status = 200, description = "Token exchanged successfully", body = ExchangeTokenResponse),
        (status = 400, description = "Unsupported provider"),
        (status = 401, description = "Unauthorized"),
        (status = 424, description = "Token exchange failed with provider"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Plaid"
)]
pub async fn exchange_authenticated_public_token(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<ExchangeTokenRequest>,
) -> Result<Json<ExchangeTokenResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    let provider = "plaid";
    if !state.config.is_financial_provider_enabled(provider) {
        return Err(provider_disabled_response(provider));
    }

    state
        .plaid()
        .exchange_public_token(
            auth_context.user_id,
            &auth_context.jwt_id,
            &req.public_token,
        )
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    get,
    path = "/api/plaid/accounts",
    description = "Lists linked accounts with transaction counts for the user.",
    responses(
        (status = 200, description = "List of user accounts with transaction counts", body = Vec<AccountResponse>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Plaid"
)]
pub async fn get_authenticated_plaid_accounts(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<Vec<AccountResponse>>, StatusCode> {
    state
        .plaid()
        .list_accounts(auth_context.user_id)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/plaid/clear-synced-data",
    description = "Clears cached transactions for the calling user's session.",
    responses(
        (status = 200, description = "Synced data cleared successfully", body = ClearSyncedDataResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Plaid"
)]
pub async fn clear_authenticated_synced_data(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<ClearSyncedDataResponse>, StatusCode> {
    state
        .plaid()
        .clear_synced_data(auth_context.user_id, &auth_context.jwt_id)
        .await
        .map(Json)
        .map_err(Into::into)
}
