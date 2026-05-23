//! Coordinates bank connections, sync completion, and session cache refresh after financial data changes.

use crate::models::{
    account::Account,
    cache::{BankConnectionSyncStatus, CachedBankAccounts, CachedBankConnection},
    plaid::{
        DataCleared, DisconnectResult, ExchangeTokenResponse, ProviderConnectRequest,
        ProviderConnectResponse, ProviderConnection,
    },
    simplefin::SimpleFinConnection,
    transaction::{SyncMetadata, SyncTransactionsResponse, Transaction},
};
use crate::providers::simplefin_provider::SimpleFinProvider;
use crate::providers::{
    FinancialDataProvider, InstitutionInfo, ProviderCredentials, ProviderRegistry,
};
use crate::services::categorization::categorization_service::Categorizer;
use crate::services::categorization::classifier_labels::format_classifier_input;
use crate::services::{
    cache_service::CacheService, repository_service::DatabaseRepository, sync_service::SyncService,
};
use anyhow::{Error, Result};
use chrono::NaiveDate;
use chrono::Utc;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use uuid::Uuid;

pub struct ConnectionService {
    db_repository: Arc<dyn DatabaseRepository>,
    cache_service: Arc<dyn CacheService>,
    provider_registry: Arc<ProviderRegistry>,
    categorizer: Arc<dyn Categorizer>,
    credential_resolvers:
        std::collections::HashMap<String, Arc<dyn crate::providers::ProviderCredentialResolver>>,
    simplefin_connection_service:
        Option<Arc<crate::services::simplefin_connection_service::SimpleFinConnectionService>>,
}

#[derive(Debug)]
pub enum TellerConnectError {
    #[allow(dead_code)]
    InvalidProvider(String),
    CredentialStorage(Error),
    ConnectionPersistence(Error),
}

#[derive(Debug)]
pub enum SimpleFinConnectError {
    #[allow(dead_code)]
    InvalidProvider(String),
    MissingSetupToken,
    MalformedSetupToken,
    SetupTokenAlreadyClaimed,
    ClaimFailed(Error),
    CredentialStorage(Error),
    ConnectionPersistence(Error),
    SnapshotFetch(Error),
    NoInstitutionsOnBridge,
    AllInstitutionsHidden,
    NoInstitutionsLinked,
}

#[derive(Debug)]
pub enum TellerSyncError {
    CredentialsMissing,
    CredentialAccess(Error),
    ProviderInitialization(Error),
    ProviderRequest(Error),
    AccountLookup(Error),
    TransactionLookup(Error),
    ConnectionPersistence(Error),
}

#[derive(Debug)]
pub enum LinkTokenError {
    ProviderUnavailable(String),
    ProviderRequest(Error),
}

#[derive(Debug)]
pub enum ExchangeTokenError {
    ProviderUnavailable(String),
    ExchangeFailed(Error),
}

#[derive(Debug)]
pub enum ProviderSyncError {
    CredentialsMissing,
    CredentialAccess(Error),
    ProviderUnavailable(String),
    ProviderRequest(Error),
    AccountLookup(Error),
    TransactionLookup(Error),
    SyncFailure(Error),
    RateLimited,
}

fn simplefin_sync_floor_ttl_seconds() -> u64 {
    std::env::var("SIMPLEFIN_SYNC_FLOOR_TTL_SECONDS")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(3600)
}

fn simplefin_sync_floor_key(user_id: &Uuid) -> String {
    format!("simplefin:sync-floor:{user_id}")
}

fn simplefin_org_item_id(user_id: &Uuid, org_conn_id: &str) -> String {
    format!("simplefin_{user_id}_{org_conn_id}")
}

fn simplefin_connect_error_from_message(message: &str) -> SimpleFinConnectError {
    if message.contains("must be provided") {
        SimpleFinConnectError::MissingSetupToken
    } else if message.contains("malformed") {
        SimpleFinConnectError::MalformedSetupToken
    } else if message.contains("already been claimed") {
        SimpleFinConnectError::SetupTokenAlreadyClaimed
    } else if message.contains("claim failed") {
        SimpleFinConnectError::ClaimFailed(anyhow::anyhow!(message.to_string()))
    } else {
        SimpleFinConnectError::CredentialStorage(anyhow::anyhow!(message.to_string()))
    }
}

#[deprecated(
    since = "5.16.0",
    note = "Use ProviderConnection.provider field instead of item_id pattern matching"
)]
fn is_simplefin_org_item_id(item_id: &str) -> bool {
    item_id.starts_with("simplefin_") && !item_id.starts_with("simplefin_root_")
}

#[deprecated(
    since = "5.16.0",
    note = "Use ProviderConnection.provider field instead of item_id pattern matching"
)]
fn simplefin_org_conn_id_from_item_id(item_id: &str, user_id: &Uuid) -> Option<String> {
    #[allow(deprecated)]
    if !is_simplefin_org_item_id(item_id) {
        return None;
    }

    let scoped_prefix = format!("simplefin_{user_id}_");
    if let Some(conn_id) = item_id.strip_prefix(&scoped_prefix) {
        return Some(conn_id.to_string());
    }

    item_id.strip_prefix("simplefin_").map(str::to_string)
}

#[deprecated(
    since = "5.16.0",
    note = "Use ProviderConnection.provider field instead of item_id pattern matching"
)]
pub fn simplefin_conn_id_from_item_id(item_id: &str, user_id: &Uuid) -> Option<String> {
    #[allow(deprecated)]
    simplefin_org_conn_id_from_item_id(item_id, user_id)
}

pub struct SyncConnectionParams<'a> {
    pub provider: &'a str,
    pub user_id: &'a Uuid,
    pub jwt_id: &'a str,
}

impl ConnectionService {
    pub fn new(
        db_repository: Arc<dyn DatabaseRepository>,
        cache_service: Arc<dyn CacheService>,
        provider_registry: Arc<ProviderRegistry>,
        categorizer: Arc<dyn Categorizer>,
        credential_resolvers: std::collections::HashMap<
            String,
            Arc<dyn crate::providers::ProviderCredentialResolver>,
        >,
    ) -> Self {
        Self {
            db_repository,
            cache_service,
            provider_registry,
            categorizer,
            credential_resolvers,
            simplefin_connection_service: None,
        }
    }

