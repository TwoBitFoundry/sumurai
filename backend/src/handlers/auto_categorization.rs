use axum::{http::StatusCode, response::Json};

use crate::models::api_error::ApiErrorResponse;
use crate::services::auto_categorization_orchestrator::AutoCategorizationOrchestrationError;

impl From<AutoCategorizationOrchestrationError> for (StatusCode, Json<ApiErrorResponse>) {
    fn from(error: AutoCategorizationOrchestrationError) -> Self {
        match error {
            AutoCategorizationOrchestrationError::ActiveJobExists(_)
            | AutoCategorizationOrchestrationError::StartFailed => {
                ApiErrorResponse::internal_server_error("Failed to start auto-categorization")
            }
            AutoCategorizationOrchestrationError::StatusFailed => {
                ApiErrorResponse::internal_server_error(
                    "Failed to fetch auto-categorization status",
                )
            }
            AutoCategorizationOrchestrationError::NoActiveJob => {
                ApiErrorResponse::new("not_found", "auto_categorization_job_not_found")
                    .into_response(StatusCode::NOT_FOUND)
            }
            AutoCategorizationOrchestrationError::CancelFailed => {
                ApiErrorResponse::internal_server_error("Failed to cancel auto-categorization")
            }
        }
    }
}
