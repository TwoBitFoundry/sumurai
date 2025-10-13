use anyhow::Result;
use chrono::{DateTime, Duration, NaiveDate, Utc};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::{account::Account, plaid::PlaidConnection, transaction::Transaction};
use crate::providers::{FinancialDataProvider, ProviderCredentials};

const MAX_SYNC_YEARS: i64 = 5;
const SAFETY_MARGIN_DAYS: i64 = 2;
const DEFAULT_FIRST_SYNC_DAYS: i64 = 90;

pub struct SyncService {
    provider: Arc<dyn FinancialDataProvider>,
}

impl SyncService {
    pub fn new(provider: Arc<dyn FinancialDataProvider>) -> Self {
        Self { provider }
    }

    pub async fn sync_bank_connection_transactions(
        &self,
        credentials: &ProviderCredentials,
        connection: &PlaidConnection,
        accounts: &[Account],
    ) -> Result<(Vec<Transaction>, String)> {
        let (start_date, end_date) = self.calculate_sync_date_range(connection.last_sync_at);

        let transactions = self
            .provider
            .get_transactions(credentials, start_date, end_date)
            .await?;

        let account_mapping = self.calculate_account_mapping(accounts);
        let mut mapped_transactions = transactions;

        for transaction in &mut mapped_transactions {
            if let Some(provider_account_id) = &transaction.provider_account_id {
                if let Some(&internal_account_id) = account_mapping.get(provider_account_id) {
                    transaction.account_id = internal_account_id;
                }
            }
        }

        let new_cursor = format!(
            "cursor_{}_{}",
            Utc::now().timestamp(),
            uuid::Uuid::new_v4().to_string()[..8].to_string()
        );

        Ok((mapped_transactions, new_cursor))
    }
    pub async fn sync_recent_transactions(
        &self,
        credentials: &ProviderCredentials,
        existing_transactions: &[Transaction],
        last_sync_at: Option<DateTime<Utc>>,
    ) -> Result<Vec<Transaction>> {
        let (start_date, end_date) = self.calculate_sync_date_range(last_sync_at);

        let provider_transactions = self
            .provider
            .get_transactions(credentials, start_date, end_date)
            .await?;

        let new_transactions =
            self.detect_duplicates(existing_transactions, &provider_transactions);

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

    pub fn calculate_sync_date_range(
        &self,
        last_sync_at: Option<DateTime<Utc>>,
    ) -> (NaiveDate, NaiveDate) {
        Self::calculate_sync_date_range_static(last_sync_at)
    }

    pub fn calculate_sync_date_range_static(
        last_sync_at: Option<DateTime<Utc>>,
    ) -> (NaiveDate, NaiveDate) {
        let end_date = Utc::now().date_naive();
        let max_lookback = end_date - Duration::days(365 * MAX_SYNC_YEARS);

        let start_date = match last_sync_at {
            Some(last_sync) => {
                let last_sync_with_buffer =
                    (last_sync - Duration::days(SAFETY_MARGIN_DAYS)).date_naive();
                std::cmp::max(last_sync_with_buffer, max_lookback).min(end_date)
            }
            None => end_date - Duration::days(DEFAULT_FIRST_SYNC_DAYS),
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
