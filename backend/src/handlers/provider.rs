use axum::{
    http::{
        header::{CONTENT_TYPE, RETRY_AFTER},
        StatusCode,
    },
    response::{IntoResponse, Json, Response},
};
use uuid::Uuid;

use crate::models::api_error::ApiErrorResponse;
use crate::services::connection_service::ProviderSyncError;
use crate::services::provider_orchestrator::ProviderOrchestrationError;

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

impl From<ProviderOrchestrationError> for Response {
    fn from(error: ProviderOrchestrationError) -> Self {
        match error {
            ProviderOrchestrationError::SyncQuotaLimited { retry_after_secs } => {
                sync_quota_rate_limited_response(retry_after_secs)
            }
            ProviderOrchestrationError::InvalidSyncClientInput
            | ProviderOrchestrationError::UnsupportedSyncProvider => {
                StatusCode::BAD_REQUEST.into_response()
            }
            ProviderOrchestrationError::SyncQuotaCheckFailed => {
                StatusCode::INTERNAL_SERVER_ERROR.into_response()
            }
            ProviderOrchestrationError::SyncFailed {
                error,
                user_id,
                item_id,
            } => provider_sync_error_to_response(error, user_id, &item_id),
            other => <(StatusCode, Json<ApiErrorResponse>)>::from(other).into_response(),
        }
    }
}

impl From<ProviderOrchestrationError> for StatusCode {
    fn from(error: ProviderOrchestrationError) -> Self {
        match error {
            ProviderOrchestrationError::InvalidSyncClientInput
            | ProviderOrchestrationError::UnsupportedSyncProvider
            | ProviderOrchestrationError::UnsupportedConnectProvider
            | ProviderOrchestrationError::SetupTokenMissing
            | ProviderOrchestrationError::SetupTokenMalformed
            | ProviderOrchestrationError::ProviderNotRegistered(_)
            | ProviderOrchestrationError::InvalidOrgConnId => StatusCode::BAD_REQUEST,
            ProviderOrchestrationError::ProviderDisabled(_) => StatusCode::FORBIDDEN,
            ProviderOrchestrationError::UserNotFound
            | ProviderOrchestrationError::ConnectionNotFound => StatusCode::NOT_FOUND,
            ProviderOrchestrationError::ActiveConnectionConflict { .. } => StatusCode::CONFLICT,
            ProviderOrchestrationError::SyncQuotaLimited { .. } => StatusCode::TOO_MANY_REQUESTS,
            ProviderOrchestrationError::SetupTokenAlreadyClaimed
            | ProviderOrchestrationError::SetupTokenClaimFailed
            | ProviderOrchestrationError::NoInstitutionsOnBridge
            | ProviderOrchestrationError::AllInstitutionsHidden
            | ProviderOrchestrationError::NoInstitutionsLinked
            | ProviderOrchestrationError::InstitutionsRequireAuth(_) => {
                StatusCode::UNPROCESSABLE_ENTITY
            }
            ProviderOrchestrationError::SnapshotFetchFailed => StatusCode::FAILED_DEPENDENCY,
            ProviderOrchestrationError::SyncQuotaCheckFailed
            | ProviderOrchestrationError::SyncFailed { .. }
            | ProviderOrchestrationError::CredentialStorageFailed
            | ProviderOrchestrationError::ConnectionPersistenceFailed
            | ProviderOrchestrationError::LoadUserFailed
            | ProviderOrchestrationError::SelectionUserMissing
            | ProviderOrchestrationError::LoadConnectionsFailed
            | ProviderOrchestrationError::UpdateProviderFailed
            | ProviderOrchestrationError::DisconnectFailed
            | ProviderOrchestrationError::ListIgnoredInstitutionsFailed
            | ProviderOrchestrationError::RestoreIgnoredInstitutionFailed => {
                StatusCode::INTERNAL_SERVER_ERROR
            }
        }
    }
}

