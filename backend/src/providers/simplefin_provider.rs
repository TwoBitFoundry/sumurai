use anyhow::{bail, Result};
use async_trait::async_trait;
use chrono::NaiveDate;
use uuid::Uuid;

use crate::models::{account::Account, transaction::ProviderTransactionsResult};
use crate::providers::trait_definition::{
    FinancialDataProvider, InstitutionInfo, ProviderCredentials,
};

pub struct SimpleFinProvider;

impl Default for SimpleFinProvider {
    fn default() -> Self {
        Self
    }
}

impl SimpleFinProvider {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl FinancialDataProvider for SimpleFinProvider {
    fn provider_name(&self) -> &str {
        "simplefin"
    }

    async fn create_link_token(&self, _user_id: &Uuid) -> Result<String> {
        bail!("not yet implemented")
    }

    async fn exchange_public_token(&self, _public_token: &str) -> Result<ProviderCredentials> {
        bail!("not yet implemented")
    }

    async fn get_accounts(&self, _credentials: &ProviderCredentials) -> Result<Vec<Account>> {
        bail!("not yet implemented")
    }

    async fn get_transactions(
        &self,
        _credentials: &ProviderCredentials,
        _start_date: NaiveDate,
        _end_date: NaiveDate,
    ) -> Result<ProviderTransactionsResult> {
        bail!("not yet implemented")
    }

    async fn get_institution_info(
        &self,
        _credentials: &ProviderCredentials,
    ) -> Result<InstitutionInfo> {
        bail!("not yet implemented")
    }
}
