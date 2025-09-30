use crate::models::{
    account::Account,
    cache::{BankConnectionSyncStatus, CachedBankAccounts, CachedBankConnection},
    plaid::{DataCleared, DisconnectResult, PlaidConnection, PlaidConnectionStatus},
};
use crate::services::{cache_service::CacheService, repository_service::DatabaseRepository};
use anyhow::Result;
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

pub struct ConnectionService {
    db_repository: Arc<dyn DatabaseRepository>,
    cache_service: Arc<dyn CacheService>,
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

    pub async fn disconnect_plaid_by_id(
        &self,
        connection_id: &Uuid,
        user_id: &Uuid,
        jwt_id: &str,
    ) -> Result<DisconnectResult> {
        let connection = self
            .db_repository
            .get_plaid_connection_by_id(connection_id)
            .await?;

        let Some(mut conn) = connection else {
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

        conn.mark_disconnected();
        self.db_repository.save_plaid_connection(&conn).await?;

        let cleared_keys = self
            .clear_all_plaid_cache_data(jwt_id, &conn.item_id)
            .await?;

        self.cache_service
            .clear_jwt_scoped_bank_connection_cache(jwt_id, *connection_id)
            .await?;

        let deleted_transactions = self
            .db_repository
            .delete_plaid_transactions(&conn.item_id)
            .await?;
        let deleted_accounts = self
            .db_repository
            .delete_plaid_accounts(&conn.item_id)
            .await?;

        self.db_repository
            .delete_plaid_credentials(&conn.item_id)
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

    pub async fn disconnect_plaid(&self, user_id: &Uuid, jwt_id: &str) -> Result<DisconnectResult> {
        let connection = self
            .db_repository
            .get_plaid_connection_by_user(user_id)
            .await?;

        if let Some(mut conn) = connection {
            conn.mark_disconnected();
            self.db_repository.save_plaid_connection(&conn).await?;

            let cleared_keys = self
                .clear_all_plaid_cache_data(jwt_id, &conn.item_id)
                .await?;

            let deleted_transactions = self
                .db_repository
                .delete_plaid_transactions(&conn.item_id)
                .await?;
            let deleted_accounts = self
                .db_repository
                .delete_plaid_accounts(&conn.item_id)
                .await?;

            self.db_repository
                .delete_plaid_credentials(&conn.item_id)
                .await?;

            Ok(DisconnectResult {
                success: true,
                message: "Successfully disconnected and cleared all Plaid data".to_string(),
                data_cleared: DataCleared {
                    transactions: deleted_transactions,
                    accounts: deleted_accounts,
                    cache_keys: cleared_keys,
                },
            })
        } else {
            Ok(DisconnectResult {
                success: true,
                message: "No active Plaid connection found".to_string(),
                data_cleared: DataCleared {
                    transactions: 0,
                    accounts: 0,
                    cache_keys: vec![],
                },
            })
        }
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

        if self
            .cache_service
            .invalidate_pattern("account_mapping_*")
            .await
            .is_ok()
        {
            cleared_keys.push("account_mapping_*".to_string());
        }

        if self.cache_service.clear_transactions().await.is_ok() {
            cleared_keys.push("synced_transactions".to_string());
        }

        // Also invalidate balances overview for this JWT
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

    pub async fn disconnect_plaid_with_jwt_context(
        &self,
        user_id: &Uuid,
        jwt_id: &str,
    ) -> Result<DisconnectResult> {
        let connection_opt = self
            .db_repository
            .get_plaid_connection_by_user(user_id)
            .await?;

        if let Some(mut conn) = connection_opt {
            let connection_id = conn.id;

            // Mark as disconnected in database
            conn.mark_disconnected();
            self.db_repository.save_plaid_connection(&conn).await?;

            // Clear legacy cache
            let cleared_keys = self
                .clear_all_plaid_cache_data(jwt_id, &conn.item_id)
                .await?;

            // Clear JWT-scoped cache for this connection and refresh connection list
            self.cache_service
                .clear_jwt_scoped_bank_connection_cache(jwt_id, connection_id)
                .await?;

            self.cache_service
                .refresh_jwt_scoped_connections_cache(jwt_id, &[])
                .await?;

            // Remove persisted Plaid data
            let deleted_transactions = self
                .db_repository
                .delete_plaid_transactions(&conn.item_id)
                .await?;
            let deleted_accounts = self
                .db_repository
                .delete_plaid_accounts(&conn.item_id)
                .await?;

            self.db_repository
                .delete_plaid_credentials(&conn.item_id)
                .await?;

            Ok(DisconnectResult {
                success: true,
                message: "Successfully disconnected and cleared all Plaid data".to_string(),
                data_cleared: DataCleared {
                    transactions: deleted_transactions,
                    accounts: deleted_accounts,
                    cache_keys: cleared_keys,
                },
            })
        } else {
            Ok(DisconnectResult {
                success: true,
                message: "No active Plaid connection found".to_string(),
                data_cleared: DataCleared {
                    transactions: 0,
                    accounts: 0,
                    cache_keys: vec![],
                },
            })
        }
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
