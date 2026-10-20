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
use crate::models::export::ExportQuery;
use crate::services::export_orchestrator::ExportOrchestrationError;

impl From<ExportOrchestrationError> for StatusCode {
    fn from(error: ExportOrchestrationError) -> Self {
        match error {
            ExportOrchestrationError::LoadAccountsFailed
            | ExportOrchestrationError::LoadTransactionsFailed => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn build_authenticated_export_response(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Query(query): Query<ExportQuery>,
) -> Result<Response, StatusCode> {
    let file = state
        .exports()
        .export(auth_context.user_id, query.format, query.connection_id)
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
