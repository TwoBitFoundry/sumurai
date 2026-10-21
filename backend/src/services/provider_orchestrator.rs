use std::sync::Arc;

use uuid::Uuid;

use crate::config::Config;
use crate::models::plaid::{
    DisconnectResult, ProviderConnectResponse, ProviderConnection, ProviderConnectionStatus,
    ProviderInfoResponse, ProviderSelectResponse, ProviderStatusResponse,
};
use crate::models::provider_connect::{ProviderConnectRequest, ProviderSyncRequest};
use crate::models::simplefin::{SimpleFinIgnoredInstitution, SimpleFinInstitutionAuthRequired};
use crate::models::transaction::SyncTransactionsResponse;
use crate::providers::ProviderRegistry;
use crate::services::connection_service::{
    ConnectionService, ProviderSyncError, SimpleFinConnectError, SyncConnectionParams,
};
use crate::services::provider_credential_log::{
    log_provider_credential_outcome, STATUS_BAD_REQUEST, STATUS_FAILED_DEPENDENCY,
    STATUS_INTERNAL_SERVER_ERROR, STATUS_OK, STATUS_UNPROCESSABLE_ENTITY,
};
use crate::services::provider_sync_rate_limit_service::{
    ProviderSyncRateLimitError, ProviderSyncRateLimitService, SyncQuotaDecision,
};
use crate::services::repository_service::DatabaseRepository;
use crate::services::sync_service::SyncService;
use crate::services::CacheService;

#[derive(Debug)]
pub enum ProviderOrchestrationError {
    SyncQuotaLimited {
        retry_after_secs: u64,
    },
    InvalidSyncClientInput,
    SyncQuotaCheckFailed,
    UnsupportedSyncProvider,
    SyncFailed {
        error: ProviderSyncError,
        user_id: Uuid,
        item_id: String,
    },
    UnsupportedConnectProvider,
    SetupTokenMissing,
    SetupTokenMalformed,
    SetupTokenAlreadyClaimed,
    SetupTokenClaimFailed,
    CredentialStorageFailed,
    SnapshotFetchFailed,
    ConnectionPersistenceFailed,
    NoInstitutionsOnBridge,
    AllInstitutionsHidden,
    NoInstitutionsLinked,
    InstitutionsRequireAuth(Vec<SimpleFinInstitutionAuthRequired>),
    LoadUserFailed,
    UserNotFound,
    SelectionUserMissing,
    LoadConnectionsFailed,
    ProviderNotRegistered(String),
    ProviderDisabled(String),
    ActiveConnectionConflict {
        conflicting_provider: String,
    },
    UpdateProviderFailed,
    ConnectionNotFound,
    DisconnectFailed,
    InvalidOrgConnId,
    ListIgnoredInstitutionsFailed,
    RestoreIgnoredInstitutionFailed,
}

pub struct SyncDependencies {
    pub rate_limit_service: Arc<ProviderSyncRateLimitService>,
    pub sync_service: Arc<SyncService>,
}

pub struct ProviderAvailability {
    pub registry: Arc<ProviderRegistry>,
    pub config: Config,
}

impl ProviderAvailability {
    fn is_registered(&self, provider: &str) -> bool {
        self.registry.get(provider).is_some()
    }

    fn is_enabled(&self, provider: &str) -> bool {
        self.config.is_financial_provider_enabled(provider)
    }

    fn is_available(&self, provider: &str) -> bool {
        self.is_registered(provider) && self.is_enabled(provider)
    }
}

pub struct ProviderOrchestrator {
    connection_service: Arc<ConnectionService>,
    repository: Arc<dyn DatabaseRepository>,
    cache: Arc<dyn CacheService>,
    sync: SyncDependencies,
    availability: ProviderAvailability,
}

impl ProviderOrchestrator {
    pub fn new(
        connection_service: Arc<ConnectionService>,
        repository: Arc<dyn DatabaseRepository>,
        cache: Arc<dyn CacheService>,
        sync: SyncDependencies,
        availability: ProviderAvailability,
    ) -> Self {
        Self {
            connection_service,
            repository,
            cache,
            sync,
            availability,
        }
    }

