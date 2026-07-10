use crate::config::{BillingMode, Config, EnvironmentProvider};
use crate::models::billing::{BillingEntitlement, PaddleWebhookEvent};
use crate::providers::paddle_provider::{
    CreateCheckoutRequest, MockPaddleHttpClient, NoOpPaddleClient,
};
use crate::services::billing_service::{
    verify_paddle_webhook_signature, BillingService, BillingWebhookError, EntitlementAccessStatus,
    EntitlementDecision, OwnDataAccessCheck, PaddleWebhookSignatureError,
};
use crate::services::repository_service::MockDatabaseRepository;
use chrono::{TimeZone, Utc};
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

struct MockEnvironment {
    vars: HashMap<String, String>,
}

impl MockEnvironment {
    fn paddle() -> Self {
        let mut vars = HashMap::new();
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
        vars.insert("BILLING_TRIALS_ENABLED".to_string(), "true".to_string());
        Self { vars }
    }

    fn disabled() -> Self {
        let mut vars = HashMap::new();
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

fn noop_paddle() -> Arc<dyn crate::providers::PaddleHttpClient> {
    Arc::new(NoOpPaddleClient)
}

fn billing_service(
    config: Config,
    repository: Arc<MockDatabaseRepository>,
    paddle: Arc<dyn crate::providers::PaddleHttpClient>,
) -> BillingService {
    BillingService::new(config, repository, paddle)
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
fn given_negative_signature_tolerance_when_verifying_then_rejects_non_exact_timestamp() {
    let raw_body = br#"{"event_id":"evt_123"}"#;
    let header =
        "ts=1700000000;h1=3a197239aca6698888207b95b9e07653c1db1715a97746290f20f3f466752b2b";

    let result =
        verify_paddle_webhook_signature("pdl_ntfset_test", header, raw_body, 1_700_000_001, -1);

    assert_eq!(result, Err(PaddleWebhookSignatureError::StaleTimestamp));
}

#[test]
fn given_mismatched_paddle_signature_when_verifying_then_rejects() {
    let raw_body = br#"{"event_id":"evt_123"}"#;
    let header = "ts=1700000000;h1=deadbeef";

    let result =
        verify_paddle_webhook_signature("pdl_ntfset_test", header, raw_body, 1_700_000_003, 5);

    assert_eq!(result, Err(PaddleWebhookSignatureError::SignatureMismatch));
}

#[test]
fn given_billing_disabled_when_building_service_then_mode_is_unrestricted() {
    let config = Config::from_env_provider(&MockEnvironment::disabled()).unwrap();
    let service = billing_service(
        config,
        Arc::new(MockDatabaseRepository::new()),
        noop_paddle(),
    );

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
    let service = billing_service(
        config,
        Arc::new(MockDatabaseRepository::new()),
        noop_paddle(),
    );

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
    let mut paddle = MockPaddleHttpClient::new();
    paddle.expect_create_checkout().never();
    let service = billing_service(
        config,
        Arc::new(MockDatabaseRepository::new()),
        Arc::new(paddle),
    );

    let result = service
        .create_checkout(CreateCheckoutRequest {
            user_email: "me@example.com".to_string(),
            price_id: "pri_monthly".to_string(),
            user_id: Uuid::new_v4(),
        })
        .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn given_billing_disabled_when_checking_own_data_access_then_allows_without_repository() {
    let config = Config::from_env_provider(&MockEnvironment::disabled()).unwrap();
    let mut repository = MockDatabaseRepository::new();
    repository.expect_get_billing_entitlement().never();
    let service = billing_service(config, Arc::new(repository), noop_paddle());

    let result = service.check_own_data_access(Uuid::new_v4()).await.unwrap();

    assert_eq!(result, OwnDataAccessCheck::Allowed);
}

fn sign_paddle_webhook(secret: &str, body: &[u8], timestamp: i64) -> String {
    type HmacSha256 = Hmac<Sha256>;
    let mut signed_payload = timestamp.to_string().into_bytes();
    signed_payload.push(b':');
    signed_payload.extend_from_slice(body);
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
    mac.update(&signed_payload);
    format!(
        "ts={timestamp};h1={}",
        hex::encode(mac.finalize().into_bytes())
    )
}

fn processed_paddle_webhook_event(event_id: &str) -> PaddleWebhookEvent {
    let now = Utc::now();
    PaddleWebhookEvent {
        event_id: event_id.to_string(),
        event_type: "subscription.activated".to_string(),
        occurred_at: now,
        processed_at: now,
        processing_status: "processed".to_string(),
        related_user_id: None,
        related_subscription_id: None,
        error_code: None,
        created_at: now,
    }
}

fn received_paddle_webhook_event(event_id: &str) -> PaddleWebhookEvent {
    let now = Utc::now();
    PaddleWebhookEvent {
        event_id: event_id.to_string(),
        event_type: "subscription.activated".to_string(),
        occurred_at: now,
        processed_at: now,
        processing_status: "received".to_string(),
        related_user_id: None,
        related_subscription_id: None,
        error_code: None,
        created_at: now,
    }
}

fn subscription_activated_payload(user_id: Uuid, occurred_at: &str) -> Vec<u8> {
    format!(
        r#"{{
            "event_id":"evt_sub_activated",
            "event_type":"subscription.activated",
            "occurred_at":"{occurred_at}",
            "data":{{
                "id":"sub_123",
                "status":"trialing",
                "customer_id":"ctm_123",
                "custom_data":{{"sumurai_user_id":"{user_id}"}},
                "items":[{{"price":{{"id":"pri_trial"}}}}],
                "trial_dates":{{"ends_at":"2026-08-06T00:00:00Z"}},
                "current_billing_period":{{"ends_at":"2026-08-06T00:00:00Z"}}
            }}
        }}"#
    )
    .into_bytes()
}

#[tokio::test]
async fn given_invalid_paddle_signature_when_processing_webhook_then_rejects_before_repository() {
    let config = Config::from_env_provider(&MockEnvironment::paddle()).unwrap();
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_record_paddle_webhook_event_if_new()
        .never();
    let service = billing_service(config, Arc::new(repository), noop_paddle());
    let body = br#"{"event_id":"evt_123"}"#;

    let result = service
        .process_paddle_webhook(Some("ts=1;h1=deadbeef"), body, 1_700_000_003)
        .await;

    assert_eq!(result, Err(BillingWebhookError::InvalidSignature));
}

#[tokio::test]
async fn given_duplicate_paddle_webhook_when_processing_then_succeeds_without_entitlement_mutation()
{
    let config = Config::from_env_provider(&MockEnvironment::paddle()).unwrap();
    let user_id = Uuid::new_v4();
    let occurred_at = "2026-07-06T12:00:00Z";
    let body = subscription_activated_payload(user_id, occurred_at);
    let header = sign_paddle_webhook("pdl_ntfset_test", &body, 1_700_000_000);
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_record_paddle_webhook_event_if_new()
        .returning(|_| Box::pin(async { Ok(false) }));
    repository
        .expect_get_paddle_webhook_event()
        .withf(|event_id| event_id == "evt_sub_activated")
        .returning(|_| {
            Box::pin(async { Ok(Some(processed_paddle_webhook_event("evt_sub_activated"))) })
        });
    repository.expect_get_billing_entitlement().never();
    repository.expect_upsert_billing_entitlement().never();
    repository
        .expect_mark_paddle_webhook_event_processed()
        .never();
    let service = billing_service(config, Arc::new(repository), noop_paddle());

    let result = service
        .process_paddle_webhook(Some(&header), &body, 1_700_000_003)
        .await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn given_retried_webhook_after_partial_failure_when_processing_then_reapplies_entitlement() {
    let config = Config::from_env_provider(&MockEnvironment::paddle()).unwrap();
    let user_id = Uuid::new_v4();
    let occurred_at = "2026-07-06T12:00:00Z";
    let body = subscription_activated_payload(user_id, occurred_at);
    let header = sign_paddle_webhook("pdl_ntfset_test", &body, 1_700_000_000);
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_record_paddle_webhook_event_if_new()
        .returning(|_| Box::pin(async { Ok(false) }));
    repository
        .expect_get_paddle_webhook_event()
        .withf(|event_id| event_id == "evt_sub_activated")
        .returning(|_| {
            Box::pin(async { Ok(Some(received_paddle_webhook_event("evt_sub_activated"))) })
        });
    repository
        .expect_get_billing_entitlement()
        .returning(|_| Box::pin(async { Ok(None) }));
    repository
        .expect_upsert_billing_entitlement()
        .withf(move |entitlement| {
            entitlement.user_id == user_id && entitlement.access_status == "trialing"
        })
        .returning(|_| Box::pin(async { Ok(()) }));
    repository
        .expect_mark_paddle_webhook_event_processed()
        .withf(|event_id, _| event_id == "evt_sub_activated")
        .returning(|_, _| Box::pin(async { Ok(()) }));
    let service = billing_service(config, Arc::new(repository), noop_paddle());

    let result = service
        .process_paddle_webhook(Some(&header), &body, 1_700_000_003)
        .await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn given_older_paddle_webhook_when_processing_then_skips_entitlement_downgrade() {
    let config = Config::from_env_provider(&MockEnvironment::paddle()).unwrap();
    let user_id = Uuid::new_v4();
    let occurred_at = "2026-07-06T11:00:00Z";
    let body = subscription_activated_payload(user_id, occurred_at);
    let header = sign_paddle_webhook("pdl_ntfset_test", &body, 1_700_000_000);
    let newer_event_at = Utc.with_ymd_and_hms(2026, 7, 6, 12, 0, 0).unwrap();
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_record_paddle_webhook_event_if_new()
        .returning(|_| Box::pin(async { Ok(true) }));
    repository
        .expect_get_billing_entitlement()
        .returning(move |_| {
            Box::pin(async move {
                Ok(Some(BillingEntitlement {
                    user_id,
                    access_status: "active".to_string(),
                    source: "paddle".to_string(),
                    paddle_subscription_id: Some("sub_123".to_string()),
                    paddle_customer_id: Some("ctm_123".to_string()),
                    paddle_price_id: Some("pri_trial".to_string()),
                    trial_ends_at: None,
                    current_period_ends_at: None,
                    canceled_at: None,
                    last_event_at: Some(newer_event_at),
                    payment_method_required: false,
                    created_at: newer_event_at,
                    updated_at: newer_event_at,
                }))
            })
        });
    repository.expect_upsert_billing_entitlement().never();
    repository
        .expect_mark_paddle_webhook_event_processed()
        .returning(|_, _| Box::pin(async { Ok(()) }));
    let service = billing_service(config, Arc::new(repository), noop_paddle());

    let result = service
        .process_paddle_webhook(Some(&header), &body, 1_700_000_003)
        .await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn given_lifecycle_webhook_without_parseable_subscription_when_processing_then_leaves_unprocessed(
) {
    let config = Config::from_env_provider(&MockEnvironment::paddle()).unwrap();
    let user_id = Uuid::new_v4();
    let body = format!(
        r#"{{
            "event_id":"evt_sub_unparseable",
            "event_type":"subscription.activated",
            "occurred_at":"2026-07-06T12:00:00Z",
            "data":{{
                "custom_data":{{"sumurai_user_id":"{user_id}"}},
                "status":"trialing"
            }}
        }}"#
    )
    .into_bytes();
    let header = sign_paddle_webhook("pdl_ntfset_test", &body, 1_700_000_000);
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_record_paddle_webhook_event_if_new()
        .returning(|_| Box::pin(async { Ok(true) }));
    repository.expect_get_billing_entitlement().never();
    repository.expect_upsert_billing_entitlement().never();
    repository
        .expect_mark_paddle_webhook_event_processed()
        .never();
    let service = billing_service(config, Arc::new(repository), noop_paddle());

    let result = service
        .process_paddle_webhook(Some(&header), &body, 1_700_000_003)
        .await;

    assert_eq!(result, Err(BillingWebhookError::UnparseableSubscription));
}

#[tokio::test]
async fn given_subscription_activated_webhook_when_processing_then_updates_trialing_entitlement() {
    let config = Config::from_env_provider(&MockEnvironment::paddle()).unwrap();
    let user_id = Uuid::new_v4();
    let occurred_at = "2026-07-06T12:00:00Z";
    let body = subscription_activated_payload(user_id, occurred_at);
    let header = sign_paddle_webhook("pdl_ntfset_test", &body, 1_700_000_000);
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_record_paddle_webhook_event_if_new()
        .returning(|_| Box::pin(async { Ok(true) }));
    repository
        .expect_get_billing_entitlement()
        .returning(|_| Box::pin(async { Ok(None) }));
    repository
        .expect_upsert_billing_entitlement()
        .withf(move |entitlement| {
            entitlement.user_id == user_id
                && entitlement.access_status == "trialing"
                && entitlement.payment_method_required
                && entitlement.paddle_subscription_id.as_deref() == Some("sub_123")
        })
        .returning(|_| Box::pin(async { Ok(()) }));
    repository
        .expect_mark_paddle_webhook_event_processed()
        .returning(|_, _| Box::pin(async { Ok(()) }));
    let service = billing_service(config, Arc::new(repository), noop_paddle());

    let result = service
        .process_paddle_webhook(Some(&header), &body, 1_700_000_003)
        .await;

    assert!(result.is_ok());
}
