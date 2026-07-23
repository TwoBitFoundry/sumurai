use anyhow::{anyhow, Result};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
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

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CancelSubscriptionRequest {
    pub subscription_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CancelSubscriptionResponse {
    pub status: String,
    pub scheduled_cancel_at: Option<DateTime<Utc>>,
    pub canceled_at: Option<DateTime<Utc>>,
}

#[async_trait]
#[cfg_attr(test, mockall::automock)]
pub trait PaddleHttpClient: Send + Sync {
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

    async fn cancel_subscription(
        &self,
        request: CancelSubscriptionRequest,
    ) -> Result<CancelSubscriptionResponse>;
}

#[derive(Clone, Copy, Debug, Default)]
pub struct NoOpPaddleClient;

#[async_trait]
impl PaddleHttpClient for NoOpPaddleClient {
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

    async fn cancel_subscription(
        &self,
        _request: CancelSubscriptionRequest,
    ) -> Result<CancelSubscriptionResponse> {
        Err(anyhow!("Paddle billing is disabled"))
    }
}

#[derive(Clone)]
pub struct PaddleClient {
    http: reqwest::Client,
    api_key: String,
    base_url: String,
}

impl PaddleClient {
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

    #[cfg(test)]
    pub fn new_for_test(base_url: String) -> Self {
        Self {
            http: reqwest::Client::new(),
            api_key: "test-api-key".to_string(),
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
        self.parse_response(response).await
    }

    async fn get<T: serde::de::DeserializeOwned>(&self, path: &str) -> Result<T> {
        let response = self
            .http
            .get(format!("{}{}", self.base_url, path))
            .bearer_auth(&self.api_key)
            .send()
            .await?;
        self.parse_response(response).await
    }

    async fn parse_response<T: serde::de::DeserializeOwned>(
        &self,
        response: reqwest::Response,
    ) -> Result<T> {
        let status = response.status();
        if !status.is_success() {
            return Err(anyhow!("Paddle API request failed with status {}", status));
        }
        Ok(response.json::<T>().await?)
    }
}

#[async_trait]
impl PaddleHttpClient for PaddleClient {
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
            .get(&format!(
                "/subscriptions/{}/update-payment-method-transaction",
                request.subscription_id
            ))
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

    async fn cancel_subscription(
        &self,
        request: CancelSubscriptionRequest,
    ) -> Result<CancelSubscriptionResponse> {
        let response: PaddleSubscriptionResponse = self
            .post(
                &format!("/subscriptions/{}/cancel", request.subscription_id),
                json!({ "effective_from": "next_billing_period" }),
            )
            .await?;
        let data = response.data;
        Ok(CancelSubscriptionResponse {
            status: data.status,
            scheduled_cancel_at: data
                .scheduled_change
                .filter(|change| change.action == "cancel")
                .map(|change| change.effective_at),
            canceled_at: data.canceled_at,
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
struct PaddleSubscriptionResponse {
    data: PaddleSubscription,
}

#[derive(Deserialize)]
struct PaddleSubscription {
    status: String,
    scheduled_change: Option<PaddleScheduledChange>,
    canceled_at: Option<DateTime<Utc>>,
}

#[derive(Deserialize)]
struct PaddleScheduledChange {
    action: String,
    effective_at: DateTime<Utc>,
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
