use crate::models::{budget::Budget, plaid::ProviderConnection};
use crate::services::repository_service::DatabaseRepository;
use axum::http::StatusCode;
use std::collections::HashSet;
use uuid::Uuid;

pub struct AuthorizationService;

impl AuthorizationService {
    pub fn new() -> Self {
        Self
    }

    pub async fn validate_account_ownership<R: DatabaseRepository + ?Sized>(
        &self,
        account_id_strings: &[String],
        user_id: &Uuid,
        db_repository: &R,
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

        let owned_account_ids: HashSet<Uuid> = user_accounts.iter().map(|a| a.id).collect();

        for account_id in &account_ids {
            if !owned_account_ids.contains(account_id) {
                return Err(StatusCode::FORBIDDEN);
            }
        }

        Ok(account_ids)
    }

    pub async fn require_budget_owned<R: DatabaseRepository + ?Sized>(
        &self,
        budget_id: &Uuid,
        user_id: &Uuid,
        db_repository: &R,
    ) -> Result<Budget, StatusCode> {
        db_repository
            .get_budget_by_id_for_user(budget_id, user_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::NOT_FOUND)
    }

    pub async fn require_provider_connection_owned<R: DatabaseRepository + ?Sized>(
        &self,
        connection_id: &Uuid,
        user_id: &Uuid,
        db_repository: &R,
    ) -> Result<ProviderConnection, StatusCode> {
        db_repository
            .get_provider_connection_by_id(connection_id, user_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::NOT_FOUND)
    }
}
