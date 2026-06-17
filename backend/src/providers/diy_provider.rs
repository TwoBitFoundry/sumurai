use anyhow::{anyhow, Result};
use async_trait::async_trait;
use chrono::NaiveDate;
use uuid::Uuid;

use crate::models::{account::Account, transaction::ProviderTransactionsResult};

use super::trait_definition::{FinancialDataProvider, InstitutionInfo, ProviderCredentials};

pub struct DiyProvider;

#[async_trait]
impl FinancialDataProvider for DiyProvider {
    fn provider_name(&self) -> &str {
        "diy"
    }

    async fn create_link_token(&self, _user_id: &Uuid) -> Result<String> {
        Err(anyhow!("DIY provider does not support link tokens"))
    }

    async fn exchange_public_token(&self, _public_token: &str) -> Result<ProviderCredentials> {
        Err(anyhow!("DIY provider does not support token exchange"))
    }

    async fn get_accounts(&self, _credentials: &ProviderCredentials) -> Result<Vec<Account>> {
        Ok(vec![])
    }

    async fn get_transactions(
        &self,
        _credentials: &ProviderCredentials,
        _start_date: NaiveDate,
        _end_date: NaiveDate,
    ) -> Result<ProviderTransactionsResult> {
        Ok(ProviderTransactionsResult {
            transactions: vec![],
            page_count: 0,
        })
    }

    async fn get_institution_info(
        &self,
        _credentials: &ProviderCredentials,
    ) -> Result<InstitutionInfo> {
        Err(anyhow!("DIY provider does not support institution info"))
    }
}
