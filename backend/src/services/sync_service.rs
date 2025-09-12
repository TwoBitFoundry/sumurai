use anyhow::Result;
use chrono::{DateTime, Duration, NaiveDate, Utc};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::{account::Account, plaid::PlaidConnection, transaction::Transaction};
use crate::services::plaid_service::PlaidService;

const MAX_SYNC_YEARS: i64 = 5;
const SAFETY_MARGIN_DAYS: i64 = 2;
const DEFAULT_FIRST_SYNC_DAYS: i64 = 90;

pub struct SyncService {
    plaid_service: Arc<PlaidService>,
}

impl SyncService {
    pub fn new(plaid_service: Arc<PlaidService>) -> Self {
        Self { plaid_service }
    }

    pub async fn sync_bank_connection_transactions(
        &self,
        access_token: &str,
        connection: &PlaidConnection,
        accounts: &[Account],
    ) -> Result<(Vec<Transaction>, String)> {
        let (transactions, new_cursor) = self
            .plaid_service
            .sync_bank_connection_transactions(
                access_token,
                connection.sync_cursor.clone(),
                connection.last_sync_at,
            )
            .await?;

        let account_mapping = self.calculate_account_mapping(accounts);
        let mut mapped_transactions = transactions;

        for transaction in &mut mapped_transactions {
            if let Some(plaid_account_id) = &transaction.plaid_account_id {
                if let Some(&internal_account_id) = account_mapping.get(plaid_account_id) {
                    transaction.account_id = internal_account_id;
                }
            }
        }

        Ok((mapped_transactions, new_cursor))
    }
    pub async fn sync_recent_transactions(
        &self,
        access_token: &str,
        existing_transactions: &[Transaction],
        last_sync_at: Option<DateTime<Utc>>,
    ) -> Result<Vec<Transaction>> {
        let (start_date, end_date) = self.calculate_sync_date_range(last_sync_at);

        let plaid_transactions = self
            .plaid_service
            .get_transactions(access_token, start_date, end_date)
            .await?;

        let new_transactions = self
            .plaid_service
            .detect_duplicates(existing_transactions, &plaid_transactions);

        Ok(new_transactions)
    }

    pub fn calculate_sync_date_range(
        &self,
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
                acc.plaid_account_id
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
            if let Some(_plaid_id) = &transaction.plaid_transaction_id {
                if let Some(&account_uuid) = account_mapping.values().next() {
                    transaction.account_id = account_uuid;
                }
            }
        }
    }
}