    pub fn with_simplefin_connection_service(
        mut self,
        service: Arc<crate::services::simplefin_connection_service::SimpleFinConnectionService>,
    ) -> Self {
        self.simplefin_connection_service = Some(service);
        self
    }

    async fn resolve_simplefin_credentials_for_connect(
        &self,
        user_id: &Uuid,
        provider: Arc<dyn FinancialDataProvider>,
        setup_token: Option<&str>,
    ) -> Result<ProviderCredentials, SimpleFinConnectError> {
        let resolver = self
            .credential_resolvers
            .get("simplefin")
            .ok_or(SimpleFinConnectError::MissingSetupToken)?;

        resolver
            .resolve_for_connect(user_id, provider, setup_token)
            .await
            .map_err(|error| simplefin_connect_error_from_message(&error.to_string()))
    }

    fn resolve_provider(&self, provider: &str) -> Option<Arc<dyn FinancialDataProvider>> {
        self.provider_registry.get(provider)
    }

    #[tracing::instrument(
        skip(self),
        fields(connection_id = %connection_id)
    )]
    pub async fn disconnect_connection_by_id(
        &self,
        connection_id: &Uuid,
        user_id: &Uuid,
        jwt_id: &str,
    ) -> Result<DisconnectResult> {
        let connection = self
            .db_repository
            .get_provider_connection_by_id(connection_id, user_id)
            .await?;

        let Some(conn) = connection else {
            return Ok(DisconnectResult {
                success: false,
                message: "Connection not found".to_string(),
                data_cleared: DataCleared {
                    transactions: 0,
                    accounts: 0,
                    cache_keys: vec![],
                },
            });
        };

        self.disconnect_owned_connection(&conn, user_id, jwt_id)
            .await
    }

    pub async fn disconnect_owned_connection(
        &self,
        connection: &ProviderConnection,
        user_id: &Uuid,
        jwt_id: &str,
    ) -> Result<DisconnectResult> {
        if connection.user_id != *user_id {
            return Err(anyhow::anyhow!("Connection does not belong to user"));
        }

        self.cache_service
            .clear_jwt_scoped_bank_connection_cache(jwt_id, connection.id)
            .await?;

        #[allow(deprecated)]
        let cleared_keys = if is_simplefin_org_item_id(&connection.item_id) {
            #[allow(deprecated)]
            let org_conn_id = simplefin_org_conn_id_from_item_id(&connection.item_id, user_id)
                .ok_or_else(|| anyhow::anyhow!("Invalid SimpleFIN item_id"))?;
            let overview_keys = self
                .clear_all_plaid_cache_data(jwt_id, &connection.item_id)
                .await?;
            let institution_name = connection.institution_name.as_deref();
            let (deleted_transactions, deleted_accounts) = self
                .db_repository
                .disconnect_simplefin_org(
                    user_id,
                    &connection.item_id,
                    &org_conn_id,
                    institution_name,
                )
                .await?;

            tracing::info!(
                connection_id = %connection.id,
                org_conn_id = %org_conn_id,
                transactions_deleted = deleted_transactions,
                accounts_deleted = deleted_accounts,
                "SimpleFIN org disconnected"
            );

            return Ok(DisconnectResult {
                success: true,
                message: "Successfully disconnected bank connection".to_string(),
                data_cleared: DataCleared {
                    transactions: deleted_transactions,
                    accounts: deleted_accounts,
                    cache_keys: overview_keys,
                },
            });
        } else {
            self.clear_all_plaid_cache_data(jwt_id, &connection.item_id)
                .await?
        };

        let deleted_transactions = self
            .db_repository
            .delete_provider_transactions(&connection.item_id)
            .await?;
        let deleted_accounts = self
            .db_repository
            .delete_provider_accounts(&connection.item_id)
            .await?;

        self.db_repository
            .delete_provider_credentials(&connection.item_id)
            .await?;

        self.db_repository
            .delete_provider_connection(user_id, &connection.item_id)
            .await?;

        tracing::info!(
            connection_id = %connection.id,
            transactions_deleted = deleted_transactions,
            accounts_deleted = deleted_accounts,
            "Provider connection disconnected"
        );

        Ok(DisconnectResult {
            success: true,
            message: "Successfully disconnected bank connection".to_string(),
            data_cleared: DataCleared {
                transactions: deleted_transactions,
                accounts: deleted_accounts,
                cache_keys: cleared_keys,
            },
        })
    }

    pub async fn connect_teller_provider(
        &self,
        user_id: &Uuid,
        jwt_id: &str,
        request: &ProviderConnectRequest,
    ) -> Result<ProviderConnectResponse, TellerConnectError> {
        if request.provider.as_str() != "teller" {
            return Err(TellerConnectError::InvalidProvider(
                request.provider.clone(),
            ));
        }

        let provider = self
            .resolve_provider("teller")
            .ok_or_else(|| TellerConnectError::InvalidProvider("teller".to_string()))?;

        let item_id = format!("teller_{}", request.enrollment_id);
        self.db_repository
            .store_provider_credentials_for_user(user_id, &item_id, &request.access_token)
            .await
            .map_err(TellerConnectError::CredentialStorage)?;

        let institution_name = request
            .institution_name
            .clone()
            .unwrap_or_else(|| "Connected Bank".to_string());

        let mut connection = ProviderConnection::new(*user_id, &item_id);
        connection.provider = "teller".to_string();
        connection.mark_connected(&institution_name);
        connection.institution_id = Some("teller".to_string());
        connection.transaction_count = 0;
        connection.account_count = 0;
        connection.last_sync_at = None;
        connection.sync_cursor = None;

        self.db_repository
            .save_provider_connection(&connection)
            .await
            .map_err(TellerConnectError::ConnectionPersistence)?;

        let provider_credentials = ProviderCredentials {
            provider: "teller".to_string(),
            access_token: request.access_token.clone(),
            item_id: item_id.clone(),
            certificate: None,
            private_key: None,
        };

        let mut persisted_accounts = Vec::new();

        match provider.get_accounts(&provider_credentials).await {
            Ok(accounts) => {
                for mut account in accounts {
                    account.user_id = Some(*user_id);
                    account.provider_connection_id = Some(connection.id);

                    match self.db_repository.upsert_account(&account).await {
                        Ok(_) => persisted_accounts.push(account),
                        Err(e) => {
                            tracing::warn!(
                                "Failed to persist Teller account {} for user {}: {}",
                                account.provider_account_id.as_deref().unwrap_or("unknown"),
                                user_id,
                                e
                            );
                        }
                    }
                }
            }
            Err(e) => {
                tracing::warn!(
                    "Failed to fetch Teller accounts during connect for user {}: {}",
                    user_id,
                    e
                );
            }
        }

        if !persisted_accounts.is_empty() {
            connection.account_count = persisted_accounts.len() as i32;

            if let Err(e) = self
                .db_repository
                .save_provider_connection(&connection)
                .await
            {
                tracing::warn!(
                    "Failed to update Teller connection account count for user {}: {}",
                    user_id,
                    e
                );
            }

            if let Err(e) = self
                .complete_sync_with_jwt_cache_update(jwt_id, &connection, &persisted_accounts)
                .await
            {
                tracing::warn!(
                    "Failed to update JWT-scoped caches after Teller connect for user {}: {}",
                    user_id,
                    e
                );
            }
        }

        Ok(ProviderConnectResponse {
            connection_id: connection.id.to_string(),
            institution_name,
        })
    }

    pub async fn list_simplefin_ignored_institutions(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<crate::models::simplefin::SimpleFinIgnoredInstitution>, anyhow::Error> {
        self.db_repository
            .list_simplefin_ignored_institutions(user_id)
            .await
    }

    pub async fn restore_simplefin_ignored_institution(
        &self,
        user_id: &Uuid,
        org_conn_id: &str,
    ) -> Result<bool, anyhow::Error> {
        let restored = self
            .db_repository
            .remove_simplefin_hidden_org(user_id, org_conn_id)
            .await?;

        if restored {
            return Ok(true);
        }

        let hidden_orgs = self
            .db_repository
            .list_simplefin_hidden_orgs(user_id)
            .await?;

        for hidden_id in hidden_orgs {
            if hidden_id == org_conn_id {
                continue;
            }

            if org_conn_id.contains(&hidden_id) || hidden_id.contains(org_conn_id) {
                let removed = self
                    .db_repository
                    .remove_simplefin_hidden_org(user_id, &hidden_id)
                    .await?;
                if removed {
                    return Ok(true);
                }
            }
        }

        Ok(false)
    }

    pub async fn connect_simplefin_provider(
        &self,
        user_id: &Uuid,
        jwt_id: &str,
        request: &ProviderConnectRequest,
    ) -> Result<ProviderConnectResponse, SimpleFinConnectError> {
        if let Some(service) = self.simplefin_connection_service.as_ref() {
            return service.connect(user_id, jwt_id, request).await;
        }

        if request.provider.as_str() != "simplefin" {
            return Err(SimpleFinConnectError::InvalidProvider(
                request.provider.clone(),
            ));
        }

        let provider = self
            .resolve_provider("simplefin")
            .ok_or_else(|| SimpleFinConnectError::InvalidProvider("simplefin".to_string()))?;

        let credentials = self
            .resolve_simplefin_credentials_for_connect(
                user_id,
                provider.clone(),
                request.simplefin_setup_token.as_deref(),
            )
            .await?;

        let snapshot = provider
            .fetch_balances_snapshot(&credentials)
            .await
            .map_err(SimpleFinConnectError::SnapshotFetch)?
            .ok_or_else(|| {
                SimpleFinConnectError::SnapshotFetch(anyhow::anyhow!(
                    "SimpleFIN balances snapshot unavailable"
                ))
            })?;

        let hidden_orgs = self
            .db_repository
            .list_simplefin_hidden_orgs(user_id)
            .await
            .map_err(SimpleFinConnectError::ConnectionPersistence)?;

        let mut first_connection_id = None;
        let mut institution_count = 0;

        for org in &snapshot.connections {
            if crate::services::simplefin_org_service::org_is_hidden(&hidden_orgs, org) {
                continue;
            }

            let persisted = self
                .persist_simplefin_org_connection(
                    user_id,
                    jwt_id,
                    &credentials,
                    org,
                    &snapshot.accounts,
                )
                .await
                .map_err(SimpleFinConnectError::ConnectionPersistence)?;

            if let Some(connection_id) = persisted {
                institution_count += 1;
                if first_connection_id.is_none() {
                    first_connection_id = Some(connection_id);
                }
            }
        }

        if institution_count == 0 {
            if snapshot.connections.is_empty() {
                return Err(SimpleFinConnectError::NoInstitutionsOnBridge);
            }
            if snapshot
                .connections
                .iter()
                .all(|org| crate::services::simplefin_org_service::org_is_hidden(&hidden_orgs, org))
            {
                return Err(SimpleFinConnectError::AllInstitutionsHidden);
            }
            return Err(SimpleFinConnectError::NoInstitutionsLinked);
        }

        let connection_id = first_connection_id
            .expect("institution_count > 0 implies a persisted connection id")
            .to_string();

        Ok(ProviderConnectResponse {
            connection_id,
            institution_name: format!("SimpleFIN ({institution_count} institutions)"),
        })
    }

    pub async fn load_simplefin_access_url(
        &self,
        user_id: &Uuid,
    ) -> Result<ProviderCredentials, SimpleFinConnectError> {
        let resolver = self
            .credential_resolvers
            .get("simplefin")
            .ok_or(SimpleFinConnectError::MissingSetupToken)?;

        resolver
            .resolve_for_sync(user_id)
            .await
            .map_err(SimpleFinConnectError::CredentialStorage)
    }

    #[allow(clippy::too_many_arguments)]
    async fn persist_simplefin_org_connection(
        &self,
        user_id: &Uuid,
        jwt_id: &str,
        _credentials: &ProviderCredentials,
        org: &SimpleFinConnection,
        snapshot_accounts: &[crate::models::simplefin::SimpleFinAccount],
    ) -> Result<Option<Uuid>> {
        let item_id = simplefin_org_item_id(user_id, &org.conn_id);
        let mut connection = ProviderConnection::new(*user_id, &item_id);
        connection.provider = "simplefin".to_string();
        connection.mark_connected(&org.name);
        connection.institution_id = Some(org.org_id.clone());
        connection.institution_name = Some(org.name.clone());
        connection.transaction_count = 0;
        connection.account_count = 0;
        connection.last_sync_at = None;
        connection.sync_cursor = None;

        self.db_repository
            .save_provider_connection(&connection)
            .await?;

        let mut persisted_accounts = Vec::new();
        for simplefin_account in snapshot_accounts
            .iter()
            .filter(|account| account.org_conn_id().as_deref() == Some(org.conn_id.as_str()))
        {
            let mut account = SimpleFinProvider::map_account(simplefin_account);
            account.user_id = Some(*user_id);
            account.provider_connection_id = Some(connection.id);

            match self.db_repository.upsert_account(&account).await {
                Ok(_) => persisted_accounts.push(account),
                Err(e) => {
                    tracing::warn!(
                        "Failed to persist SimpleFIN account {} for user {}: {}",
                        simplefin_account.id,
                        user_id,
                        e
                    );
                }
            }
        }

        if !persisted_accounts.is_empty() {
            connection.account_count = persisted_accounts.len() as i32;
            if let Err(e) = self
                .db_repository
                .save_provider_connection(&connection)
                .await
            {
                tracing::warn!(
                    "Failed to update SimpleFIN connection account count for user {}: {}",
                    user_id,
                    e
                );
            }

            if let Err(e) = self
                .complete_sync_with_jwt_cache_update(jwt_id, &connection, &persisted_accounts)
                .await
            {
                tracing::warn!(
                    "Failed to update JWT-scoped caches after SimpleFIN connect for user {}: {}",
                    user_id,
                    e
                );
            }
        }

        Ok(Some(connection.id))
    }

    pub async fn create_link_token(
        &self,
        provider: &str,
        user_id: &Uuid,
    ) -> Result<String, LinkTokenError> {
        let provider = self
            .resolve_provider(provider)
            .ok_or_else(|| LinkTokenError::ProviderUnavailable(provider.to_string()))?;

        provider
            .as_ref()
            .create_link_token(user_id)
            .await
            .map_err(LinkTokenError::ProviderRequest)
    }

    #[tracing::instrument(
        skip(self, public_token),
        fields(provider = provider)
    )]
    pub async fn exchange_public_token(
        &self,
        provider: &str,
        user_id: &Uuid,
        jwt_id: &str,
        public_token: &str,
    ) -> Result<ExchangeTokenResponse, ExchangeTokenError> {
        let provider = self
            .resolve_provider(provider)
            .ok_or_else(|| ExchangeTokenError::ProviderUnavailable(provider.to_string()))?;

        let credentials = provider
            .as_ref()
            .exchange_public_token(public_token)
            .await
            .map_err(ExchangeTokenError::ExchangeFailed)?;

        let institution_info = match provider.as_ref().get_institution_info(&credentials).await {
            Ok(info) => info,
            Err(e) => {
                tracing::warn!(
                    "Failed to fetch institution info for provider {} and user {}: {}. Using fallback metadata.",
                    provider.provider_name(),
                    user_id,
                    e
                );
                InstitutionInfo {
                    institution_id: credentials.item_id.clone(),
                    name: "Connected Bank".to_string(),
                    logo: None,
                    color: None,
                }
            }
        };

        if let Err(e) = self
            .db_repository
            .store_provider_credentials_for_user(
                user_id,
                &credentials.item_id,
                &credentials.access_token,
            )
            .await
        {
            tracing::warn!(
                "Failed to store credentials for provider {} and user {}: {}",
                provider.provider_name(),
                user_id,
                e
            );
        }

        if let Err(e) = self
            .cache_service
            .set_access_token(jwt_id, &credentials.item_id, &credentials.access_token)
            .await
        {
            tracing::warn!(
                "Failed to cache access token for provider {} and user {}: {}",
                provider.provider_name(),
                user_id,
                e
            );
        }

        let mut connection = ProviderConnection::new(*user_id, &credentials.item_id);
        connection.provider = provider.provider_name().to_string();
        connection.mark_connected(&institution_info.name);
        connection.institution_id = Some(institution_info.institution_id.clone());
        connection.institution_name = Some(institution_info.name.clone());

        if let Err(e) = self
            .db_repository
            .save_provider_connection(&connection)
            .await
        {
            tracing::warn!(
                "Failed to persist provider connection {} for user {}: {}",
                connection.id,
                user_id,
                e
            );
        }

        tracing::info!(
            provider = provider.provider_name(),
            institution_id = %connection.institution_id.as_deref().unwrap_or("unknown"),
            institution_name = %connection.institution_name.as_deref().unwrap_or("Unknown Bank"),
            "Provider connection established"
        );

        Ok(ExchangeTokenResponse {
            access_token: credentials.access_token,
            item_id: connection.item_id,
            institution_id: connection.institution_id.clone(),
            institution_name: connection
                .institution_name
                .clone()
                .unwrap_or_else(|| "Connected Bank".to_string()),
            connection_id: connection.id.to_string(),
        })
    }

    #[tracing::instrument(
        skip(self, sync_service, connection, params),
        fields(provider = %params.provider, connection_id = %connection.id)
    )]
    pub async fn sync_provider_connection(
        &self,
        params: SyncConnectionParams<'_>,
        sync_service: &SyncService,
        connection: &mut ProviderConnection,
        reference_date: Option<NaiveDate>,
    ) -> Result<SyncTransactionsResponse, ProviderSyncError> {
        if params.provider == "simplefin" {
            return self
                .sync_simplefin_connection(params, sync_service, connection, reference_date)
                .await;
        }

        let sync_timestamp = Utc::now();
        let (sync_start_date, sync_end_date) =
            sync_service.calculate_sync_date_range(connection.last_sync_at, reference_date);

        let credentials_record = self
            .db_repository
            .get_provider_credentials_for_user(params.user_id, &connection.item_id)
            .await
            .map_err(ProviderSyncError::CredentialAccess)?
            .ok_or(ProviderSyncError::CredentialsMissing)?;

        let provider_credentials = ProviderCredentials {
            provider: params.provider.to_string(),
            access_token: credentials_record.access_token.clone(),
            item_id: connection.item_id.clone(),
            certificate: None,
            private_key: None,
        };

        let provider_impl = self
            .resolve_provider(params.provider)
            .ok_or_else(|| ProviderSyncError::ProviderUnavailable(params.provider.to_string()))?;

        let fetched_accounts = provider_impl
            .as_ref()
            .get_accounts(&provider_credentials)
            .await
            .map_err(ProviderSyncError::ProviderRequest)?;

        for mut account in fetched_accounts {
            account.user_id = Some(*params.user_id);
            account.provider_connection_id = Some(connection.id);

            if let Err(e) = self.db_repository.upsert_account(&account).await {
                tracing::warn!(
                    "Failed to persist account {} for user {}: {}",
                    account.provider_account_id.as_deref().unwrap_or("unknown"),
                    params.user_id,
                    e
                );
            }
        }

        let db_accounts = self
            .db_repository
            .get_accounts_for_user(params.user_id)
            .await
            .map_err(ProviderSyncError::AccountLookup)?;

        let (mut transactions, new_cursor, page_count) = sync_service
            .sync_bank_connection_transactions(
                &provider_credentials,
                connection,
                &db_accounts,
                reference_date,
            )
            .await
            .map_err(ProviderSyncError::SyncFailure)?;

        let existing_provider_transaction_ids = self
            .db_repository
            .get_provider_transaction_ids_for_user(params.user_id)
            .await
            .map_err(ProviderSyncError::TransactionLookup)?;

        transactions = sync_service.filter_duplicate_transactions_by_provider_ids(
            &existing_provider_transaction_ids,
            &transactions,
        );

        for txn in &mut transactions {
            txn.user_id = Some(*params.user_id);
        }

        let valid_transactions: Vec<Transaction> = transactions
            .iter()
            .filter_map(|transaction| {
                if transaction.account_id.is_nil() {
                    tracing::warn!(
                        "Skipping transaction {:?} for user {} because account mapping is missing",
                        transaction.provider_transaction_id,
                        params.user_id
                    );
                    None
                } else {
                    Some(transaction.clone())
                }
            })
            .collect();

        for chunk in valid_transactions.chunks(500) {
            if let Err(e) = self
                .db_repository
                .upsert_transactions_batch(chunk, params.user_id)
                .await
            {
                tracing::warn!(
                    "Failed to persist transaction batch for user {}: {}",
                    params.user_id,
                    e
                );
            }
        }

        for transaction in &valid_transactions {
            if let Err(e) = self
                .cache_service
                .add_transaction(params.jwt_id, transaction)
                .await
            {
                tracing::warn!(
                    "Failed to cache transaction {:?} for user {}: {}",
                    transaction.provider_transaction_id,
                    params.user_id,
                    e
                );
            }
        }

        let transactions = valid_transactions;

        let total_transactions = self
            .db_repository
            .count_transactions(params.user_id, None, None, None, None, None)
            .await
            .map(|count| count as i32)
            .unwrap_or(0);
        let total_accounts = db_accounts.len() as i32;

        connection.update_sync_info(total_transactions, total_accounts);
        connection.sync_cursor = Some(new_cursor);
        connection.last_sync_at = Some(sync_timestamp);

        if let Err(e) = self
            .db_repository
            .save_provider_connection(connection)
            .await
        {
            tracing::warn!(
                "Failed to update provider connection {} for user {}: {}",
                connection.id,
                params.user_id,
                e
            );
        }

        if let Err(e) = self
            .complete_sync_with_jwt_cache_update(params.jwt_id, connection, &db_accounts)
            .await
        {
            tracing::warn!(
                "Failed to update JWT-scoped caches after sync for user {}: {}",
                params.user_id,
                e
            );
        }

        tracing::info!(
            provider = params.provider,
            connection_id = %connection.id,
            transaction_count = total_transactions,
            account_count = total_accounts,
            page_count = page_count,
            start_date = %sync_start_date,
            end_date = %sync_end_date,
            "Transaction sync completed"
        );

        Ok(SyncTransactionsResponse {
            transactions,
            metadata: SyncMetadata {
                transaction_count: total_transactions,
                account_count: total_accounts,
                sync_timestamp: sync_timestamp.to_rfc3339(),
                start_date: sync_start_date.to_string(),
                end_date: sync_end_date.to_string(),
                connection_updated: true,
            },
        })
    }

    #[tracing::instrument(
        skip(self, sync_service, connection, params),
        fields(provider = "simplefin", connection_id = %connection.id)
    )]
    pub async fn sync_simplefin_connection(
        &self,
        params: SyncConnectionParams<'_>,
        sync_service: &SyncService,
        connection: &mut ProviderConnection,
        reference_date: Option<NaiveDate>,
    ) -> Result<SyncTransactionsResponse, ProviderSyncError> {
        if let Some(service) = self.simplefin_connection_service.as_ref() {
            return service
                .sync(params, sync_service, connection, reference_date)
                .await;
        }

        let sync_timestamp = Utc::now();
        let (sync_start_date, sync_end_date) =
            sync_service.calculate_sync_date_range(connection.last_sync_at, reference_date);

        tracing::info!(
            provider = "simplefin",
            user_id = %params.user_id,
            connection_id = %connection.id,
            item_id = %connection.item_id,
            sync_start_date = %sync_start_date,
            sync_end_date = %sync_end_date,
            last_sync_at = ?connection.last_sync_at,
            "SimpleFIN connection sync started"
        );

        let floor_key = simplefin_sync_floor_key(params.user_id);
        if self
            .cache_service
            .get_string(&floor_key)
            .await
            .map_err(ProviderSyncError::SyncFailure)?
            .is_some()
        {
            tracing::info!(
                provider = "simplefin",
                user_id = %params.user_id,
                connection_id = %connection.id,
                "SimpleFIN sync skipped: hourly rate floor active"
            );
            return Err(ProviderSyncError::RateLimited);
        }

        #[allow(deprecated)]
        let conn_id = simplefin_conn_id_from_item_id(&connection.item_id, params.user_id).ok_or(
            ProviderSyncError::SyncFailure(anyhow::anyhow!("Invalid SimpleFIN connection item_id")),
        )?;

        tracing::info!(
            provider = "simplefin",
            connection_id = %connection.id,
            org_conn_id = %conn_id,
            "SimpleFIN connection sync resolved org"
        );

        let hidden_orgs = self
            .db_repository
            .list_simplefin_hidden_orgs(params.user_id)
            .await
            .map_err(ProviderSyncError::SyncFailure)?;

        if crate::services::simplefin_org_service::conn_id_is_hidden(
            &hidden_orgs,
            &conn_id,
            connection.institution_id.as_deref(),
        ) {
            return Ok(SyncTransactionsResponse {
                transactions: Vec::new(),
                metadata: SyncMetadata {
                    transaction_count: connection.transaction_count,
                    account_count: connection.account_count,
                    sync_timestamp: sync_timestamp.to_rfc3339(),
                    start_date: sync_start_date.to_string(),
                    end_date: sync_end_date.to_string(),
                    connection_updated: false,
                },
            });
        }

        let provider_credentials = self
            .load_simplefin_access_url(params.user_id)
            .await
            .map_err(|error| match error {
                SimpleFinConnectError::CredentialStorage(source) => {
                    ProviderSyncError::CredentialAccess(source)
                }
                _ => ProviderSyncError::CredentialsMissing,
            })?;

        let provider_impl = self
            .resolve_provider("simplefin")
            .ok_or_else(|| ProviderSyncError::ProviderUnavailable("simplefin".to_string()))?;

        let snapshot = provider_impl
            .as_ref()
            .fetch_balances_snapshot(&provider_credentials)
            .await
            .map_err(ProviderSyncError::ProviderRequest)?
            .ok_or_else(|| {
                ProviderSyncError::ProviderRequest(anyhow::anyhow!(
                    "SimpleFIN balances snapshot unavailable"
                ))
            })?;

        let connection_accounts: Vec<Account> = snapshot
            .accounts
            .iter()
            .filter(|account| {
                account.org_conn_id().as_deref() == Some(conn_id.as_str())
                    && !crate::services::simplefin_org_service::conn_id_is_hidden(
                        &hidden_orgs,
                        &conn_id,
                        connection.institution_id.as_deref(),
                    )
            })
            .map(SimpleFinProvider::map_account)
            .collect();

        for mut account in connection_accounts {
            account.user_id = Some(*params.user_id);
            account.provider_connection_id = Some(connection.id);

            if let Err(e) = self.db_repository.upsert_account(&account).await {
                tracing::warn!(
                    "Failed to persist SimpleFIN account {} for user {}: {}",
                    account.provider_account_id.as_deref().unwrap_or("unknown"),
                    params.user_id,
                    e
                );
            }
        }

        let db_accounts: Vec<Account> = self
            .db_repository
            .get_accounts_for_user(params.user_id)
            .await
            .map_err(ProviderSyncError::AccountLookup)?
            .into_iter()
            .filter(|account| account.provider_connection_id == Some(connection.id))
            .collect();

        let db_account_ids: Vec<String> = db_accounts
            .iter()
            .filter_map(|account| account.provider_account_id.clone())
            .collect();
        tracing::info!(
            provider = "simplefin",
            connection_id = %connection.id,
            org_conn_id = %conn_id,
            db_account_count = db_accounts.len(),
            db_provider_account_ids = ?db_account_ids,
            "SimpleFIN connection sync loaded DB accounts"
        );

        let (mut transactions, new_cursor, page_count) = sync_service
            .sync_bank_connection_transactions(
                &provider_credentials,
                connection,
                &db_accounts,
                reference_date,
            )
            .await
            .map_err(|error| {
                tracing::error!(
                    provider = "simplefin",
                    connection_id = %connection.id,
                    org_conn_id = %conn_id,
                    error = %error,
                    "SimpleFIN provider transaction fetch failed"
                );
                ProviderSyncError::SyncFailure(error)
            })?;

        let fetched_count = transactions.len();
        transactions = SyncService::filter_simplefin_transactions_for_connection(
            transactions,
            &db_accounts,
            &conn_id,
            &hidden_orgs,
        );
        let after_connection_filter_count = transactions.len();

        let existing_provider_transaction_ids = self
            .db_repository
            .get_provider_transaction_ids_for_user(params.user_id)
            .await
            .map_err(ProviderSyncError::TransactionLookup)?;

        transactions = sync_service.filter_duplicate_transactions_by_provider_ids(
            &existing_provider_transaction_ids,
            &transactions,
        );
        let after_dedupe_count = transactions.len();

        tracing::info!(
            provider = "simplefin",
            connection_id = %connection.id,
            org_conn_id = %conn_id,
            fetched_count,
            after_connection_filter_count,
            after_dedupe_count,
            page_count,
            new_cursor = %new_cursor,
            "SimpleFIN connection sync transaction pipeline"
        );

        for txn in &mut transactions {
            txn.user_id = Some(*params.user_id);
        }

        let mut valid_transactions: Vec<Transaction> = transactions
            .iter()
            .filter_map(|transaction| {
                if transaction.account_id.is_nil() {
                    tracing::warn!(
                        "Skipping transaction {:?} for user {} because account mapping is missing",
                        transaction.provider_transaction_id,
                        params.user_id
                    );
                    None
                } else {
                    Some(transaction.clone())
                }
            })
            .collect();

        let mut categorizable_indexes = Vec::new();
        let mut categorizable_inputs = Vec::new();
        for (index, txn) in valid_transactions.iter().enumerate() {
            if txn.category_primary == "OTHER" {
                categorizable_indexes.push(index);
                categorizable_inputs.push(format_classifier_input(
                    &txn.amount,
                    txn.merchant_name.as_deref().unwrap_or_default(),
                ));
            }
        }

        if !categorizable_inputs.is_empty() {
            match self
                .categorizer
                .categorize_batch(categorizable_inputs)
                .await
            {
                Ok(predictions) => {
                    use crate::models::predicted_category::Confidence;
                    for (index, prediction) in categorizable_indexes.into_iter().zip(predictions) {
                        if prediction.confidence != Confidence::Low {
                            if let Some(txn) = valid_transactions.get_mut(index) {
                                txn.category_primary = prediction.primary;
                                txn.category_confidence =
                                    prediction.confidence.as_str().to_string();
                            }
                        }
                    }
                }
                Err(err) => {
                    tracing::warn!(
                        provider = "simplefin",
                        connection_id = %connection.id,
                        error = %err,
                        "SimpleFIN sync categorization failed"
                    );
                }
            }
        }

        for chunk in valid_transactions.chunks(500) {
            if let Err(e) = self
                .db_repository
                .upsert_transactions_batch(chunk, params.user_id)
                .await
            {
                tracing::warn!(
                    "Failed to persist transaction batch for user {}: {}",
                    params.user_id,
                    e
                );
            }
        }

        for transaction in &valid_transactions {
            if let Err(e) = self
                .cache_service
                .add_transaction(params.jwt_id, transaction)
                .await
            {
                tracing::warn!(
                    "Failed to cache transaction {:?} for user {}: {}",
                    transaction.provider_transaction_id,
                    params.user_id,
                    e
                );
            }
        }

        let transactions = valid_transactions;

        tracing::info!(
            provider = "simplefin",
            connection_id = %connection.id,
            org_conn_id = %conn_id,
            valid_txn_count = transactions.len(),
            "SimpleFIN connection sync ready to persist transactions"
        );

        let total_transactions = self
            .db_repository
            .count_transactions(params.user_id, None, None, None, None, None)
            .await
            .map(|count| count as i32)
            .unwrap_or(0);
        let total_accounts = db_accounts.len() as i32;

        connection.update_sync_info(total_transactions, total_accounts);
        connection.sync_cursor = Some(new_cursor);
        connection.last_sync_at = Some(sync_timestamp);

        tracing::info!(
            provider = "simplefin",
            connection_id = %connection.id,
            org_conn_id = %conn_id,
            user_total_transactions = total_transactions,
            connection_account_count = total_accounts,
            "SimpleFIN connection sync completed"
        );

        if let Err(e) = self
            .db_repository
            .save_provider_connection(connection)
            .await
        {
            tracing::warn!(
                "Failed to update SimpleFIN connection {} for user {}: {}",
                connection.id,
                params.user_id,
                e
            );
        }

        if let Err(e) = self
            .complete_sync_with_jwt_cache_update(params.jwt_id, connection, &db_accounts)
            .await
        {
            tracing::warn!(
                "Failed to update JWT-scoped caches after SimpleFIN sync for user {}: {}",
                params.user_id,
                e
            );
        }

        tracing::info!(
            provider = "simplefin",
            connection_id = %connection.id,
            transaction_count = total_transactions,
            account_count = total_accounts,
            page_count = page_count,
            start_date = %sync_start_date,
            end_date = %sync_end_date,
            "Transaction sync completed"
        );

        self.cache_service
            .set_with_ttl(&floor_key, "1", simplefin_sync_floor_ttl_seconds())
            .await
            .map_err(ProviderSyncError::SyncFailure)?;

        Ok(SyncTransactionsResponse {
            transactions,
            metadata: SyncMetadata {
                transaction_count: total_transactions,
                account_count: total_accounts,
                sync_timestamp: sync_timestamp.to_rfc3339(),
                start_date: sync_start_date.to_string(),
                end_date: sync_end_date.to_string(),
                connection_updated: true,
            },
        })
    }

    #[tracing::instrument(
        skip(self, connection),
        fields(provider = "teller", connection_id = %connection.id)
    )]
    pub async fn sync_teller_connection(
        &self,
        user_id: &Uuid,
        jwt_id: &str,
        connection: &mut ProviderConnection,
        reference_date: Option<NaiveDate>,
    ) -> Result<SyncTransactionsResponse, TellerSyncError> {
        let sync_timestamp = Utc::now();
        let (sync_start_date, sync_end_date) =
            SyncService::calculate_sync_date_range_static(connection.last_sync_at, reference_date);

        let credentials = self
            .db_repository
            .get_provider_credentials_for_user(user_id, &connection.item_id)
            .await
            .map_err(TellerSyncError::CredentialAccess)?
            .ok_or(TellerSyncError::CredentialsMissing)?;

        let provider_credentials = ProviderCredentials {
            provider: "teller".to_string(),
            access_token: credentials.access_token.clone(),
            item_id: connection.item_id.clone(),
            certificate: None,
            private_key: None,
        };

        let provider = self.resolve_provider("teller").ok_or_else(|| {
            TellerSyncError::ProviderInitialization(anyhow::anyhow!(
                "Teller provider not registered"
            ))
        })?;

        let mut fetched_accounts = provider
            .as_ref()
            .get_accounts(&provider_credentials)
            .await
            .map_err(TellerSyncError::ProviderRequest)?;

        for account in &mut fetched_accounts {
            account.user_id = Some(*user_id);
            account.provider_connection_id = Some(connection.id);

            if let Err(e) = self.db_repository.upsert_account(account).await {
                tracing::warn!(
                    "Failed to persist Teller account {} for user {}: {}",
                    account.provider_account_id.as_deref().unwrap_or("unknown"),
                    user_id,
                    e
                );
            }
        }

        let db_accounts = self
            .db_repository
            .get_accounts_for_user(user_id)
            .await
            .map_err(TellerSyncError::AccountLookup)?;

        let accounts_for_connection: Vec<_> = db_accounts
            .iter()
            .filter(|acct| acct.provider_connection_id == Some(connection.id))
            .cloned()
            .collect();

        let account_map: HashMap<String, Uuid> = accounts_for_connection
            .iter()
            .filter_map(|acct| {
                acct.provider_account_id
                    .as_ref()
                    .map(|pid| (pid.clone(), acct.id))
            })
            .collect();

        let crate::models::transaction::ProviderTransactionsResult {
            transactions: mut teller_transactions,
            page_count,
        } = provider
            .as_ref()
            .get_transactions(&provider_credentials, sync_start_date, sync_end_date)
            .await
            .map_err(TellerSyncError::ProviderRequest)?;

        let existing_provider_transaction_ids = self
            .db_repository
            .get_provider_transaction_ids_for_user(user_id)
            .await
            .map_err(TellerSyncError::TransactionLookup)?;

        let mut existing_ids: HashSet<String> =
            existing_provider_transaction_ids.into_iter().collect();

        teller_transactions.retain(|txn| {
            txn.provider_transaction_id
                .as_ref()
                .map(|id| !existing_ids.contains(id))
                .unwrap_or(true)
        });

        let mut synced_transactions: Vec<Transaction> = Vec::new();

        for mut transaction in teller_transactions {
            transaction.user_id = Some(*user_id);

            let provider_account_id = match transaction.provider_account_id.as_ref() {
                Some(id) => id,
                None => {
                    tracing::warn!(
                        "Skipping Teller transaction without provider_account_id: {:?}",
                        transaction.provider_transaction_id
                    );
                    continue;
                }
            };

            let Some(&internal_account_id) = account_map.get(provider_account_id) else {
                tracing::warn!(
                    "Skipping Teller transaction with unknown account {}",
                    provider_account_id
                );
                continue;
            };

            transaction.account_id = internal_account_id;

            if let Some(provider_transaction_id) = transaction.provider_transaction_id.clone() {
                existing_ids.insert(provider_transaction_id);
            }

            synced_transactions.push(transaction);
        }

        for chunk in synced_transactions.chunks(500) {
            if let Err(e) = self
                .db_repository
                .upsert_transactions_batch(chunk, user_id)
                .await
            {
                tracing::warn!(
                    "Failed to persist Teller transaction batch for user {}: {}",
                    user_id,
                    e
                );
            }
        }

        for transaction in &synced_transactions {
            if let Err(e) = self
                .cache_service
                .add_transaction(jwt_id, transaction)
                .await
            {
                tracing::warn!(
                    "Failed to cache Teller transaction {:?}: {}",
                    transaction.provider_transaction_id,
                    e
                );
            }
        }

        let total_transactions = match self
            .db_repository
            .count_transactions(user_id, None, None, None, None, None)
            .await
        {
            Ok(count) => count as i32,
            Err(e) => {
                tracing::warn!(
                    "Failed to load total transaction count for Teller user {}: {}",
                    user_id,
                    e
                );
                0
            }
        };

        let total_accounts = accounts_for_connection.len() as i32;

        let random_suffix: String = Uuid::new_v4().to_string().chars().take(8).collect();

        connection.update_sync_info(total_transactions, total_accounts);
        connection.sync_cursor = Some(format!(
            "teller_cursor_{}_{}",
            Utc::now().timestamp(),
            random_suffix
        ));
        connection.last_sync_at = Some(sync_timestamp);

        self.db_repository
            .save_provider_connection(connection)
            .await
            .map_err(TellerSyncError::ConnectionPersistence)?;

        if let Err(e) = self
            .complete_sync_with_jwt_cache_update(jwt_id, connection, &accounts_for_connection)
            .await
        {
            tracing::warn!(
                "Failed to update JWT-scoped caches after Teller sync for user {}: {}",
                user_id,
                e
            );
        }

        let metadata = SyncMetadata {
            transaction_count: total_transactions,
            account_count: total_accounts,
            sync_timestamp: sync_timestamp.to_rfc3339(),
            start_date: sync_start_date.to_string(),
            end_date: sync_end_date.to_string(),
            connection_updated: true,
        };

        tracing::info!(
            provider = "teller",
            connection_id = %connection.id,
            transaction_count = total_transactions,
            account_count = total_accounts,
            page_count = page_count,
            start_date = %sync_start_date,
            end_date = %sync_end_date,
            "Transaction sync completed"
        );

        Ok(SyncTransactionsResponse {
            transactions: synced_transactions,
            metadata,
        })
    }

    async fn clear_all_plaid_cache_data(&self, jwt_id: &str, item_id: &str) -> Result<Vec<String>> {
        let mut cleared_keys = vec![];

        if self
            .cache_service
            .delete_access_token(jwt_id, item_id)
            .await
            .is_ok()
        {
            cleared_keys.push(format!("{}_access_token_{}", jwt_id, item_id));
        }

        // Only invalidate balances overview (user-scoped, needs refresh after disconnect)
        let balances_pattern = format!("{}_balances_overview*", jwt_id);
        if self
            .cache_service
            .invalidate_pattern(&balances_pattern)
            .await
            .is_ok()
        {
            cleared_keys.push(balances_pattern);
        }

        let net_worth_pattern = format!("{}_net_worth_over_time_*", jwt_id);
        if self
            .cache_service
            .invalidate_pattern(&net_worth_pattern)
            .await
            .is_ok()
        {
            cleared_keys.push(net_worth_pattern);
        }

        Ok(cleared_keys)
    }

    fn warn_post_sync_cache_failure(&self, operation: &str, jwt_id: &str, result: Result<()>) {
        if let Err(error) = result {
            tracing::warn!(
                operation = operation,
                jwt_id = jwt_id,
                error = %error,
                "Post-sync session cache update failed; responses may be stale until the next sync or refresh"
            );
        }
    }

    pub async fn complete_sync_with_jwt_cache_update(
        &self,
        jwt_id: &str,
        connection: &ProviderConnection,
        accounts: &[Account],
    ) -> Result<()> {
        self.warn_post_sync_cache_failure(
            "invalidate_balances_overview",
            jwt_id,
            self.cache_service
                .invalidate_pattern(&format!("{}_balances_overview*", jwt_id))
                .await,
        );

        self.warn_post_sync_cache_failure(
            "invalidate_net_worth_over_time",
            jwt_id,
            self.cache_service
                .invalidate_pattern(&format!("{}_net_worth_over_time_*", jwt_id))
                .await,
        );

        self.warn_post_sync_cache_failure(
            "clear_transactions",
            jwt_id,
            self.cache_service.clear_transactions(jwt_id).await,
        );

        self.warn_post_sync_cache_failure(
            "clear_budgets",
            jwt_id,
            self.cache_service.clear_budgets(jwt_id).await,
        );

        let cached_connection = CachedBankConnection {
            connection: connection.clone(),
            sync_status: BankConnectionSyncStatus {
                in_progress: false,
                last_sync_at: connection.last_sync_at,
                error_message: None,
            },
            cached_at: Utc::now(),
        };

        self.cache_service
            .cache_jwt_scoped_bank_connection(jwt_id, &cached_connection)
            .await?;

        let cached_accounts = CachedBankAccounts {
            accounts: accounts.to_vec(),
            cached_at: Utc::now(),
        };

        self.cache_service
            .cache_jwt_scoped_bank_accounts(jwt_id, connection.id, &cached_accounts)
            .await?;

        Ok(())
    }
}
