use axum::{http::StatusCode, response::Json};

use crate::models::api_error::ApiErrorResponse;
use crate::services::auth_orchestrator::AuthOrchestrationError;

impl From<AuthOrchestrationError> for (StatusCode, Json<ApiErrorResponse>) {
    fn from(error: AuthOrchestrationError) -> Self {
        match error {
            #[cfg(feature = "dev-seed")]
            AuthOrchestrationError::EmailAlreadyRegistered => {
                ApiErrorResponse::conflict("Email address is already registered")
            }
            #[cfg(feature = "dev-seed")]
            AuthOrchestrationError::PasswordProcessingFailed => {
                ApiErrorResponse::internal_server_error("Failed to process password")
            }
            AuthOrchestrationError::InvalidCredentials => {
                ApiErrorResponse::unauthorized("Invalid email or password")
            }
            AuthOrchestrationError::AuthenticationServiceError
            | AuthOrchestrationError::SessionCheckFailed
            | AuthOrchestrationError::UserLookupFailed => {
                ApiErrorResponse::internal_server_error("Authentication service error")
            }
            AuthOrchestrationError::TokenGenerationFailed => {
                ApiErrorResponse::internal_server_error("Failed to generate authentication token")
            }
            AuthOrchestrationError::Unauthorized => {
                ApiErrorResponse::unauthorized("Authentication required")
            }
            AuthOrchestrationError::InvalidUserId => {
                ApiErrorResponse::bad_request("Invalid user ID")
            }
            AuthOrchestrationError::OnboardingUpdateFailed => {
                ApiErrorResponse::internal_server_error("Failed to update onboarding status")
            }
            AuthOrchestrationError::DemoUserLoadFailed => {
                ApiErrorResponse::internal_server_error("Failed to load user")
            }
            AuthOrchestrationError::DemoActivationFailed => {
                ApiErrorResponse::internal_server_error("Failed to activate demo mode")
            }
            AuthOrchestrationError::LoadConnectionsFailed => {
                ApiErrorResponse::internal_server_error("Failed to retrieve user connections")
            }
            AuthOrchestrationError::LoadBudgetsFailed => {
                ApiErrorResponse::internal_server_error("Failed to retrieve user budgets")
            }
            AuthOrchestrationError::DeleteUserFailed => {
                ApiErrorResponse::internal_server_error("Failed to delete user account")
            }
        }
    }
}

impl From<AuthOrchestrationError> for StatusCode {
    fn from(error: AuthOrchestrationError) -> Self {
        match error {
            #[cfg(feature = "dev-seed")]
            AuthOrchestrationError::EmailAlreadyRegistered => StatusCode::CONFLICT,
            AuthOrchestrationError::InvalidCredentials | AuthOrchestrationError::Unauthorized => {
                StatusCode::UNAUTHORIZED
            }
            AuthOrchestrationError::InvalidUserId => StatusCode::BAD_REQUEST,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}
