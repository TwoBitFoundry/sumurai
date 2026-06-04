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

    pub fn institutions_requiring_auth(&self) -> Vec<SimpleFinInstitutionAuthRequired> {
        let mut notices = Vec::new();
        let mut seen = HashSet::new();

        for error in &self.errors {
            let message = error.message();
            if !message_requires_auth_refresh(&message) {
                continue;
            }

            let org_conn_id = error
                .conn_id()
                .or_else(|| conn_id_from_auth_message(&message));
            let institution_name = org_conn_id
                .as_ref()
                .and_then(|conn_id| {
                    self.connections
                        .iter()
                        .find(|connection| connection.conn_id == *conn_id)
                        .map(|connection| connection.name.clone())
                })
                .or_else(|| institution_name_from_auth_message(&message))
                .unwrap_or_else(|| "Institution".to_string());

            let dedupe_key = org_conn_id
                .clone()
                .unwrap_or_else(|| institution_name.to_ascii_lowercase());
            if !seen.insert(dedupe_key) {
                continue;
            }

            notices.push(SimpleFinInstitutionAuthRequired {
                institution_name,
                org_conn_id,
                message,
            });
        }

        notices
    }

    pub fn org_has_accounts(&self, org_conn_id: &str) -> bool {
        self.accounts
            .iter()
            .any(|account| account.org_conn_id().as_deref() == Some(org_conn_id))
    }
}

pub(crate) fn message_requires_auth_refresh(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    lower.contains("auth required") || lower.contains("may need attention")
}

fn institution_name_from_auth_message(message: &str) -> Option<String> {
    const PREFIX: &str = "connection to ";
    const SUFFIX: &str = " may need attention";

    let lower = message.to_ascii_lowercase();
    let start = lower.find(PREFIX)?;
    let rest = &message[start + PREFIX.len()..];
    let end = rest.to_ascii_lowercase().find(SUFFIX)?;
    let name = rest[..end].trim();
    if name.is_empty() {
        None
    } else {
        Some(name.to_string())
    }
}

fn conn_id_from_auth_message(_message: &str) -> Option<String> {
    None
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct SimpleFinInstitutionAuthRequired {
    pub institution_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub org_conn_id: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SimpleFinInstitutionSyncStatus {
    Synced,
    AuthRequired,
    SkippedHidden,
    NoAccounts,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct SimpleFinInstitutionSyncResult {
    pub institution_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub org_conn_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connection_id: Option<String>,
    pub status: SimpleFinInstitutionSyncStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transaction_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
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

    pub fn conn_id(&self) -> Option<String> {
        match self {
            Self::Text(_) => None,
            Self::Structured(error) => error.conn_id.clone(),
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
