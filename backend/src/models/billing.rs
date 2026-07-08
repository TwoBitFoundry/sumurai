use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct BillingProfile {
    pub user_id: Uuid,
    pub paddle_customer_id: Option<String>,
    pub paddle_address_id: Option<String>,
    pub billing_country_code: Option<String>,
    pub billing_postal_code: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct BillingEntitlement {
    pub user_id: Uuid,
    pub access_status: String,
    pub source: String,
    pub paddle_subscription_id: Option<String>,
    pub paddle_customer_id: Option<String>,
    pub paddle_price_id: Option<String>,
    pub trial_ends_at: Option<DateTime<Utc>>,
    pub current_period_ends_at: Option<DateTime<Utc>>,
    pub canceled_at: Option<DateTime<Utc>>,
    pub last_event_at: Option<DateTime<Utc>>,
    pub payment_method_required: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TrialCode {
    pub id: Uuid,
    pub code_hash: String,
    pub redeem_by_at: DateTime<Utc>,
    pub redeemed_at: Option<DateTime<Utc>>,
    pub redeemed_by_user_id: Option<Uuid>,
    pub disabled_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TrialCodeRedemption {
    pub id: Uuid,
    pub trial_code_id: Uuid,
    pub user_id: Uuid,
    pub status: String,
    pub paddle_transaction_id: Option<String>,
    pub paddle_subscription_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub fulfilled_at: Option<DateTime<Utc>>,
    pub failed_at: Option<DateTime<Utc>>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PaddleWebhookEvent {
    pub event_id: String,
    pub event_type: String,
    pub occurred_at: DateTime<Utc>,
    pub processed_at: DateTime<Utc>,
    pub processing_status: String,
    pub related_user_id: Option<Uuid>,
    pub related_subscription_id: Option<String>,
    pub error_code: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct BillingStatusResponse {
    pub billing_enabled: bool,
    pub trials_enabled: bool,
    pub access_status: String,
    pub can_use_own_data: bool,
    pub is_demo_mode_active: bool,
    pub trial_ends_at: Option<DateTime<Utc>>,
    pub current_period_ends_at: Option<DateTime<Utc>>,
    pub payment_method_required: bool,
    pub billing_portal_available: bool,
    pub enabled_financial_providers: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct BillingCheckoutResponse {
    pub checkout_url: String,
    pub transaction_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct TrialStartRequest {
    pub country_code: String,
    pub postal_code: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct TrialStartResponse {
    pub status: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct BillingPortalSessionResponse {
    pub overview_url: String,
    pub subscription_urls: Vec<String>,
}
