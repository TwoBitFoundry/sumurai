use std::sync::Arc;

use async_trait::async_trait;
use chrono::NaiveDate;

use crate::models::plaid::ProviderConnection;
use crate::models::transaction::SyncTransactionsResponse;
use crate::services::connection_service::{
    ConnectionService, ProviderSyncError, SyncConnectionParams,
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
