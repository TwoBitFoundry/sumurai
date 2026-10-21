use std::sync::Arc;

use uuid::Uuid;

use crate::config::Config;
use crate::models::domain_error::DomainError;
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
pub enum ProviderSyncOrchestrationError {
    SyncQuotaLimited {
        retry_after_secs: u64,
    },
    SyncFailed {
        error: ProviderSyncError,
        user_id: Uuid,
        item_id: String,
    },
    Domain(DomainError),
}

impl From<DomainError> for ProviderSyncOrchestrationError {
    fn from(error: DomainError) -> Self {
        Self::Domain(error)
    }
}

#[derive(Debug)]
pub enum ProviderConnectOrchestrationError {
    InstitutionsRequireAuth(Vec<SimpleFinInstitutionAuthRequired>),
    Domain(DomainError),
}

impl From<DomainError> for ProviderConnectOrchestrationError {
    fn from(error: DomainError) -> Self {
        Self::Domain(error)
    }
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
    ) -> Result<SyncTransactionsResponse, ProviderSyncOrchestrationError> {
        let provider = connection.provider.clone();

        match self
            .sync
            .rate_limit_service
            .try_consume_sync_quota(&user_id, &request.client_date, &request.client_timezone)
            .await
        {
            Ok(SyncQuotaDecision::Allowed { .. }) => {}
            Ok(SyncQuotaDecision::Limited { retry_after_secs }) => {
                return Err(ProviderSyncOrchestrationError::SyncQuotaLimited { retry_after_secs });
            }
            Err(ProviderSyncRateLimitError::InvalidClientDate)
            | Err(ProviderSyncRateLimitError::InvalidClientTimezone) => {
                return Err(DomainError::bad_request("Invalid client date or timezone").into());
            }
            Err(ProviderSyncRateLimitError::Cache(error)) => {
                tracing::error!(
                    error = %error,
                    user_id = %user_id,
                    "Sync quota check failed"
                );
                return Err(DomainError::internal("Failed to check sync quota").into());
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
                DomainError::bad_request("Provider does not support transaction sync")
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
            Err(error) => Err(ProviderSyncOrchestrationError::SyncFailed {
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
    ) -> Result<ProviderConnectResponse, ProviderConnectOrchestrationError> {
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
                    Err(DomainError::bad_request("Unsupported provider").into())
                }
                Err(SimpleFinConnectError::MissingSetupToken) => {
                    log_provider_credential_outcome(
                        "simplefin",
                        STATUS_BAD_REQUEST,
                        "provider.connect",
                    );
                    Err(DomainError::bad_request(
                        "Provide a SimpleFIN setup token to connect this account",
                    )
                    .into())
                }
                Err(SimpleFinConnectError::MalformedSetupToken) => {
                    log_provider_credential_outcome(
                        "simplefin",
                        STATUS_BAD_REQUEST,
                        "provider.connect",
                    );
                    Err(DomainError::bad_request("The SimpleFIN setup token is malformed").into())
                }
                Err(SimpleFinConnectError::SetupTokenAlreadyClaimed) => {
                    log_provider_credential_outcome(
                        "simplefin",
                        STATUS_UNPROCESSABLE_ENTITY,
                        "provider.connect",
                    );
                    Err(DomainError::unprocessable(
                        "This SimpleFIN setup token has already been used",
                    )
                    .with_error_name("SETUP_TOKEN_ALREADY_CLAIMED")
                    .into())
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
                    Err(
                        DomainError::unprocessable("Could not claim the SimpleFIN setup token")
                            .with_error_name("SETUP_TOKEN_CLAIM_FAILED")
                            .into(),
                    )
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
                    Err(DomainError::internal("Failed to store credentials").into())
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
                    Err(DomainError::failed_dependency("SimpleFIN provider request failed").into())
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
                    Err(DomainError::internal("Failed to save connection").into())
                }
                Err(SimpleFinConnectError::NoInstitutionsOnBridge) => {
                    log_provider_credential_outcome(
                        "simplefin",
                        STATUS_UNPROCESSABLE_ENTITY,
                        "provider.connect",
                    );
                    Err(DomainError::unprocessable(
                        "No institutions are available from your SimpleFIN bridge yet",
                    )
                    .with_error_name("NO_INSTITUTIONS")
                    .into())
                }
                Err(SimpleFinConnectError::AllInstitutionsHidden) => {
                    log_provider_credential_outcome(
                        "simplefin",
                        STATUS_UNPROCESSABLE_ENTITY,
                        "provider.connect",
                    );
                    Err(DomainError::unprocessable(
                        "All SimpleFIN institutions are hidden in Sumurai. Restore one to start syncing.",
                    )
                    .with_error_name("ALL_INSTITUTIONS_HIDDEN").into())
                }
                Err(SimpleFinConnectError::NoInstitutionsLinked) => {
                    log_provider_credential_outcome(
                        "simplefin",
                        STATUS_UNPROCESSABLE_ENTITY,
                        "provider.connect",
                    );
                    Err(DomainError::unprocessable(
                        "No SimpleFIN institutions could be linked. Try again or check your bridge setup.",
                    )
                    .with_error_name("NO_INSTITUTIONS").into())
                }
                Err(SimpleFinConnectError::InstitutionsRequireAuth(notices)) => {
                    log_provider_credential_outcome(
                        "simplefin",
                        STATUS_UNPROCESSABLE_ENTITY,
                        "provider.connect",
                    );
                    Err(ProviderConnectOrchestrationError::InstitutionsRequireAuth(
                        notices,
                    ))
                }
            },
            _ => {
                log_provider_credential_outcome(
                    &req.provider,
                    STATUS_BAD_REQUEST,
                    "provider.connect",
                );
                Err(DomainError::bad_request("Unsupported provider").into())
            }
        }
    }

    pub async fn status(&self, user_id: Uuid) -> Result<ProviderStatusResponse, DomainError> {
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
                return Err(DomainError::internal("Failed to fetch user"));
            }
        };

        let connections = self.load_connection_statuses(&user_id).await?;

        Ok(ProviderStatusResponse {
            provider,
            connections,
        })
    }

    pub async fn info(&self, user_id: Uuid) -> Result<ProviderInfoResponse, DomainError> {
        let user = self
            .repository
            .get_user_by_id(&user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get user {}: {}", user_id, e);
                DomainError::internal("Failed to fetch user")
            })?
            .ok_or_else(|| {
                tracing::error!("User {} not found", user_id);
                DomainError::not_found("User not found")
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
    ) -> Result<ProviderSelectResponse, DomainError> {
        if !self.availability.is_registered(&requested_provider) {
            return Err(DomainError::bad_request(format!(
                "Provider '{}' is not registered",
                requested_provider
            )));
        }

        if !self.availability.is_enabled(&requested_provider) {
            return Err(DomainError::forbidden(format!(
                "Provider '{}' is disabled in this deployment",
                requested_provider
            ))
            .with_code("PROVIDER_DISABLED"));
        }

        let _user = match self.repository.get_user_by_id(&user_id).await {
            Ok(Some(user)) => user,
            Ok(None) => {
                tracing::error!("User {} not found", user_id);
                return Err(DomainError::internal("User not found"));
            }
            Err(e) => {
                tracing::error!("Failed to get user {}: {}", user_id, e);
                return Err(DomainError::internal("Failed to fetch user"));
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
                return Err(DomainError::internal("Failed to check active connections"));
            }
        };

        if requested_provider != "diy" {
            if let Some(conflicting_provider) = connections.iter().find_map(|connection| {
                (connection.is_connected
                    && connection.provider != requested_provider
                    && connection.provider != "diy")
                    .then_some(connection.provider.as_str())
            }) {
                return Err(DomainError::conflict(format!(
                    "Disconnect all {} accounts before switching",
                    conflicting_provider
                )));
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
                Err(DomainError::internal("Failed to update provider selection"))
            }
        }
    }

    pub async fn disconnect(
        &self,
        user_id: Uuid,
        jwt_id: &str,
        connection: &ProviderConnection,
    ) -> Result<DisconnectResult, DomainError> {
        match self
            .connection_service
            .disconnect_owned_connection(connection, &user_id, jwt_id)
            .await
        {
            Ok(result) if result.success => Ok(result),
            Ok(_) => Err(DomainError::not_found("Connection not found")),
            Err(e) => {
                tracing::error!("Failed to disconnect: {}", e);
                Err(DomainError::internal("Failed to disconnect connection"))
            }
        }
    }

    pub async fn list_simplefin_ignored_institutions(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<SimpleFinIgnoredInstitution>, DomainError> {
        self.connection_service
            .list_simplefin_ignored_institutions(&user_id)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to list SimpleFIN ignored institutions for user {}: {}",
                    user_id,
                    e
                );
                DomainError::internal("Failed to list ignored institutions")
            })
    }

    pub async fn restore_simplefin_ignored_institution(
        &self,
        user_id: Uuid,
        org_conn_id: &str,
    ) -> Result<bool, DomainError> {
        let org_conn_id = org_conn_id.trim();
        if org_conn_id.is_empty() {
            return Err(DomainError::bad_request(
                "Invalid institution connection id",
            ));
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
                DomainError::internal("Failed to restore ignored institution")
            })
    }

    async fn load_connection_statuses(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<ProviderConnectionStatus>, DomainError> {
        let connections = self
            .repository
            .get_all_provider_connections_by_user(user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get connections for user {}: {}", user_id, e);
                DomainError::internal("Failed to check active connections")
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
