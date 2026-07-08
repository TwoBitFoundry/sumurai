use axum::http::StatusCode;
use axum::response::Json;
use uuid::Uuid;

use crate::models::api_error::ApiErrorResponse;
use crate::models::app_state::AppState;
use crate::services::billing_service::OwnDataAccessCheck;

pub fn paid_access_required_response() -> (StatusCode, Json<ApiErrorResponse>) {
    ApiErrorResponse::with_code(
        "PAID_ACCESS_REQUIRED",
        "Paid access is required to use your own data in this deployment",
        "PAID_ACCESS_REQUIRED",
    )
    .into_response(StatusCode::PAYMENT_REQUIRED)
}

pub async fn require_paid_own_data_access(
    state: &AppState,
    user_id: Uuid,
    operation: &'static str,
) -> Result<(), (StatusCode, Json<ApiErrorResponse>)> {
    match state.billing_service.check_own_data_access(user_id).await {
        Ok(OwnDataAccessCheck::Allowed) => Ok(()),
        Ok(OwnDataAccessCheck::Denied { access_status }) => {
            tracing::warn!(
                user_id = %user_id,
                operation,
                access_status = access_status.as_str(),
                "Blocked own-data write without paid access"
            );
            Err(paid_access_required_response())
        }
        Err(error) => {
            tracing::error!(
                user_id = %user_id,
                operation,
                error = ?error,
                "Failed to load billing entitlement"
            );
            Err(ApiErrorResponse::internal_server_error(
                "Failed to check billing access",
            ))
        }
    }
}

pub async fn require_paid_own_data_access_after_demo(
    state: &AppState,
    user_id: Uuid,
    operation: &'static str,
) -> Result<(), (StatusCode, Json<ApiErrorResponse>)> {
    match state
        .billing_service
        .check_own_data_access_after_demo(user_id)
        .await
    {
        Ok(OwnDataAccessCheck::Allowed) => Ok(()),
        Ok(OwnDataAccessCheck::Denied { access_status }) => {
            tracing::warn!(
                user_id = %user_id,
                operation,
                access_status = access_status.as_str(),
                "Blocked own-data write without paid access"
            );
            Err(paid_access_required_response())
        }
        Err(error) => {
            tracing::error!(
                user_id = %user_id,
                operation,
                error = ?error,
                "Failed to check billing access"
            );
            Err(ApiErrorResponse::internal_server_error(
                "Failed to check billing access",
            ))
        }
    }
}
