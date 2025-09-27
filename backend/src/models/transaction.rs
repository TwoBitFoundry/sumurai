use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Transaction {
    pub id: Uuid,
    pub account_id: Uuid,
    pub user_id: Option<Uuid>,
    pub plaid_account_id: Option<String>,
    pub plaid_transaction_id: Option<String>,
    pub amount: Decimal,
    pub date: NaiveDate,
    pub merchant_name: Option<String>,
    pub category_primary: String,
    pub category_detailed: String,
    pub category_confidence: String,
    pub payment_channel: Option<String>,
    pub pending: bool,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TransactionWithAccount {
    pub id: Uuid,
    pub account_id: Uuid,
    pub user_id: Option<Uuid>,
    pub plaid_account_id: Option<String>,
    pub plaid_transaction_id: Option<String>,
    pub amount: Decimal,
    pub date: NaiveDate,
    pub merchant_name: Option<String>,
    pub category_primary: String,
    pub category_detailed: String,
    pub category_confidence: String,
    pub payment_channel: Option<String>,
    pub pending: bool,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub account_name: String,
    pub account_type: String,
    pub account_mask: Option<String>,
}

#[derive(Deserialize)]
pub struct TransactionsQuery {
    pub search: Option<String>,
    #[serde(rename = "account_ids")]
    pub account_ids: Option<Vec<String>>,
}

#[derive(Serialize)]
pub struct SyncTransactionsResponse {
    pub transactions: Vec<Transaction>,
    pub metadata: SyncMetadata,
}

#[derive(Serialize)]
pub struct SyncMetadata {
    pub transaction_count: i32,
    pub account_count: i32,
    pub sync_timestamp: String,
    pub start_date: String,
    pub end_date: String,
    pub connection_updated: bool,
}

impl Transaction {
    #[allow(dead_code)]
    pub fn new_mock(
        account_id: Uuid,
        amount: Decimal,
        date: NaiveDate,
        merchant_name: Option<String>,
        category_primary: String,
        category_detailed: String,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            account_id,
            user_id: None,
            plaid_account_id: None,
            plaid_transaction_id: None,
            amount,
            date,
            merchant_name,
            category_primary,
            category_detailed,
            category_confidence: "VERY_HIGH".to_string(),
            payment_channel: Some("in_store".to_string()),
            pending: false,
            created_at: Some(chrono::Utc::now()),
        }
    }
}