    pub async fn sync_transactions(
        &self,
        user_id: Uuid,
        jwt_id: &str,
        mut connection: ProviderConnection,
        request: ProviderSyncRequest,
    ) -> Result<SyncTransactionsResponse, ProviderOrchestrationError> {
        let provider = connection.provider.clone();

        match self
            .sync
            .rate_limit_service
            .try_consume_sync_quota(&user_id, &request.client_date, &request.client_timezone)
            .await
        {
            Ok(SyncQuotaDecision::Allowed { .. }) => {}
            Ok(SyncQuotaDecision::Limited { retry_after_secs }) => {
                return Err(ProviderOrchestrationError::SyncQuotaLimited { retry_after_secs });
            }
            Err(ProviderSyncRateLimitError::InvalidClientDate)
            | Err(ProviderSyncRateLimitError::InvalidClientTimezone) => {
                return Err(ProviderOrchestrationError::InvalidSyncClientInput);
            }
            Err(ProviderSyncRateLimitError::Cache(error)) => {
                tracing::error!(
                    error = %error,
                    user_id = %user_id,
                    "Sync quota check failed"
                );
                return Err(ProviderOrchestrationError::SyncQuotaCheckFailed);
            }
        }

        let sync_params = SyncConnectionParams {
            provider: provider.as_str(),
            user_id: &user_id,
            jwt_id,
        };

        self.availability
            .registry
            .get(&provider)
            .filter(|adapter| adapter.supports_transaction_sync())
            .ok_or_else(|| {
                tracing::error!(
                    "Sync transactions: unsupported provider '{}' for user {}",
                    connection.provider,
                    user_id
                );
                ProviderOrchestrationError::UnsupportedSyncProvider
            })?;

        match self
            .connection_service
            .sync_provider_connection(
                sync_params,
                self.sync.sync_service.as_ref(),
                &mut connection,
                Some(request.reference_date),
            )
            .await
        {
            Ok(response) => {
                if let Err(e) = self
                    .cache
                    .clear_jwt_scoped_bank_connection_cache(jwt_id, connection.id)
                    .await
                {
                    tracing::warn!(
                        "Failed to clear connection cache after sync for user {}: {}",
                        user_id,
                        e
                    );
                }

                if let Err(e) = self.cache.clear_transactions(jwt_id).await {
                    tracing::warn!(
                        "Failed to clear transaction cache after sync for user {}: {}",
                        user_id,
                        e
                    );
                }

                Ok(response)
            }
            Err(error) => Err(ProviderOrchestrationError::SyncFailed {
                error,
                user_id,
                item_id: connection.item_id.clone(),
            }),
        }
    }

