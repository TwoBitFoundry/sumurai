#![allow(dead_code)]

use std::sync::Arc;

use crate::config::{BillingMode, Config};
use crate::models::{
    auth::User,
    billing::{BillingEntitlement, BillingProfile, PaddleWebhookEvent},
};
use crate::providers::paddle_provider::{
    CreateCardlessTrialRequest, CreateCheckoutRequest, CreateCheckoutResponse,
    CreatePaymentMethodTransactionRequest, CreatePaymentMethodTransactionResponse,
    CreatePortalSessionRequest, CreatePortalSessionResponse, PaddleHttpClient,
};
use crate::services::repository_service::DatabaseRepository;
use chrono::{DateTime, Utc};
use hmac::{Hmac, KeyInit, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use subtle::ConstantTimeEq;

type HmacSha256 = Hmac<Sha256>;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EntitlementAccessStatus {
    Demo,
    Trialing,
    Active,
    PastDue,
    Paused,
    Canceled,
    Expired,
}

impl EntitlementAccessStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Demo => "demo",
            Self::Trialing => "trialing",
            Self::Active => "active",
            Self::PastDue => "past_due",
            Self::Paused => "paused",
            Self::Canceled => "canceled",
            Self::Expired => "expired",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct EntitlementDecision {
    pub can_use_own_data: bool,
    pub payment_method_required: bool,
}

pub struct TrialStartInput<'a> {
    pub country_code: &'a str,
    pub postal_code: &'a str,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OwnDataAccessCheck {
    Allowed,
    Denied {
        access_status: EntitlementAccessStatus,
    },
}

#[derive(Clone)]
pub struct BillingService {
    config: Config,
    repository: Arc<dyn DatabaseRepository>,
    paddle_client: Arc<dyn PaddleHttpClient>,
}

impl BillingService {
    pub fn new(
        config: Config,
        repository: Arc<dyn DatabaseRepository>,
        paddle_client: Arc<dyn PaddleHttpClient>,
    ) -> Self {
        Self {
            config,
            repository,
            paddle_client,
        }
    }

    pub fn config(&self) -> &Config {
        &self.config
    }

    pub fn billing_mode(&self) -> BillingMode {
        self.config.billing_mode()
    }

    pub fn decision_for_status(&self, status: EntitlementAccessStatus) -> EntitlementDecision {
        if !self.config.is_billing_enabled() {
            return EntitlementDecision {
                can_use_own_data: true,
                payment_method_required: false,
            };
        }

        match status {
            EntitlementAccessStatus::Trialing => EntitlementDecision {
                can_use_own_data: true,
                payment_method_required: true,
            },
            EntitlementAccessStatus::Active => EntitlementDecision {
                can_use_own_data: true,
                payment_method_required: false,
            },
            EntitlementAccessStatus::Demo
            | EntitlementAccessStatus::PastDue
            | EntitlementAccessStatus::Paused
            | EntitlementAccessStatus::Canceled
            | EntitlementAccessStatus::Expired => EntitlementDecision {
                can_use_own_data: false,
                payment_method_required: false,
            },
        }
    }

    pub fn project_paddle_subscription_status(status: &str) -> EntitlementAccessStatus {
        match status {
            "trialing" => EntitlementAccessStatus::Trialing,
            "active" => EntitlementAccessStatus::Active,
            "past_due" => EntitlementAccessStatus::PastDue,
            "paused" => EntitlementAccessStatus::Paused,
            "canceled" => EntitlementAccessStatus::Canceled,
            _ => EntitlementAccessStatus::Expired,
        }
    }

    pub fn project_local_access_status(status: Option<&str>) -> EntitlementAccessStatus {
        match status {
            Some("trialing") => EntitlementAccessStatus::Trialing,
            Some("active") => EntitlementAccessStatus::Active,
            Some("past_due") => EntitlementAccessStatus::PastDue,
            Some("paused") => EntitlementAccessStatus::Paused,
            Some("canceled") => EntitlementAccessStatus::Canceled,
            Some("expired") => EntitlementAccessStatus::Expired,
            _ => EntitlementAccessStatus::Demo,
        }
    }

    pub fn should_apply_event(
        existing_last_event_at: Option<DateTime<Utc>>,
        incoming_event_at: DateTime<Utc>,
    ) -> bool {
        existing_last_event_at
            .map(|last_event_at| incoming_event_at >= last_event_at)
            .unwrap_or(true)
    }

