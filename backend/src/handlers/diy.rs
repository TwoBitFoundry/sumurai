use axum::{http::StatusCode, response::Json};

use crate::models::api_error::ApiErrorResponse;
use crate::services::diy_orchestrator::{DiyOrchestrationError, DIY_VALID_ACCOUNT_TYPES};

impl From<DiyOrchestrationError> for (StatusCode, Json<ApiErrorResponse>) {
    fn from(error: DiyOrchestrationError) -> Self {
        match error {
            DiyOrchestrationError::EmptyInstitutionName => {
                ApiErrorResponse::bad_request("Institution name cannot be empty")
            }
            DiyOrchestrationError::InstitutionNameTaken => {
                ApiErrorResponse::conflict("Institution name already exists")
            }
            DiyOrchestrationError::CreateInstitutionFailed => {
                ApiErrorResponse::internal_server_error("Failed to create institution")
            }
            DiyOrchestrationError::EmptyAccountName => {
                ApiErrorResponse::bad_request("Account name cannot be empty")
            }
            DiyOrchestrationError::InvalidAccountType => ApiErrorResponse::bad_request(&format!(
                "account_type must be one of: {}",
                DIY_VALID_ACCOUNT_TYPES.join(", ")
            )),
            DiyOrchestrationError::BalanceRequired => {
                ApiErrorResponse::bad_request("Balance is required")
            }
            DiyOrchestrationError::ConnectionNotFound => {
                ApiErrorResponse::new("NOT_FOUND", "Connection not found")
                    .into_response(StatusCode::NOT_FOUND)
            }
            DiyOrchestrationError::ConnectionNotDiy => {
                ApiErrorResponse::new("FORBIDDEN", "Connection is not a DIY connection")
                    .into_response(StatusCode::FORBIDDEN)
            }
            DiyOrchestrationError::AccountNameTaken => {
                ApiErrorResponse::conflict("Account name already exists in this institution")
            }
            DiyOrchestrationError::AccountMaskTaken => {
                ApiErrorResponse::conflict("Account mask already exists in this institution")
            }
            DiyOrchestrationError::CreateAccountFailed => {
                ApiErrorResponse::internal_server_error("Failed to create account")
            }
            DiyOrchestrationError::InstitutionNotFound => {
                ApiErrorResponse::new("NOT_FOUND", "Institution not found")
                    .into_response(StatusCode::NOT_FOUND)
            }
            DiyOrchestrationError::NotDiyInstitution => {
                ApiErrorResponse::new("FORBIDDEN", "Connection is not a DIY institution")
                    .into_response(StatusCode::FORBIDDEN)
            }
            DiyOrchestrationError::ResolveInstitutionFailed
            | DiyOrchestrationError::DisconnectFailed => {
                ApiErrorResponse::internal_server_error("Failed to disconnect institution")
            }
        }
    }
}
