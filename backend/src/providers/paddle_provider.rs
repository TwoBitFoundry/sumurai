use anyhow::{anyhow, Result};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use opentelemetry::trace::Status;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tracing::{field::Empty, Instrument, Span};
use tracing_opentelemetry::OpenTelemetrySpanExt;
use url::form_urlencoded;
use uuid::Uuid;

use crate::services::external_http;

fn paddle_route(path: &str) -> &str {
    path.split('?').next().unwrap_or(path)
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CreateCheckoutRequest {
    pub user_email: String,
    pub existing_customer_id: Option<String>,
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
        let route = paddle_route(path);
        let endpoint_url =
            external_http::sanitize_external_url(&format!("{}{}", self.base_url, path));
        let span = tracing::info_span!(
            "external_http",
            event_name = "external.http",
            external.service = "paddle",
            http.method = "POST",
            http.route = %route,
            http.url = %endpoint_url,
            http.status_code = Empty,
            error.type = Empty,
            error.message = Empty,
            error.reason = Empty,
            error.stack_trace = Empty,
        );
        async move {
            let response = self
                .http
                .post(format!("{}{}", self.base_url, path))
                .bearer_auth(&self.api_key)
                .json(&body)
                .send()
                .await
                .inspect_err(|error| self.record_transport_error(path, error))?;
            self.parse_response(response, "POST", path, Some(&body))
                .await
        }
        .instrument(span)
        .await
    }

    async fn get<T: serde::de::DeserializeOwned>(&self, path: &str) -> Result<T> {
        let route = paddle_route(path);
        let endpoint_url =
            external_http::sanitize_external_url(&format!("{}{}", self.base_url, path));
        let span = tracing::info_span!(
            "external_http",
            event_name = "external.http",
            external.service = "paddle",
            http.method = "GET",
            http.route = %route,
            http.url = %endpoint_url,
            http.status_code = Empty,
            error.type = Empty,
            error.message = Empty,
            error.reason = Empty,
            error.stack_trace = Empty,
        );
        async move {
            let response = self
                .http
                .get(format!("{}{}", self.base_url, path))
                .bearer_auth(&self.api_key)
                .send()
                .await
                .inspect_err(|error| self.record_transport_error(path, error))?;
            self.parse_response(response, "GET", path, None).await
        }
        .instrument(span)
        .await
    }

    async fn patch<T: serde::de::DeserializeOwned>(
        &self,
        path: &str,
        body: serde_json::Value,
    ) -> Result<T> {
        let route = paddle_route(path);
        let endpoint_url =
            external_http::sanitize_external_url(&format!("{}{}", self.base_url, path));
        let span = tracing::info_span!(
            "external_http",
            event_name = "external.http",
            external.service = "paddle",
            http.method = "PATCH",
            http.route = %route,
            http.url = %endpoint_url,
            http.status_code = Empty,
            error.type = Empty,
            error.message = Empty,
            error.reason = Empty,
            error.stack_trace = Empty,
        );
        async move {
            let response = self
                .http
                .patch(format!("{}{}", self.base_url, path))
                .bearer_auth(&self.api_key)
                .json(&body)
                .send()
                .await
                .inspect_err(|error| self.record_transport_error(path, error))?;
            self.parse_response(response, "PATCH", path, Some(&body))
                .await
        }
        .instrument(span)
        .await
    }

    async fn parse_response<T: serde::de::DeserializeOwned>(
        &self,
        response: reqwest::Response,
        method: &str,
        path: &str,
        request_payload: Option<&serde_json::Value>,
    ) -> Result<T> {
        let route = paddle_route(path);
        let status = response.status();
        if !status.is_success() {
            let response_body = response.text().await.unwrap_or_default();
            if let Some(request_payload) = request_payload {
                external_http::log_request_payload("paddle", method, route, request_payload);
            }
            external_http::log_response_payload(
                "paddle",
                method,
                route,
                status.as_u16(),
                &response_body,
            );
            let (error_type, message, reason) = paddle_error_fields(&response_body);
            let message = message.unwrap_or_else(|| "Paddle API request failed".to_string());
            let reason = reason.unwrap_or_else(|| status.to_string());
            let error = anyhow!("Paddle API request failed with status {status}: {message}");
            Span::current().record("http.status_code", status.as_u16());
            Span::current().record("error.type", error_type.as_deref().unwrap_or("paddle"));
            Span::current().record("error.message", message.as_str());
            Span::current().record("error.reason", reason.as_str());
            Span::current().record(
                "error.stack_trace",
                external_http::truncate_telemetry_text(format!("{error:?}")),
            );
            Span::current().set_status(Status::error(message.clone()));
            tracing::error!(
                event_name = "external.http.error",
                external.service = "paddle",
                http.method = method,
                http.route = route,
                http.url = %external_http::sanitize_external_url(&format!("{}{}", self.base_url, path)),
                http.status_code = status.as_u16(),
                error.type = error_type.as_deref().unwrap_or("paddle"),
                error.message = %message,
                error.reason = %reason,
                error.stack_trace = %external_http::truncate_telemetry_text(format!("{error:?}")),
                "external endpoint request failed"
            );
            return Err(error);
        }
        Span::current().record("http.status_code", status.as_u16());
        tracing::info!(
            event_name = "external.http.completed",
            external.service = "paddle",
            http.method = method,
            http.route = route,
            http.url = %external_http::sanitize_external_url(&format!("{}{}", self.base_url, path)),
            http.status_code = status.as_u16(),
            message = "external endpoint completed",
            "external endpoint completed"
        );
        let response_body = response.text().await?;
        serde_json::from_str::<T>(&response_body).map_err(|error| {
            external_http::log_response_payload(
                "paddle",
                method,
                route,
                status.as_u16(),
                &response_body,
            );
            Span::current().record("error.type", "decode");
            Span::current().record(
                "error.message",
                external_http::truncate_telemetry_text(error.to_string()),
            );
            Span::current().record("error.reason", "invalid_json");
            Span::current().set_status(Status::error("Paddle response decode failed"));
            tracing::error!(
                event_name = "external.http.decode_error",
                external.service = "paddle",
                http.status_code = status.as_u16(),
                http.url = %external_http::sanitize_external_url(&format!("{}{}", self.base_url, path)),
                error.type = "decode",
                error.message = %error,
                error.reason = "invalid_json",
                error.stack_trace = %external_http::truncate_telemetry_text(format!("{error:?}")),
                "external endpoint response could not be decoded"
            );
            error.into()
        })
    }

    fn record_transport_error(&self, path: &str, error: &reqwest::Error) {
        let route = paddle_route(path);
        Span::current().record("error.type", "transport");
        Span::current().record("error.message", error.to_string().as_str());
        Span::current().record("error.reason", "request_failed");
        Span::current().record(
            "error.stack_trace",
            external_http::truncate_telemetry_text(format!("{error:?}")),
        );
        Span::current().set_status(Status::error("Paddle transport request failed"));
        tracing::error!(
            event_name = "external.http.transport_error",
            external.service = "paddle",
            http.url = %external_http::sanitize_external_url(&format!("{}{}", self.base_url, path)),
            http.route = route,
            error.type = "transport",
            error.message = %error,
            error.reason = "request_failed",
            error.stack_trace = %external_http::truncate_telemetry_text(format!("{error:?}")),
            "external endpoint request could not be sent"
        );
    }
}

