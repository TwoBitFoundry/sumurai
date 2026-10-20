use axum::{http::StatusCode, response::Json};

use crate::models::api_error::ApiErrorResponse;
use crate::services::budget_orchestrator::BudgetOrchestrationError;

impl From<BudgetOrchestrationError> for (StatusCode, Json<ApiErrorResponse>) {
    fn from(error: BudgetOrchestrationError) -> Self {
        match error {
            BudgetOrchestrationError::InvalidAmount => {
                ApiErrorResponse::new("BAD_REQUEST", "Budget amount must be greater than zero")
                    .into_response(StatusCode::BAD_REQUEST)
            }
            BudgetOrchestrationError::IneligibleCategory => ApiErrorResponse::new(
                "BAD_REQUEST",
                "Budgets cannot be created for income or transfer categories",
            )
            .into_response(StatusCode::BAD_REQUEST),
            BudgetOrchestrationError::AlreadyExists => {
                ApiErrorResponse::new("CONFLICT", "Budget category already exists")
                    .into_response(StatusCode::CONFLICT)
            }
            BudgetOrchestrationError::NotFound => {
                ApiErrorResponse::new("NOT_FOUND", "Budget not found")
                    .into_response(StatusCode::NOT_FOUND)
            }
            BudgetOrchestrationError::LoadBudgetsFailed => {
                ApiErrorResponse::internal_server_error("Failed to fetch budgets")
            }
            BudgetOrchestrationError::LoadFixedExpensesFailed => {
                ApiErrorResponse::internal_server_error("Failed to fetch fixed expenses")
            }
            BudgetOrchestrationError::CreateFailed => {
                ApiErrorResponse::internal_server_error("Failed to create budget")
            }
            BudgetOrchestrationError::UpdateFailed => {
                ApiErrorResponse::internal_server_error("Failed to update budget")
            }
            BudgetOrchestrationError::DeleteFailed => {
                ApiErrorResponse::internal_server_error("Failed to delete budget")
            }
        }
    }
}