    pub async fn connect(
        &self,
        user_id: Uuid,
        jwt_id: &str,
        req: &ProviderConnectRequest,
    ) -> Result<ProviderConnectResponse, ProviderOrchestrationError> {
        match req.provider.as_str() {
            "simplefin" => match self
                .connection_service
                .connect_simplefin_provider(&user_id, jwt_id, req)
                .await
            {
                Ok(response) => {
                    log_provider_credential_outcome("simplefin", STATUS_OK, "provider.connect");
                    Ok(response)
                }
                Err(SimpleFinConnectError::InvalidProvider) => {
                    log_provider_credential_outcome(
                        &req.provider,
                        STATUS_BAD_REQUEST,
                        "provider.connect",
                    );
                    Err(ProviderOrchestrationError::UnsupportedConnectProvider)
                }
                Err(SimpleFinConnectError::MissingSetupToken) => {
                    log_provider_credential_outcome(
                        "simplefin",
                        STATUS_BAD_REQUEST,
                        "provider.connect",
                    );
                    Err(ProviderOrchestrationError::SetupTokenMissing)
                }
                Err(SimpleFinConnectError::MalformedSetupToken) => {
                    log_provider_credential_outcome(
                        "simplefin",
                        STATUS_BAD_REQUEST,
                        "provider.connect",
                    );
                    Err(ProviderOrchestrationError::SetupTokenMalformed)
                }
                Err(SimpleFinConnectError::SetupTokenAlreadyClaimed) => {
                    log_provider_credential_outcome(
                        "simplefin",
                        STATUS_UNPROCESSABLE_ENTITY,
                        "provider.connect",
                    );
                    Err(ProviderOrchestrationError::SetupTokenAlreadyClaimed)
                }
                Err(SimpleFinConnectError::ClaimFailed(e)) => {
                    log_provider_credential_outcome(
                        "simplefin",
                        STATUS_UNPROCESSABLE_ENTITY,
                        "provider.connect",
                    );
                    tracing::error!(
                        "Failed to claim SimpleFIN access URL for user {}: {}",
                        user_id,
                        e
                    );
                    Err(ProviderOrchestrationError::SetupTokenClaimFailed)
                }
                Err(SimpleFinConnectError::CredentialStorage(e)) => {
                    log_provider_credential_outcome(
                        "simplefin",
                        STATUS_INTERNAL_SERVER_ERROR,
                        "provider.connect",
                    );
                    tracing::error!(
                        "Failed to store SimpleFIN credentials for user {}: {}",
                        user_id,
                        e
                    );
                    Err(ProviderOrchestrationError::CredentialStorageFailed)
                }
                Err(SimpleFinConnectError::SnapshotFetch(e)) => {
                    log_provider_credential_outcome(
                        "simplefin",
                        STATUS_FAILED_DEPENDENCY,
                        "provider.connect",
                    );
                    tracing::error!(
                        "Failed to fetch SimpleFIN account snapshot for user {}: {}",
                        user_id,
                        e
                    );
                    Err(ProviderOrchestrationError::SnapshotFetchFailed)
                }
                Err(SimpleFinConnectError::ConnectionPersistence(e)) => {
                    log_provider_credential_outcome(
                        "simplefin",
                        STATUS_INTERNAL_SERVER_ERROR,
                        "provider.connect",
                    );
                    tracing::error!(
                        "Failed to persist SimpleFIN connection for user {}: {}",
                        user_id,
                        e
                    );
                    Err(ProviderOrchestrationError::ConnectionPersistenceFailed)
                }
                Err(SimpleFinConnectError::NoInstitutionsOnBridge) => {
                    log_provider_credential_outcome(
                        "simplefin",
                        STATUS_UNPROCESSABLE_ENTITY,
                        "provider.connect",
                    );
                    Err(ProviderOrchestrationError::NoInstitutionsOnBridge)
                }
                Err(SimpleFinConnectError::AllInstitutionsHidden) => {
                    log_provider_credential_outcome(
                        "simplefin",
                        STATUS_UNPROCESSABLE_ENTITY,
                        "provider.connect",
                    );
                    Err(ProviderOrchestrationError::AllInstitutionsHidden)
                }
                Err(SimpleFinConnectError::NoInstitutionsLinked) => {
                    log_provider_credential_outcome(
                        "simplefin",
                        STATUS_UNPROCESSABLE_ENTITY,
                        "provider.connect",
                    );
                    Err(ProviderOrchestrationError::NoInstitutionsLinked)
                }
                Err(SimpleFinConnectError::InstitutionsRequireAuth(notices)) => {
                    log_provider_credential_outcome(
                        "simplefin",
                        STATUS_UNPROCESSABLE_ENTITY,
                        "provider.connect",
                    );
                    Err(ProviderOrchestrationError::InstitutionsRequireAuth(notices))
                }
            },
            _ => {
                log_provider_credential_outcome(
                    &req.provider,
                    STATUS_BAD_REQUEST,
                    "provider.connect",
                );
                Err(ProviderOrchestrationError::UnsupportedConnectProvider)
            }
        }
    }

    pub async fn status(
        &self,
        user_id: Uuid,
    ) -> Result<ProviderStatusResponse, ProviderOrchestrationError> {
        let provider = match self.repository.get_user_by_id(&user_id).await {
            Ok(Some(user)) => {
                if self.availability.is_available(&user.provider) {
                    user.provider
                } else {
                    String::new()
                }
            }
            Ok(None) => String::new(),
            Err(e) => {
                tracing::error!("Failed to load user {} for provider status: {}", user_id, e);
                return Err(ProviderOrchestrationError::LoadUserFailed);
            }
        };

        let connections = self.load_connection_statuses(&user_id).await?;

        Ok(ProviderStatusResponse {
            provider,
            connections,
        })
    }

    pub async fn info(
        &self,
        user_id: Uuid,
    ) -> Result<ProviderInfoResponse, ProviderOrchestrationError> {
        let user = self
            .repository
            .get_user_by_id(&user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get user {}: {}", user_id, e);
                ProviderOrchestrationError::LoadUserFailed
            })?
            .ok_or_else(|| {
                tracing::error!("User {} not found", user_id);
                ProviderOrchestrationError::UserNotFound
            })?;

        let mut available_providers = Vec::new();
        for provider in ["plaid", "simplefin", "diy"] {
            if !self.availability.is_registered(provider) {
                continue;
            }

            if !self.availability.is_enabled(provider) {
                continue;
            }

            available_providers.push(provider.to_string());
        }

        let user_provider = user
            .active_provider()
            .filter(|provider| self.availability.is_available(provider))
            .map(str::to_string);

