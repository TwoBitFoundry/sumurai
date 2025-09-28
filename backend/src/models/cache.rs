use crate::models::{account::Account, plaid::PlaidConnection, transaction::Transaction};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedTransaction {
    pub transactions: Vec<Transaction>,
    pub cached_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CachedBankConnection {
    pub connection: PlaidConnection,
    pub sync_status: BankConnectionSyncStatus,
    pub cached_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BankConnectionSyncStatus {
    pub in_progress: bool,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CachedBankAccounts {
    pub accounts: Vec<Account>,
    pub cached_at: DateTime<Utc>,
}
