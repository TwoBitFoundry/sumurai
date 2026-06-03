//! Orchestrates transaction sync through provider adapters.

use anyhow::{anyhow, Result};
use chrono::{DateTime, Duration, Months, NaiveDate, Utc};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use uuid::Uuid;

use crate::models::{
    account::Account,
    plaid::ProviderConnection,
    transaction::{ProviderTransactionsResult, Transaction},
};
use crate::providers::{FinancialDataProvider, ProviderCredentials, ProviderRegistry};

const MAX_SYNC_YEARS: i64 = 5;
const FIRST_SYNC_DAYS: i64 = 90;
const SAFETY_MARGIN_DAYS: i64 = 2;

pub struct SyncService {
    providers: Arc<ProviderRegistry>,
}

#[allow(dead_code)]
impl SyncService {
    pub fn new(providers: Arc<ProviderRegistry>) -> Self {
        Self { providers }
    }

    pub(crate) fn resolve_provider(
        &self,
        provider_name: Option<&str>,
    ) -> Result<Arc<dyn FinancialDataProvider>> {
        let name = provider_name
            .map(|s| s.to_lowercase())
            .filter(|s| !s.is_empty())
            .ok_or_else(|| anyhow!("No provider selected — connect an account first"))?;

        self.providers
            .get(&name)
            .ok_or_else(|| anyhow!("Provider '{}' is not registered", name))
    }

    pub async fn sync_bank_connection_transactions(
        &self,
        credentials: &ProviderCredentials,
        connection: &ProviderConnection,
        accounts: &[Account],
        reference_date: Option<NaiveDate>,
    ) -> Result<(Vec<Transaction>, String, i32)> {
        let (start_date, end_date) =
            self.calculate_sync_date_range(connection.last_sync_at, reference_date);

        let provider = self.resolve_provider(Some(&credentials.provider))?;
        let ProviderTransactionsResult {
            transactions,
            page_count,
        } = provider
            .get_transactions(credentials, start_date, end_date)
            .await?;

        let account_mapping = self.calculate_account_mapping(accounts);
        let mut mapped_transactions = transactions;

        for transaction in &mut mapped_transactions {
            match &transaction.provider_account_id {
                Some(pid) if account_mapping.contains_key(pid) => {
                    transaction.account_id = account_mapping[pid];
                }
                _ => {
                    transaction.account_id = Uuid::nil();
                }
            }
        }

        let new_cursor = format!(
            "cursor_{}_{}",
            Utc::now().timestamp(),
            &uuid::Uuid::new_v4().to_string()[..8]
        );

        Ok((mapped_transactions, new_cursor, page_count))
    }

    pub fn filter_simplefin_transactions_for_connection(
        transactions: Vec<Transaction>,
        accounts: &[Account],
        conn_id: &str,
        hidden_orgs: &HashSet<String>,
    ) -> Vec<Transaction> {
        if hidden_orgs.contains(conn_id) {
            return Vec::new();
        }

        let allowed_provider_account_ids: HashSet<String> = accounts
            .iter()
            .filter(|account| {
                !account
                    .provider_conn_id
                    .as_deref()
                    .is_some_and(|org_conn_id| hidden_orgs.contains(org_conn_id))
            })
            .filter_map(|account| account.provider_account_id.clone())
            .collect();

        transactions
            .into_iter()
            .filter(|transaction| {
                transaction
                    .provider_account_id
                    .as_ref()
                    .is_some_and(|provider_account_id| {
                        allowed_provider_account_ids.contains(provider_account_id)
                    })
            })
            .collect()
    }

