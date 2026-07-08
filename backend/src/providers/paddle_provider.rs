use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CreateCheckoutRequest {
    pub user_email: String,
    pub price_id: String,
    pub user_id: Uuid,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CreateCheckoutResponse {
    pub checkout_url: String,
    pub transaction_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CreateCardlessTrialRequest {
    pub user_id: Uuid,
    pub user_email: String,
    pub existing_customer_id: Option<String>,
    pub existing_address_id: Option<String>,
    pub country_code: String,
    pub postal_code: String,
    pub price_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CreateCardlessTrialResponse {
    pub customer_id: String,
    pub address_id: String,
    pub transaction_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CreatePaymentMethodTransactionRequest {
    pub subscription_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CreatePaymentMethodTransactionResponse {
    pub checkout_url: String,
    pub transaction_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CreatePortalSessionRequest {
    pub customer_id: String,
    pub subscription_ids: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CreatePortalSessionResponse {
    pub overview_url: String,
    pub subscription_urls: Vec<String>,
}

#[async_trait]
#[cfg_attr(test, mockall::automock)]
pub trait PaddleClient: Send + Sync {
    async fn create_checkout(
        &self,
        request: CreateCheckoutRequest,
    ) -> Result<CreateCheckoutResponse>;

    async fn create_cardless_trial(
        &self,
        request: CreateCardlessTrialRequest,
    ) -> Result<CreateCardlessTrialResponse>;

    async fn create_payment_method_transaction(
        &self,
        request: CreatePaymentMethodTransactionRequest,
    ) -> Result<CreatePaymentMethodTransactionResponse>;

    async fn create_portal_session(
        &self,
        request: CreatePortalSessionRequest,
    ) -> Result<CreatePortalSessionResponse>;
}

#[derive(Clone, Copy, Debug, Default)]
pub struct NoOpPaddleClient;

#[async_trait]
impl PaddleClient for NoOpPaddleClient {
    async fn create_checkout(
        &self,
        _request: CreateCheckoutRequest,
    ) -> Result<CreateCheckoutResponse> {
        Err(anyhow!("Paddle billing is disabled"))
    }

    async fn create_cardless_trial(
        &self,
        _request: CreateCardlessTrialRequest,
    ) -> Result<CreateCardlessTrialResponse> {
        Err(anyhow!("Paddle billing is disabled"))
    }

    async fn create_payment_method_transaction(
        &self,
        _request: CreatePaymentMethodTransactionRequest,
    ) -> Result<CreatePaymentMethodTransactionResponse> {
        Err(anyhow!("Paddle billing is disabled"))
    }

    async fn create_portal_session(
        &self,
        _request: CreatePortalSessionRequest,
    ) -> Result<CreatePortalSessionResponse> {
        Err(anyhow!("Paddle billing is disabled"))
    }
}

#[derive(Clone)]
pub struct RealPaddleClient {
    http: reqwest::Client,
    api_key: String,
    base_url: String,
}

impl RealPaddleClient {
    pub fn new(environment: &str, api_key: String) -> Self {
        let base_url = if environment == "production" {
            "https://api.paddle.com".to_string()
        } else {
            "https://sandbox-api.paddle.com".to_string()
        };
        Self {
            http: reqwest::Client::new(),
            api_key,
            base_url,
        }
    }

    async fn post<T: serde::de::DeserializeOwned>(
        &self,
        path: &str,
        body: serde_json::Value,
    ) -> Result<T> {
        let response = self
            .http
            .post(format!("{}{}", self.base_url, path))
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await?;
        let status = response.status();
        if !status.is_success() {
            return Err(anyhow!("Paddle API request failed with status {}", status));
        }
        Ok(response.json::<T>().await?)
    }
}

#[async_trait]
impl PaddleClient for RealPaddleClient {
    async fn create_checkout(
        &self,
        request: CreateCheckoutRequest,
    ) -> Result<CreateCheckoutResponse> {
        let response: PaddleTransactionResponse = self
            .post(
                "/transactions",
                json!({
                    "items": [{ "price_id": request.price_id, "quantity": 1 }],
                    "customer_ip_address": null,
                    "custom_data": { "sumurai_user_id": request.user_id.to_string() },
                    "collection_mode": "automatic",
                }),
            )
            .await?;
        let data = response.data;
        Ok(CreateCheckoutResponse {
            transaction_id: data.id,
            checkout_url: data
                .checkout
                .and_then(|checkout| checkout.url)
                .ok_or_else(|| anyhow!("Paddle transaction did not include checkout URL"))?,
        })
    }

    async fn create_cardless_trial(
        &self,
        request: CreateCardlessTrialRequest,
    ) -> Result<CreateCardlessTrialResponse> {
        let customer_id = match request.existing_customer_id {
            Some(customer_id) => customer_id,
            None => {
                let response: PaddleCustomerResponse = self
                    .post(
                        "/customers",
                        json!({
                            "email": request.user_email,
                            "custom_data": { "sumurai_user_id": request.user_id.to_string() },
                        }),
                    )
                    .await?;
                response.data.id
            }
        };

        let address_id = match request.existing_address_id {
            Some(address_id) => address_id,
            None => {
                let response: PaddleAddressResponse = self
                    .post(
                        &format!("/customers/{customer_id}/addresses"),
                        json!({
                            "country_code": request.country_code,
                            "postal_code": request.postal_code,
                        }),
                    )
                    .await?;
                response.data.id
            }
        };

        let response: PaddleTransactionResponse = self
            .post(
                "/transactions",
                json!({
                    "items": [{ "price_id": request.price_id, "quantity": 1 }],
                    "customer_id": customer_id,
                    "address_id": address_id,
                    "collection_mode": "automatic",
                    "status": "billed",
                    "custom_data": { "sumurai_user_id": request.user_id.to_string() },
                }),
            )
            .await?;

        Ok(CreateCardlessTrialResponse {
            customer_id,
            address_id,
            transaction_id: response.data.id,
        })
    }

    async fn create_payment_method_transaction(
        &self,
        request: CreatePaymentMethodTransactionRequest,
    ) -> Result<CreatePaymentMethodTransactionResponse> {
        let response: PaddleTransactionResponse = self
            .post(
                &format!(
                    "/subscriptions/{}/update-payment-method-transaction",
                    request.subscription_id
                ),
                json!({}),
            )
            .await?;
        let data = response.data;
        Ok(CreatePaymentMethodTransactionResponse {
            transaction_id: data.id,
            checkout_url: data
                .checkout
                .and_then(|checkout| checkout.url)
                .ok_or_else(|| anyhow!("Paddle transaction did not include checkout URL"))?,
        })
    }

    async fn create_portal_session(
        &self,
        request: CreatePortalSessionRequest,
    ) -> Result<CreatePortalSessionResponse> {
        let response: PaddlePortalSessionResponse = self
            .post(
                &format!("/customers/{}/portal-sessions", request.customer_id),
                json!({ "subscription_ids": request.subscription_ids }),
            )
            .await?;
        let urls = response.data.urls;
        Ok(CreatePortalSessionResponse {
            overview_url: urls.general.overview,
            subscription_urls: urls
                .subscriptions
                .into_iter()
                .flat_map(|subscription| {
                    [
                        subscription.cancel_subscription,
                        subscription.update_subscription_payment_method,
                    ]
                })
                .collect(),
        })
    }
}

#[derive(Deserialize)]
struct PaddleTransactionResponse {
    data: PaddleTransaction,
}

#[derive(Deserialize)]
struct PaddleTransaction {
    id: String,
    checkout: Option<PaddleCheckout>,
}

#[derive(Deserialize)]
struct PaddleCheckout {
    url: Option<String>,
}

#[derive(Deserialize)]
struct PaddleCustomerResponse {
    data: PaddleId,
}

#[derive(Deserialize)]
struct PaddleAddressResponse {
    data: PaddleId,
}

#[derive(Deserialize)]
struct PaddleId {
    id: String,
}

#[derive(Deserialize)]
struct PaddlePortalSessionResponse {
    data: PaddlePortalSession,
}

#[derive(Deserialize)]
struct PaddlePortalSession {
    urls: PaddlePortalUrls,
}

#[derive(Deserialize)]
struct PaddlePortalUrls {
    general: PaddlePortalGeneralUrls,
    #[serde(default)]
    subscriptions: Vec<PaddlePortalSubscriptionUrls>,
}

#[derive(Deserialize)]
struct PaddlePortalGeneralUrls {
    overview: String,
}

#[derive(Deserialize, Serialize)]
struct PaddlePortalSubscriptionUrls {
    cancel_subscription: String,
    update_subscription_payment_method: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn given_no_op_paddle_client_when_calling_api_methods_then_returns_error() {
        let client = NoOpPaddleClient;
        let user_id = Uuid::new_v4();

        assert!(client
            .create_checkout(CreateCheckoutRequest {
                user_email: "me@example.com".to_string(),
                price_id: "pri_monthly".to_string(),
                user_id,
            })
            .await
            .is_err());
        assert!(client
            .create_cardless_trial(CreateCardlessTrialRequest {
                user_id,
                user_email: "me@example.com".to_string(),
                existing_customer_id: None,
                existing_address_id: None,
                country_code: "US".to_string(),
                postal_code: "94107".to_string(),
                price_id: "pri_trial".to_string(),
            })
            .await
            .is_err());
        assert!(client
            .create_payment_method_transaction(CreatePaymentMethodTransactionRequest {
                subscription_id: "sub_123".to_string(),
            })
            .await
            .is_err());
        assert!(client
            .create_portal_session(CreatePortalSessionRequest {
                customer_id: "ctm_123".to_string(),
                subscription_ids: vec!["sub_123".to_string()],
            })
            .await
            .is_err());
    }
}
