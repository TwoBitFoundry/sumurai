use axum::{
    extract::{Query, State},
    http::{
        header::{CONTENT_DISPOSITION, CONTENT_TYPE},
        HeaderValue, StatusCode,
    },
    response::{IntoResponse, Response},
};
#[allow(unused_imports)]
use uuid::Uuid;

use crate::models::app_state::AppState;
use crate::models::auth::AuthContext;
use crate::models::export::{ExportFormat, ExportQuery};
use crate::services::export_service::ExportService;

pub async fn build_authenticated_export_response(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Query(query): Query<ExportQuery>,
) -> Result<Response, StatusCode> {
    let mut accounts = state
        .db_repository
        .get_accounts_for_user(&auth_context.user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Some(connection_id) = query.connection_id {
        accounts.retain(|account| account.provider_connection_id == Some(connection_id));
    }

    let account_ids = if accounts.is_empty() {
        Some(Vec::new())
    } else {
        Some(accounts.iter().map(|account| account.id).collect())
    };

    let transactions = state
        .db_repository
        .get_transactions_for_export(&auth_context.user_id, account_ids.as_deref())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let date_range = transactions
        .iter()
        .map(|transaction| transaction.date)
        .min()
        .zip(
            transactions
                .iter()
                .map(|transaction| transaction.date)
                .max(),
        );

    let scope = if query.connection_id.is_some() {
        accounts
            .first()
            .and_then(|account| account.institution_name.as_deref())
            .unwrap_or("institution")
    } else {
        "all"
    };

    let body = match query.format {
        ExportFormat::Csv => ExportService::to_csv(&accounts, &transactions),
        ExportFormat::Ofx => ExportService::to_ofx(&accounts, &transactions),
    };

    let filename = query.format.filename_for_scope(scope, date_range);
    let content_disposition =
        HeaderValue::from_str(&format!("attachment; filename=\"{filename}\""))
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((
        [
            (
                CONTENT_TYPE,
                HeaderValue::from_static(query.format.content_type()),
            ),
            (CONTENT_DISPOSITION, content_disposition),
        ],
        body,
    )
        .into_response())
}
