//! Plaid API helpers used by the Plaid provider adapter.

use anyhow::Result;
use chrono::NaiveDate;
use rust_decimal::prelude::FromPrimitive;
use rust_decimal::Decimal;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::{
    account::Account,
    transaction::{ProviderTransactionsResult, Transaction},
};

#[derive(Clone)]
pub struct RealPlaidClient {
    client_id: String,
    secret: String,
    base_url: String,
    http_client: reqwest::Client,
}

impl RealPlaidClient {
    pub fn new(client_id: String, secret: String, environment: String) -> Self {
        let base_url = match environment.to_lowercase().as_str() {
            "development" => "https://development.plaid.com",
            "production" => "https://production.plaid.com",
            _ => "https://sandbox.plaid.com",
        };

        Self {
            client_id,
            secret,
            base_url: base_url.to_string(),
            http_client: reqwest::Client::new(),
        }
    }

    #[cfg(test)]
    pub fn new_for_test(base_url: String) -> Self {
        Self {
            client_id: String::new(),
            secret: String::new(),
            base_url,
            http_client: reqwest::Client::new(),
        }
    }

    async fn get_institution_name(&self, institution_id: &str) -> Result<String> {
        let request_body = json!({
            "client_id": self.client_id,
            "secret": self.secret,
            "institution_id": institution_id,
            "country_codes": ["US"]
        });

        let response = self
            .http_client
            .post(format!("{}/institutions/get_by_id", self.base_url))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;
            let institution_name = data
                .get("institution")
                .and_then(|inst| inst.get("name"))
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown Bank")
                .to_string();

            Ok(institution_name)
        } else {
            Ok("Connected Bank".to_string())
        }
    }
}