impl From<ProviderOrchestrationError> for (StatusCode, Json<ApiErrorResponse>) {
    fn from(error: ProviderOrchestrationError) -> Self {
        match error {
            ProviderOrchestrationError::UnsupportedConnectProvider => {
                ApiErrorResponse::new("BAD_REQUEST", "Unsupported provider")
                    .into_response(StatusCode::BAD_REQUEST)
            }
            ProviderOrchestrationError::SetupTokenMissing => ApiErrorResponse::new(
                "BAD_REQUEST",
                "Provide a SimpleFIN setup token to connect this account",
            )
            .into_response(StatusCode::BAD_REQUEST),
            ProviderOrchestrationError::SetupTokenMalformed => {
                ApiErrorResponse::new("BAD_REQUEST", "The SimpleFIN setup token is malformed")
                    .into_response(StatusCode::BAD_REQUEST)
            }
            ProviderOrchestrationError::SetupTokenAlreadyClaimed => ApiErrorResponse::new(
                "SETUP_TOKEN_ALREADY_CLAIMED",
                "This SimpleFIN setup token has already been used",
            )
            .into_response(StatusCode::UNPROCESSABLE_ENTITY),
            ProviderOrchestrationError::SetupTokenClaimFailed => ApiErrorResponse::new(
                "SETUP_TOKEN_CLAIM_FAILED",
                "Could not claim the SimpleFIN setup token",
            )
            .into_response(StatusCode::UNPROCESSABLE_ENTITY),
            ProviderOrchestrationError::CredentialStorageFailed => {
                ApiErrorResponse::internal_server_error("Failed to store credentials")
            }
            ProviderOrchestrationError::SnapshotFetchFailed => {
                ApiErrorResponse::new("FAILED_DEPENDENCY", "SimpleFIN provider request failed")
                    .into_response(StatusCode::FAILED_DEPENDENCY)
            }
            ProviderOrchestrationError::ConnectionPersistenceFailed => {
                ApiErrorResponse::internal_server_error("Failed to save connection")
            }
            ProviderOrchestrationError::NoInstitutionsOnBridge => ApiErrorResponse::new(
                "NO_INSTITUTIONS",
                "No institutions are available from your SimpleFIN bridge yet",
            )
            .into_response(StatusCode::UNPROCESSABLE_ENTITY),
            ProviderOrchestrationError::AllInstitutionsHidden => ApiErrorResponse::new(
                "ALL_INSTITUTIONS_HIDDEN",
                "All SimpleFIN institutions are hidden in Sumurai. Restore one to start syncing.",
            )
            .into_response(StatusCode::UNPROCESSABLE_ENTITY),
            ProviderOrchestrationError::NoInstitutionsLinked => ApiErrorResponse::new(
                "NO_INSTITUTIONS",
                "No SimpleFIN institutions could be linked. Try again or check your bridge setup.",
            )
            .into_response(StatusCode::UNPROCESSABLE_ENTITY),
            ProviderOrchestrationError::InstitutionsRequireAuth(notices) => {
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
            ProviderOrchestrationError::ProviderNotRegistered(provider) => ApiErrorResponse::new(
                "BAD_REQUEST",
                &format!("Provider '{}' is not registered", provider),
            )
            .into_response(StatusCode::BAD_REQUEST),
            ProviderOrchestrationError::ProviderDisabled(provider) => {
                provider_disabled_response(&provider)
            }
            ProviderOrchestrationError::SelectionUserMissing => {
                ApiErrorResponse::internal_server_error("User not found")
            }
            ProviderOrchestrationError::LoadUserFailed => {
                ApiErrorResponse::internal_server_error("Failed to fetch user")
            }
            ProviderOrchestrationError::LoadConnectionsFailed => {
                ApiErrorResponse::internal_server_error("Failed to check active connections")
            }
            ProviderOrchestrationError::ActiveConnectionConflict {
                conflicting_provider,
            } => ApiErrorResponse::new(
                "CONFLICT",
                &format!(
                    "Disconnect all {} accounts before switching",
                    conflicting_provider
                ),
            )
            .into_response(StatusCode::CONFLICT),
            ProviderOrchestrationError::UpdateProviderFailed => {
                ApiErrorResponse::internal_server_error("Failed to update provider selection")
            }
            other => {
                let status = StatusCode::from(other);
                ApiErrorResponse::new("PROVIDER_ERROR", "Provider request failed")
                    .into_response(status)
            }
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