    pub async fn sync_recent_transactions(
        &self,
        credentials: &ProviderCredentials,
        existing_transactions: &[Transaction],
        last_sync_at: Option<DateTime<Utc>>,
        reference_date: Option<NaiveDate>,
    ) -> Result<Vec<Transaction>> {
        let (start_date, end_date) = self.calculate_sync_date_range(last_sync_at, reference_date);

        let provider = self.resolve_provider(Some(&credentials.provider))?;
        let provider_transactions = provider
            .get_transactions(credentials, start_date, end_date)
            .await?;

        let new_transactions =
            self.detect_duplicates(existing_transactions, &provider_transactions.transactions);

        Ok(new_transactions)
    }

    fn detect_duplicates(&self, existing: &[Transaction], new: &[Transaction]) -> Vec<Transaction> {
        let existing_plaid_ids: HashMap<String, bool> = existing
            .iter()
            .filter_map(|t| t.provider_transaction_id.as_ref())
            .map(|id| (id.clone(), true))
            .collect();

        new.iter()
            .filter(|t| {
                if let Some(plaid_id) = &t.provider_transaction_id {
                    !existing_plaid_ids.contains_key(plaid_id)
                } else {
                    true
                }
            })
            .cloned()
            .collect()
    }

    pub fn filter_duplicate_transactions(
        &self,
        existing: &[Transaction],
        new: &[Transaction],
    ) -> Vec<Transaction> {
        self.detect_duplicates(existing, new)
    }

    pub fn filter_duplicate_transactions_by_provider_ids(
        &self,
        existing_provider_transaction_ids: &[String],
        new: &[Transaction],
    ) -> Vec<Transaction> {
        let existing_provider_transaction_ids: std::collections::HashSet<&str> =
            existing_provider_transaction_ids
                .iter()
                .map(String::as_str)
                .collect();

        new.iter()
            .filter(|t| {
                if let Some(provider_transaction_id) = &t.provider_transaction_id {
                    !existing_provider_transaction_ids.contains(provider_transaction_id.as_str())
                } else {
                    true
                }
            })
            .cloned()
            .collect()
    }

    pub fn calculate_sync_date_range(
        &self,
        last_sync_at: Option<DateTime<Utc>>,
        reference_date: Option<NaiveDate>,
    ) -> (NaiveDate, NaiveDate) {
        Self::calculate_sync_date_range_static(last_sync_at, reference_date)
    }

    pub fn calculate_sync_date_range_static(
        last_sync_at: Option<DateTime<Utc>>,
        reference_date: Option<NaiveDate>,
    ) -> (NaiveDate, NaiveDate) {
        let end_date = reference_date.unwrap_or_else(|| Utc::now().date_naive());
        let lookback_months = Months::new((MAX_SYNC_YEARS * 12) as u32);
        let max_lookback = end_date
            .checked_sub_months(lookback_months)
            .unwrap_or(end_date);

        let start_date = match last_sync_at {
            Some(last_sync) => {
                let last_sync_with_buffer =
                    (last_sync - Duration::days(SAFETY_MARGIN_DAYS)).date_naive();
                std::cmp::max(last_sync_with_buffer, max_lookback).min(end_date)
            }
            None => {
                let first_sync_start = end_date
                    .checked_sub_days(chrono::Days::new(FIRST_SYNC_DAYS as u64))
                    .unwrap_or(end_date);
                std::cmp::max(first_sync_start, max_lookback)
            }
        };

        (start_date, end_date)
    }
    pub fn calculate_account_mapping(&self, accounts: &[Account]) -> HashMap<String, Uuid> {
        accounts
            .iter()
            .filter_map(|acc| {
                acc.provider_account_id
                    .as_ref()
                    .map(|plaid_id| (plaid_id.clone(), acc.id))
            })
            .collect()
    }

    pub fn map_transactions_to_accounts(
        &self,
        transactions: &mut [Transaction],
        account_mapping: &HashMap<String, Uuid>,
    ) {
        for transaction in transactions {
            if let Some(_plaid_id) = &transaction.provider_transaction_id {
                if let Some(&account_uuid) = account_mapping.values().next() {
                    transaction.account_id = account_uuid;
                }
            }
        }
    }
}
