use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PlaidConnection {
    pub id: Uuid,
    pub user_id: Uuid,
    pub item_id: String,
    pub is_connected: bool,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub connected_at: Option<DateTime<Utc>>,
    pub disconnected_at: Option<DateTime<Utc>>,
    pub institution_id: Option<String>,
    pub institution_name: Option<String>,
    pub institution_logo_url: Option<String>,
    pub sync_cursor: Option<String>,
    pub transaction_count: i32,
    pub account_count: i32,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

// DTOs for Plaid-related API flows
#[derive(Deserialize)]
pub struct LinkTokenRequest {}

#[derive(Deserialize)]
pub struct ExchangeTokenRequest {
    pub public_token: String,
}

#[derive(Debug, Deserialize)]
pub struct ProviderConnectRequest {
    pub provider: String,
    pub access_token: String,
    pub enrollment_id: String,
    pub institution_name: Option<String>,
}

#[derive(Deserialize, Serialize)]
pub struct SyncTransactionsRequest {
    pub connection_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DisconnectRequest {
    pub connection_id: String,
}

impl PlaidConnection {
    #[allow(dead_code)]
    pub fn new(user_id: Uuid, item_id: &str) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            user_id,
            item_id: item_id.to_string(),
            is_connected: false,
            last_sync_at: None,
            connected_at: None,
            disconnected_at: None,
            institution_id: None,
            institution_name: None,
            institution_logo_url: None,
            sync_cursor: None,
            transaction_count: 0,
            account_count: 0,
            created_at: Some(now),
            updated_at: Some(now),
        }
    }

    #[allow(dead_code)]
    pub fn mark_connected(&mut self, institution_name: &str) {
        self.is_connected = true;
        self.connected_at = Some(Utc::now());
        self.disconnected_at = None;
        self.institution_name = Some(institution_name.to_string());
        self.updated_at = Some(Utc::now());
    }

    #[allow(dead_code)]
    pub fn mark_disconnected(&mut self) {
        self.is_connected = false;
        self.disconnected_at = Some(Utc::now());
        self.last_sync_at = None;
        self.transaction_count = 0;
        self.account_count = 0;
        self.updated_at = Some(Utc::now());
    }

    #[allow(dead_code)]
    pub fn update_sync_info(&mut self, transaction_count: i32, account_count: i32) {
        self.last_sync_at = Some(Utc::now());
        self.transaction_count = transaction_count;
        self.account_count = account_count;
        self.updated_at = Some(Utc::now());
    }

    #[allow(dead_code)]
    pub fn update_sync_cursor(
        &mut self,
        sync_cursor: String,
        transaction_count: i32,
        account_count: i32,
    ) {
        self.sync_cursor = Some(sync_cursor);
        self.last_sync_at = Some(Utc::now());
        self.transaction_count = transaction_count;
        self.account_count = account_count;
        self.updated_at = Some(Utc::now());
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaidConnectionStatus {
    pub is_connected: bool,
    pub last_sync_at: Option<String>,
    pub institution_name: Option<String>,
    pub connection_id: Option<String>,
    pub transaction_count: i32,
    pub account_count: i32,
    pub sync_in_progress: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderStatusResponse {
    pub provider: String,
    pub connections: Vec<PlaidConnectionStatus>,
}

#[derive(Debug, Serialize)]
pub struct ProviderConnectResponse {
    pub connection_id: String,
    pub institution_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisconnectResult {
    pub success: bool,
    pub message: String,
    pub data_cleared: DataCleared,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataCleared {
    pub transactions: i32,
    pub accounts: i32,
    pub cache_keys: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::FromRow)]
pub struct LatestAccountBalance {
    pub account_id: Uuid,
    pub institution_id: String,
    pub account_type: String,
    pub account_subtype: Option<String>,
    pub currency: String,
    pub current_balance: Decimal,
    pub provider_connection_id: Option<Uuid>,
    pub institution_name: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PlaidCredentials {
    #[allow(dead_code)]
    pub id: Uuid,
    #[allow(dead_code)]
    pub item_id: String,
    #[allow(dead_code)]
    pub user_id: Option<Uuid>,
    pub access_token: String,
    #[allow(dead_code)]
    pub created_at: DateTime<Utc>,
    #[allow(dead_code)]
    pub updated_at: DateTime<Utc>,
}
