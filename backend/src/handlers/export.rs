use axum::{
    extract::{Query, State},
    http::{
        header::{CONTENT_DISPOSITION, CONTENT_TYPE},
        HeaderValue, StatusCode,
    },
    response::{IntoResponse, Response},
};

use crate::models::app_state::AppState;
use crate::models::auth::AuthContext;
use crate::models::export::{ExportFormat, ExportQuery};
use crate::services::export_service::ExportService;

#[utoipa::path(
    get,
    path = "/api/export",
    description = "Downloads the current user's stored accounts and transactions as CSV or OFX.",
    params(
        ("format" = ExportFormat, Query, description = "Export format"),
        ("connection_id" = Option<Uuid>, Query, description = "Optional provider connection filter")
    ),
    responses(
        (status = 200, description = "Downloaded export file", body = String),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    ),
    security(("auth_cookie" = [])),
    tag = "Transactions"
)]
pub async fn get_authenticated_export(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Query(query): Query<ExportQuery>,
) -> Result<Response, StatusCode> {
    let file = ExportService::export_for_user(
        state.db_repository.as_ref(),
        auth_context.user_id,
        query.format,
        query.connection_id,
    )
    .await?;

    let content_disposition =
        HeaderValue::from_str(&format!("attachment; filename=\"{}\"", file.filename))
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((
        [
            (
                CONTENT_TYPE,
                HeaderValue::from_static(file.format.content_type()),
            ),
            (CONTENT_DISPOSITION, content_disposition),
        ],
        file.body,
    )
        .into_response())
}
