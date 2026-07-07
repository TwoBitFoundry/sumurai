use crate::config::{BillingMode, Config, EnvironmentProvider};
use crate::providers::paddle_provider::{CreateCheckoutRequest, MockPaddleClient};
use crate::services::billing_service::{
    verify_paddle_webhook_signature, BillingService, EntitlementAccessStatus, EntitlementDecision,
    PaddleWebhookSignatureError,
};
use chrono::{TimeZone, Utc};
use std::collections::HashMap;

struct MockEnvironment {
    vars: HashMap<String, String>,
}

impl MockEnvironment {
    fn paddle() -> Self {
        let mut vars = HashMap::new();
        vars.insert("TELLER_ENV".to_string(), "test".to_string());
        vars.insert("AUTH_COOKIE_SAME_SITE".to_string(), "Lax".to_string());
        vars.insert(
            "APP_ORIGIN".to_string(),
            "http://localhost:8080".to_string(),
        );
        vars.insert("BILLING_MODE".to_string(), "paddle".to_string());
        vars.insert("PADDLE_ENVIRONMENT".to_string(), "sandbox".to_string());
        vars.insert("PADDLE_API_KEY".to_string(), "test-api-key".to_string());
        vars.insert(
            "PADDLE_WEBHOOK_SECRET".to_string(),
            "pdl_ntfset_test".to_string(),
        );
        vars.insert(
            "PADDLE_MONTHLY_PRICE_ID".to_string(),
            "pri_monthly".to_string(),
        );
        vars.insert(
            "PADDLE_CARDLESS_TRIAL_PRICE_ID".to_string(),
            "pri_trial".to_string(),
        );
        Self { vars }
    }

    fn disabled() -> Self {
        let mut vars = HashMap::new();
        vars.insert("TELLER_ENV".to_string(), "test".to_string());
        vars.insert("AUTH_COOKIE_SAME_SITE".to_string(), "Lax".to_string());
        vars.insert(
            "APP_ORIGIN".to_string(),
            "http://localhost:8080".to_string(),
        );
        Self { vars }
    }
}

impl EnvironmentProvider for MockEnvironment {
    fn get_var(&self, key: &str) -> Option<String> {
        self.vars.get(key).cloned()
    }
}

#[test]
fn given_valid_paddle_signature_when_verifying_then_accepts_raw_body() {
    let raw_body = br#"{"event_id":"evt_123"}"#;
    let header =
        "ts=1700000000;h1=3a197239aca6698888207b95b9e07653c1db1715a97746290f20f3f466752b2b";

    let result =
        verify_paddle_webhook_signature("pdl_ntfset_test", header, raw_body, 1_700_000_003, 5);

    assert!(result.is_ok());
}

#[test]
fn given_missing_paddle_signature_when_verifying_then_rejects_before_json_parsing() {
    let result =
        verify_paddle_webhook_signature("pdl_ntfset_test", "", b"not-json", 1_700_000_003, 5);

    assert_eq!(result, Err(PaddleWebhookSignatureError::MissingHeader));
}

#[test]
fn given_stale_paddle_signature_when_verifying_then_rejects() {
    let raw_body = br#"{"event_id":"evt_123"}"#;
    let header =
        "ts=1700000000;h1=3a197239aca6698888207b95b9e07653c1db1715a97746290f20f3f466752b2b";

    let result =
        verify_paddle_webhook_signature("pdl_ntfset_test", header, raw_body, 1_700_000_006, 5);

    assert_eq!(result, Err(PaddleWebhookSignatureError::StaleTimestamp));
}

#[test]
fn given_mismatched_paddle_signature_when_verifying_then_rejects() {
    let raw_body = br#"{"event_id":"evt_123","extra":true}"#;
    let header =
        "ts=1700000000;h1=3a197239aca6698888207b95b9e07653c1db1715a97746290f20f3f466752b2b";

    let result =
        verify_paddle_webhook_signature("pdl_ntfset_test", header, raw_body, 1_700_000_003, 5);

    assert_eq!(result, Err(PaddleWebhookSignatureError::SignatureMismatch));
}

