use crate::providers::{FinancialDataProvider, ProviderCredentials};
use async_trait::async_trait;
use std::sync::Arc;
use uuid::Uuid;

#[async_trait]
pub trait ProviderCredentialResolver: Send + Sync {
    async fn resolve_for_connect(
        &self,
        user_id: &Uuid,
        provider: Arc<dyn FinancialDataProvider>,
        setup_token: Option<&str>,
    ) -> anyhow::Result<ProviderCredentials>;

    async fn resolve_for_sync(&self, user_id: &Uuid) -> anyhow::Result<ProviderCredentials>;
}
