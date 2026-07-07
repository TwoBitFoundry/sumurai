#![allow(dead_code)]

use std::sync::Arc;

use crate::config::{BillingMode, Config};
use crate::models::{
    auth::User,
    billing::{BillingProfile, TrialCodeRedemption},
};
use crate::providers::paddle_provider::{
    CreateCardlessTrialRequest, CreateCheckoutRequest, CreateCheckoutResponse,
    CreatePaymentMethodTransactionRequest, CreatePaymentMethodTransactionResponse,
    CreatePortalSessionRequest, CreatePortalSessionResponse, PaddleClient,
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

pub struct TrialRedemptionInput<'a> {
    pub code: &'a str,
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
    paddle_client: Arc<dyn PaddleClient>,
}

impl BillingService {
    pub fn new(
        config: Config,
        repository: Arc<dyn DatabaseRepository>,
        paddle_client: Arc<dyn PaddleClient>,
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

    pub async fn redeem_trial_code(
        &self,
        user: &User,
        input: TrialRedemptionInput<'_>,
    ) -> Result<TrialCodeRedemption, BillingServiceError> {
        if !self.config.is_billing_enabled() {
            return Err(BillingServiceError::BillingDisabled);
        }
        if input.code.trim().is_empty()
            || input.country_code.trim().is_empty()
            || input.postal_code.trim().is_empty()
        {
            return Err(BillingServiceError::InvalidTrialRedemption);
        }

        let paddle = self
            .config
            .paddle_billing()
            .ok_or(BillingServiceError::BillingDisabled)?;
        let code_hash = hash_trial_code(&paddle.trial_code_hash_key, input.code)?;
        let reserved_at = Utc::now();
        let Some(redemption) = self
            .repository
            .reserve_trial_code_redemption(&code_hash, &user.id, reserved_at)
            .await
            .map_err(|_| BillingServiceError::RepositoryRequestFailed)?
        else {
            return Err(BillingServiceError::TrialCodeUnavailable);
        };

        let profile = self
            .repository
            .get_billing_profile(&user.id)
            .await
            .map_err(|_| BillingServiceError::RepositoryRequestFailed)?;

        let trial = match self
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
        {
            Ok(trial) => trial,
            Err(_) => {
                let _ = self
                    .repository
                    .release_trial_code_redemption(&code_hash, &user.id, Utc::now())
                    .await;
                return Err(BillingServiceError::PaddleRequestFailed);
            }
        };

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

        let updated = TrialCodeRedemption {
            paddle_transaction_id: Some(trial.transaction_id),
            updated_at: now,
            ..redemption
        };
        self.repository
            .upsert_trial_code_redemption(&updated)
            .await
            .map_err(|_| BillingServiceError::RepositoryRequestFailed)?;

        Ok(updated)
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
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum BillingServiceError {
    BillingDisabled,
    EntitlementUnavailable,
    InvalidTrialRedemption,
    PaddleRequestFailed,
    RepositoryRequestFailed,
    TrialCodeUnavailable,
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

pub fn hash_trial_code(secret: &str, code: &str) -> Result<String, BillingServiceError> {
    billing_common::hash_trial_code(secret, code).map_err(|error| match error {
        billing_common::TrialCodeHashError::InvalidCode => {
            BillingServiceError::InvalidTrialRedemption
        }
        billing_common::TrialCodeHashError::InvalidHashKey => {
            BillingServiceError::PaddleRequestFailed
        }
    })
}

pub fn normalize_trial_code(code: &str) -> Result<String, BillingServiceError> {
    billing_common::normalize_trial_code(code).map_err(|error| match error {
        billing_common::TrialCodeHashError::InvalidCode => {
            BillingServiceError::InvalidTrialRedemption
        }
        billing_common::TrialCodeHashError::InvalidHashKey => {
            BillingServiceError::PaddleRequestFailed
        }
    })
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
