use anyhow::Result;
use async_trait::async_trait;
use chrono::NaiveDate;
use futures::future::join_all;
use reqwest::Client;
use rust_decimal::Decimal;
use std::str::FromStr;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::{account::Account, transaction::Transaction};
use crate::providers::trait_definition::{
    FinancialDataProvider, InstitutionInfo, ProviderCredentials,
};

#[cfg_attr(test, mockall::automock)]
#[async_trait]
pub trait TellerHttpClient: Send + Sync {
    async fn get_json_array(
        &self,
        url: &str,
        access_token: &str,
    ) -> anyhow::Result<Vec<serde_json::Value>>;

    async fn get_json_value(
        &self,
        url: &str,
        access_token: &str,
    ) -> anyhow::Result<serde_json::Value>;
}

struct ReqwestTellerClient {
    client: Client,
}

impl ReqwestTellerClient {
    fn new() -> anyhow::Result<Self> {
        let client = Client::builder().build()?;
        Ok(Self { client })
    }
}

#[async_trait]
impl TellerHttpClient for ReqwestTellerClient {
    async fn get_json_array(
        &self,
        url: &str,
        access_token: &str,
    ) -> anyhow::Result<Vec<serde_json::Value>> {
        let response = self
            .client
            .get(url)
            .basic_auth(access_token, Some(""))
            .send()
            .await?;
        let payload = response.json::<serde_json::Value>().await?;
        if let Some(array) = payload.as_array() {
            Ok(array.to_vec())
        } else {
            Err(anyhow::anyhow!("Expected array response from {}", url))
        }
    }

    async fn get_json_value(
        &self,
        url: &str,
        access_token: &str,
    ) -> anyhow::Result<serde_json::Value> {
        let response = self
            .client
            .get(url)
            .basic_auth(access_token, Some(""))
            .send()
            .await?;
        Ok(response.json::<serde_json::Value>().await?)
    }
}

pub struct TellerProvider {
    http_client: Arc<dyn TellerHttpClient>,
    base_url: String,
}

impl TellerProvider {
    pub fn new() -> Result<Self> {
        Ok(Self {
            http_client: Arc::new(ReqwestTellerClient::new()?),
            base_url: "https://api.teller.io".to_string(),
        })
    }

    #[cfg(test)]
    pub fn new_for_test(base_url: String, http_client: Arc<dyn TellerHttpClient>) -> Self {
        Self {
            http_client,
            base_url,
        }
    }

    async fn get_account_balances(
        &self,
        account_id: &str,
        credentials: &ProviderCredentials,
    ) -> Result<TellerBalances> {
        let url = format!("{}/accounts/{}/balances", self.base_url, account_id);
        let balances = self
            .http_client
            .get_json_value(&url, &credentials.access_token)
            .await?;

        Ok(TellerBalances {
            ledger: parse_balance_decimal(&balances["ledger"]),
            current: parse_balance_decimal(&balances["current"]),
            available: parse_balance_decimal(&balances["available"]),
            statement: parse_balance_decimal(&balances["statement"]),
        })
    }
}

#[derive(Debug)]
struct TellerBalances {
    ledger: Option<Decimal>,
    current: Option<Decimal>,
    available: Option<Decimal>,
    statement: Option<Decimal>,
}

fn parse_balance_decimal(value: &serde_json::Value) -> Option<Decimal> {
    match value {
        serde_json::Value::Null => None,
        serde_json::Value::Bool(_) => None,
        serde_json::Value::Number(num) => Decimal::from_str(&num.to_string()).ok(),
        serde_json::Value::String(s) => {
            use std::borrow::Cow;
            let sanitized: String = s
                .chars()
                .filter(|c| c.is_ascii_digit() || *c == '.' || *c == '-')
                .collect();
            let candidate: Cow<'_, str> = if sanitized.is_empty() {
                Cow::Borrowed(s.trim())
            } else {
                Cow::Owned(sanitized)
            };
            Decimal::from_str(candidate.as_ref()).ok()
        }
        serde_json::Value::Array(arr) => arr.iter().find_map(parse_balance_decimal),
        serde_json::Value::Object(map) => {
            if let Some(inner) = map.get("value") {
                parse_balance_decimal(inner)
            } else if let Some(amount) = map.get("amount") {
                parse_balance_decimal(amount)
            } else if let Some(current) = map.get("current") {
                parse_balance_decimal(current)
            } else {
                None
            }
        }
    }
}

