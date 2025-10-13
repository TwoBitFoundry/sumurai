use crate::models::{
    account::Account,
    cache::{BankConnectionSyncStatus, CachedBankAccounts, CachedBankConnection},
    plaid::{
        DataCleared, DisconnectResult, PlaidConnection, ProviderConnectRequest,
        ProviderConnectResponse,
    },
    transaction::{SyncMetadata, SyncTransactionsResponse, Transaction},
};
use crate::providers::{FinancialDataProvider, ProviderCredentials, TellerProvider};
use crate::services::{
    cache_service::CacheService, repository_service::DatabaseRepository, sync_service::SyncService,
};
use anyhow::{Error, Result};
use chrono::Utc;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use uuid::Uuid;

pub struct ConnectionService {
    db_repository: Arc<dyn DatabaseRepository>,
    cache_service: Arc<dyn CacheService>,
}

#[derive(Debug)]
pub enum TellerConnectError {
    InvalidProvider(String),
    CredentialStorage(Error),
    ConnectionPersistence(Error),
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

impl ConnectionService {
    pub fn new(
        db_repository: Arc<dyn DatabaseRepository>,
        cache_service: Arc<dyn CacheService>,
    ) -> Self {
        Self {
            db_repository,
            cache_service,
        }
    }

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

        if conn.user_id != *user_id {
            return Err(anyhow::anyhow!("Connection does not belong to user"));
        }

        let cleared_keys = self
            .clear_all_plaid_cache_data(jwt_id, &conn.item_id)
            .await?;

        self.cache_service
            .clear_jwt_scoped_bank_connection_cache(jwt_id, *connection_id)
            .await?;

        let deleted_transactions = self
            .db_repository
            .delete_provider_transactions(&conn.item_id)
            .await?;
        let deleted_accounts = self
            .db_repository
            .delete_provider_accounts(&conn.item_id)
            .await?;

        self.db_repository
            .delete_provider_credentials(&conn.item_id)
            .await?;

        self.db_repository
            .delete_provider_connection(user_id, &conn.item_id)
            .await?;

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

        let item_id = format!("teller_{}", request.enrollment_id);
        self.db_repository
            .store_provider_credentials_for_user(user_id, &item_id, &request.access_token)
            .await
            .map_err(|e| TellerConnectError::CredentialStorage(e.into()))?;

        let institution_name = request
            .institution_name
            .clone()
            .unwrap_or_else(|| "Connected Bank".to_string());

        let mut connection = PlaidConnection::new(*user_id, &item_id);
        connection.mark_connected(&institution_name);
        connection.institution_id = Some("teller".to_string());
        connection.transaction_count = 0;
        connection.account_count = 0;
        connection.last_sync_at = None;
        connection.sync_cursor = None;

        self.db_repository
            .save_provider_connection(&connection)
            .await
            .map_err(|e| TellerConnectError::ConnectionPersistence(e.into()))?;

        let provider_credentials = ProviderCredentials {
            provider: "teller".to_string(),
            access_token: request.access_token.clone(),
            item_id: item_id.clone(),
            certificate: None,
            private_key: None,
        };

        let mut persisted_accounts = Vec::new();

        match TellerProvider::new() {
            Ok(teller_provider) => {
                match teller_provider.get_accounts(&provider_credentials).await {
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
            }
            Err(e) => {
                tracing::warn!(
                    "Failed to initialize Teller provider during connect for user {}: {}",
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
                .complete_sync_with_jwt_cache_update(
                    user_id,
                    jwt_id,
                    &connection,
                    &persisted_accounts,
                )
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

    pub async fn sync_teller_connection(
        &self,
        user_id: &Uuid,
        jwt_id: &str,
        connection: &mut PlaidConnection,
    ) -> Result<SyncTransactionsResponse, TellerSyncError> {
        let sync_timestamp = Utc::now();
        let (sync_start_date, sync_end_date) =
            SyncService::calculate_sync_date_range_static(connection.last_sync_at);

        let credentials = self
            .db_repository
            .get_provider_credentials_for_user(user_id, &connection.item_id)
            .await
            .map_err(|e| TellerSyncError::CredentialAccess(e.into()))?
            .ok_or(TellerSyncError::CredentialsMissing)?;

        let provider_credentials = ProviderCredentials {
            provider: "teller".to_string(),
            access_token: credentials.access_token.clone(),
            item_id: connection.item_id.clone(),
            certificate: None,
            private_key: None,
        };

        let teller_provider =
            TellerProvider::new().map_err(|e| TellerSyncError::ProviderInitialization(e.into()))?;

        let mut fetched_accounts = teller_provider
            .get_accounts(&provider_credentials)
            .await
            .map_err(|e| TellerSyncError::ProviderRequest(e.into()))?;

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
            .map_err(|e| TellerSyncError::AccountLookup(e.into()))?;

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

        let mut teller_transactions = teller_provider
            .get_transactions(&provider_credentials, sync_start_date, sync_end_date)
            .await
            .map_err(|e| TellerSyncError::ProviderRequest(e.into()))?;

        let existing_transactions = self
            .db_repository
            .get_transactions_for_user(user_id)
            .await
            .map_err(|e| TellerSyncError::TransactionLookup(e.into()))?;

        let mut existing_ids: HashSet<String> = existing_transactions
            .iter()
            .filter_map(|t| t.provider_transaction_id.clone())
            .collect();

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

            if let Err(e) = self.db_repository.upsert_transaction(&transaction).await {
                tracing::warn!(
                    "Failed to persist Teller transaction {:?}: {}",
                    transaction.provider_transaction_id,
                    e
                );
                continue;
            }

            if let Err(e) = self.cache_service.add_transaction(&transaction).await {
                tracing::warn!(
                    "Failed to cache Teller transaction {:?}: {}",
                    transaction.provider_transaction_id,
                    e
                );
            }

            if let Some(provider_transaction_id) = transaction.provider_transaction_id.clone() {
                existing_ids.insert(provider_transaction_id);
            }

            synced_transactions.push(transaction);
        }

        let total_transactions = match self.db_repository.get_transactions_for_user(user_id).await {
            Ok(txns) => txns.len() as i32,
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
            .map_err(|e| TellerSyncError::ConnectionPersistence(e.into()))?;

        if let Err(e) = self
            .complete_sync_with_jwt_cache_update(
                user_id,
                jwt_id,
                connection,
                &accounts_for_connection,
            )
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
        let balances_key = format!("{}_balances_overview", jwt_id);
        if self
            .cache_service
            .invalidate_pattern(&balances_key)
            .await
            .is_ok()
        {
            cleared_keys.push(balances_key);
        }

        Ok(cleared_keys)
    }

    pub async fn complete_sync_with_jwt_cache_update(
        &self,
        _user_id: &Uuid,
        jwt_id: &str,
        connection: &PlaidConnection,
        accounts: &[Account],
    ) -> Result<()> {
        let _ = self
            .cache_service
            .invalidate_pattern(&format!("{}_balances_overview", jwt_id))
            .await;

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