fn paddle_error_fields(body: &str) -> (Option<String>, Option<String>, Option<String>) {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(body) else {
        return (None, None, None);
    };
    let error = value.get("error").unwrap_or(&value);
    let string_field = |name: &str, fallback: &str| {
        error
            .get(name)
            .or_else(|| value.get(fallback))
            .and_then(|value| value.as_str())
            .map(str::to_string)
    };
    (
        string_field("type", "error_type"),
        error
            .get("detail")
            .or_else(|| error.get("message"))
            .and_then(|value| value.as_str())
            .map(str::to_string)
            .or_else(|| string_field("message", "error_message")),
        string_field("code", "error_code"),
    )
}

impl PaddleClient {
    async fn find_customer_by_email(&self, email: &str) -> Result<Option<PaddleCustomer>> {
        let query = form_urlencoded::Serializer::new(String::new())
            .append_pair("email", email)
            .append_pair("status", "active,archived")
            .append_pair("per_page", "1")
            .finish();
        let response: PaddleCustomerListResponse = self.get(&format!("/customers?{query}")).await?;
        Ok(response.data.into_iter().next())
    }

    async fn customer_id_for(&self, customer: PaddleCustomer) -> Result<String> {
        if customer.status == "archived" {
            let restored: PaddleCustomerResponse = self
                .patch(
                    &format!("/customers/{}", customer.id),
                    json!({ "status": "active" }),
                )
                .await?;
            return Ok(restored.data.id);
        }
        Ok(customer.id)
    }

    async fn resolve_customer_id(&self, customer_id: &str) -> Result<String> {
        let response: PaddleCustomerDetailsResponse =
            self.get(&format!("/customers/{customer_id}")).await?;
        self.customer_id_for(response.data).await
    }

    async fn find_or_create_customer(
        &self,
        request: &CreateCardlessTrialRequest,
    ) -> Result<String> {
        if let Some(customer) = self.find_customer_by_email(&request.user_email).await? {
            return self.customer_id_for(customer).await;
        }

        let response: Result<PaddleCustomerResponse> = self
            .post(
                "/customers",
                json!({
                    "email": request.user_email,
                    "custom_data": { "sumurai_user_id": request.user_id.to_string() },
                }),
            )
            .await;
        match response {
            Ok(response) => Ok(response.data.id),
            Err(error) if error.to_string().contains("customer email conflicts") => {
                let customer = self
                    .find_customer_by_email(&request.user_email)
                    .await?
                    .ok_or_else(|| anyhow!("Paddle customer conflict could not be reconciled"))?;
                self.customer_id_for(customer).await
            }
            Err(error) => Err(error),
        }
    }
}

#[async_trait]
impl PaddleHttpClient for PaddleClient {
    async fn create_checkout(
        &self,
        request: CreateCheckoutRequest,
    ) -> Result<CreateCheckoutResponse> {
        let customer_id = match request.existing_customer_id {
            Some(customer_id) => Some(self.resolve_customer_id(&customer_id).await?),
            None => None,
        };
        let response: PaddleTransactionResponse = self
            .post(
                "/transactions",
                json!({
                    "items": [{ "price_id": request.price_id, "quantity": 1 }],
                    "customer_id": customer_id,
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
            Some(customer_id) => self.resolve_customer_id(&customer_id).await?,
            None => self.find_or_create_customer(&request).await?,
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
struct PaddleCustomerDetailsResponse {
    data: PaddleCustomer,
}

#[derive(Deserialize)]
struct PaddleCustomerListResponse {
    data: Vec<PaddleCustomer>,
}

#[derive(Deserialize)]
struct PaddleCustomer {
    id: String,
    status: String,
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
