//! Coordinates bank connections, sync completion, and session cache refresh after financial data changes.

use crate::models::{
    account::Account,
    cache::{BankConnectionSyncStatus, CachedBankAccounts, CachedBankConnection},
    plaid::{
        DataCleared, DisconnectResult, ExchangeTokenResponse, ProviderConnectResponse,
        ProviderConnection,
    },
    provider_connect::ProviderConnectRequest,
    transaction::{SyncMetadata, SyncTransactionsResponse, Transaction},
};
use crate::providers::{
    FinancialDataProvider, InstitutionInfo, ProviderCredentials, ProviderRegistry,
};
use crate::services::categorization::categorization_service::Categorizer;
use crate::services::categorization::classifier_labels::apply_deterministic_categories;
use crate::services::merchant_normalization::service::MerchantNormalizationService;
use crate::services::{
    cache_service::CacheService, demo_mode_service::DemoModeService,
    repository_service::DatabaseRepository, sync_service::SyncService,
};
use anyhow::{Error, Result};
use chrono::NaiveDate;
use chrono::Utc;
use std::collections::HashSet;
use std::sync::Arc;
use uuid::Uuid;

pub struct ConnectionService {
    db_repository: Arc<dyn DatabaseRepository>,
    cache_service: Arc<dyn CacheService>,
    provider_registry: Arc<ProviderRegistry>,
    credential_resolvers:
        std::collections::HashMap<String, Arc<dyn crate::providers::ProviderCredentialResolver>>,
    simplefin_connection_service:
        Option<Arc<crate::services::simplefin_connection_service::SimpleFinConnectionService>>,
    merchant_normalization_service: Arc<MerchantNormalizationService>,
}

