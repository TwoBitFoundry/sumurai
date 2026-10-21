use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use uuid::Uuid;

use crate::handlers::provider::provider_disabled_response;
use crate::models::api_error::ApiErrorResponse;
use crate::models::app_state::AppState;
use crate::models::auth::AuthContext;
use crate::models::diy::{
    CreateDiyAccountRequest, CreateDiyAccountResponse, CreateDiyInstitutionRequest,
    CreateDiyInstitutionResponse,
};
use crate::models::plaid::DisconnectResult;

#[utoipa::path(
    post,
    path = "/api/diy/institutions",
    description = "Creates a new DIY institution (provider_connection with provider='diy') for the authenticated user.",
    request_body = CreateDiyInstitutionRequest,
    responses(
        (status = 200, description = "Institution created successfully", body = CreateDiyInstitutionResponse),
        (status = 400, description = "Invalid request body", body = ApiErrorResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "DIY Provider"
)]
pub async fn create_diy_institution(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<CreateDiyInstitutionRequest>,
) -> Result<Json<CreateDiyInstitutionResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    if !state.config.is_financial_provider_enabled("diy") {
        return Err(provider_disabled_response("diy"));
    }

    state
        .diy()
        .create_institution(auth_context.user_id, &auth_context.jwt_id, &req.name)
        .await
        .map(|connection| {
            Json(CreateDiyInstitutionResponse {
                connection_id: connection.id,
            })
        })
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/diy/institutions/{connection_id}/accounts",
    description = "Creates a new account under a DIY institution owned by the authenticated user.",
    params(
        ("connection_id" = Uuid, Path, description = "DIY institution connection ID")
    ),
    request_body = CreateDiyAccountRequest,
    responses(
        (status = 200, description = "Account created successfully", body = CreateDiyAccountResponse),
        (status = 400, description = "Invalid account type or empty name", body = ApiErrorResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Connection is not a DIY connection", body = ApiErrorResponse),
        (status = 404, description = "Connection not found", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "DIY Provider"
)]
pub async fn create_diy_account(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Path(connection_id): axum::extract::Path<Uuid>,
    Json(req): Json<CreateDiyAccountRequest>,
) -> Result<Json<CreateDiyAccountResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    if !state.config.is_financial_provider_enabled("diy") {
        return Err(provider_disabled_response("diy"));
    }

    state
        .diy()
        .create_account(auth_context.user_id, connection_id, &req)
        .await
        .map(|account| {
            Json(CreateDiyAccountResponse {
                id: account.id,
                name: account.name,
                account_type: account.account_type,
            })
        })
        .map_err(Into::into)
}

#[utoipa::path(
    delete,
    path = "/api/diy/institutions/{connection_id}",
    description = "Removes a DIY institution and cascades deletion of its accounts, transactions, and related cache entries.",
    params(
        ("connection_id" = Uuid, Path, description = "DIY institution connection ID")
    ),
    responses(
        (status = 200, description = "Institution removed successfully", body = DisconnectResult),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Connection is not a DIY institution", body = ApiErrorResponse),
        (status = 404, description = "Institution not found", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "DIY Provider"
)]
pub async fn disconnect_diy_institution(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Path(connection_id): axum::extract::Path<Uuid>,
) -> Result<Json<DisconnectResult>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .diy()
        .disconnect(auth_context.user_id, &auth_context.jwt_id, connection_id)
        .await
        .map(Json)
        .map_err(Into::into)
}