    pub async fn check_own_data_access(
        &self,
        user_id: uuid::Uuid,
    ) -> Result<OwnDataAccessCheck, BillingServiceError> {
        if !self.config.is_billing_enabled() {
            return Ok(OwnDataAccessCheck::Allowed);
        }

        let entitlement = self
            .repository
            .get_billing_entitlement(&user_id)
            .await
            .map_err(|_| BillingServiceError::RepositoryRequestFailed)?;
        let access_status = Self::project_local_access_status(
            entitlement.as_ref().map(|row| row.access_status.as_str()),
        );
        let decision = self.decision_for_status(access_status);

        if decision.can_use_own_data {
            Ok(OwnDataAccessCheck::Allowed)
        } else {
            Ok(OwnDataAccessCheck::Denied { access_status })
        }
    }

    pub async fn check_own_data_access_after_demo(
        &self,
        user_id: uuid::Uuid,
    ) -> Result<OwnDataAccessCheck, BillingServiceError> {
        if !self.config.is_billing_enabled() {
            return Ok(OwnDataAccessCheck::Allowed);
        }

        let user = self
            .repository
            .get_user_by_id(&user_id)
            .await
            .map_err(|_| BillingServiceError::RepositoryRequestFailed)?
            .ok_or(BillingServiceError::RepositoryRequestFailed)?;

        if user.demo_mode_active {
            return Ok(OwnDataAccessCheck::Allowed);
        }

        self.check_own_data_access(user_id).await
    }

    pub async fn create_checkout(
        &self,
        request: CreateCheckoutRequest,
    ) -> Result<CreateCheckoutResponse, BillingServiceError> {
        if !self.config.is_billing_enabled() {
            return Err(BillingServiceError::BillingDisabled);
        }

        self.paddle_client
            .create_checkout(request)
            .await
            .map_err(|_| BillingServiceError::PaddleRequestFailed)
    }

    pub async fn create_checkout_for_user(
        &self,
        user: &User,
    ) -> Result<CreateCheckoutResponse, BillingServiceError> {
        let paddle = self
            .config
            .paddle_billing()
            .ok_or(BillingServiceError::BillingDisabled)?;
        self.create_checkout(CreateCheckoutRequest {
            user_email: user.email.clone(),
            user_id: user.id,
            price_id: paddle.monthly_price_id.clone(),
        })
        .await
    }

    pub async fn start_open_trial(
        &self,
        user: &User,
        input: TrialStartInput<'_>,
    ) -> Result<(), BillingServiceError> {
        if !self.config.is_billing_enabled() {
            return Err(BillingServiceError::BillingDisabled);
        }
        if !self.config.is_trials_enabled() {
            return Err(BillingServiceError::TrialsDisabled);
        }
        if input.country_code.trim().is_empty() || input.postal_code.trim().is_empty() {
            return Err(BillingServiceError::InvalidTrialStart);
        }

        let paddle = self
            .config
            .paddle_billing()
            .ok_or(BillingServiceError::BillingDisabled)?;

        let entitlement = self
            .repository
            .get_billing_entitlement(&user.id)
            .await
            .map_err(|_| BillingServiceError::RepositoryRequestFailed)?;
        if entitlement
            .as_ref()
            .is_some_and(|row| has_used_paddle_trial_or_paid_entitlement(&row.access_status))
        {
            return Err(BillingServiceError::TrialAlreadyUsed);
        }

        let profile = self
            .repository
            .get_billing_profile(&user.id)
            .await
            .map_err(|_| BillingServiceError::RepositoryRequestFailed)?;

        let trial = self
            .paddle_client
            .create_cardless_trial(CreateCardlessTrialRequest {
                user_id: user.id,
                user_email: user.email.clone(),
                existing_customer_id: profile
                    .as_ref()
                    .and_then(|profile| profile.paddle_customer_id.clone()),
                existing_address_id: profile
                    .as_ref()
                    .and_then(|profile| profile.paddle_address_id.clone()),
                country_code: input.country_code.trim().to_uppercase(),
                postal_code: input.postal_code.trim().to_string(),
                price_id: paddle.cardless_trial_price_id.clone(),
            })
            .await
            .map_err(|_| BillingServiceError::PaddleRequestFailed)?;

        let now = Utc::now();
        self.repository
            .upsert_billing_profile(&BillingProfile {
                user_id: user.id,
                paddle_customer_id: Some(trial.customer_id),
                paddle_address_id: Some(trial.address_id),
                billing_country_code: Some(input.country_code.trim().to_uppercase()),
                billing_postal_code: Some(input.postal_code.trim().to_string()),
                created_at: profile
                    .as_ref()
                    .map(|profile| profile.created_at)
                    .unwrap_or(now),
                updated_at: now,
            })
            .await
            .map_err(|_| BillingServiceError::RepositoryRequestFailed)?;

        Ok(())
    }

