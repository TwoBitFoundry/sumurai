use super::credential_resolver::ProviderCredentialResolver;
use crate::providers::simplefin_provider::{SimpleFinProvider, SimpleFinProviderError};
use crate::providers::{FinancialDataProvider, ProviderCredentials};
use crate::services::repository_service::DatabaseRepository;
use async_trait::async_trait;
use std::sync::Arc;
use uuid::Uuid;

pub struct SimpleFinCredentialResolver {
    db_repository: Arc<dyn DatabaseRepository>,
}

impl SimpleFinCredentialResolver {
    pub fn new(db_repository: Arc<dyn DatabaseRepository>) -> Self {
        Self { db_repository }
    }

    fn root_item_id(user_id: &Uuid) -> String {
        format!("simplefin_root_{user_id}")
    }

    fn setup_token_already_claimed(err: &anyhow::Error) -> bool {
        err.chain().any(|source| {
            source
                .downcast_ref::<SimpleFinProviderError>()
                .is_some_and(|error| {
                    matches!(error, SimpleFinProviderError::SetupTokenAlreadyClaimed)
                })
        })
    }
}

#[async_trait]
impl ProviderCredentialResolver for SimpleFinCredentialResolver {
    async fn resolve_for_connect(
        &self,
        user_id: &Uuid,
        provider: Arc<dyn FinancialDataProvider>,
        setup_token: Option<&str>,
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

        let setup_token = setup_token
            .map(str::trim)
            .filter(|token| !token.is_empty())
            .ok_or_else(|| anyhow::anyhow!("SimpleFIN setup token must be provided"))?;

        let _decoded = SimpleFinProvider::decode_setup_token(setup_token)
            .map_err(|_| anyhow::anyhow!("SimpleFIN setup token is malformed"))?;

        let credentials = match provider.exchange_public_token(setup_token).await {
            Ok(mut credentials) => {
                credentials.item_id = Self::root_item_id(user_id);
                credentials
            }
            Err(err) if Self::setup_token_already_claimed(&err) => {
                let access_url =
                    SimpleFinProvider::beta_demo_access_url_for_consumed_setup_token(setup_token)
                        .ok_or_else(|| {
                        anyhow::anyhow!("SimpleFIN setup token has already been claimed")
                    })?;
                ProviderCredentials {
                    provider: "simplefin".to_string(),
                    access_token: access_url,
                    item_id: Self::root_item_id(user_id),
                    certificate: None,
                    private_key: None,
                }
            }
            Err(err) => return Err(anyhow::anyhow!("SimpleFIN claim failed: {err}")),
        };

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
