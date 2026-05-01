#[cfg(test)]
use axum::http::StatusCode;
#[cfg(test)]
use std::sync::Arc;
#[cfg(test)]
use uuid::Uuid;

#[cfg(test)]
use crate::services::{repository_service::DatabaseRepository, AuthorizationService};

#[cfg(test)]
pub async fn validate_account_ownership(
    account_id_strings: &[String],
    user_id: &Uuid,
    db_repository: &Arc<dyn DatabaseRepository>,
) -> Result<Vec<Uuid>, StatusCode> {
    AuthorizationService::new()
        .validate_account_ownership(account_id_strings, user_id, db_repository.as_ref())
        .await
}
