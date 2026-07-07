#![allow(dead_code)]

use crate::config::{BillingMode, Config};
use crate::providers::paddle_provider::{
    CreateCheckoutRequest, CreateCheckoutResponse, PaddleClient,
};
use chrono::{DateTime, Utc};
use hmac::{Hmac, KeyInit, Mac};
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

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct EntitlementDecision {
    pub can_use_own_data: bool,
    pub payment_method_required: bool,
}

#[derive(Clone)]
pub struct BillingService {
    config: Config,
}

impl BillingService {
    pub fn new(config: Config) -> Self {
        Self { config }
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

    pub fn should_apply_event(
        existing_last_event_at: Option<DateTime<Utc>>,
        incoming_event_at: DateTime<Utc>,
    ) -> bool {
        existing_last_event_at
            .map(|last_event_at| incoming_event_at >= last_event_at)
            .unwrap_or(true)
    }

    pub async fn create_checkout<C: PaddleClient + ?Sized>(
        &self,
        client: &C,
        request: CreateCheckoutRequest,
    ) -> Result<CreateCheckoutResponse, BillingServiceError> {
        if !self.config.is_billing_enabled() {
            return Err(BillingServiceError::BillingDisabled);
        }

        client
            .create_checkout(request)
            .await
            .map_err(|_| BillingServiceError::PaddleRequestFailed)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum BillingServiceError {
    BillingDisabled,
    PaddleRequestFailed,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PaddleWebhookSignatureError {
    MissingHeader,
    MalformedHeader,
    InvalidTimestamp,
    StaleTimestamp,
    SignatureMismatch,
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

    if now_timestamp.abs_diff(timestamp) > tolerance_seconds as u64 {
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
