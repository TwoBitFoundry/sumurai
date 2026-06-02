use std::sync::Arc;

use async_trait::async_trait;
use chrono::NaiveDate;

use crate::models::api_error::ApiErrorResponse;
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

fn provider_sync_error_json_response(
    status: axum::http::StatusCode,
    error: &str,
    message: &str,
    retry_after_secs: Option<String>,
) -> axum::response::Response {
    use axum::response::IntoResponse;

    let body = axum::Json(ApiErrorResponse::new(error, message));
    match retry_after_secs {
        Some(retry_after) => (
            status,
            [(axum::http::header::RETRY_AFTER, retry_after)],
            body,
        )
            .into_response(),
        None => (status, body).into_response(),
    }
}

pub fn provider_sync_error_to_response(
    err: ProviderSyncError,
    user_id: uuid::Uuid,
    item_id: &str,
) -> axum::response::Response {
    use axum::http::StatusCode;

    match err {
        ProviderSyncError::RateLimited {
            message,
            retry_after_secs,
        } => {
            tracing::info!(
                "Provider sync rate-limited for user {} and item {}",
                user_id,
                item_id
            );
            provider_sync_error_json_response(
                StatusCode::TOO_MANY_REQUESTS,
                "RATE_LIMITED",
                &message,
                Some(retry_after_secs),
            )
        }
        ProviderSyncError::CredentialsMissing => {
            tracing::error!(
                "Sync transactions: no credentials for user {} and item {}",
                user_id,
                item_id
            );
            provider_sync_error_json_response(
                StatusCode::NOT_FOUND,
                "NOT_FOUND",
                "This institution is linked in Sumurai but provider credentials are missing. Reconnect your financial provider from Accounts.",
                None,
            )
        }
        ProviderSyncError::CredentialAccess(e) => {
            tracing::error!(
                "Sync transactions: failed to access credentials for user {} and item {}: {}",
                user_id,
                item_id,
                e
            );
            provider_sync_error_json_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_SERVER_ERROR",
                "Could not access provider credentials for this connection",
                None,
            )
        }
        ProviderSyncError::ProviderUnavailable(p) => {
            tracing::error!(
                "Sync transactions: provider '{}' unavailable for user {}",
                p,
                user_id
            );
            provider_sync_error_json_response(
                StatusCode::BAD_REQUEST,
                "BAD_REQUEST",
                "This provider is not available for sync",
                None,
            )
        }
        ProviderSyncError::ProviderRequest(e) => {
            tracing::error!(
                "Provider request failed during sync for user {} and item {}: {}",
                user_id,
                item_id,
                e
            );
            provider_sync_error_json_response(
                StatusCode::BAD_GATEWAY,
                "BAD_GATEWAY",
                "The financial provider request failed. Try again in a few minutes.",
                None,
            )
        }
        ProviderSyncError::AccountLookup(e) => {
            tracing::error!(
                "Failed to load accounts during sync for user {} and item {}: {}",
                user_id,
                item_id,
                e
            );
            provider_sync_error_json_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_SERVER_ERROR",
                "Could not load accounts for this connection",
                None,
            )
        }
        ProviderSyncError::TransactionLookup(e) => {
            tracing::error!(
                "Failed to load transactions during sync for user {} and item {}: {}",
                user_id,
                item_id,
                e
            );
            provider_sync_error_json_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_SERVER_ERROR",
                "Could not load transactions for this connection",
                None,
            )
        }
        ProviderSyncError::SyncFailure(e) => {
            tracing::error!(
                "Sync service failed for user {} and item {}: {}",
                user_id,
                item_id,
                e
            );
            provider_sync_error_json_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_SERVER_ERROR",
                "Sync failed unexpectedly. Try again.",
                None,
            )
        }
    }
}
