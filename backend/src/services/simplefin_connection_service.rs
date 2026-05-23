use crate::models::plaid::{ProviderConnectRequest, ProviderConnectResponse, ProviderConnection};
use crate::models::transaction::SyncTransactionsResponse;
use crate::providers::ProviderCredentials;
use crate::providers::ProviderRegistry;
use crate::services::cache_service::CacheService;
use crate::services::connection_service::{
    ProviderSyncError, SimpleFinConnectError, SyncConnectionParams,
};
use crate::services::repository_service::DatabaseRepository;
use crate::services::simplefin_org_service::SimpleFinOrganizationService;
use crate::services::simplefin_rate_limit_service::SimpleFinRateLimitService;
use crate::services::sync_service::SyncService;
use anyhow::Result;
use chrono::NaiveDate;
use std::sync::Arc;
use uuid::Uuid;

#[allow(dead_code)]
pub struct SimpleFinConnectionService {
    db_repository: Arc<dyn DatabaseRepository>,
    cache_service: Arc<dyn CacheService>,
    provider_registry: Arc<ProviderRegistry>,
    credential_resolvers:
        std::collections::HashMap<String, Arc<dyn crate::providers::ProviderCredentialResolver>>,
    org_service: Arc<SimpleFinOrganizationService>,
    rate_limit_service: Arc<SimpleFinRateLimitService>,
}

impl SimpleFinConnectionService {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        db_repository: Arc<dyn DatabaseRepository>,
        cache_service: Arc<dyn CacheService>,
        provider_registry: Arc<ProviderRegistry>,
        credential_resolvers: std::collections::HashMap<
            String,
            Arc<dyn crate::providers::ProviderCredentialResolver>,
        >,
        org_service: Arc<SimpleFinOrganizationService>,
        rate_limit_service: Arc<SimpleFinRateLimitService>,
    ) -> Self {
        Self {
            db_repository,
            cache_service,
            provider_registry,
            credential_resolvers,
            org_service,
            rate_limit_service,
        }
    }

    pub async fn connect(
        &self,
        user_id: &Uuid,
        jwt_id: &str,
        request: &ProviderConnectRequest,
    ) -> Result<ProviderConnectResponse, SimpleFinConnectError> {
        if request.provider.as_str() != "simplefin" {
            return Err(SimpleFinConnectError::InvalidProvider(
                request.provider.clone(),
            ));
        }

        let provider = self
            .provider_registry
            .get("simplefin")
            .ok_or_else(|| SimpleFinConnectError::InvalidProvider("simplefin".to_string()))?;

        let credentials = self
            .resolve_simplefin_credentials_for_connect(user_id, provider.clone())
            .await?;
        let root_item_id = credentials.item_id.clone();

        let snapshot = provider
            .fetch_balances_snapshot(&credentials)
            .await
            .map_err(SimpleFinConnectError::SnapshotFetch)?
            .ok_or_else(|| {
                SimpleFinConnectError::SnapshotFetch(anyhow::anyhow!(
                    "SimpleFIN balances snapshot unavailable"
                ))
            })?;

        self.db_repository
            .store_provider_credentials_for_user(user_id, &root_item_id, &credentials.access_token)
            .await
            .map_err(SimpleFinConnectError::CredentialStorage)?;

        let hidden_orgs = self
            .org_service
            .list_hidden_orgs(user_id)
            .await
            .map_err(SimpleFinConnectError::ConnectionPersistence)?;

        let mut first_connection_id = None;
        let mut institution_count = 0;

        for org in &snapshot.connections {
            if hidden_orgs.contains(&org.conn_id) {
                continue;
            }

            let persisted = self
                .org_service
                .persist_org_connection(user_id, jwt_id, &credentials, org, &snapshot.accounts)
                .await
                .map_err(SimpleFinConnectError::ConnectionPersistence)?;

            if let Some(connection_id) = persisted {
                institution_count += 1;
                if first_connection_id.is_none() {
                    first_connection_id = Some(connection_id);
                }
            }
        }

        let connection_id = first_connection_id.unwrap_or_else(Uuid::new_v4).to_string();

        Ok(ProviderConnectResponse {
            connection_id,
            institution_name: format!("SimpleFIN ({institution_count} institutions)"),
        })
    }

    #[allow(dead_code)]
    pub async fn sync(
        &self,
        _params: SyncConnectionParams<'_>,
        _sync_service: &SyncService,
        _connection: &mut ProviderConnection,
        _reference_date: Option<NaiveDate>,
    ) -> Result<SyncTransactionsResponse, ProviderSyncError> {
        // TODO: Extract full sync logic from ConnectionService in Phase 3 slice 3.5
        // For now, this is a placeholder that will be implemented when sync logic is extracted
        Err(ProviderSyncError::SyncFailure(anyhow::anyhow!(
            "SimpleFIN sync not yet migrated to service"
        )))
    }

    async fn resolve_simplefin_credentials_for_connect(
        &self,
        user_id: &Uuid,
        provider: Arc<dyn crate::providers::FinancialDataProvider>,
    ) -> Result<ProviderCredentials, SimpleFinConnectError> {
        let resolver = self
            .credential_resolvers
            .get("simplefin")
            .ok_or(SimpleFinConnectError::SetupTokenNotConfigured)?;

        resolver
            .resolve_for_connect(user_id, provider)
            .await
            .map_err(SimpleFinConnectError::CredentialStorage)
    }
}
