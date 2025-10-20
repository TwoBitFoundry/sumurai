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
    "provider_account_id": "acct-123",
    "provider_connection_id": "99999999-8888-7777-6666-555555555555",
    "name": "Demo Checking",
    "account_type": "depository",
    "balance_current": "1234.56",
    "mask": "1234",
    "institution_name": "Demo Bank"
}))]
pub struct Account {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub provider_account_id: Option<String>,
    pub provider_connection_id: Option<Uuid>,
    pub name: String,
    pub account_type: String,
    #[schema(value_type = Option<String>)]
    pub balance_current: Option<Decimal>,
    pub mask: Option<String>,
    pub institution_name: Option<String>,
}

#[derive(Serialize, ToSchema)]
#[schema(example = json!({
    "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "user_id": "ffffffff-1111-2222-3333-444444444444",
    "provider_account_id": "acct-123",
    "provider_connection_id": "99999999-8888-7777-6666-555555555555",
    "name": "Demo Checking",
    "account_type": "depository",
    "balance_current": "1234.56",
    "mask": "1234",
    "transaction_count": 42,
    "institution_name": "Demo Bank"
}))]
pub struct AccountResponse {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub provider_account_id: Option<String>,
    pub provider_connection_id: Option<Uuid>,
    pub name: String,
    pub account_type: String,
    #[schema(value_type = Option<String>)]
    pub balance_current: Option<rust_decimal::Decimal>,
    pub mask: Option<String>,
    pub transaction_count: i64,
    pub institution_name: Option<String>,
}

impl Account {
    pub fn from_teller(teller_acc: &serde_json::Value) -> Self {
        Self {
            id: Uuid::new_v4(),
            user_id: None,
            provider_account_id: teller_acc["id"].as_str().map(String::from),
            provider_connection_id: None,
            name: teller_acc["name"].as_str().unwrap_or("Unknown").to_string(),
            account_type: teller_acc["type"].as_str().unwrap_or("other").to_string(),
            balance_current: None,
            mask: teller_acc["last_four"].as_str().map(String::from),
            institution_name: teller_acc["institution"]["name"].as_str().map(String::from),
        }
    }

    pub fn from_plaid(plaid_acc: &serde_json::Value) -> Self {
        Self {
            id: Uuid::new_v4(),
            user_id: None,
            provider_account_id: plaid_acc["account_id"].as_str().map(String::from),
            provider_connection_id: None,
            name: plaid_acc["name"].as_str().unwrap_or("Unknown").to_string(),
            account_type: plaid_acc["type"].as_str().unwrap_or("other").to_string(),
            balance_current: plaid_acc["balances"]["current"]
                .as_f64()
                .and_then(Decimal::from_f64_retain),
            mask: plaid_acc["mask"].as_str().map(String::from),
            institution_name: None,
        }
    }
}
