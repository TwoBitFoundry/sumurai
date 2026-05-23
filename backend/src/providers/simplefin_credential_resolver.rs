use super::credential_resolver::ProviderCredentialResolver;
use crate::providers::{FinancialDataProvider, ProviderCredentials};
use crate::services::repository_service::DatabaseRepository;
use async_trait::async_trait;
use std::sync::Arc;
use uuid::Uuid;

pub struct SimpleFinCredentialResolver {
    db_repository: Arc<dyn DatabaseRepository>,
    setup_token: Option<String>,
}

impl SimpleFinCredentialResolver {
    pub fn new(db_repository: Arc<dyn DatabaseRepository>, setup_token: Option<String>) -> Self {
        Self {
            db_repository,
            setup_token,
        }
    }

    fn root_item_id(user_id: &Uuid) -> String {
        format!("simplefin_root_{user_id}")
    }
}

#[async_trait]
impl ProviderCredentialResolver for SimpleFinCredentialResolver {
    async fn resolve_for_connect(
        &self,
        user_id: &Uuid,
        provider: Arc<dyn FinancialDataProvider>,
    ) -> anyhow::Result<ProviderCredentials> {
        if let Some(access_url) = self
            .db_repository
            .get_simplefin_root_credential(user_id)
            .await?
        {
            return Ok(ProviderCredentials {
                provider: "simplefin".to_string(),
                access_token: access_url,
                item_id: Self::root_item_id(user_id),
                certificate: None,
                private_key: None,
            });
        }

        let setup_token = self
            .setup_token
            .as_deref()
            .filter(|token| !token.trim().is_empty())
            .ok_or_else(|| anyhow::anyhow!("SimpleFIN setup token not configured"))?;

        let mut credentials = provider.exchange_public_token(setup_token).await?;
        credentials.item_id = Self::root_item_id(user_id);

        self.db_repository
            .store_simplefin_root_credential(user_id, &credentials.access_token)
            .await?;

        Ok(credentials)
    }

    async fn resolve_for_sync(&self, user_id: &Uuid) -> anyhow::Result<ProviderCredentials> {
        let access_url = self
            .db_repository
            .get_simplefin_root_credential(user_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("SimpleFIN access URL not found for user"))?;

        Ok(ProviderCredentials {
            provider: "simplefin".to_string(),
            access_token: access_url,
            item_id: Self::root_item_id(user_id),
            certificate: None,
            private_key: None,
        })
    }
}