#[async_trait]
impl FinancialDataProvider for TellerProvider {
    fn provider_name(&self) -> &str {
        "teller"
    }

    async fn create_link_token(&self, user_id: &Uuid) -> Result<String> {
        Ok(format!("teller_enrollment_{}", user_id))
    }

    async fn exchange_public_token(&self, public_token: &str) -> Result<ProviderCredentials> {
        Ok(ProviderCredentials {
            provider: "teller".to_string(),
            access_token: public_token.to_string(),
            item_id: "teller_enrollment".to_string(),
            certificate: None,
            private_key: None,
        })
    }

    async fn get_accounts(&self, credentials: &ProviderCredentials) -> Result<Vec<Account>> {
        let url = format!("{}/accounts", self.base_url);
        let teller_accounts = self
            .http_client
            .get_json_array(&url, &credentials.access_token)
            .await?;

        let account_ids: Vec<String> = teller_accounts
            .iter()
            .filter_map(|acc| acc["id"].as_str().map(String::from))
            .collect();

        let balance_futures: Vec<_> = account_ids
            .iter()
            .map(|account_id| self.get_account_balances(account_id, credentials))
            .collect();

        let balances = join_all(balance_futures).await;

        let accounts = teller_accounts
            .into_iter()
            .zip(balances)
            .map(|(acc_json, balance_result)| {
                let mut account = Account::from_teller(&acc_json);

                if let Ok(bal) = balance_result {
                    account.balance_current = bal
                        .ledger
                        .or(bal.current)
                        .or(bal.available)
                        .or(bal.statement);
                    if account.balance_current.is_none() {
                        account.balance_current = parse_balance_decimal(&acc_json["balance"]);
                    }
                    if account.balance_current.is_none() {
                        account.balance_current = acc_json["balance"]
                            .as_str()
                            .and_then(|s| Decimal::from_str(s).ok());
                    }
                }

                account
            })
            .collect();

        Ok(accounts)
    }

    async fn get_transactions(
        &self,
        credentials: &ProviderCredentials,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<Vec<Transaction>> {
        let accounts = self.get_accounts(credentials).await?;
        let mut all_transactions = Vec::new();

        for account in accounts {
            let account_id = account
                .provider_account_id
                .as_ref()
                .ok_or_else(|| anyhow::anyhow!("Account missing ID"))?;

            let url = format!("{}/accounts/{}/transactions", self.base_url, account_id);
            let teller_txns = self
                .http_client
                .get_json_array(&url, &credentials.access_token)
                .await?;

            let transactions = teller_txns
                .iter()
                .filter(|t| {
                    if let Some(date_str) = t["date"].as_str() {
                        if let Ok(date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                            return date >= start_date && date <= end_date;
                        }
                    }
                    false
                })
                .map(|t| Transaction::from_teller(t, &account.id, Some(account_id)))
                .collect::<Vec<_>>();

            all_transactions.extend(transactions);
        }

        Ok(all_transactions)
    }

    async fn get_institution_info(
        &self,
        credentials: &ProviderCredentials,
    ) -> Result<InstitutionInfo> {
        let url = format!("{}/accounts", self.base_url);
        let teller_accounts = self
            .http_client
            .get_json_array(&url, &credentials.access_token)
            .await?;

        let account = teller_accounts
            .first()
            .ok_or_else(|| anyhow::anyhow!("No accounts found"))?;

        Ok(InstitutionInfo {
            institution_id: account["institution"]["id"]
                .as_str()
                .unwrap_or("unknown")
                .to_string(),
            name: account["institution"]["name"]
                .as_str()
                .unwrap_or("Unknown Bank")
                .to_string(),
            logo: None,
            color: None,
        })
    }
}
