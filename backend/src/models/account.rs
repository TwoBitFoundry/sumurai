use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Account {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub plaid_account_id: Option<String>,
    pub plaid_connection_id: Option<Uuid>,
    pub name: String,
    pub account_type: String,
    pub balance_current: Option<Decimal>,
    pub mask: Option<String>,
    pub institution_name: Option<String>,
}

#[derive(Serialize)]
pub struct AccountResponse {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub plaid_account_id: Option<String>,
    pub plaid_connection_id: Option<Uuid>,
    pub name: String,
    pub account_type: String,
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
            plaid_account_id: teller_acc["id"].as_str().map(String::from),
            plaid_connection_id: None,
            name: teller_acc["name"]
                .as_str()
                .unwrap_or("Unknown")
                .to_string(),
            account_type: teller_acc["type"]
                .as_str()
                .unwrap_or("other")
                .to_string(),
            balance_current: None,
            mask: teller_acc["last_four"].as_str().map(String::from),
            institution_name: teller_acc["institution"]["name"]
                .as_str()
                .map(String::from),
        }
    }
}
