use anyhow::Result;
use async_trait::async_trait;
use chrono::NaiveDate;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::{account::Account, transaction::Transaction};
use crate::providers::trait_definition::{
    FinancialDataProvider, InstitutionInfo, ProviderCredentials,
};
use crate::services::plaid_service::RealPlaidClient;

pub struct PlaidProvider {
    client: Arc<RealPlaidClient>,
}

impl PlaidProvider {
    pub fn new(client: Arc<RealPlaidClient>) -> Self {
        Self { client }
    }
}

#[async_trait]
impl FinancialDataProvider for PlaidProvider {
    fn provider_name(&self) -> &str {
        "plaid"
    }

    async fn create_link_token(&self, user_id: &Uuid) -> Result<String> {
        self.client.create_link_token(&user_id.to_string()).await
    }

    async fn exchange_public_token(&self, public_token: &str) -> Result<ProviderCredentials> {
        let access_token = self.client.exchange_public_token(public_token).await?;

        let (item_id, _, _) = self.client.get_item_info(&access_token).await?;

        Ok(ProviderCredentials {
            provider: "plaid".to_string(),
            access_token,
            item_id,
            certificate: None,
            private_key: None,
        })
    }

    async fn get_accounts(&self, credentials: &ProviderCredentials) -> Result<Vec<Account>> {
        self.client.get_accounts(&credentials.access_token).await
    }

    async fn get_transactions(
        &self,
        credentials: &ProviderCredentials,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<Vec<Transaction>> {
        self.client
            .get_transactions(&credentials.access_token, start_date, end_date)
            .await
    }

    async fn get_institution_info(
        &self,
        credentials: &ProviderCredentials,
    ) -> Result<InstitutionInfo> {
        let (item_id, institution_id, institution_name) =
            self.client.get_item_info(&credentials.access_token).await?;

        Ok(InstitutionInfo {
            institution_id: institution_id.unwrap_or_else(|| item_id.clone()),
            name: institution_name.unwrap_or_else(|| "Unknown Bank".to_string()),
            logo: None,
            color: None,
        })
    }
}
