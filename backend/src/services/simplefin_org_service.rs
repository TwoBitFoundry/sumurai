use crate::models::plaid::ProviderConnection;
use crate::models::simplefin::{SimpleFinAccountsResponse, SimpleFinConnection};
use crate::providers::simplefin_provider::SimpleFinProvider;
use crate::services::cache_service::CacheService;
use crate::services::repository_service::DatabaseRepository;
use anyhow::Result;
use std::collections::HashSet;
use std::sync::Arc;
use uuid::Uuid;

pub struct SimpleFinOrganizationService {
    db_repository: Arc<dyn DatabaseRepository>,
    cache_service: Arc<dyn CacheService>,
}

impl SimpleFinOrganizationService {
    pub fn new(
        db_repository: Arc<dyn DatabaseRepository>,
        cache_service: Arc<dyn CacheService>,
    ) -> Self {
        Self {
            db_repository,
            cache_service,
        }
    }

    pub async fn list_hidden_orgs(
        &self,
        user_id: &Uuid,
    ) -> Result<std::collections::HashSet<String>> {
        self.db_repository.list_simplefin_hidden_orgs(user_id).await
    }

    #[allow(dead_code)]
    pub async fn restore_org(&self, user_id: &Uuid, org_conn_id: &str) -> Result<bool> {
        self.db_repository
            .remove_simplefin_hidden_org(user_id, org_conn_id)
            .await
    }

    #[allow(dead_code)]
    pub async fn list_ignored_institutions(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<crate::models::simplefin::SimpleFinIgnoredInstitution>> {
        self.db_repository
            .list_simplefin_ignored_institutions(user_id)
            .await
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn persist_org_connection(
        &self,
        user_id: &Uuid,
        jwt_id: &str,
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

        let saved_id = self
            .db_repository
            .save_provider_connection(&connection)
            .await?;
        connection.id = saved_id;

        let mut persisted_accounts = Vec::new();
        let mut transaction_count = 0;

        for simplefin_account in snapshot_accounts
            .iter()
            .filter(|account| account.org_conn_id().as_deref() == Some(org.conn_id.as_str()))
        {
            let mut account = SimpleFinProvider::map_account(simplefin_account);
            account.user_id = Some(*user_id);
            account.provider_connection_id = Some(connection.id);

            match self.db_repository.upsert_account(&account).await {
                Ok(_) => {
                    persisted_accounts.push(account.clone());

                    for simplefin_tx in &simplefin_account.transactions {
                        match SimpleFinProvider::map_transaction(simplefin_tx, &account) {
                            Ok(mut tx) => {
                                tx.user_id = Some(*user_id);

                                match self.db_repository.upsert_transaction(&tx).await {
                                    Ok(_) => transaction_count += 1,
                                    Err(e) => {
                                        tracing::warn!(
                                            "Failed to persist SimpleFIN transaction for user {}: {}",
                                            user_id,
                                            e
                                        );
                                    }
                                }
                            }
                            Err(e) => {
                                tracing::warn!(
                                    "Failed to map SimpleFIN transaction for user {}: {}",
                                    user_id,
                                    e
                                );
                            }
                        }
                    }
                }
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
            connection.transaction_count = transaction_count;
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

    pub async fn reconcile_snapshot_connections(
        &self,
        user_id: &Uuid,
        jwt_id: &str,
        hidden_orgs: &HashSet<String>,
        snapshot: &SimpleFinAccountsResponse,
    ) -> Result<SimpleFinSnapshotReconciliation> {
        let institutions_requiring_auth = snapshot.institutions_requiring_auth();
        let mut institution_count = 0;
        let mut first_connection_id = None;

        for org in snapshot
            .connections
            .iter()
            .filter(|org| !org_is_hidden(hidden_orgs, org))
            .filter(|org| {
                !org_requires_auth_refresh(org, &institutions_requiring_auth)
                    || snapshot.org_has_accounts(&org.conn_id)
            })
        {
            let persisted = self
                .persist_org_connection(user_id, jwt_id, org, &snapshot.accounts)
                .await?;

            if let Some(connection_id) = persisted {
                institution_count += 1;
                if first_connection_id.is_none() {
                    first_connection_id = Some(connection_id);
                }
            }
        }

        Ok(SimpleFinSnapshotReconciliation {
            institution_count,
            first_connection_id,
        })
    }

    async fn complete_sync_with_jwt_cache_update(
        &self,
        jwt_id: &str,
        connection: &ProviderConnection,
        accounts: &[crate::models::account::Account],
    ) -> Result<()> {
        use crate::models::cache::{
            BankConnectionSyncStatus, CachedBankAccounts, CachedBankConnection,
        };
        use chrono::Utc;

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
            .await
    }
}

pub fn simplefin_org_item_id(user_id: &Uuid, org_conn_id: &str) -> String {
    format!("simplefin_{user_id}_{org_conn_id}")
}

pub fn org_is_hidden(hidden_orgs: &HashSet<String>, org: &SimpleFinConnection) -> bool {
    if hidden_orgs.contains(&org.conn_id) {
        return true;
    }

    !org.org_id.is_empty() && hidden_orgs.contains(&org.org_id)
}

pub fn conn_id_is_hidden(
    hidden_orgs: &HashSet<String>,
    conn_id: &str,
    org_id: Option<&str>,
) -> bool {
    if hidden_orgs.contains(conn_id) {
        return true;
    }

    org_id.is_some_and(|id| !id.is_empty() && hidden_orgs.contains(id))
}

pub(crate) fn org_requires_auth_refresh(
    org: &SimpleFinConnection,
    institutions_requiring_auth: &[crate::models::simplefin::SimpleFinInstitutionAuthRequired],
) -> bool {
    institutions_requiring_auth.iter().any(|notice| {
        notice.org_conn_id.as_deref() == Some(org.conn_id.as_str())
            || notice.institution_name.eq_ignore_ascii_case(&org.name)
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SimpleFinSnapshotReconciliation {
    pub institution_count: usize,
    pub first_connection_id: Option<Uuid>,
}
