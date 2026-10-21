use axum::{
    extract::State,
    http::{
        header::{CONTENT_TYPE, RETRY_AFTER},
        StatusCode,
    },
    response::{IntoResponse, Json, Response},
};
use chrono::NaiveDate;
use uuid::Uuid;

use crate::middleware::resource_authorization::AuthorizedConnectionRequest;
use crate::models::api_error::ApiErrorResponse;
use crate::models::app_state::AppState;
use crate::models::auth::AuthContext;
use crate::models::plaid::{
    DisconnectRequest, DisconnectResult, ProviderConnectResponse, ProviderInfoResponse,
    ProviderSelectRequest, ProviderSelectResponse, ProviderStatusResponse, SyncTransactionsRequest,
};
use crate::models::provider_connect::{ProviderConnectRequest, ProviderSyncRequest};
use crate::models::transaction::SyncTransactionsResponse;
use crate::services::connection_service::ProviderSyncError;
use crate::services::provider_orchestrator::{
    ProviderConnectOrchestrationError, ProviderSyncOrchestrationError,
};

pub fn provider_disabled_response(provider: &str) -> (StatusCode, Json<ApiErrorResponse>) {
    ApiErrorResponse::with_code(
        "FORBIDDEN",
        &format!("Provider '{}' is disabled in this deployment", provider),
        "PROVIDER_DISABLED",
    )
    .into_response(StatusCode::FORBIDDEN)
}

fn sync_quota_rate_limited_response(retry_after_secs: u64) -> Response {
    let payload = ApiErrorResponse::with_code(
        "TOO_MANY_REQUESTS",
        "Daily sync limit reached (24 per day). Try again tomorrow.",
        "RATE_LIMITED",
    );
    let body = serde_json::to_vec(&payload).unwrap_or_else(|_| b"{}".to_vec());

    Response::builder()
        .status(StatusCode::TOO_MANY_REQUESTS)
        .header(CONTENT_TYPE, "application/json")
        .header(RETRY_AFTER, retry_after_secs.to_string())
        .body(axum::body::Body::from(body))
        .unwrap_or_else(|_| Response::new(axum::body::Body::empty()))
}

impl From<ProviderSyncOrchestrationError> for Response {
    fn from(error: ProviderSyncOrchestrationError) -> Self {
        match error {
            ProviderSyncOrchestrationError::SyncQuotaLimited { retry_after_secs } => {
                sync_quota_rate_limited_response(retry_after_secs)
            }
            ProviderSyncOrchestrationError::SyncFailed {
                error,
                user_id,
                item_id,
            } => provider_sync_error_to_response(error, user_id, &item_id),
            ProviderSyncOrchestrationError::Domain(error) => {
                StatusCode::from(error).into_response()
            }
        }
    }
}

impl From<ProviderConnectOrchestrationError> for (StatusCode, Json<ApiErrorResponse>) {
    fn from(error: ProviderConnectOrchestrationError) -> Self {
        match error {
            ProviderConnectOrchestrationError::InstitutionsRequireAuth(notices) => {
                let message = if notices.len() == 1 {
                    format!(
                        "{} needs to be re-authenticated in your SimpleFIN dashboard before it can sync.",
                        notices[0].institution_name
                    )
                } else {
                    "Some SimpleFIN institutions need to be re-authenticated in your SimpleFIN dashboard before they can sync.".to_string()
                };
                ApiErrorResponse {
                    error: "SIMPLEFIN_INSTITUTIONS_REQUIRE_AUTH".to_string(),
                    message,
                    code: Some("SIMPLEFIN_AUTH_REQUIRED".to_string()),
                    details: serde_json::to_value(notices).ok(),
                    status_code: None,
                    reason: None,
                    trace_id: None,
                }
                .into_response(StatusCode::UNPROCESSABLE_ENTITY)
            }
            ProviderConnectOrchestrationError::Domain(error) => error.into(),
        }
    }
}

fn provider_sync_error_json_response(
    status: StatusCode,
    error: &str,
    message: &str,
    retry_after_secs: Option<String>,
    code: Option<&str>,
) -> Response {
    let body = match code {
        Some(code) => Json(ApiErrorResponse::with_code(error, message, code)),
        None => Json(ApiErrorResponse::new(error, message)),
    };
    match retry_after_secs {
        Some(retry_after) => (status, [(RETRY_AFTER, retry_after)], body).into_response(),
        None => (status, body).into_response(),
    }
}

