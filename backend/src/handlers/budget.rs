use axum::{extract::State, http::StatusCode, response::Json};

use crate::middleware::resource_authorization::AuthorizedBudgetId;
use crate::models::api_error::ApiErrorResponse;
use crate::models::app_state::AppState;
use crate::models::auth::AuthContext;
use crate::models::budget::{
    Budget, BudgetsOverviewResponse, CreateBudgetRequest, DeleteBudgetResponse, UpdateBudgetRequest,
};

#[utoipa::path(
    get,
    path = "/api/budgets",
    description = "Retrieves all budgets for the authenticated user, leveraging Redis caching when available.",
    responses(
        (status = 200, description = "List of user budgets", body = Vec<Budget>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Budgets"
)]
pub async fn get_authenticated_budgets(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<Vec<Budget>>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .budgets()
        .list(auth_context.user_id, &auth_context.jwt_id)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    get,
    path = "/api/budgets/overview",
    description = "Returns budgets (cached when available) and live subscription summaries for the authenticated user.",
    responses(
        (status = 200, description = "Budgets and subscription overview", body = BudgetsOverviewResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Budgets"
)]
pub async fn get_authenticated_budgets_overview(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<BudgetsOverviewResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .budgets()
        .overview(auth_context.user_id, &auth_context.jwt_id)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/budgets",
    description = "Creates a new budget entry for the user with category and amount.",
    request_body = CreateBudgetRequest,
    responses(
        (status = 200, description = "Budget created", body = Budget),
        (status = 400, description = "Invalid budget data", body = ApiErrorResponse),
        (status = 401, description = "Unauthorized"),
        (status = 409, description = "Budget category already exists", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Budgets"
)]
pub async fn create_authenticated_budget(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<CreateBudgetRequest>,
) -> Result<Json<Budget>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .budgets()
        .create(
            auth_context.user_id,
            &auth_context.jwt_id,
            req.category,
            req.amount,
        )
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    put,
    path = "/api/budgets/{id}",
    description = "Updates the amount of an existing budget owned by the authenticated user.",
    params(("id" = String, Path, description = "Budget ID")),
    request_body = UpdateBudgetRequest,
    responses(
        (status = 200, description = "Budget updated successfully", body = Budget),
        (status = 400, description = "Invalid budget amount"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Budget not found", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Budgets"
)]
pub async fn update_authenticated_budget(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedBudgetId { budget_id }: AuthorizedBudgetId,
    Json(req): Json<UpdateBudgetRequest>,
) -> Result<Json<Budget>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .budgets()
        .update(
            auth_context.user_id,
            &auth_context.jwt_id,
            budget_id,
            req.amount,
        )
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    delete,
    path = "/api/budgets/{id}",
    description = "Deletes a budget and invalidates cached budget data.",
    params(("id" = String, Path, description = "Budget ID")),
    responses(
        (status = 200, description = "Budget deleted successfully", body = DeleteBudgetResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Budget not found", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Budgets"
)]
pub async fn delete_authenticated_budget(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedBudgetId { budget_id }: AuthorizedBudgetId,
) -> Result<Json<DeleteBudgetResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .budgets()
        .delete(auth_context.user_id, &auth_context.jwt_id, budget_id)
        .await
        .map(|()| {
            Json(DeleteBudgetResponse {
                deleted: true,
                budget_id: budget_id.to_string(),
            })
        })
        .map_err(Into::into)
}
