use axum::http::StatusCode;
use std::sync::Arc;
use uuid::Uuid;

use crate::services::{repository_service::DatabaseRepository, AuthorizationService};

pub async fn validate_account_ownership(
    account_id_strings: &[String],
    user_id: &Uuid,
    db_repository: &Arc<dyn DatabaseRepository>,
) -> Result<Vec<Uuid>, StatusCode> {
    AuthorizationService::new()
        .validate_account_ownership(account_id_strings, user_id, db_repository.as_ref())
        .await
}
