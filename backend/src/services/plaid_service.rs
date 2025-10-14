use anyhow::Result;
use chrono::NaiveDate;
use rust_decimal::prelude::FromPrimitive;
use rust_decimal::Decimal;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::{account::Account, transaction::Transaction};

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
            "client_name": "Sumaura",
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
                        .and_then(|f| Decimal::from_f64(f));

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
    ) -> Result<Vec<Transaction>> {
        let request_body = json!({
            "client_id": self.client_id,
            "secret": self.secret,
            "access_token": access_token,
            "start_date": start_date.format("%Y-%m-%d").to_string(),
            "end_date": end_date.format("%Y-%m-%d").to_string()
        });

        let response = self
            .http_client
            .post(format!("{}/transactions/get", self.base_url))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;
            let mut transactions = Vec::new();

            if let Some(transactions_array) = data.get("transactions").and_then(|v| v.as_array()) {
                for t in transactions_array {
                    let amount = t.get("amount").and_then(|v| v.as_f64()).unwrap_or(0.0);

                    let name = t
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Unknown")
                        .to_string();

                    let date = t
                        .get("date")
                        .and_then(|v| v.as_str())
                        .unwrap_or("1970-01-01")
                        .to_string();

                    let provider_transaction_id = t
                        .get("transaction_id")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());

                    let provider_account_id = t
                        .get("account_id")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());

                    // Extract category information from Plaid API personal_finance_category
                    let category_primary = t
                        .get("personal_finance_category")
                        .and_then(|pfc| pfc.get("primary"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("OTHER")
                        .to_string();

                    let category_detailed = t
                        .get("personal_finance_category")
                        .and_then(|pfc| pfc.get("detailed"))
                        .and_then(|v| v.as_str())
                        .unwrap_or(&category_primary)
                        .to_string();

                    let category_confidence = t
                        .get("personal_finance_category")
                        .and_then(|pfc| pfc.get("confidence_level"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("MEDIUM")
                        .to_string();

                    let payment_channel = t
                        .get("payment_channel")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());

                    let pending = t.get("pending").and_then(|v| v.as_bool()).unwrap_or(false);

                    let transaction = Transaction {
                        id: Uuid::new_v4(),
                        account_id: Uuid::new_v4(),
                        user_id: None,
                        provider_account_id,
                        provider_transaction_id,
                        amount: Decimal::from_f64(amount).unwrap_or(Decimal::ZERO),
                        date: chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d").unwrap_or_else(
                            |_| chrono::NaiveDate::from_ymd_opt(1970, 1, 1).unwrap(),
                        ),
                        merchant_name: Some(name),
                        category_primary,
                        category_detailed,
                        category_confidence,
                        payment_channel,
                        pending,
                        created_at: Some(chrono::Utc::now()),
                    };
                    transactions.push(transaction);
                }
            }

            Ok(transactions)
        } else {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            Err(anyhow::anyhow!("Plaid API error: {}", error_text))
        }
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
    client: Arc<RealPlaidClient>,
}

impl PlaidService {
    pub fn new(client: Arc<RealPlaidClient>) -> Self {
        Self { client }
    }
}

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
    ) -> Result<Vec<Transaction>> {
        self.client
            .get_transactions(access_token, start_date, end_date)
            .await
    }
}