impl RealPlaidClient {
    pub async fn create_link_token(&self, user_id: &str) -> Result<String> {
        let request_body = json!({
            "client_id": self.client_id,
            "secret": self.secret,
            "client_name": "Sumurai",
            "country_codes": ["US"],
            "language": "en",
            "user": {
                "client_user_id": user_id
            },
            "products": ["transactions"]
        });

        let response = self
            .http_client
            .post(format!("{}/link/token/create", self.base_url))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;
            if let Some(link_token) = data.get("link_token").and_then(|v| v.as_str()) {
                Ok(link_token.to_string())
            } else {
                Err(anyhow::anyhow!("No link_token in response"))
            }
        } else {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            Err(anyhow::anyhow!("Plaid API error: {}", error_text))
        }
    }

    pub async fn exchange_public_token(&self, public_token: &str) -> Result<String> {
        let request_body = json!({
            "client_id": self.client_id,
            "secret": self.secret,
            "public_token": public_token
        });

        let response = self
            .http_client
            .post(format!("{}/item/public_token/exchange", self.base_url))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;
            if let Some(access_token) = data.get("access_token").and_then(|v| v.as_str()) {
                Ok(access_token.to_string())
            } else {
                Err(anyhow::anyhow!("No access_token in response"))
            }
        } else {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            Err(anyhow::anyhow!("Plaid API error: {}", error_text))
        }
    }

    pub async fn get_accounts(&self, access_token: &str) -> Result<Vec<Account>> {
        let request_body = json!({
            "client_id": self.client_id,
            "secret": self.secret,
            "access_token": access_token
        });

        let response = self
            .http_client
            .post(format!("{}/accounts/get", self.base_url))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;
            let mut accounts = Vec::new();

            if let Some(accounts_array) = data.get("accounts").and_then(|v| v.as_array()) {
                for acc in accounts_array {
                    let id = acc
                        .get("account_id")
                        .and_then(|v| v.as_str())
                        .unwrap_or(&Uuid::new_v4().to_string())
                        .to_string();

                    let name = acc
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Unknown Account")
                        .to_string();

                    // Extract balance from Plaid API response
                    let balance_current = acc
                        .get("balances")
                        .and_then(|b| b.get("current"))
                        .and_then(|v| v.as_f64())
                        .and_then(Decimal::from_f64);

                    // Extract account mask from Plaid API response
                    let mask = acc
                        .get("mask")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());

                    let account = Account {
                        id: Uuid::new_v4(),
                        user_id: None,
                        provider_account_id: Some(id),
                        provider_connection_id: None,
                        name,
                        account_type: acc
                            .get("type")
                            .and_then(|v| v.as_str())
                            .unwrap_or("other")
                            .to_string(),
                        balance_current,
                        mask,
                        institution_name: None,
                        provider_conn_id: None,
                    };
                    accounts.push(account);
                }
            }

            Ok(accounts)
        } else {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            Err(anyhow::anyhow!("Plaid API error: {}", error_text))
        }
    }

    pub async fn get_transactions(
        &self,
        access_token: &str,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<ProviderTransactionsResult> {
        let mut transactions = Vec::new();
        let mut offset = 0usize;
        let mut total_transactions = None;
        let mut page_count = 0i32;

        loop {
            page_count += 1;
            let request_body = json!({
                "client_id": self.client_id,
                "secret": self.secret,
                "access_token": access_token,
                "start_date": start_date.format("%Y-%m-%d").to_string(),
                "end_date": end_date.format("%Y-%m-%d").to_string(),
                "options": {
                    "count": 500,
                    "offset": offset
                }
            });

            let response = self
                .http_client
                .post(format!("{}/transactions/get", self.base_url))
                .header("Content-Type", "application/json")
                .json(&request_body)
                .send()
                .await?;

            if !response.status().is_success() {
                let error_text = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Unknown error".to_string());
                return Err(anyhow::anyhow!("Plaid API error: {}", error_text));
            }

            let data: serde_json::Value = response.json().await?;
            let total = data
                .get("total_transactions")
                .and_then(|v| v.as_u64())
                .map(|value| value as usize);
            if total_transactions.is_none() {
                total_transactions = total;
            }

            let Some(transactions_array) = data.get("transactions").and_then(|v| v.as_array())
            else {
                break;
            };

            let batch_len = transactions_array.len();

            for t in transactions_array {
                transactions.push(Transaction::from_plaid(t, &Uuid::nil()));
            }

            offset += batch_len;

            if batch_len == 0 {
                break;
            }

            if let Some(total) = total_transactions {
                if offset >= total {
                    break;
                }
            } else {
                break;
            }
        }

        Ok(ProviderTransactionsResult {
            transactions,
            page_count,
        })
    }

    pub async fn get_item_info(
        &self,
        access_token: &str,
    ) -> Result<(String, Option<String>, Option<String>)> {
        let request_body = json!({
            "client_id": self.client_id,
            "secret": self.secret,
            "access_token": access_token,
        });

        let response = self
            .http_client
            .post(format!("{}/item/get", self.base_url))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;

            let item_id = data
                .get("item")
                .and_then(|item| item.get("item_id"))
                .and_then(|v| v.as_str())
                .unwrap_or("unknown_item")
                .to_string();

            let institution_id = data
                .get("item")
                .and_then(|item| item.get("institution_id"))
                .and_then(|v| v.as_str());

            let institution_name = if let Some(inst_id) = institution_id {
                self.get_institution_name(inst_id).await.ok()
            } else {
                None
            };

            Ok((
                item_id,
                institution_id.map(|s| s.to_string()),
                institution_name,
            ))
        } else {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            Err(anyhow::anyhow!("Failed to get item info: {}", error_text))
        }
    }
}

pub struct PlaidService {
    #[allow(dead_code)]
    client: Arc<RealPlaidClient>,
}

impl PlaidService {
    pub fn new(client: Arc<RealPlaidClient>) -> Self {
        Self { client }
    }
}

#[allow(dead_code)]
impl PlaidService {
    pub async fn create_link_token(&self, user_id: &str) -> Result<String> {
        self.client.create_link_token(user_id).await
    }

    pub async fn exchange_public_token(&self, public_token: &str) -> Result<String> {
        self.client.exchange_public_token(public_token).await
    }

    pub async fn get_accounts(&self, access_token: &str) -> Result<Vec<Account>> {
        self.client.get_accounts(access_token).await
    }

    pub async fn get_transactions(
        &self,
        access_token: &str,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<ProviderTransactionsResult> {
        self.client
            .get_transactions(access_token, start_date, end_date)
            .await
    }
}
