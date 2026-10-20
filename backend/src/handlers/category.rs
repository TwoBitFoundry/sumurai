use axum::{http::StatusCode, response::Json};

use crate::models::api_error::ApiErrorResponse;
use crate::models::custom_category::CustomCategoryError;
use crate::services::category_orchestrator::CategoryOrchestrationError;

impl From<CategoryOrchestrationError> for StatusCode {
    fn from(error: CategoryOrchestrationError) -> Self {
        match error {
            CategoryOrchestrationError::LoadTransactionCategoriesFailed
            | CategoryOrchestrationError::LoadCategoriesFailed
            | CategoryOrchestrationError::CreateCustomCategoryFailed
            | CategoryOrchestrationError::DeleteCustomCategoryFailed
            | CategoryOrchestrationError::SetTransactionCategoryFailed => {
                StatusCode::INTERNAL_SERVER_ERROR
            }
            CategoryOrchestrationError::InvalidCustomCategory(_)
            | CategoryOrchestrationError::CustomCategoryNotFound
            | CategoryOrchestrationError::InvalidTransactionCategory => StatusCode::BAD_REQUEST,
            CategoryOrchestrationError::TransactionNotFound => StatusCode::NOT_FOUND,
        }
    }
}

impl From<CategoryOrchestrationError> for (StatusCode, Json<ApiErrorResponse>) {
    fn from(error: CategoryOrchestrationError) -> Self {
        match error {
            CategoryOrchestrationError::InvalidCustomCategory(validation) => {
                let (message, code) = custom_category_validation_message(validation);
                ApiErrorResponse::with_code("validation_error", message, code)
                    .into_response(StatusCode::BAD_REQUEST)
            }
            CategoryOrchestrationError::CreateCustomCategoryFailed
            | CategoryOrchestrationError::SetTransactionCategoryFailed => {
                ApiErrorResponse::new("internal_error", "internal_server_error")
                    .into_response(StatusCode::INTERNAL_SERVER_ERROR)
            }
            CategoryOrchestrationError::DeleteCustomCategoryFailed => {
                ApiErrorResponse::internal_server_error("Failed to delete custom category")
            }
            CategoryOrchestrationError::TransactionNotFound => {
                ApiErrorResponse::new("not_found", "transaction_not_found")
                    .into_response(StatusCode::NOT_FOUND)
            }
            CategoryOrchestrationError::CustomCategoryNotFound => {
                ApiErrorResponse::new("validation_error", "custom_category_not_found")
                    .into_response(StatusCode::BAD_REQUEST)
            }
            CategoryOrchestrationError::InvalidTransactionCategory => {
                ApiErrorResponse::new("validation_error", "validation_error")
                    .into_response(StatusCode::BAD_REQUEST)
            }
            CategoryOrchestrationError::LoadTransactionCategoriesFailed
            | CategoryOrchestrationError::LoadCategoriesFailed => {
                ApiErrorResponse::internal_server_error("Failed to fetch categories")
            }
        }
    }
}

fn custom_category_validation_message(error: CustomCategoryError) -> (&'static str, &'static str) {
    match error {
        CustomCategoryError::NameTooLong => ("Name too long", "name_too_long"),
        CustomCategoryError::TooManyWords => ("Too many words", "too_many_words"),
        CustomCategoryError::EmptyName => ("Name is empty", "empty_name"),
        CustomCategoryError::InvalidCharacters => ("Invalid characters", "invalid_characters"),
        CustomCategoryError::CollidesWithSystemCategory => (
            "Collides with system category",
            "collides_with_system_category",
        ),
        CustomCategoryError::CollidesWithExistingCustom => (
            "Collides with existing custom category",
            "collides_with_existing_custom",
        ),
    }
}