        Ok(ProviderInfoResponse {
            available_providers,
            user_provider,
        })
    }

    pub async fn select(
        &self,
        user_id: Uuid,
        requested_provider: String,
    ) -> Result<ProviderSelectResponse, ProviderOrchestrationError> {
        if !self.availability.is_registered(&requested_provider) {
            return Err(ProviderOrchestrationError::ProviderNotRegistered(
                requested_provider,
            ));
        }

        if !self.availability.is_enabled(&requested_provider) {
            return Err(ProviderOrchestrationError::ProviderDisabled(
                requested_provider,
            ));
        }

        let _user = match self.repository.get_user_by_id(&user_id).await {
            Ok(Some(user)) => user,
            Ok(None) => {
                tracing::error!("User {} not found", user_id);
                return Err(ProviderOrchestrationError::SelectionUserMissing);
            }
            Err(e) => {
                tracing::error!("Failed to get user {}: {}", user_id, e);
                return Err(ProviderOrchestrationError::LoadUserFailed);
            }
        };

        let connections = match self
            .repository
            .get_all_provider_connections_by_user(&user_id)
            .await
        {
            Ok(conns) => conns,
            Err(e) => {
                tracing::error!("Failed to get connections for user {}: {}", user_id, e);
                return Err(ProviderOrchestrationError::LoadConnectionsFailed);
            }
        };

        if requested_provider != "diy" {
            if let Some(conflicting_provider) = connections.iter().find_map(|connection| {
                (connection.is_connected
                    && connection.provider != requested_provider
                    && connection.provider != "diy")
                    .then_some(connection.provider.as_str())
            }) {
                return Err(ProviderOrchestrationError::ActiveConnectionConflict {
                    conflicting_provider: conflicting_provider.to_string(),
                });
            }
        }

        match self
            .repository
            .update_user_provider(&user_id, &requested_provider)
            .await
        {
            Ok(_) => {
                tracing::info!("User {} selected provider: {}", user_id, requested_provider);
                Ok(ProviderSelectResponse {
                    user_provider: requested_provider,
                })
            }
            Err(e) => {
                tracing::error!("Failed to update provider for user {}: {}", user_id, e);
                Err(ProviderOrchestrationError::UpdateProviderFailed)
            }
        }
    }

    pub async fn disconnect(
        &self,
        user_id: Uuid,
        jwt_id: &str,
        connection: &ProviderConnection,
    ) -> Result<DisconnectResult, ProviderOrchestrationError> {
        match self
            .connection_service
            .disconnect_owned_connection(connection, &user_id, jwt_id)
            .await
        {
            Ok(result) if result.success => Ok(result),
            Ok(_) => Err(ProviderOrchestrationError::ConnectionNotFound),
            Err(e) => {
                tracing::error!("Failed to disconnect: {}", e);
                Err(ProviderOrchestrationError::DisconnectFailed)
            }
        }
    }

    pub async fn list_simplefin_ignored_institutions(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<SimpleFinIgnoredInstitution>, ProviderOrchestrationError> {
        self.connection_service
            .list_simplefin_ignored_institutions(&user_id)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to list SimpleFIN ignored institutions for user {}: {}",
                    user_id,
                    e
                );
                ProviderOrchestrationError::ListIgnoredInstitutionsFailed
            })
    }

    pub async fn restore_simplefin_ignored_institution(
        &self,
        user_id: Uuid,
        org_conn_id: &str,
    ) -> Result<bool, ProviderOrchestrationError> {
        let org_conn_id = org_conn_id.trim();
        if org_conn_id.is_empty() {
            return Err(ProviderOrchestrationError::InvalidOrgConnId);
        }

        self.connection_service
            .restore_simplefin_ignored_institution(&user_id, org_conn_id)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to restore SimpleFIN ignored institution for user {}: {}",
                    user_id,
                    e
                );
                ProviderOrchestrationError::RestoreIgnoredInstitutionFailed
            })
    }

    async fn load_connection_statuses(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<ProviderConnectionStatus>, ProviderOrchestrationError> {
        let connections = self
            .repository
            .get_all_provider_connections_by_user(user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get connections for user {}: {}", user_id, e);
                ProviderOrchestrationError::LoadConnectionsFailed
            })?;

        Ok(connections
            .into_iter()
            .filter(|conn| conn.is_connected)
            .map(|conn| ProviderConnectionStatus {
                is_connected: conn.is_connected,
                last_sync_at: conn.last_sync_at.map(|dt| dt.to_rfc3339()),
                institution_name: conn.institution_name,
                connection_id: Some(conn.id.to_string()),
                item_id: Some(conn.item_id),
                provider: conn.provider,
                transaction_count: conn.transaction_count,
                account_count: conn.account_count,
                sync_in_progress: false,
            })
            .collect())
    }
}