    pub async fn create_payment_method_transaction(
        &self,
        user: &User,
    ) -> Result<CreatePaymentMethodTransactionResponse, BillingServiceError> {
        if !self.config.is_billing_enabled() {
            return Err(BillingServiceError::BillingDisabled);
        }
        let entitlement = self
            .repository
            .get_billing_entitlement(&user.id)
            .await
            .map_err(|_| BillingServiceError::RepositoryRequestFailed)?
            .ok_or(BillingServiceError::EntitlementUnavailable)?;
        let subscription_id = entitlement
            .paddle_subscription_id
            .ok_or(BillingServiceError::EntitlementUnavailable)?;
        self.paddle_client
            .create_payment_method_transaction(CreatePaymentMethodTransactionRequest {
                subscription_id,
            })
            .await
            .map_err(|_| BillingServiceError::PaddleRequestFailed)
    }

    pub async fn create_portal_session(
        &self,
        user: &User,
    ) -> Result<CreatePortalSessionResponse, BillingServiceError> {
        if !self.config.is_billing_enabled() {
            return Err(BillingServiceError::BillingDisabled);
        }
        let entitlement = self
            .repository
            .get_billing_entitlement(&user.id)
            .await
            .map_err(|_| BillingServiceError::RepositoryRequestFailed)?
            .ok_or(BillingServiceError::EntitlementUnavailable)?;
        let customer_id = entitlement
            .paddle_customer_id
            .ok_or(BillingServiceError::EntitlementUnavailable)?;
        let subscription_ids = entitlement.paddle_subscription_id.into_iter().collect();
        self.paddle_client
            .create_portal_session(CreatePortalSessionRequest {
                customer_id,
                subscription_ids,
            })
            .await
            .map_err(|_| BillingServiceError::PaddleRequestFailed)
    }

    pub async fn process_paddle_webhook(
        &self,
        signature_header: Option<&str>,
        raw_body: &[u8],
        now_timestamp: i64,
    ) -> Result<(), BillingWebhookError> {
        if !self.config.is_billing_enabled() {
            return Err(BillingWebhookError::BillingDisabled);
        }

        let paddle = self
            .config
            .paddle_billing()
            .ok_or(BillingWebhookError::BillingDisabled)?;

        verify_paddle_webhook_signature(
            &paddle.webhook_secret,
            signature_header.unwrap_or(""),
            raw_body,
            now_timestamp,
            300,
        )
        .map_err(|_| BillingWebhookError::InvalidSignature)?;

        let payload: PaddleWebhookPayload =
            serde_json::from_slice(raw_body).map_err(|_| BillingWebhookError::InvalidPayload)?;

        let now = Utc::now();
        let is_new = self
            .repository
            .record_paddle_webhook_event_if_new(&PaddleWebhookEvent {
                event_id: payload.event_id.clone(),
                event_type: payload.event_type.clone(),
                occurred_at: payload.occurred_at,
                processed_at: now,
                processing_status: "received".to_string(),
                related_user_id: extract_sumurai_user_id(&payload.data),
                related_subscription_id: extract_subscription_id(&payload.data),
                error_code: None,
                created_at: now,
            })
            .await
            .map_err(|_| BillingWebhookError::RepositoryRequestFailed)?;

        if !is_new {
            let existing = self
                .repository
                .get_paddle_webhook_event(&payload.event_id)
                .await
                .map_err(|_| BillingWebhookError::RepositoryRequestFailed)?;
            if existing
                .as_ref()
                .is_some_and(|event| event.processing_status == "processed")
            {
                return Ok(());
            }
        }

        let Some(user_id) = extract_sumurai_user_id(&payload.data) else {
            self.repository
                .mark_paddle_webhook_event_processed(&payload.event_id, Utc::now())
                .await
                .map_err(|_| BillingWebhookError::RepositoryRequestFailed)?;
            return Ok(());
        };

        if is_subscription_lifecycle_event(&payload.event_type) {
            if let Some(subscription) = parse_subscription_data(&payload.data) {
                self.apply_subscription_entitlement(user_id, &subscription, payload.occurred_at)
                    .await?;
            }
        }

        self.repository
            .mark_paddle_webhook_event_processed(&payload.event_id, Utc::now())
            .await
            .map_err(|_| BillingWebhookError::RepositoryRequestFailed)?;

        Ok(())
    }