fn provider_sync_error_to_response(
    err: ProviderSyncError,
    user_id: Uuid,
    item_id: &str,
) -> Response {
    match err {
        ProviderSyncError::RateLimited {
            message,
            retry_after_secs,
        } => {
            tracing::info!(
                "Provider sync rate-limited for user {} and item {}",
                user_id,
                item_id
            );
            provider_sync_error_json_response(
                StatusCode::TOO_MANY_REQUESTS,
                "RATE_LIMITED",
                &message,
                Some(retry_after_secs),
                None,
            )
        }
        ProviderSyncError::CredentialsMissing => {
            tracing::error!(
                "Sync transactions: no credentials for user {} and item {}",
                user_id,
                item_id
            );
            provider_sync_error_json_response(
                StatusCode::NOT_FOUND,
                "NOT_FOUND",
                "This institution is linked in Sumurai but provider credentials are missing. Reconnect your financial provider from Accounts.",
                None,
                Some("PROVIDER_CREDENTIALS_MISSING"),
            )
        }
        ProviderSyncError::CredentialAccess(e) => {
            tracing::error!(
                "Sync transactions: failed to access credentials for user {} and item {}: {}",
                user_id,
                item_id,
                e
            );
            provider_sync_error_json_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_SERVER_ERROR",
                "Could not access provider credentials for this connection",
                None,
                None,
            )
        }
        ProviderSyncError::ProviderUnavailable(p) => {
            tracing::error!(
                "Sync transactions: provider '{}' unavailable for user {}",
                p,
                user_id
            );
            provider_sync_error_json_response(
                StatusCode::BAD_REQUEST,
                "BAD_REQUEST",
                "This provider is not available for sync",
                None,
                None,
            )
        }
        ProviderSyncError::ProviderRequest(e) => {
            tracing::error!(
                "Provider request failed during sync for user {} and item {}: {}",
                user_id,
                item_id,
                e
            );
            provider_sync_error_json_response(
                StatusCode::FAILED_DEPENDENCY,
                "FAILED_DEPENDENCY",
                "The financial provider request failed. Try again in a few minutes.",
                None,
                None,
            )
        }
        ProviderSyncError::AccountLookup(e) => {
            tracing::error!(
                "Failed to load accounts during sync for user {} and item {}: {}",
                user_id,
                item_id,
                e
            );
            provider_sync_error_json_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_SERVER_ERROR",
                "Could not load accounts for this connection",
                None,
                None,
            )
        }
        ProviderSyncError::TransactionLookup(e) => {
            tracing::error!(
                "Failed to load transactions during sync for user {} and item {}: {}",
                user_id,
                item_id,
                e
            );
            provider_sync_error_json_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_SERVER_ERROR",
                "Could not load transactions for this connection",
                None,
                None,
            )
        }
        ProviderSyncError::SyncFailure(e) => {
            tracing::error!(
                "Sync service failed for user {} and item {}: {}",
                user_id,
                item_id,
                e
            );
            provider_sync_error_json_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_SERVER_ERROR",
                "Sync failed unexpectedly. Try again.",
                None,
                None,
            )
        }
    }
}

