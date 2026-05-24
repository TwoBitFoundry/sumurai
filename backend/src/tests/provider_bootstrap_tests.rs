use std::sync::Arc;

use anyhow::Result;
use async_trait::async_trait;
use chrono::NaiveDate;
use uuid::Uuid;

use crate::models::{
    account::Account, simplefin::SimpleFinAccountsResponse, transaction::ProviderTransactionsResult,
};
use crate::providers::{FinancialDataProvider, InstitutionInfo, ProviderCredentials};

struct DummyProvider {
    name: &'static str,
}

#[async_trait]
impl FinancialDataProvider for DummyProvider {
    fn provider_name(&self) -> &str {
        self.name
    }

    async fn create_link_token(&self, _user_id: &Uuid) -> Result<String> {
        Ok(format!("{}_link_token", self.name))
    }

    async fn exchange_public_token(&self, _public_token: &str) -> Result<ProviderCredentials> {
        Ok(ProviderCredentials {
            provider: self.name.to_string(),
            access_token: format!("{}_access_token", self.name),
            item_id: format!("{}_item", self.name),
            certificate: None,
            private_key: None,
        })
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
        Ok(InstitutionInfo {
            institution_id: format!("{}_institution", self.name),
            name: format!("{} Bank", self.name),
            logo: None,
            color: None,
        })
    }

    async fn fetch_balances_snapshot(
        &self,
        _credentials: &ProviderCredentials,
    ) -> Result<Option<SimpleFinAccountsResponse>> {
        Ok(None)
    }
}

#[test]
fn given_plaid_and_teller_unavailable_when_building_provider_registry_then_only_simplefin_is_registered(
) {
    let simplefin_provider: Arc<dyn FinancialDataProvider> =
        Arc::new(DummyProvider { name: "simplefin" });

    let registry = crate::build_provider_registry(
        None,
        Err(anyhow::anyhow!("teller unavailable")),
        simplefin_provider,
    );

    assert!(registry.get("plaid").is_none());
    assert!(registry.get("teller").is_none());

    let simplefin = registry.get("simplefin").expect("simplefin provider");
    assert_eq!(simplefin.provider_name(), "simplefin");
}
