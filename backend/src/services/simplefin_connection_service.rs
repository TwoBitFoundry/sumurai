use crate::models::plaid::{ProviderConnectResponse, ProviderConnection};
use crate::models::provider_connect::ProviderConnectRequest;
use crate::models::simplefin::{
    message_requires_auth_refresh, SimpleFinAccountsResponse, SimpleFinInstitutionSyncResult,
    SimpleFinInstitutionSyncStatus,
};
use crate::models::transaction::SyncTransactionsResponse;
use crate::providers::simplefin_provider::SimpleFinProviderError;
use crate::providers::{ProviderCredentials, ProviderRegistry};
use crate::services::cache_service::CacheService;
use crate::services::connection_service::{
    ProviderSyncError, SimpleFinConnectError, SyncConnectionParams,
};
use crate::services::repository_service::DatabaseRepository;
use crate::services::simplefin_org_service::{conn_id_is_hidden, SimpleFinOrganizationService};
use crate::services::sync_service::SyncService;
use anyhow::Result;
use chrono::NaiveDate;
use std::collections::{HashMap, HashSet};
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
}

fn simplefin_org_conn_id_from_item_id(item_id: &str, user_id: &Uuid) -> Option<String> {
    item_id
        .strip_prefix(&format!("simplefin_{}_", user_id))
        .or_else(|| item_id.strip_prefix("simplefin_"))
        .map(str::to_string)
}

