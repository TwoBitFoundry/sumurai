use crate::models::plaid::{ProviderConnectRequest, ProviderConnectResponse, ProviderConnection};
use crate::models::transaction::SyncTransactionsResponse;
use crate::providers::ProviderCredentials;
use crate::providers::ProviderRegistry;
use crate::services::cache_service::CacheService;
use crate::services::categorization::categorization_service::Categorizer;
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
    categorizer: Arc<dyn Categorizer>,
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
        categorizer: Arc<dyn Categorizer>,
    ) -> Self {
        Self {
            db_repository,
            cache_service,
            provider_registry,
            credential_resolvers,
            org_service,
            rate_limit_service,
            categorizer,
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

    pub async fn sync(
        &self,
        params: SyncConnectionParams<'_>,
        sync_service: &SyncService,
        connection: &mut ProviderConnection,
        reference_date: Option<NaiveDate>,
    ) -> Result<SyncTransactionsResponse, ProviderSyncError> {
        use crate::models::transaction::SyncMetadata;
        use crate::providers::simplefin_provider::SimpleFinProvider;
        use crate::services::categorization::classifier_labels::format_classifier_input;
        use chrono::Utc;

        let sync_timestamp = Utc::now();
        let (sync_start_date, sync_end_date) =
            sync_service.calculate_sync_date_range(connection.last_sync_at, reference_date);

        let floor_key = format!("simplefin_sync_floor:{}", params.user_id);
        if self
            .cache_service
            .get_string(&floor_key)
            .await
            .map_err(ProviderSyncError::SyncFailure)?
            .is_some()
        {
            return Err(ProviderSyncError::RateLimited);
        }

        #[allow(deprecated)]
        let conn_id = crate::services::connection_service::simplefin_conn_id_from_item_id(
            &connection.item_id,
            params.user_id,
        )
        .ok_or_else(|| {
            ProviderSyncError::SyncFailure(anyhow::anyhow!("Invalid SimpleFIN connection item_id"))
        })?;

        let hidden_orgs = self
            .org_service
            .list_hidden_orgs(params.user_id)
            .await
            .map_err(ProviderSyncError::SyncFailure)?;

        if hidden_orgs.contains(&conn_id) {
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
            .provider_registry
            .get("simplefin")
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

        let connection_accounts: Vec<crate::models::account::Account> = snapshot
            .accounts
            .iter()
            .filter(|account| {
                account.org_conn_id().as_deref() == Some(conn_id.as_str())
                    && !hidden_orgs.contains(&conn_id)
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

        let db_accounts: Vec<crate::models::account::Account> = self
            .db_repository
            .get_accounts_for_user(params.user_id)
            .await
            .map_err(ProviderSyncError::AccountLookup)?
            .into_iter()
            .filter(|account| account.provider_connection_id == Some(connection.id))
            .collect();

        let (mut transactions, new_cursor, _) = sync_service
            .sync_bank_connection_transactions(
                &provider_credentials,
                connection,
                &db_accounts,
                reference_date,
            )
            .await
            .map_err(ProviderSyncError::SyncFailure)?;

        transactions = SyncService::filter_simplefin_transactions_for_connection(
            transactions,
            &db_accounts,
            &conn_id,
            &hidden_orgs,
        );

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

        let mut valid_transactions: Vec<crate::models::transaction::Transaction> = transactions
            .iter()
            .filter_map(|transaction| {
                if transaction.account_id.is_nil() {
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
            if let Ok(predictions) = self
                .categorizer
                .categorize_batch(categorizable_inputs)
                .await
            {
                use crate::models::predicted_category::Confidence;
                for (index, prediction) in categorizable_indexes.into_iter().zip(predictions) {
                    if prediction.confidence != Confidence::Low {
                        if let Some(txn) = valid_transactions.get_mut(index) {
                            txn.category_primary = prediction.primary;
                            txn.category_confidence = prediction.confidence.as_str().to_string();
                        }
                    }
                }
            }
        }

        for chunk in valid_transactions.chunks(500) {
            let _ = self
                .db_repository
                .upsert_transactions_batch(chunk, params.user_id)
                .await;
        }

        for transaction in &valid_transactions {
            let _ = self
                .cache_service
                .add_transaction(params.jwt_id, transaction)
                .await;
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
                "Failed to update SimpleFIN connection {} for user {}: {}",
                connection.id,
                params.user_id,
                e
            );
        }

        self.cache_service
            .set_with_ttl(&floor_key, "1", 3600)
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

    async fn load_simplefin_access_url(
        &self,
        user_id: &Uuid,
    ) -> Result<ProviderCredentials, SimpleFinConnectError> {
        let resolver = self
            .credential_resolvers
            .get("simplefin")
            .ok_or(SimpleFinConnectError::SetupTokenNotConfigured)?;

        resolver
            .resolve_for_sync(user_id)
            .await
            .map_err(SimpleFinConnectError::CredentialStorage)
    }
}