#[test]
fn given_billing_disabled_when_building_service_then_mode_is_unrestricted() {
    let config = Config::from_env_provider(&MockEnvironment::disabled()).unwrap();

    let service = BillingService::new(config);

    assert_eq!(service.billing_mode(), BillingMode::Disabled);
    assert_eq!(
        service.decision_for_status(EntitlementAccessStatus::Demo),
        EntitlementDecision {
            can_use_own_data: true,
            payment_method_required: false
        }
    );
}

#[test]
fn given_paddle_billing_when_deciding_access_then_allows_only_trialing_and_active() {
    let config = Config::from_env_provider(&MockEnvironment::paddle()).unwrap();
    let service = BillingService::new(config);

    assert_eq!(service.billing_mode(), BillingMode::Paddle);
    assert!(
        service
            .decision_for_status(EntitlementAccessStatus::Trialing)
            .can_use_own_data
    );
    assert!(
        service
            .decision_for_status(EntitlementAccessStatus::Active)
            .can_use_own_data
    );
    assert!(
        !service
            .decision_for_status(EntitlementAccessStatus::PastDue)
            .can_use_own_data
    );
    assert!(
        !service
            .decision_for_status(EntitlementAccessStatus::Paused)
            .can_use_own_data
    );
    assert!(
        !service
            .decision_for_status(EntitlementAccessStatus::Canceled)
            .can_use_own_data
    );
    assert!(
        !service
            .decision_for_status(EntitlementAccessStatus::Expired)
            .can_use_own_data
    );
}

#[test]
fn given_paddle_subscription_status_when_projecting_then_maps_to_local_access_status() {
    assert_eq!(
        BillingService::project_paddle_subscription_status("trialing"),
        EntitlementAccessStatus::Trialing
    );
    assert_eq!(
        BillingService::project_paddle_subscription_status("active"),
        EntitlementAccessStatus::Active
    );
    assert_eq!(
        BillingService::project_paddle_subscription_status("past_due"),
        EntitlementAccessStatus::PastDue
    );
    assert_eq!(
        BillingService::project_paddle_subscription_status("paused"),
        EntitlementAccessStatus::Paused
    );
    assert_eq!(
        BillingService::project_paddle_subscription_status("canceled"),
        EntitlementAccessStatus::Canceled
    );
    assert_eq!(
        BillingService::project_paddle_subscription_status("deleted"),
        EntitlementAccessStatus::Expired
    );
}

#[test]
fn given_existing_newer_entitlement_event_when_checking_order_then_rejects_older_event() {
    let existing = Utc.with_ymd_and_hms(2026, 7, 6, 12, 0, 0).unwrap();
    let older = Utc.with_ymd_and_hms(2026, 7, 6, 11, 59, 59).unwrap();
    let same = Utc.with_ymd_and_hms(2026, 7, 6, 12, 0, 0).unwrap();
    let newer = Utc.with_ymd_and_hms(2026, 7, 6, 12, 0, 1).unwrap();

    assert!(!BillingService::should_apply_event(Some(existing), older));
    assert!(BillingService::should_apply_event(Some(existing), same));
    assert!(BillingService::should_apply_event(Some(existing), newer));
    assert!(BillingService::should_apply_event(None, older));
}

#[tokio::test]
async fn given_billing_disabled_when_creating_checkout_then_paddle_client_is_not_called() {
    let config = Config::from_env_provider(&MockEnvironment::disabled()).unwrap();
    let service = BillingService::new(config);
    let mut paddle = MockPaddleClient::new();
    paddle.expect_create_checkout().never();

    let result = service
        .create_checkout(
            &paddle,
            CreateCheckoutRequest {
                user_email: "me@example.com".to_string(),
                price_id: "pri_monthly".to_string(),
            },
        )
        .await;

    assert!(result.is_err());
}
