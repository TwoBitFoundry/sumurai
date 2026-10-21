use std::collections::HashMap;
use std::sync::Arc;

use uuid::Uuid;

use crate::models::account::AccountResponse;
use crate::models::domain_error::DomainError;
use crate::models::plaid::{ClearSyncedDataResponse, ExchangeTokenResponse};
use crate::services::connection_service::{ConnectionService, ExchangeTokenError, LinkTokenError};
use crate::services::provider_credential_log::{
    log_provider_credential_outcome, STATUS_BAD_REQUEST, STATUS_FAILED_DEPENDENCY, STATUS_OK,
};
use crate::services::repository_service::DatabaseRepository;
use crate::services::CacheService;

pub const PLAID_PROVIDER: &str = "plaid";

pub struct PlaidOrchestrator {
    connection_service: Arc<ConnectionService>,
    repository: Arc<dyn DatabaseRepository>,
    cache: Arc<dyn CacheService>,
}

impl PlaidOrchestrator {
    pub fn new(
        connection_service: Arc<ConnectionService>,
        repository: Arc<dyn DatabaseRepository>,
        cache: Arc<dyn CacheService>,
    ) -> Self {
        Self {
            connection_service,
            repository,
            cache,
        }
    }

    pub async fn create_link_token(&self, user_id: Uuid) -> Result<String, DomainError> {
        match self
            .connection_service
            .create_link_token(PLAID_PROVIDER, &user_id)
            .await
        {
            Ok(link_token) => Ok(link_token),
            Err(LinkTokenError::ProviderUnavailable(p)) => {
                tracing::error!(
                    "Link token requested for unsupported provider '{}' by user {}",
                    p,
                    user_id
                );
                Err(DomainError::bad_request("Unsupported provider"))
            }
            Err(LinkTokenError::ProviderRequest(e)) => {
                tracing::error!(
                    "Failed to create link token for provider {} and user {}: {}",
                    PLAID_PROVIDER,
                    user_id,
                    e
                );
                Err(DomainError::failed_dependency("Provider request failed")
                    .with_code("PROVIDER_REQUEST_FAILED"))
            }
        }
    }

    pub async fn exchange_public_token(
        &self,
        user_id: Uuid,
        jwt_id: &str,
        public_token: &str,
    ) -> Result<ExchangeTokenResponse, DomainError> {
        match self
            .connection_service
            .exchange_public_token(PLAID_PROVIDER, &user_id, jwt_id, public_token)
            .await
        {
            Ok(response) => {
                log_provider_credential_outcome(PLAID_PROVIDER, STATUS_OK, "plaid.exchange-token");
                Ok(response)
            }
            Err(ExchangeTokenError::ProviderUnavailable(p)) => {
                log_provider_credential_outcome(&p, STATUS_BAD_REQUEST, "plaid.exchange-token");
                tracing::error!(
                    "Exchange token requested for unsupported provider '{}' by user {}",
                    p,
                    user_id
                );
                Err(DomainError::bad_request("Unsupported provider"))
            }
            Err(ExchangeTokenError::ExchangeFailed(e)) => {
                log_provider_credential_outcome(
                    PLAID_PROVIDER,
                    STATUS_FAILED_DEPENDENCY,
                    "plaid.exchange-token",
                );
                tracing::error!(
                    "Failed to exchange public token for provider {} and user {}: {}",
                    PLAID_PROVIDER,
                    user_id,
                    e
                );
                Err(
                    DomainError::failed_dependency("Token exchange failed with provider")
                        .with_code("PROVIDER_REQUEST_FAILED"),
                )
            }
        }
    }

    pub async fn list_accounts(&self, user_id: Uuid) -> Result<Vec<AccountResponse>, DomainError> {
        let db_accounts = match self.repository.get_accounts_for_user(&user_id).await {
            Ok(accounts) => accounts,
            Err(e) => {
                tracing::error!("Failed to get accounts for user {}: {}", user_id, e);
                return Err(DomainError::internal("Internal server error"));
            }
        };

        let transaction_counts = self
            .repository
            .get_transaction_count_by_account_for_user(&user_id)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to get transaction counts for user {}: {}",
                    user_id,
                    e
                );
                DomainError::internal("Internal server error")
            })?;

        let provider_by_connection_id = self
            .repository
            .get_all_provider_connections_by_user(&user_id)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to get provider connections for user {}: {}",
                    user_id,
                    e
                );
                DomainError::internal("Internal server error")
            })?
            .into_iter()
            .map(|connection| (connection.id, connection.provider))
            .collect::<HashMap<_, _>>();

        let account_responses: Vec<AccountResponse> = db_accounts
            .into_iter()
            .map(|account| {
                let transaction_count = transaction_counts.get(&account.id).unwrap_or(&0);
                AccountResponse {
                    id: account.id,
                    user_id: Some(user_id),
                    provider: account.provider_connection_id.and_then(|connection_id| {
                        provider_by_connection_id.get(&connection_id).cloned()
                    }),
                    provider_account_id: account.provider_account_id.clone(),
                    provider_connection_id: account.provider_connection_id,
                    name: account.name,
                    account_type: account.account_type,
                    balance_current: account.balance_current,
                    mask: account.mask,
                    transaction_count: *transaction_count,
                    institution_name: account.institution_name,
                }
            })
            .collect();

        tracing::info!(
            record_count = account_responses.len(),
            provider = "unified",
            "Data access: accounts"
        );

        Ok(account_responses)
    }

    pub async fn clear_synced_data(
        &self,
        user_id: Uuid,
        jwt_id: &str,
    ) -> Result<ClearSyncedDataResponse, DomainError> {
        match self.cache.clear_transactions(jwt_id).await {
            Ok(_) => Ok(ClearSyncedDataResponse {
                cleared: true,
                user_id: user_id.to_string(),
            }),
            Err(e) => {
                tracing::error!("Failed to clear synced data for user {}: {}", user_id, e);
                Err(DomainError::internal("Internal server error"))
            }
        }
    }
}
