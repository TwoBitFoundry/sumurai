use super::credential_resolver::ProviderCredentialResolver;
use crate::providers::{FinancialDataProvider, ProviderCredentials};
use crate::services::repository_service::DatabaseRepository;
use async_trait::async_trait;
use std::sync::Arc;
use uuid::Uuid;

pub struct PlaidCredentialResolver {
    _db_repository: Arc<dyn DatabaseRepository>,
}

impl PlaidCredentialResolver {
    pub fn new(db_repository: Arc<dyn DatabaseRepository>) -> Self {
        Self {
            _db_repository: db_repository,
        }
    }
}

#[async_trait]
impl ProviderCredentialResolver for PlaidCredentialResolver {
    async fn resolve_for_connect(
        &self,
        _user_id: &Uuid,
        _provider: Arc<dyn FinancialDataProvider>,
        _setup_token: Option<&str>,
    ) -> anyhow::Result<ProviderCredentials> {
        Err(anyhow::anyhow!(
            "Plaid requires exchange_public_token flow, not setup token"
        ))
    }

    async fn resolve_for_sync(&self, _user_id: &Uuid) -> anyhow::Result<ProviderCredentials> {
        Err(anyhow::anyhow!(
            "Plaid credentials should be loaded per-connection, not per-user"
        ))
    }
}
