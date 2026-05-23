use std::sync::Arc;

use async_trait::async_trait;
use chrono::NaiveDate;

use crate::models::plaid::ProviderConnection;
use crate::models::transaction::SyncTransactionsResponse;
use crate::services::connection_service::{
    ConnectionService, ProviderSyncError, SyncConnectionParams, TellerSyncError,
};
use crate::services::sync_service::SyncService;

#[async_trait]
pub trait SyncServiceDispatcher: Send + Sync {
    async fn sync(
        &self,
        params: SyncConnectionParams<'_>,
        connection: &mut ProviderConnection,
        reference_date: Option<NaiveDate>,
    ) -> Result<SyncTransactionsResponse, ProviderSyncError>;
}

pub struct PlaidSyncDispatcher {
    connection_service: Arc<ConnectionService>,
    sync_service: Arc<SyncService>,
}

impl PlaidSyncDispatcher {
    pub fn new(connection_service: Arc<ConnectionService>, sync_service: Arc<SyncService>) -> Self {
        Self {
            connection_service,
            sync_service,
        }
    }
}

#[async_trait]
impl SyncServiceDispatcher for PlaidSyncDispatcher {
    async fn sync(
        &self,
        params: SyncConnectionParams<'_>,
        connection: &mut ProviderConnection,
        reference_date: Option<NaiveDate>,
    ) -> Result<SyncTransactionsResponse, ProviderSyncError> {
        let plaid_params = SyncConnectionParams {
            provider: "plaid",
            user_id: params.user_id,
            jwt_id: params.jwt_id,
        };
        self.connection_service
            .sync_provider_connection(
                plaid_params,
                self.sync_service.as_ref(),
                connection,
                reference_date,
            )
            .await
    }
}

pub struct SimpleFinSyncDispatcher {
    connection_service: Arc<ConnectionService>,
    sync_service: Arc<SyncService>,
}

impl SimpleFinSyncDispatcher {
    pub fn new(connection_service: Arc<ConnectionService>, sync_service: Arc<SyncService>) -> Self {
        Self {
            connection_service,
            sync_service,
        }
    }
}

#[async_trait]
impl SyncServiceDispatcher for SimpleFinSyncDispatcher {
    async fn sync(
        &self,
        params: SyncConnectionParams<'_>,
        connection: &mut ProviderConnection,
        reference_date: Option<NaiveDate>,
    ) -> Result<SyncTransactionsResponse, ProviderSyncError> {
        let simplefin_params = SyncConnectionParams {
            provider: "simplefin",
            user_id: params.user_id,
            jwt_id: params.jwt_id,
        };
        self.connection_service
            .sync_simplefin_connection(
                simplefin_params,
                self.sync_service.as_ref(),
                connection,
                reference_date,
            )
            .await
    }
}

pub struct TellerSyncDispatcher {
    connection_service: Arc<ConnectionService>,
}

impl TellerSyncDispatcher {
    pub fn new(connection_service: Arc<ConnectionService>) -> Self {
        Self { connection_service }
    }
}

#[async_trait]
impl SyncServiceDispatcher for TellerSyncDispatcher {
    async fn sync(
        &self,
        params: SyncConnectionParams<'_>,
        connection: &mut ProviderConnection,
        reference_date: Option<NaiveDate>,
    ) -> Result<SyncTransactionsResponse, ProviderSyncError> {
        self.connection_service
            .sync_teller_connection(params.user_id, params.jwt_id, connection, reference_date)
            .await
            .map_err(provider_sync_error_from_teller)
    }
}

fn provider_sync_error_from_teller(err: TellerSyncError) -> ProviderSyncError {
    match err {
        TellerSyncError::CredentialsMissing => ProviderSyncError::CredentialsMissing,
        TellerSyncError::CredentialAccess(e) => ProviderSyncError::CredentialAccess(e),
        TellerSyncError::ProviderInitialization(e) => ProviderSyncError::SyncFailure(e),
        TellerSyncError::ProviderRequest(e) => ProviderSyncError::ProviderRequest(e),
        TellerSyncError::AccountLookup(e) => ProviderSyncError::AccountLookup(e),
        TellerSyncError::TransactionLookup(e) => ProviderSyncError::TransactionLookup(e),
        TellerSyncError::ConnectionPersistence(e) => ProviderSyncError::SyncFailure(e),
    }
}

pub fn provider_sync_error_to_response(
    err: ProviderSyncError,
    user_id: uuid::Uuid,
    item_id: &str,
) -> axum::response::Response {
    use axum::http::StatusCode;
    use axum::response::IntoResponse;

    match err {
        ProviderSyncError::RateLimited => {
            tracing::info!(
                "Provider sync rate-limited for user {} and item {}",
                user_id,
                item_id
            );
            (
                StatusCode::TOO_MANY_REQUESTS,
                [(axum::http::header::RETRY_AFTER, "3600")],
            )
                .into_response()
        }
        ProviderSyncError::CredentialsMissing => {
            tracing::error!(
                "Sync transactions: no credentials for user {} and item {}",
                user_id,
                item_id
            );
            StatusCode::NOT_FOUND.into_response()
        }
        ProviderSyncError::CredentialAccess(e) => {
            tracing::error!(
                "Sync transactions: failed to access credentials for user {} and item {}: {}",
                user_id,
                item_id,
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
        ProviderSyncError::ProviderUnavailable(p) => {
            tracing::error!(
                "Sync transactions: provider '{}' unavailable for user {}",
                p,
                user_id
            );
            StatusCode::BAD_REQUEST.into_response()
        }
        ProviderSyncError::ProviderRequest(e) => {
            tracing::error!(
                "Provider request failed during sync for user {} and item {}: {}",
                user_id,
                item_id,
                e
            );
            StatusCode::BAD_GATEWAY.into_response()
        }
        ProviderSyncError::AccountLookup(e) => {
            tracing::error!(
                "Failed to load accounts during sync for user {} and item {}: {}",
                user_id,
                item_id,
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
        ProviderSyncError::TransactionLookup(e) => {
            tracing::error!(
                "Failed to load transactions during sync for user {} and item {}: {}",
                user_id,
                item_id,
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
        ProviderSyncError::SyncFailure(e) => {
            tracing::error!(
                "Sync service failed for user {} and item {}: {}",
                user_id,
                item_id,
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}
