use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use serde_json::json;

pub fn simplefin_connect_request_example() -> serde_json::Value {
    json!({"simplefin_setup_token": null})
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct SimpleFinAccountsResponse {
    #[serde(default, alias = "errlist")]
    pub errors: Vec<SimpleFinApiErrorEntry>,
    #[serde(default)]
    pub connections: Vec<SimpleFinConnection>,
    #[serde(default)]
    pub accounts: Vec<SimpleFinAccount>,
}

impl SimpleFinAccountsResponse {
    pub fn normalize(&mut self) {
        for account in &mut self.accounts {
            if account
                .conn_id
                .as_ref()
                .is_none_or(|conn_id| conn_id.trim().is_empty())
            {
                account.conn_id = account.org_conn_id();
            }
        }

        if !self.connections.is_empty() {
            return;
        }

        let mut seen = HashSet::new();
        for account in &self.accounts {
            let Some(conn_id) = account.org_conn_id() else {
                continue;
            };
            if !seen.insert(conn_id.clone()) {
                continue;
            }

            let org = account.org.as_ref();
            self.connections.push(SimpleFinConnection {
                conn_id,
                name: org
                    .and_then(|org| org.name.clone())
                    .unwrap_or_else(|| account.name.clone()),
                org_id: org.map(|org| org.id.clone()).unwrap_or_default(),
                org_url: org.and_then(|org| org.url.clone()),
                sfin_url: org.and_then(|org| org.sfin_url.clone()),
            });
        }
    }

    pub fn error_messages(&self) -> Vec<String> {
        self.errors
            .iter()
            .map(SimpleFinApiErrorEntry::message)
            .collect()
    }
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum SimpleFinApiErrorEntry {
    Text(String),
    Structured(SimpleFinApiError),
}

impl SimpleFinApiErrorEntry {
    pub fn message(&self) -> String {
        match self {
            Self::Text(value) => value.clone(),
            Self::Structured(error) => error
                .message
                .clone()
                .or(error.msg.clone())
                .or(error.code.clone())
                .unwrap_or_else(|| "unknown SimpleFIN bridge error".to_string()),
        }
    }
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
pub struct SimpleFinOrg {
    pub id: String,
    pub name: Option<String>,
    pub domain: Option<String>,
    #[serde(rename = "sfin-url")]
    pub sfin_url: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct SimpleFinAccount {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub conn_id: Option<String>,
    #[serde(default)]
    pub org: Option<SimpleFinOrg>,
    pub currency: Option<String>,
    pub balance: Option<String>,
    #[serde(rename = "available-balance")]
    pub available_balance: Option<String>,
    #[serde(rename = "balance-date")]
    pub balance_date: Option<i64>,
    #[serde(default)]
    pub holdings: Vec<serde_json::Value>,
    #[serde(default)]
    pub transactions: Vec<SimpleFinTransaction>,
}

impl SimpleFinAccount {
    pub fn org_conn_id(&self) -> Option<String> {
        if let Some(conn_id) = self
            .conn_id
            .as_ref()
            .filter(|value| !value.trim().is_empty())
        {
            return Some(conn_id.clone());
        }

        self.org.as_ref().map(|org| org.id.clone())
    }
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

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq)]
pub struct SimpleFinIgnoredInstitution {
    pub org_conn_id: String,
    pub institution_name: Option<String>,
    pub hidden_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq)]
pub struct SimpleFinIgnoredInstitutionsResponse {
    pub institutions: Vec<SimpleFinIgnoredInstitution>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct SimpleFinRestoreIgnoredInstitutionRequest {
    pub org_conn_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema, Default)]
#[schema(example = json!({"simplefin_setup_token": null}))]
pub struct SimpleFinConnectRequest {
    pub simplefin_setup_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SimpleFinRestoreIgnoredInstitutionResponse {
    pub restored: bool,
}
