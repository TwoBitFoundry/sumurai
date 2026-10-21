use anyhow::Error;
use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Json, Response},
};
use uuid::Uuid;

use crate::models::api_error::ApiErrorResponse;
use crate::models::app_state::AppState;
use crate::models::auth::AuthContext;
use crate::models::auto_categorization_job::AutoCategorizationJobState;
use crate::models::domain_error::DomainError;
use crate::services::auto_categorization::service::AutoCategorizationError;

const START_FAILED_MESSAGE: &str = "Failed to start auto-categorization";
const STATUS_FAILED_MESSAGE: &str = "Failed to fetch auto-categorization status";
const CANCEL_FAILED_MESSAGE: &str = "Failed to cancel auto-categorization";

pub(crate) fn start_failure(user_id: Uuid, error: AutoCategorizationError) -> DomainError {
    if let AutoCategorizationError::Storage(error) = error {
        tracing::error!(
            "Failed to start auto-categorization for user {}: {}",
            user_id,
            error
        );
    }
    DomainError::internal(START_FAILED_MESSAGE)
}

pub(crate) fn status_failure(user_id: Uuid, error: Error) -> DomainError {
    tracing::error!(
        "Failed to fetch auto-categorization status for user {}: {}",
        user_id,
        error
    );
    DomainError::internal(STATUS_FAILED_MESSAGE)
}

pub(crate) fn cancel_failure(user_id: Uuid, error: AutoCategorizationError) -> DomainError {
    match error {
        AutoCategorizationError::NoActiveJob => {
            DomainError::not_found("auto_categorization_job_not_found").with_error_name("not_found")
        }
        AutoCategorizationError::ActiveJobExists(_) => DomainError::internal(CANCEL_FAILED_MESSAGE),
        AutoCategorizationError::Storage(error) => {
            tracing::error!(
                "Failed to cancel auto-categorization for user {}: {}",
                user_id,
                error
            );
            DomainError::internal(CANCEL_FAILED_MESSAGE)
        }
    }
}

#[utoipa::path(
    post,
    path = "/api/transactions/auto-categorize",
    responses(
        (status = 200, description = "Background categorization started", body = AutoCategorizationJobState),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 409, description = "Active job already exists", body = AutoCategorizationJobState),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Transactions"
)]
pub async fn start_auto_categorization(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Response, (StatusCode, Json<ApiErrorResponse>)> {
    match state
        .auto_categorization_service
        .start(&auth_context.user_id, &auth_context.jwt_id)
        .await
    {
        Ok(job) => Ok((StatusCode::OK, Json(job)).into_response()),
        Err(AutoCategorizationError::ActiveJobExists(job)) => {
            Ok((StatusCode::CONFLICT, Json(job)).into_response())
        }
        Err(error) => Err(start_failure(auth_context.user_id, error).into()),
    }
}

#[utoipa::path(
    get,
    path = "/api/transactions/auto-categorize",
    responses(
        (status = 200, description = "Latest auto-categorization job status", body = AutoCategorizationJobState),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Transactions"
)]
pub async fn get_auto_categorization_status(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<Option<AutoCategorizationJobState>>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .auto_categorization_service
        .get_status(&auth_context.user_id)
        .await
        .map(Json)
        .map_err(|error| status_failure(auth_context.user_id, error).into())
}

#[utoipa::path(
    delete,
    path = "/api/transactions/auto-categorize",
    responses(
        (status = 200, description = "Cancellation requested for active job", body = AutoCategorizationJobState),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 404, description = "No active job to cancel", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Transactions"
)]
pub async fn cancel_auto_categorization(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<AutoCategorizationJobState>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .auto_categorization_service
        .cancel(&auth_context.user_id)
        .await
        .map(Json)
        .map_err(|error| cancel_failure(auth_context.user_id, error).into())
}