#[derive(Debug)]
pub enum SimpleFinConnectError {
    InvalidProvider,
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
    InstitutionsRequireAuth(Vec<crate::models::simplefin::SimpleFinInstitutionAuthRequired>),
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
    RateLimited {
        message: String,
        retry_after_secs: String,
    },
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
        _categorizer: Arc<dyn Categorizer>,
        credential_resolvers: std::collections::HashMap<
            String,
            Arc<dyn crate::providers::ProviderCredentialResolver>,
        >,
    ) -> Self {
        let merchant_normalization_service = Arc::new(MerchantNormalizationService::new(
            db_repository.clone(),
            cache_service.clone(),
        ));
        Self {
            db_repository,
            cache_service,
            provider_registry,
            credential_resolvers,
            simplefin_connection_service: None,
            merchant_normalization_service,
        }
    }

    pub fn with_simplefin_connection_service(
        mut self,
        service: Arc<crate::services::simplefin_connection_service::SimpleFinConnectionService>,
    ) -> Self {
        self.simplefin_connection_service = Some(service);
        self
    }

    fn resolve_provider(&self, provider: &str) -> Option<Arc<dyn FinancialDataProvider>> {
        self.provider_registry.get(provider)
    }

    async fn set_user_provider(&self, user_id: &Uuid, provider: &str) -> Result<()> {
        self.db_repository
            .update_user_provider(user_id, provider)
            .await
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

    pub async fn exit_demo_mode_before_new_institution(
        &self,
        user_id: &Uuid,
        jwt_id: &str,
    ) -> Result<()> {
        DemoModeService::exit_demo_mode_if_active(
            &self.db_repository,
            &self.cache_service,
            self,
            user_id,
            jwt_id,
        )
        .await?;
        Ok(())
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

            self.clear_simplefin_root_if_last_connection(user_id)
                .await?;
            self.clear_user_provider_if_no_active_connections(user_id)
                .await?;

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

        let (deleted_transactions, deleted_accounts) = self
            .db_repository
            .disconnect_provider_connection_cascade(user_id, &connection.item_id)
            .await?;

        self.clear_user_provider_if_no_active_connections(user_id)
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

    async fn clear_simplefin_root_if_last_connection(&self, user_id: &Uuid) -> Result<()> {
        let connections = self
            .db_repository
            .get_all_provider_connections_by_user(user_id)
            .await?;

        let has_simplefin_connections = connections
            .iter()
            .any(|connection| connection.provider == "simplefin" && connection.is_connected);

        if has_simplefin_connections {
            return Ok(());
        }

        self.db_repository
            .delete_simplefin_root_credential(user_id)
            .await?;

        let hidden_orgs = self
            .db_repository
            .list_simplefin_hidden_orgs(user_id)
            .await?;
        for hidden_org in hidden_orgs {
            self.db_repository
                .remove_simplefin_hidden_org(user_id, &hidden_org)
                .await?;
        }

        Ok(())
    }

    async fn clear_user_provider_if_no_active_connections(&self, user_id: &Uuid) -> Result<()> {
        let connections = self
            .db_repository
            .get_all_provider_connections_by_user(user_id)
            .await?;

        if connections.iter().any(|connection| connection.is_connected) {
            return Ok(());
        }

        self.db_repository.update_user_provider(user_id, "").await?;

        Ok(())
    }

    pub async fn connect_simplefin_provider(
        &self,
        user_id: &Uuid,
        jwt_id: &str,
        request: &ProviderConnectRequest,
    ) -> Result<ProviderConnectResponse, SimpleFinConnectError> {
        let service = self
            .simplefin_connection_service
            .as_ref()
            .ok_or(SimpleFinConnectError::InvalidProvider)?;

        self.exit_demo_mode_before_new_institution(user_id, jwt_id)
            .await
            .map_err(SimpleFinConnectError::ConnectionPersistence)?;

        let response = service.connect(user_id, jwt_id, request).await?;
        if let Err(error) = self.set_user_provider(user_id, "simplefin").await {
            tracing::warn!(
                "Failed to persist active provider after SimpleFIN connect for user {}: {}",
                user_id,
                error
            );
        }
        Ok(response)
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

        if let Err(error) = self
            .exit_demo_mode_before_new_institution(user_id, jwt_id)
            .await
        {
            return Err(ExchangeTokenError::ExchangeFailed(error));
        }

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

        if let Err(error) = self
            .set_user_provider(user_id, provider.provider_name())
            .await
        {
            tracing::warn!(
                "Failed to persist active provider after {} token exchange for user {}: {}",
                provider.provider_name(),
                user_id,
                error
            );
        }

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

        let mut valid_transactions = valid_transactions;

        if let Err(e) = self
            .merchant_normalization_service
            .normalize_batch(&mut valid_transactions)
            .await
        {
            tracing::warn!(
                "Merchant normalization failed for user {}: {}",
                params.user_id,
                e
            );
        }

        apply_deterministic_categories(&mut valid_transactions);

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

        {
            let db_clone = Arc::clone(&self.db_repository);
            let cache_clone = Arc::clone(&self.cache_service);
            let user_id_owned = *params.user_id;
            let jwt_id_owned = params.jwt_id.to_string();
            tokio::spawn(async move {
                match crate::services::subscription_detection::service::detect_and_assign_for_user(
                    &*db_clone,
                    &user_id_owned,
                )
                .await
                {
                    Ok(count) => {
                        tracing::debug!(
                            user_id = %user_id_owned,
                            count,
                            "Post-sync subscription detection completed"
                        );
                        if count > 0 {
                            if let Err(e) = cache_clone.clear_transactions(&jwt_id_owned).await {
                                tracing::warn!(
                                    user_id = %user_id_owned,
                                    "Failed to clear transactions cache after post-sync detection: {e}"
                                );
                            }
                        }
                    }
                    Err(e) => {
                        tracing::warn!(
                            user_id = %user_id_owned,
                            "Post-sync subscription detection failed: {e}"
                        );
                    }
                }
            });
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
            simplefin_institution_results: None,
            bridge_warnings: None,
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
        if crate::seed::is_demo_simplefin_item_id(&connection.item_id) {
            return self
                .sync_demo_simplefin_connection(params.user_id, params.jwt_id, connection)
                .await;
        }

        let service = self
            .simplefin_connection_service
            .as_ref()
            .ok_or_else(|| ProviderSyncError::ProviderUnavailable("simplefin".to_string()))?;

        service
            .sync(params, sync_service, connection, reference_date)
            .await
    }

    async fn sync_demo_simplefin_connection(
        &self,
        user_id: &Uuid,
        jwt_id: &str,
        connection: &ProviderConnection,
    ) -> Result<SyncTransactionsResponse, ProviderSyncError> {
        let sync_timestamp = Utc::now();
        let accounts: Vec<Account> = self
            .db_repository
            .get_accounts_for_user(user_id)
            .await
            .map_err(ProviderSyncError::AccountLookup)?
            .into_iter()
            .filter(|account| account.provider_connection_id == Some(connection.id))
            .collect();

        let account_ids: HashSet<Uuid> = accounts.iter().map(|account| account.id).collect();

        let mut transactions: Vec<Transaction> = self
            .db_repository
            .get_transactions_for_user(user_id)
            .await
            .map_err(ProviderSyncError::TransactionLookup)?
            .into_iter()
            .filter(|transaction| account_ids.contains(&transaction.account_id))
            .collect();

        for transaction in &mut transactions {
            transaction.merchant_name = transaction.original_merchant_name.clone();
        }

        if let Err(error) = self
            .merchant_normalization_service
            .normalize_batch(&mut transactions)
            .await
        {
            tracing::warn!("Demo sync normalization failed: {}", error);
        }

        let _ = self
            .db_repository
            .upsert_transactions_batch(&transactions, user_id)
            .await;

        for transaction in &transactions {
            let _ = self
                .cache_service
                .add_transaction(jwt_id, transaction)
                .await;
        }

        let transaction_count = transactions.len() as i32;
        let account_count = accounts.len() as i32;

        Ok(SyncTransactionsResponse {
            transactions,
            metadata: SyncMetadata {
                transaction_count,
                account_count,
                sync_timestamp: sync_timestamp.to_rfc3339(),
                start_date: String::new(),
                end_date: String::new(),
                connection_updated: false,
            },
            simplefin_institution_results: None,
            bridge_warnings: None,
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
