use axum::{http::StatusCode, response::Json};

use crate::models::api_error::ApiErrorResponse;
use crate::services::import_orchestrator::ImportOrchestrationError;

impl From<ImportOrchestrationError> for (StatusCode, Json<ApiErrorResponse>) {
    fn from(error: ImportOrchestrationError) -> Self {
        match error {
            ImportOrchestrationError::AccountNotOwned => ApiErrorResponse::new(
                "FORBIDDEN",
                "Account does not belong to the authenticated user",
            )
            .into_response(StatusCode::FORBIDDEN),
            ImportOrchestrationError::AccountOwnershipCheckFailed => {
                ApiErrorResponse::internal_server_error("Failed to validate account ownership")
            }
            ImportOrchestrationError::InvalidUtf8 => {
                ApiErrorResponse::bad_request("Uploaded file must be valid UTF-8")
            }
            ImportOrchestrationError::UnsupportedFileExtension(file_name) => {
                ApiErrorResponse::bad_request(&format!(
                    "Unsupported file extension for '{}'",
                    file_name
                ))
            }
            ImportOrchestrationError::InvalidCsvHeaders(message) => {
                ApiErrorResponse::bad_request(&message)
            }
            ImportOrchestrationError::InvalidCsvMapping(errors) => {
                ApiErrorResponse::bad_request(&errors.join("; "))
            }
            ImportOrchestrationError::NoValidTransactions(errors) => {
                let message = if errors.is_empty() {
                    "No valid transactions were found in the uploaded file".to_string()
                } else {
                    errors.join("; ")
                };
                ApiErrorResponse::bad_request(&message)
            }
            ImportOrchestrationError::LoadTransactionCountsFailed => {
                ApiErrorResponse::internal_server_error(
                    "Failed to load existing transaction counts",
                )
            }
            ImportOrchestrationError::NormalizeMerchantsFailed => {
                ApiErrorResponse::internal_server_error("Failed to normalize imported merchants")
            }
            ImportOrchestrationError::ImportFailed => {
                ApiErrorResponse::internal_server_error("Failed to import transactions")
            }
            ImportOrchestrationError::RefreshTransactionCountsFailed => {
                ApiErrorResponse::internal_server_error("Failed to refresh transaction counts")
            }
        }
    }
}
