use anyhow::Result;
use async_trait::async_trait;
use chrono::NaiveDate;
use uuid::Uuid;

use crate::models::{account::Account, transaction::Transaction};

#[async_trait]
pub trait FinancialDataProvider: Send + Sync {
    fn provider_name(&self) -> &str;

    async fn create_link_token(&self, user_id: &Uuid) -> Result<String>;

    async fn exchange_public_token(&self, public_token: &str) -> Result<ProviderCredentials>;

    async fn get_accounts(&self, credentials: &ProviderCredentials) -> Result<Vec<Account>>;

    async fn get_transactions(
        &self,
        credentials: &ProviderCredentials,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<Vec<Transaction>>;

    async fn get_institution_info(
        &self,
        credentials: &ProviderCredentials,
    ) -> Result<InstitutionInfo>;
}

#[derive(Debug, Clone)]
pub struct ProviderCredentials {
    pub provider: String,
    pub access_token: String,
    pub item_id: String,
    pub certificate: Option<Vec<u8>>,
    pub private_key: Option<Vec<u8>>,
}

#[derive(Debug, Clone)]
pub struct InstitutionInfo {
    pub institution_id: String,
    pub name: String,
    pub logo: Option<String>,
    pub color: Option<String>,
}
