use serde::Deserialize;

#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct SimpleFinAccountsResponse {
    #[serde(default, alias = "errlist")]
    pub errors: Vec<SimpleFinApiError>,
    #[serde(default)]
    pub connections: Vec<SimpleFinConnection>,
    #[serde(default)]
    pub accounts: Vec<SimpleFinAccount>,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct SimpleFinApiError {
    pub code: Option<String>,
    pub message: Option<String>,
    #[serde(alias = "msg")]
    pub msg: Option<String>,
    pub conn_id: Option<String>,
    pub account_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct SimpleFinConnection {
    pub conn_id: String,
    pub name: String,
    pub org_id: String,
    pub org_url: Option<String>,
    pub sfin_url: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct SimpleFinAccount {
    pub id: String,
    pub name: String,
    pub conn_id: String,
    pub currency: Option<String>,
    pub balance: Option<String>,
    #[serde(rename = "available-balance")]
    pub available_balance: Option<String>,
    #[serde(rename = "balance-date")]
    pub balance_date: Option<i64>,
    #[serde(default)]
    pub transactions: Vec<SimpleFinTransaction>,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct SimpleFinTransaction {
    pub id: String,
    pub posted: i64,
    pub amount: String,
    pub description: String,
    #[serde(default)]
    pub pending: bool,
    pub transacted_at: Option<i64>,
    #[serde(default)]
    pub extra: serde_json::Value,
}
