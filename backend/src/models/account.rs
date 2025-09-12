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
}