pub(crate) fn enrich_simplefin_institution_sync_results(
    results: Vec<SimpleFinInstitutionSyncResult>,
    simplefin_connections: &[ProviderConnection],
    user_id: &Uuid,
    hidden_orgs: &HashSet<String>,
) -> Vec<SimpleFinInstitutionSyncResult> {
    let connection_ids: HashMap<String, String> = simplefin_connections
        .iter()
        .filter(|saved_connection| {
            saved_connection.item_id.starts_with("simplefin_")
                && !saved_connection.item_id.starts_with("simplefin_root_")
        })
        .filter_map(|saved_connection| {
            let saved_conn_id =
                simplefin_org_conn_id_from_item_id(&saved_connection.item_id, user_id)?;

            if conn_id_is_hidden(
                hidden_orgs,
                &saved_conn_id,
                saved_connection.institution_id.as_deref(),
            ) {
                None
            } else {
                Some((saved_conn_id, saved_connection.id.to_string()))
            }
        })
        .collect();

    results
        .into_iter()
        .map(|mut result| {
            if result.connection_id.is_none() {
                result.connection_id = result
                    .org_conn_id
                    .as_ref()
                    .and_then(|org_conn_id| connection_ids.get(org_conn_id).cloned());
            }

            result
        })
        .collect()
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
    ) -> Self {
        Self {
            db_repository,
            cache_service,
            provider_registry,
            credential_resolvers,
            org_service,
        }
    }

    pub(crate) fn build_simplefin_institution_sync_results(
        snapshot: &SimpleFinAccountsResponse,
        hidden_orgs: &HashSet<String>,
    ) -> (Vec<SimpleFinInstitutionSyncResult>, Vec<String>) {
        let auth_notices = snapshot.institutions_requiring_auth();
        let mut results = Vec::new();

        for org in &snapshot.connections {
            let account_count = snapshot
                .accounts
                .iter()
                .filter(|account| account.org_conn_id().as_deref() == Some(org.conn_id.as_str()))
                .count() as i32;
            let transaction_count = snapshot
                .accounts
                .iter()
                .filter(|account| account.org_conn_id().as_deref() == Some(org.conn_id.as_str()))
                .map(|account| account.transactions.len() as i32)
                .sum::<i32>();

            if conn_id_is_hidden(hidden_orgs, &org.conn_id, Some(&org.org_id)) {
                results.push(SimpleFinInstitutionSyncResult {
                    institution_name: org.name.clone(),
                    org_conn_id: Some(org.conn_id.clone()),
                    connection_id: None,
                    status: SimpleFinInstitutionSyncStatus::SkippedHidden,
                    transaction_count: None,
                    message: Some("Institution is hidden in SimpleFIN".to_string()),
                });
                continue;
            }

            if let Some(notice) = auth_notices.iter().find(|notice| {
                notice.org_conn_id.as_deref() == Some(org.conn_id.as_str())
                    || notice.institution_name.eq_ignore_ascii_case(&org.name)
            }) {
                results.push(SimpleFinInstitutionSyncResult {
                    institution_name: org.name.clone(),
                    org_conn_id: Some(org.conn_id.clone()),
                    connection_id: None,
                    status: SimpleFinInstitutionSyncStatus::AuthRequired,
                    transaction_count: Some(transaction_count),
                    message: Some(notice.message.clone()),
                });
                continue;
            }

            if account_count == 0 {
                results.push(SimpleFinInstitutionSyncResult {
                    institution_name: org.name.clone(),
                    org_conn_id: Some(org.conn_id.clone()),
                    connection_id: None,
                    status: SimpleFinInstitutionSyncStatus::NoAccounts,
                    transaction_count: Some(0),
                    message: Some("No accounts were returned for this institution".to_string()),
                });
                continue;
            }

            results.push(SimpleFinInstitutionSyncResult {
                institution_name: org.name.clone(),
                org_conn_id: Some(org.conn_id.clone()),
                connection_id: None,
                status: SimpleFinInstitutionSyncStatus::Synced,
                transaction_count: Some(transaction_count),
                message: None,
            });
        }

        let bridge_warnings = snapshot
            .error_messages()
            .into_iter()
            .filter(|message| !message_requires_auth_refresh(message))
            .collect();

        (results, bridge_warnings)
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
            .resolve_simplefin_credentials_for_connect(
                user_id,
                provider.clone(),
                request.simplefin.simplefin_setup_token.as_deref(),
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
            .org_service
            .list_hidden_orgs(user_id)
            .await
            .map_err(SimpleFinConnectError::ConnectionPersistence)?;

        let institutions_requiring_auth = snapshot.institutions_requiring_auth();

        let reconciliation = self
            .org_service
            .reconcile_snapshot_connections(user_id, jwt_id, &hidden_orgs, &snapshot)
            .await
            .map_err(SimpleFinConnectError::ConnectionPersistence)?;
        let institution_count = reconciliation.institution_count;

        if institution_count == 0 {
            if !institutions_requiring_auth.is_empty() {
                return Err(SimpleFinConnectError::InstitutionsRequireAuth(
                    institutions_requiring_auth,
                ));
            }
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

        let connection_id = reconciliation
            .first_connection_id
            .expect("institution_count > 0 implies a persisted connection id")
            .to_string();

        Ok(ProviderConnectResponse {
            connection_id,
            institution_name: format!("SimpleFIN ({institution_count} institutions)"),
            simplefin_institutions_requiring_auth: if institutions_requiring_auth.is_empty() {
                None
            } else {
                Some(institutions_requiring_auth)
            },
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
        use chrono::Utc;

        let sync_timestamp = Utc::now();
        let (sync_start_date, sync_end_date) =
            sync_service.calculate_sync_date_range(connection.last_sync_at, reference_date);

        let conn_id = simplefin_org_conn_id_from_item_id(&connection.item_id, params.user_id)
            .ok_or_else(|| {
                ProviderSyncError::SyncFailure(anyhow::anyhow!(
                    "Invalid SimpleFIN connection item_id"
                ))
            })?;

        let hidden_orgs = self
            .org_service
            .list_hidden_orgs(params.user_id)
            .await
            .map_err(ProviderSyncError::SyncFailure)?;

        if conn_id_is_hidden(&hidden_orgs, &conn_id, connection.institution_id.as_deref()) {
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
                simplefin_institution_results: None,
                bridge_warnings: None,
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

        let mut snapshot_for_reconciliation = snapshot.clone();
        for account in &mut snapshot_for_reconciliation.accounts {
            account.transactions.clear();
        }

        let _reconciliation = self
            .org_service
            .reconcile_snapshot_connections(
                params.user_id,
                params.jwt_id,
                &hidden_orgs,
                &snapshot_for_reconciliation,
            )
            .await
            .map_err(ProviderSyncError::SyncFailure)?;

        let (simplefin_institution_results, bridge_warnings) =
            Self::build_simplefin_institution_sync_results(&snapshot, &hidden_orgs);

        let db_accounts: Vec<crate::models::account::Account> = self
            .db_repository
            .get_accounts_for_user(params.user_id)
            .await
            .map_err(ProviderSyncError::AccountLookup)?
            .into_iter()
            .collect();

        let simplefin_connections = self
            .db_repository
            .get_all_provider_connections_by_user(params.user_id)
            .await
            .map_err(ProviderSyncError::SyncFailure)?;

        let simplefin_institution_results = enrich_simplefin_institution_sync_results(
            simplefin_institution_results,
            &simplefin_connections,
            params.user_id,
            &hidden_orgs,
        );

        let visible_simplefin_connection_ids: HashSet<Uuid> = simplefin_connections
            .iter()
            .filter(|saved_connection| {
                saved_connection.item_id.starts_with("simplefin_")
                    && !saved_connection.item_id.starts_with("simplefin_root_")
            })
            .filter_map(|saved_connection| {
                let saved_conn_id =
                    simplefin_org_conn_id_from_item_id(&saved_connection.item_id, params.user_id)?;

                if conn_id_is_hidden(
                    &hidden_orgs,
                    &saved_conn_id,
                    saved_connection.institution_id.as_deref(),
                ) {
                    None
                } else {
                    Some(saved_connection.id)
                }
            })
            .collect();

        let simplefin_accounts: Vec<crate::models::account::Account> = db_accounts
            .iter()
            .filter(|account| {
                account.provider_connection_id.is_some_and(|connection_id| {
                    visible_simplefin_connection_ids.contains(&connection_id)
                })
            })
            .cloned()
            .collect();

        let visible_provider_account_ids: HashSet<String> = simplefin_accounts
            .iter()
            .filter_map(|account| account.provider_account_id.clone())
            .collect();

        let (mut transactions, new_cursor, _) = sync_service
            .sync_bank_connection_transactions(
                &provider_credentials,
                connection,
                &simplefin_accounts,
                reference_date,
            )
            .await
            .map_err(|e| {
                if let Some(SimpleFinProviderError::RateLimited(msg)) =
                    e.downcast_ref::<SimpleFinProviderError>()
                {
                    ProviderSyncError::RateLimited {
                        message: msg.clone(),
                        retry_after_secs: "3600".to_string(),
                    }
                } else {
                    ProviderSyncError::SyncFailure(e)
                }
            })?;

        transactions.retain(|transaction| {
            transaction
                .provider_account_id
                .as_ref()
                .is_some_and(|provider_account_id| {
                    visible_provider_account_ids.contains(provider_account_id)
                })
        });

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
            txn.category_primary = "OTHER".to_string();
            txn.category_detailed = "OTHER".to_string();
            txn.category_confidence.clear();
        }

        let valid_transactions: Vec<crate::models::transaction::Transaction> = transactions
            .iter()
            .filter_map(|transaction| {
                if transaction.account_id.is_nil() {
                    None
                } else {
                    Some(transaction.clone())
                }
            })
            .collect();

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
        let account_connection_ids: HashMap<Uuid, Uuid> = simplefin_accounts
            .iter()
            .filter_map(|account| {
                account
                    .provider_connection_id
                    .map(|connection_id| (account.id, connection_id))
            })
            .collect();

        let simplefin_connections = self
            .db_repository
            .get_all_provider_connections_by_user(params.user_id)
            .await
            .map_err(ProviderSyncError::SyncFailure)?;

        for mut saved_connection in simplefin_connections {
            if !saved_connection.item_id.starts_with("simplefin_")
                || saved_connection.item_id.starts_with("simplefin_root_")
            {
                continue;
            }

            let user_scoped_prefix = format!("simplefin_{}_", params.user_id);
            let saved_conn_id = saved_connection
                .item_id
                .strip_prefix(&user_scoped_prefix)
                .or_else(|| saved_connection.item_id.strip_prefix("simplefin_"))
                .map(str::to_string)
                .ok_or_else(|| {
                    ProviderSyncError::SyncFailure(anyhow::anyhow!(
                        "Invalid SimpleFIN connection item_id"
                    ))
                })?;

            if conn_id_is_hidden(
                &hidden_orgs,
                &saved_conn_id,
                saved_connection.institution_id.as_deref(),
            ) {
                continue;
            }

            let account_count = simplefin_accounts
                .iter()
                .filter(|account| account.provider_connection_id == Some(saved_connection.id))
                .count() as i32;
            let transaction_count = transactions
                .iter()
                .filter(|transaction| {
                    account_connection_ids
                        .get(&transaction.account_id)
                        .is_some_and(|connection_id| *connection_id == saved_connection.id)
                })
                .count() as i32;

            saved_connection.update_sync_info(transaction_count, account_count);
            saved_connection.sync_cursor = Some(new_cursor.clone());

            if saved_connection.id == connection.id {
                *connection = saved_connection.clone();
            }

            if let Err(e) = self
                .db_repository
                .save_provider_connection(&saved_connection)
                .await
            {
                tracing::warn!(
                    "Failed to update SimpleFIN connection {} for user {}: {}",
                    saved_connection.id,
                    params.user_id,
                    e
                );
            }
        }

        let total_transactions = self
            .db_repository
            .count_transactions(params.user_id, None, None, None, None, None)
            .await
            .map(|count| count as i32)
            .unwrap_or(0);
        let total_accounts = simplefin_accounts.len() as i32;

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
            simplefin_institution_results: Some(simplefin_institution_results),
            bridge_warnings: (!bridge_warnings.is_empty()).then_some(bridge_warnings),
        })
    }

    async fn resolve_simplefin_credentials_for_connect(
        &self,
        user_id: &Uuid,
        provider: Arc<dyn crate::providers::FinancialDataProvider>,
        setup_token: Option<&str>,
    ) -> Result<ProviderCredentials, SimpleFinConnectError> {
        let resolver = self
            .credential_resolvers
            .get("simplefin")
            .ok_or(SimpleFinConnectError::MissingSetupToken)?;

        resolver
            .resolve_for_connect(user_id, provider, setup_token)
            .await
            .map_err(|error| {
                if error.to_string().contains("must be provided") {
                    SimpleFinConnectError::MissingSetupToken
                } else if error.to_string().contains("malformed") {
                    SimpleFinConnectError::MalformedSetupToken
                } else if error.to_string().contains("already been claimed") {
                    SimpleFinConnectError::SetupTokenAlreadyClaimed
                } else if error.to_string().contains("claim failed") {
                    SimpleFinConnectError::ClaimFailed(anyhow::anyhow!(error.to_string()))
                } else {
                    SimpleFinConnectError::CredentialStorage(anyhow::anyhow!(error.to_string()))
                }
            })
    }

    async fn load_simplefin_access_url(
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
}
