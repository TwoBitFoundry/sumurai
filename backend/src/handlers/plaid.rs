use axum::{http::StatusCode, response::Json};

use crate::models::api_error::ApiErrorResponse;
use crate::services::plaid_orchestrator::PlaidOrchestrationError;

impl From<PlaidOrchestrationError> for StatusCode {
    fn from(_: PlaidOrchestrationError) -> Self {
        StatusCode::INTERNAL_SERVER_ERROR
    }
}

impl From<PlaidOrchestrationError> for (StatusCode, Json<ApiErrorResponse>) {
    fn from(error: PlaidOrchestrationError) -> Self {
        match error {
            PlaidOrchestrationError::UnsupportedProvider => {
                ApiErrorResponse::new("BAD_REQUEST", "Unsupported provider")
                    .into_response(StatusCode::BAD_REQUEST)
            }
            PlaidOrchestrationError::LinkTokenRequestFailed => ApiErrorResponse::with_code(
                "FAILED_DEPENDENCY",
                "Provider request failed",
                "PROVIDER_REQUEST_FAILED",
            )
            .into_response(StatusCode::FAILED_DEPENDENCY),
            PlaidOrchestrationError::TokenExchangeFailed => ApiErrorResponse::with_code(
                "FAILED_DEPENDENCY",
                "Token exchange failed with provider",
                "PROVIDER_REQUEST_FAILED",
            )
            .into_response(StatusCode::FAILED_DEPENDENCY),
            PlaidOrchestrationError::LoadAccountsFailed
            | PlaidOrchestrationError::ClearSyncedDataFailed => {
                ApiErrorResponse::internal_server_error("Internal server error")
            }
        }
    }
}
