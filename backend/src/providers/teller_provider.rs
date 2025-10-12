use anyhow::Result;
use async_trait::async_trait;
use chrono::NaiveDate;
use futures::future::join_all;
use reqwest::Client;
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;

use crate::models::{account::Account, transaction::Transaction};
use crate::providers::trait_definition::{
    FinancialDataProvider, InstitutionInfo, ProviderCredentials,
};

pub struct TellerProvider {
    client: Client,
    base_url: String,
}

impl TellerProvider {
    pub fn new() -> Result<Self> {
        let client = Client::builder().build()?;
        Ok(Self {
            client,
            base_url: "https://api.teller.io".to_string(),
        })
    }

    #[cfg(test)]
    pub fn new_for_test(base_url: String) -> Self {
        Self {
            client: Client::new(),
            base_url,
        }
    }

    async fn get_account_balances(
        &self,
        account_id: &str,
        credentials: &ProviderCredentials,
    ) -> Result<TellerBalances> {
        let url = format!("{}/accounts/{}/balances", self.base_url, account_id);
        let response = self
            .client
            .get(&url)
            .basic_auth(&credentials.access_token, Some(""))
            .send()
            .await?;

        let balances: serde_json::Value = response.json().await?;

        Ok(TellerBalances {
            ledger: balances["ledger"]
                .as_str()
                .and_then(|s| Decimal::from_str(s).ok()),
            available: balances["available"]
                .as_str()
                .and_then(|s| Decimal::from_str(s).ok()),
        })
    }
}

#[derive(Debug)]
struct TellerBalances {
    ledger: Option<Decimal>,
    available: Option<Decimal>,
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
        let response = self
            .client
            .get(&url)
            .basic_auth(&credentials.access_token, Some(""))
            .send()
            .await?;

        let teller_accounts: Vec<serde_json::Value> = response.json().await?;

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
                    account.balance_current = bal.ledger.or(bal.available);
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
            let response = self
                .client
                .get(&url)
                .basic_auth(&credentials.access_token, Some(""))
                .send()
                .await?;

            let teller_txns: Vec<serde_json::Value> = response.json().await?;

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
                .map(|t| Transaction::from_teller(t, &account.id))
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
        let response = self
            .client
            .get(&url)
            .basic_auth(&credentials.access_token, Some(""))
            .send()
            .await?;

        let teller_accounts: Vec<serde_json::Value> = response.json().await?;

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