    async fn apply_subscription_entitlement(
        &self,
        user_id: uuid::Uuid,
        subscription: &ParsedSubscriptionData,
        event_at: DateTime<Utc>,
    ) -> Result<(), BillingWebhookError> {
        let existing = self
            .repository
            .get_billing_entitlement(&user_id)
            .await
            .map_err(|_| BillingWebhookError::RepositoryRequestFailed)?;

        if !Self::should_apply_event(
            existing.as_ref().and_then(|row| row.last_event_at),
            event_at,
        ) {
            return Ok(());
        }

        let access_status = Self::project_paddle_subscription_status(&subscription.status);
        let payment_method_required = matches!(access_status, EntitlementAccessStatus::Trialing);
        let now = Utc::now();
        let entitlement = BillingEntitlement {
            user_id,
            access_status: access_status.as_str().to_string(),
            source: "paddle".to_string(),
            paddle_subscription_id: Some(subscription.subscription_id.clone()),
            paddle_customer_id: subscription.customer_id.clone(),
            paddle_price_id: subscription.price_id.clone(),
            trial_ends_at: subscription.trial_ends_at,
            current_period_ends_at: subscription.current_period_ends_at,
            canceled_at: subscription.canceled_at,
            last_event_at: Some(event_at),
            payment_method_required,
            created_at: existing.as_ref().map(|row| row.created_at).unwrap_or(now),
            updated_at: now,
        };

        self.repository
            .upsert_billing_entitlement(&entitlement)
            .await
            .map_err(|_| BillingWebhookError::RepositoryRequestFailed)?;

        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum BillingWebhookError {
    BillingDisabled,
    InvalidSignature,
    InvalidPayload,
    RepositoryRequestFailed,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum BillingServiceError {
    BillingDisabled,
    EntitlementUnavailable,
    InvalidTrialStart,
    PaddleRequestFailed,
    RepositoryRequestFailed,
    TrialAlreadyUsed,
    TrialsDisabled,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PaddleWebhookSignatureError {
    MissingHeader,
    MalformedHeader,
    InvalidTimestamp,
    StaleTimestamp,
    SignatureMismatch,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct PaddleWebhookEnvelope {
    pub event_id: String,
    pub event_type: String,
    pub occurred_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct PaddleWebhookPayload {
    pub event_id: String,
    pub event_type: String,
    pub occurred_at: DateTime<Utc>,
    pub data: serde_json::Value,
}

struct ParsedSubscriptionData {
    subscription_id: String,
    customer_id: Option<String>,
    price_id: Option<String>,
    status: String,
    trial_ends_at: Option<DateTime<Utc>>,
    current_period_ends_at: Option<DateTime<Utc>>,
    canceled_at: Option<DateTime<Utc>>,
}

fn is_subscription_lifecycle_event(event_type: &str) -> bool {
    matches!(
        event_type,
        "subscription.created"
            | "subscription.updated"
            | "subscription.activated"
            | "subscription.paused"
            | "subscription.canceled"
            | "subscription.past_due"
            | "transaction.completed"
            | "transaction.payment_failed"
    )
}

fn extract_sumurai_user_id(value: &serde_json::Value) -> Option<uuid::Uuid> {
    value
        .get("custom_data")
        .and_then(|custom_data| custom_data.get("sumurai_user_id"))
        .and_then(|user_id| user_id.as_str())
        .and_then(|user_id| uuid::Uuid::parse_str(user_id).ok())
        .or_else(|| value.get("subscription").and_then(extract_sumurai_user_id))
}

fn extract_subscription_id(value: &serde_json::Value) -> Option<String> {
    value
        .get("id")
        .and_then(|id| id.as_str())
        .filter(|id| id.starts_with("sub_"))
        .map(str::to_string)
        .or_else(|| {
            value
                .get("subscription_id")
                .and_then(|id| id.as_str())
                .map(str::to_string)
        })
}

fn parse_paddle_timestamp(value: Option<&serde_json::Value>) -> Option<DateTime<Utc>> {
    value
        .and_then(|timestamp| timestamp.as_str())
        .and_then(|timestamp| DateTime::parse_from_rfc3339(timestamp).ok())
        .map(|timestamp| timestamp.with_timezone(&Utc))
}

fn parse_subscription_data(data: &serde_json::Value) -> Option<ParsedSubscriptionData> {
    let subscription = if data
        .get("id")
        .and_then(|id| id.as_str())
        .is_some_and(|id| id.starts_with("sub_"))
    {
        data
    } else {
        data.get("subscription")?
    };

    let subscription_id = subscription.get("id")?.as_str()?.to_string();
    let price_id = subscription
        .get("items")
        .and_then(|items| items.as_array())
        .and_then(|items| items.first())
        .and_then(|item| item.get("price"))
        .and_then(|price| price.get("id"))
        .and_then(|price_id| price_id.as_str())
        .map(str::to_string);

    Some(ParsedSubscriptionData {
        subscription_id,
        customer_id: subscription
            .get("customer_id")
            .and_then(|customer_id| customer_id.as_str())
            .map(str::to_string),
        price_id,
        status: subscription
            .get("status")
            .and_then(|status| status.as_str())
            .unwrap_or("expired")
            .to_string(),
        trial_ends_at: parse_paddle_timestamp(
            subscription
                .get("trial_dates")
                .and_then(|trial_dates| trial_dates.get("ends_at")),
        ),
        current_period_ends_at: parse_paddle_timestamp(
            subscription
                .get("current_billing_period")
                .and_then(|period| period.get("ends_at")),
        ),
        canceled_at: parse_paddle_timestamp(subscription.get("canceled_at")),
    })
}

fn has_used_paddle_trial_or_paid_entitlement(access_status: &str) -> bool {
    matches!(
        access_status,
        "trialing" | "active" | "past_due" | "paused" | "canceled" | "expired"
    )
}

pub fn verify_paddle_webhook_signature(
    secret: &str,
    signature_header: &str,
    raw_body: &[u8],
    now_timestamp: i64,
    tolerance_seconds: i64,
) -> Result<(), PaddleWebhookSignatureError> {
    if signature_header.trim().is_empty() {
        return Err(PaddleWebhookSignatureError::MissingHeader);
    }

    let mut timestamp = None;
    let mut signature = None;
    for part in signature_header.split(';') {
        let Some((key, value)) = part.split_once('=') else {
            return Err(PaddleWebhookSignatureError::MalformedHeader);
        };
        match key.trim() {
            "ts" => timestamp = Some(value.trim()),
            "h1" => signature = Some(value.trim()),
            _ => {}
        }
    }

    let timestamp = timestamp.ok_or(PaddleWebhookSignatureError::MalformedHeader)?;
    let signature = signature.ok_or(PaddleWebhookSignatureError::MalformedHeader)?;
    let timestamp = timestamp
        .parse::<i64>()
        .map_err(|_| PaddleWebhookSignatureError::InvalidTimestamp)?;

    let tolerance_seconds = tolerance_seconds.max(0) as u64;
    if now_timestamp.abs_diff(timestamp) > tolerance_seconds {
        return Err(PaddleWebhookSignatureError::StaleTimestamp);
    }

    let expected_signature =
        hex::decode(signature).map_err(|_| PaddleWebhookSignatureError::MalformedHeader)?;
    let mut signed_payload = timestamp.to_string().into_bytes();
    signed_payload.push(b':');
    signed_payload.extend_from_slice(raw_body);

    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .map_err(|_| PaddleWebhookSignatureError::MalformedHeader)?;
    mac.update(&signed_payload);
    let computed = mac.finalize().into_bytes();

    if computed
        .as_slice()
        .ct_eq(expected_signature.as_slice())
        .into()
    {
        Ok(())
    } else {
        Err(PaddleWebhookSignatureError::SignatureMismatch)
    }
}