#[utoipa::path(
    post,
    path = "/api/providers/sync-transactions",
    description = "Kicks off a provider sync to pull the latest transactions.",
    request_body = SyncTransactionsRequest,
    responses(
        (status = 200, description = "Transactions synced successfully", body = SyncTransactionsResponse),
        (status = 400, description = "Missing connection_id"),
        (status = 401, description = "Unauthorized"),
        (status = 415, description = "Unsupported media type"),
        (status = 404, description = "Connection not found or credentials missing"),
        (status = 424, description = "Provider request failed"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Financial Providers"
)]
pub async fn sync_authenticated_provider_transactions(
    State(state): State<AppState>,
    auth_context: AuthContext,
    req: AuthorizedConnectionRequest<SyncTransactionsRequest>,
) -> Result<Json<SyncTransactionsResponse>, Response> {
    let user_id = auth_context.user_id;
    let AuthorizedConnectionRequest {
        _body: request_body,
        connection,
    } = req;

    tracing::info!(
        user_id = %user_id,
        connection_id = %connection.id,
        item_id = %connection.item_id,
        "Sync transactions requested"
    );

    let reference_date = NaiveDate::parse_from_str(&request_body.client_date, "%Y-%m-%d")
        .map_err(|_| StatusCode::BAD_REQUEST.into_response())?;

    let provider = connection.provider.clone();
    if !state.config.is_financial_provider_enabled(&provider) {
        return Err(provider_disabled_response(&provider).into_response());
    }

    state
        .providers()
        .sync_transactions(
            user_id,
            &auth_context.jwt_id,
            connection,
            ProviderSyncRequest {
                client_date: request_body.client_date,
                client_timezone: request_body.client_timezone,
                reference_date,
            },
        )
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/providers/connect",
    description = "Completes provider connect enrollment and stores provider credentials for the user.",
    request_body = ProviderConnectRequest,
    responses(
        (status = 200, description = "Provider connected successfully", body = ProviderConnectResponse),
        (status = 400, description = "Unsupported provider"),
        (status = 401, description = "Unauthorized"),
        (status = 424, description = "Provider request failed", body = ApiErrorResponse),
        (status = 500, description = "Failed to connect provider", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Financial Providers"
)]
pub async fn connect_authenticated_provider(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<ProviderConnectRequest>,
) -> Result<Json<ProviderConnectResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    if state.provider_registry.get(&req.provider).is_some()
        && !state.config.is_financial_provider_enabled(&req.provider)
    {
        return Err(provider_disabled_response(&req.provider));
    }

    state
        .providers()
        .connect(auth_context.user_id, &auth_context.jwt_id, &req)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    get,
    path = "/api/providers/status",
    description = "Summarizes connection status, sync metrics, and active institutions for the selected provider.",
    responses(
        (status = 200, description = "Provider connection status and statistics", body = ProviderStatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Financial Providers"
)]
pub async fn get_authenticated_provider_status(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<ProviderStatusResponse>, StatusCode> {
    state
        .providers()
        .status(auth_context.user_id)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    get,
    path = "/api/providers/info",
    description = "Describes available providers and the caller's current selection.",
    responses(
        (status = 200, description = "Available providers and current user provider configuration", body = ProviderInfoResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "User not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Financial Providers"
)]
pub async fn get_authenticated_provider_info(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<ProviderInfoResponse>, StatusCode> {
    state
        .providers()
        .info(auth_context.user_id)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/providers/select",
    description = "Persists a provider switch for the authenticated user.",
    request_body = ProviderSelectRequest,
    responses(
        (status = 200, description = "Provider selected successfully", body = ProviderSelectResponse),
        (status = 400, description = "Invalid provider specified", body = ApiErrorResponse),
        (status = 401, description = "Unauthorized"),
        (status = 409, description = "Cannot switch while active connections exist", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Financial Providers"
)]
pub async fn select_authenticated_provider(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<ProviderSelectRequest>,
) -> Result<Json<ProviderSelectResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .providers()
        .select(auth_context.user_id, req.provider)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/providers/disconnect",
    description = "Disconnects a provider connection and clears related cached artifacts.",
    request_body = DisconnectRequest,
    responses(
        (status = 200, description = "Provider connection disconnected", body = DisconnectResult),
        (status = 400, description = "Invalid connection_id format"),
        (status = 401, description = "Unauthorized"),
        (status = 415, description = "Unsupported media type"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Financial Providers"
)]
pub async fn disconnect_authenticated_connection(
    State(state): State<AppState>,
    auth_context: AuthContext,
    req: AuthorizedConnectionRequest<DisconnectRequest>,
) -> Result<Json<DisconnectResult>, StatusCode> {
    state
        .providers()
        .disconnect(auth_context.user_id, &auth_context.jwt_id, &req.connection)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    get,
    path = "/api/providers/simplefin/ignored-institutions",
    description = "Lists SimpleFIN bridge institutions the user has hidden in Sumurai.",
    responses(
        (status = 200, description = "Ignored institutions", body = crate::models::simplefin::SimpleFinIgnoredInstitutionsResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Financial Providers"
)]
pub async fn get_authenticated_simplefin_ignored_institutions(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<crate::models::simplefin::SimpleFinIgnoredInstitutionsResponse>, StatusCode> {
    if !state.config.is_financial_provider_enabled("simplefin") {
        return Err(StatusCode::FORBIDDEN);
    }

    state
        .providers()
        .list_simplefin_ignored_institutions(auth_context.user_id)
        .await
        .map(|institutions| {
            Json(crate::models::simplefin::SimpleFinIgnoredInstitutionsResponse { institutions })
        })
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/providers/simplefin/ignored-institutions",
    description = "Removes a SimpleFIN institution from the ignore list so connect/sync can import it again. Idempotent: returns 200 even if the institution was not on the ignore list.",
    request_body = crate::models::simplefin::SimpleFinRestoreIgnoredInstitutionRequest,
    responses(
        (status = 200, description = "Institution restored (or was already not ignored)", body = crate::models::simplefin::SimpleFinRestoreIgnoredInstitutionResponse),
        (status = 400, description = "Invalid request"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Financial Providers"
)]
pub async fn restore_authenticated_simplefin_ignored_institution(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<crate::models::simplefin::SimpleFinRestoreIgnoredInstitutionRequest>,
) -> Result<Json<crate::models::simplefin::SimpleFinRestoreIgnoredInstitutionResponse>, StatusCode>
{
    if !state.config.is_financial_provider_enabled("simplefin") {
        return Err(StatusCode::FORBIDDEN);
    }

    state
        .providers()
        .restore_simplefin_ignored_institution(auth_context.user_id, &req.org_conn_id)
        .await
        .map(|restored| {
            Json(crate::models::simplefin::SimpleFinRestoreIgnoredInstitutionResponse { restored })
        })
        .map_err(Into::into)
}
