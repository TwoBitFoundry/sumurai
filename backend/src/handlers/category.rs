use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use uuid::Uuid;

use crate::models::api_error::ApiErrorResponse;
use crate::models::app_state::AppState;
use crate::models::auth::AuthContext;
use crate::models::custom_category::{
    CategoryListResponse, CreateCustomCategoryRequest, CustomCategory,
};
use crate::models::transaction_category_override::SetTransactionCategoryRequest;

#[utoipa::path(
    get,
    path = "/api/transactions/categories",
    description = "Returns the user's transaction categories sorted and deduplicated.",
    responses(
        (status = 200, description = "List of categories", body = Vec<String>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Transactions"
)]
pub async fn get_authenticated_transaction_categories(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<Vec<String>>, StatusCode> {
    state
        .categories()
        .transaction_categories(auth_context.user_id)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    get,
    path = "/api/categories",
    responses(
        (status = 200, description = "List of system and custom categories", body = CategoryListResponse),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Categories"
)]
pub async fn list_categories(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<CategoryListResponse>, StatusCode> {
    state
        .categories()
        .list(auth_context.user_id)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/categories/custom",
    request_body = CreateCustomCategoryRequest,
    responses(
        (status = 200, description = "Custom category created", body = CustomCategory),
        (status = 400, description = "Validation error with error code"),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Categories"
)]
pub async fn create_custom_category(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<CreateCustomCategoryRequest>,
) -> Result<Json<CustomCategory>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .categories()
        .create_custom(auth_context.user_id, &req.name)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    delete,
    path = "/api/categories/custom/{id}",
    params(
        ("id" = Uuid, Path, description = "Custom category ID"),
    ),
    responses(
        (status = 204, description = "Custom category deleted"),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Categories"
)]
pub async fn delete_custom_category(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Path(id): axum::extract::Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .categories()
        .delete_custom(auth_context.user_id, id)
        .await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(Into::into)
}

#[utoipa::path(
    put,
    path = "/api/transactions/{id}/category",
    request_body = SetTransactionCategoryRequest,
    params(
        ("id" = Uuid, Path, description = "Transaction ID"),
    ),
    responses(
        (status = 200, description = "Category updated"),
        (status = 400, description = "Validation error"),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 404, description = "Transaction not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Transactions"
)]
pub async fn set_transaction_category(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Path(id): axum::extract::Path<Uuid>,
    Json(req): Json<SetTransactionCategoryRequest>,
) -> Result<StatusCode, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .categories()
        .set_transaction_category(auth_context.user_id, &auth_context.jwt_id, id, req)
        .await
        .map(|_| StatusCode::OK)
        .map_err(Into::into)
}
