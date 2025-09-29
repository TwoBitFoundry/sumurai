use axum::http::StatusCode;
use std::sync::Arc;
use uuid::Uuid;

use crate::services::repository_service::DatabaseRepository;

pub async fn validate_account_ownership(
    account_id_strings: &[String],
    user_id: &Uuid,
    db_repository: &Arc<dyn DatabaseRepository>,
) -> Result<Vec<Uuid>, StatusCode> {
    let account_ids: Result<Vec<Uuid>, _> = account_id_strings
        .iter()
        .map(|s| Uuid::parse_str(s))
        .collect();

    let account_ids = account_ids.map_err(|_| StatusCode::BAD_REQUEST)?;

    let user_accounts = db_repository
        .get_accounts_for_user(user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let owned_account_ids: std::collections::HashSet<Uuid> =
        user_accounts.iter().map(|a| a.id).collect();

    for account_id in &account_ids {
        if !owned_account_ids.contains(account_id) {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    Ok(account_ids)
}
