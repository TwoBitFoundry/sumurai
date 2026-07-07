#![allow(dead_code)]

use anyhow::Result;
use async_trait::async_trait;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CreateCheckoutRequest {
    pub user_email: String,
    pub price_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CreateCheckoutResponse {
    pub checkout_url: String,
}

#[async_trait]
#[cfg_attr(test, mockall::automock)]
pub trait PaddleClient: Send + Sync {
    async fn create_checkout(
        &self,
        request: CreateCheckoutRequest,
    ) -> Result<CreateCheckoutResponse>;
}
