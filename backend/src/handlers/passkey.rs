use axum::{http::StatusCode, response::Json};

use crate::models::api_error::ApiErrorResponse;
use crate::services::passkey_orchestrator::PasskeyOrchestrationError;

impl From<PasskeyOrchestrationError> for (StatusCode, Json<ApiErrorResponse>) {
    fn from(error: PasskeyOrchestrationError) -> Self {
        match error {
            #[cfg(not(feature = "dev-seed"))]
            PasskeyOrchestrationError::PasswordRegistrationUnsupported => {
                ApiErrorResponse::bad_request(
                    "Password registration is no longer supported; enroll a passkey instead",
                )
            }
            PasskeyOrchestrationError::AuthenticatedEnrollmentRequired => {
                ApiErrorResponse::bad_request(
                    "Authenticated passkey enrollment must use /api/auth/passkey/enroll/finish",
                )
            }
            PasskeyOrchestrationError::EmailAlreadyRegistered => {
                ApiErrorResponse::conflict("Email address is already registered")
            }
            PasskeyOrchestrationError::AuthenticationFailed => {
                ApiErrorResponse::unauthorized("Authentication failed")
            }
            PasskeyOrchestrationError::AuthenticationServiceError => {
                ApiErrorResponse::internal_server_error("Authentication service error")
            }
            PasskeyOrchestrationError::BeginRegistrationFailed => {
                ApiErrorResponse::internal_server_error("Failed to begin passkey registration")
            }
            PasskeyOrchestrationError::BeginEnrollmentFailed => {
                ApiErrorResponse::internal_server_error("Failed to begin passkey enrollment")
            }
            PasskeyOrchestrationError::BeginAuthenticationFailed => {
                ApiErrorResponse::internal_server_error("Failed to begin authentication")
            }
            PasskeyOrchestrationError::LoadExistingCredentialsFailed => {
                ApiErrorResponse::internal_server_error("Failed to retrieve existing credentials")
            }
            PasskeyOrchestrationError::SerializeRegistrationStateFailed => {
                ApiErrorResponse::internal_server_error("Failed to serialize registration state")
            }
            PasskeyOrchestrationError::SerializeAuthenticationStateFailed => {
                ApiErrorResponse::internal_server_error("Failed to serialize authentication state")
            }
            PasskeyOrchestrationError::StoreRegistrationChallengeFailed => {
                ApiErrorResponse::internal_server_error("Failed to store registration challenge")
            }
            PasskeyOrchestrationError::StoreAuthenticationChallengeFailed => {
                ApiErrorResponse::internal_server_error("Failed to store authentication challenge")
            }
            PasskeyOrchestrationError::SerializeChallengeFailed => {
                ApiErrorResponse::internal_server_error("Failed to serialize challenge")
            }
            PasskeyOrchestrationError::RetrieveChallengeFailed => {
                ApiErrorResponse::internal_server_error("Failed to retrieve challenge")
            }
            PasskeyOrchestrationError::ChallengeNotFound => {
                ApiErrorResponse::bad_request("Challenge not found or already used")
            }
            PasskeyOrchestrationError::InvalidEnrollmentChallenge => {
                ApiErrorResponse::bad_request("Invalid enrollment challenge")
            }
            PasskeyOrchestrationError::InvalidRegistrationChallenge => {
                ApiErrorResponse::bad_request("Invalid registration challenge")
            }
            PasskeyOrchestrationError::InvalidChallengeState => {
                ApiErrorResponse::bad_request("Invalid challenge state")
            }
            PasskeyOrchestrationError::InvalidAuthenticationState => {
                ApiErrorResponse::bad_request("Invalid authentication state")
            }
            PasskeyOrchestrationError::InvalidCredentialResponse => {
                ApiErrorResponse::bad_request("Invalid credential response")
            }
            PasskeyOrchestrationError::ChallengeUserMismatch => ApiErrorResponse::unauthorized(
                "Challenge does not belong to the authenticated user",
            ),
            PasskeyOrchestrationError::PasskeyVerificationFailed => {
                ApiErrorResponse::bad_request("Passkey verification failed")
            }
            PasskeyOrchestrationError::SerializePasskeyFailed => {
                ApiErrorResponse::internal_server_error("Failed to serialize passkey")
            }
            PasskeyOrchestrationError::SavePasskeyFailed => {
                ApiErrorResponse::internal_server_error("Failed to save passkey")
            }
            PasskeyOrchestrationError::CompleteEnrollmentFailed => {
                ApiErrorResponse::internal_server_error("Failed to complete passkey enrollment")
            }
            PasskeyOrchestrationError::UserNotFound => {
                ApiErrorResponse::internal_server_error("User not found")
            }
            PasskeyOrchestrationError::PasskeyAlreadyAvailable => ApiErrorResponse::bad_request(
                "Passkey sign-in is already available for this account",
            ),
            PasskeyOrchestrationError::AccountNotFound => {
                ApiErrorResponse::bad_request("Account not found")
            }
            PasskeyOrchestrationError::PasswordSignInAvailable => {
                ApiErrorResponse::bad_request("Password sign-in is available for this account")
            }
            PasskeyOrchestrationError::TokenGenerationFailed => {
                ApiErrorResponse::internal_server_error("Failed to generate authentication token")
            }
            PasskeyOrchestrationError::LoadPasskeysFailed => {
                ApiErrorResponse::internal_server_error("Failed to retrieve passkeys")
            }
            PasskeyOrchestrationError::PasskeyNotFound => {
                ApiErrorResponse::not_found("Passkey not found")
            }
            PasskeyOrchestrationError::LastPasskey => {
                ApiErrorResponse::conflict("Cannot remove the last enrolled passkey")
            }
            PasskeyOrchestrationError::DeletePasskeyFailed => {
                ApiErrorResponse::internal_server_error("Failed to delete passkey")
            }
        }
    }
}
