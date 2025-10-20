use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[allow(unused_imports)]
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[schema(example = json!({
    "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "user_id": "ffffffff-1111-2222-3333-444444444444",
    "item_id": "item-123",
    "is_connected": true,
    "last_sync_at": "2024-01-15T12:00:00Z",
    "connected_at": "2024-01-10T09:00:00Z",
    "disconnected_at": null,
    "institution_id": "ins_123",
    "institution_name": "Demo Bank",
    "institution_logo_url": "https://cdn.demo.bank/logo.png",
    "sync_cursor": "cursor-456",
    "transaction_count": 125,
    "account_count": 3,
    "created_at": "2024-01-10T08:55:00Z",
    "updated_at": "2024-01-15T12:00:00Z"
}))]
pub struct ProviderConnection {
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
#[derive(Deserialize, ToSchema)]
#[schema(example = json!({}))]
pub struct LinkTokenRequest {}

#[derive(Deserialize, ToSchema)]
#[schema(example = json!({"public_token": "public-sandbox-abc123"}))]
pub struct ExchangeTokenRequest {
    pub public_token: String,
}

#[derive(Debug, Deserialize, ToSchema)]
#[schema(example = json!({
    "provider": "teller",
    "access_token": "access-sandbox-xyz",
    "enrollment_id": "enroll-123",
    "institution_name": "Teller Demo Bank"
}))]
pub struct ProviderConnectRequest {
    pub provider: String,
    pub access_token: String,
    pub enrollment_id: String,
    pub institution_name: Option<String>,
}

#[derive(Deserialize, Serialize, ToSchema)]
#[schema(example = json!({"connection_id": "connection-uuid"}))]
pub struct SyncTransactionsRequest {
    pub connection_id: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[schema(example = json!({"connection_id": "connection-uuid"}))]
pub struct DisconnectRequest {
    pub connection_id: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[schema(example = json!({"link_token": "link-sandbox-abc123"}))]
pub struct LinkTokenResponse {
    pub link_token: String,
}

#[derive(Debug, Deserialize, ToSchema)]
#[schema(example = json!({"provider": "teller"}))]
pub struct ProviderSelectRequest {
    #[schema(value_type = String, example = "teller")]
    pub provider: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[schema(example = json!({"user_provider": "teller"}))]
pub struct ProviderSelectResponse {
    pub user_provider: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[schema(example = json!({
    "available_providers": ["plaid", "teller"],
    "default_provider": "teller",
    "user_provider": "teller",
    "teller_application_id": "app-123",
    "teller_environment": "sandbox"
}))]
pub struct ProviderInfoResponse {
    pub available_providers: Vec<String>,
    pub default_provider: String,
    pub user_provider: String,
    #[schema(value_type = Option<String>)]
    pub teller_application_id: Option<String>,
    pub teller_environment: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[schema(example = json!({"cleared": true, "user_id": "99999999-8888-7777-6666-555555555555"}))]
pub struct ClearSyncedDataResponse {
    pub cleared: bool,
    pub user_id: String,
}

impl ProviderConnection {
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

    pub fn mark_connected(&mut self, institution_name: &str) {
        self.is_connected = true;
        self.connected_at = Some(Utc::now());
        self.disconnected_at = None;
        self.institution_name = Some(institution_name.to_string());
        self.updated_at = Some(Utc::now());
    }

    pub fn update_sync_info(&mut self, transaction_count: i32, account_count: i32) {
        self.last_sync_at = Some(Utc::now());
        self.transaction_count = transaction_count;
        self.account_count = account_count;
        self.updated_at = Some(Utc::now());
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(example = json!({
    "is_connected": true,
    "last_sync_at": "2024-01-10T12:00:00Z",
    "institution_name": "Demo Bank",
    "connection_id": "connection-uuid",
    "transaction_count": 120,
    "account_count": 3,
    "sync_in_progress": false
}))]
pub struct ProviderConnectionStatus {
    pub is_connected: bool,
    pub last_sync_at: Option<String>,
    pub institution_name: Option<String>,
    pub connection_id: Option<String>,
    pub transaction_count: i32,
    pub account_count: i32,
    pub sync_in_progress: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(example = json!({
    "provider": "teller",
    "connections": [{
        "is_connected": true,
        "last_sync_at": "2024-01-10T12:00:00Z",
        "institution_name": "Demo Bank",
        "connection_id": "connection-uuid",
        "transaction_count": 120,
        "account_count": 3,
        "sync_in_progress": false
    }]
}))]
pub struct ProviderStatusResponse {
    pub provider: String,
    pub connections: Vec<ProviderConnectionStatus>,
}

#[derive(Debug, Serialize, ToSchema)]
#[schema(example = json!({"connection_id": "connection-uuid", "institution_name": "Demo Bank"}))]
pub struct ProviderConnectResponse {
    pub connection_id: String,
    pub institution_name: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[schema(example = json!({
    "access_token": "access-sandbox-xyz",
    "item_id": "item-123",
    "institution_id": "ins_123",
    "institution_name": "Demo Bank"
}))]
pub struct ExchangeTokenResponse {
    pub access_token: String,
    pub item_id: String,
    pub institution_id: Option<String>,
    pub institution_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(example = json!({
    "success": true,
    "message": "Connection disconnected and data cleared",
    "data_cleared": {
        "transactions": 25,
        "accounts": 2,
        "cache_keys": ["user123_bank_connection"]
    }
}))]
pub struct DisconnectResult {
    pub success: bool,
    pub message: String,
    pub data_cleared: DataCleared,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(example = json!({
    "transactions": 25,
    "accounts": 2,
    "cache_keys": ["user123_bank_connection"]
}))]
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
