use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use chrono::Utc;
use serde_json::Value;
use std::sync::Arc;
use tower::ServiceExt;
use uuid::Uuid;

use crate::models::billing::{BillingEntitlement, BillingProfile, PaddleWebhookEvent};
use crate::providers::paddle_provider::{
    CancelSubscriptionResponse, CreateCardlessTrialResponse, CreateCheckoutResponse,
    CreatePaymentMethodTransactionResponse, CreatePortalSessionResponse, MockPaddleHttpClient,
};
use crate::services::cache_service::MockCacheService;
use crate::services::repository_service::MockDatabaseRepository;
use crate::test_fixtures::{noop_categorizer, TestFixtures};

#[tokio::test]
async fn given_billing_disabled_when_get_status_then_returns_unrestricted_disabled_status() {
    let (mut user, token) = TestFixtures::create_authenticated_user_with_token();
    user.demo_mode_active = true;
    let expected_user = user.clone();
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_user_by_id()
        .withf(move |user_id| *user_id == expected_user.id)
        .return_once(move |_| Box::pin(async move { Ok(Some(user)) }));
    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = Request::builder()
        .method("GET")
        .uri("/api/billing/status")
        .header("Cookie", format!("auth_token={token}"))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let value: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(value["billing_enabled"], false);
    assert_eq!(value["trials_enabled"], false);
    assert_eq!(value["access_status"], "unrestricted");
    assert_eq!(value["can_use_own_data"], true);
    assert_eq!(value["is_demo_mode_active"], true);
    assert_eq!(value["paddle_client_token"], Value::Null);
    assert_eq!(value["paddle_environment"], Value::Null);
    assert_eq!(value["billing_portal_available"], false);
}

#[tokio::test]
async fn given_paddle_billing_when_create_checkout_then_returns_checkout_url() {
    let mock_db = MockDatabaseRepository::new();
    let mut mock_db = mock_db;
    mock_db
        .expect_get_billing_profile()
        .returning(|_| Box::pin(async { Ok(None) }));
    let mut paddle = MockPaddleHttpClient::new();
    paddle.expect_create_checkout().returning(|request| {
        assert_eq!(request.price_id, "pri_monthly");
        Box::pin(async {
            Ok(CreateCheckoutResponse {
                checkout_url: "https://checkout.paddle.test/monthly".to_string(),
                transaction_id: "txn_monthly".to_string(),
            })
        })
    });
    let app = create_paddle_billing_app(mock_db, paddle).await;
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let request = Request::builder()
        .method("POST")
        .uri("/api/billing/checkout")
        .header("Cookie", format!("auth_token={token}"))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let value: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        value["checkout_url"],
        "https://checkout.paddle.test/monthly"
    );
    assert_eq!(value["transaction_id"], "txn_monthly");
}

#[tokio::test]
async fn given_open_trial_paddle_setup_fails_when_starting_then_returns_failed_dependency() {
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_billing_entitlement()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_db
        .expect_get_billing_profile()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_db.expect_upsert_billing_profile().never();

    let mut paddle = MockPaddleHttpClient::new();
    paddle
        .expect_create_cardless_trial()
        .returning(|_| Box::pin(async { Err(anyhow::anyhow!("paddle setup failed")) }));
    let app = create_paddle_billing_app(mock_db, paddle).await;
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let request = Request::builder()
        .method("POST")
        .uri("/api/billing/trials/start")
        .header("Cookie", format!("auth_token={token}"))
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::json!({
                "country_code": "US",
                "postal_code": "78701"
            })
            .to_string(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::FAILED_DEPENDENCY);
}

#[tokio::test]
async fn given_existing_trial_entitlement_when_starting_then_returns_conflict_without_paddle() {
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_billing_entitlement()
        .returning(|user_id| {
            let user_id = *user_id;
            Box::pin(async move {
                Ok(Some(BillingEntitlement {
                    user_id,
                    access_status: "trialing".to_string(),
                    source: "paddle".to_string(),
                    paddle_subscription_id: Some("sub_existing".to_string()),
                    paddle_customer_id: Some("ctm_existing".to_string()),
                    paddle_price_id: Some("pri_trial".to_string()),
                    trial_ends_at: None,
                    current_period_ends_at: None,
                    canceled_at: None,
                    scheduled_cancel_at: None,
                    last_event_at: None,
                    payment_method_required: true,
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                }))
            })
        });

    let mut paddle = MockPaddleHttpClient::new();
    paddle.expect_create_cardless_trial().never();
    let app = create_paddle_billing_app(mock_db, paddle).await;
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let request = Request::builder()
        .method("POST")
        .uri("/api/billing/trials/start")
        .header("Cookie", format!("auth_token={token}"))
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::json!({
                "country_code": "US",
                "postal_code": "78701"
            })
            .to_string(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::CONFLICT);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let value: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(value["code"], "TRIAL_ALREADY_USED");
}

#[tokio::test]
async fn given_open_trial_when_starting_then_returns_pending_and_records_profile() {
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_billing_entitlement()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_db
        .expect_get_billing_profile()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_db
        .expect_upsert_billing_profile()
        .returning(|profile| {
            assert_eq!(profile.paddle_customer_id.as_deref(), Some("ctm_trial"));
            assert_eq!(profile.paddle_address_id.as_deref(), Some("add_trial"));
            assert_eq!(profile.billing_country_code.as_deref(), Some("US"));
            assert_eq!(profile.billing_postal_code.as_deref(), Some("78701"));
            Box::pin(async { Ok(()) })
        });

    let mut paddle = MockPaddleHttpClient::new();
    paddle.expect_create_cardless_trial().returning(|request| {
        assert_eq!(request.price_id, "pri_trial");
        assert_eq!(request.country_code, "US");
        assert_eq!(request.postal_code, "78701");
        Box::pin(async {
            Ok(CreateCardlessTrialResponse {
                customer_id: "ctm_trial".to_string(),
                address_id: "add_trial".to_string(),
                transaction_id: "txn_trial".to_string(),
            })
        })
    });
    let app = create_paddle_billing_app(mock_db, paddle).await;
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let request = Request::builder()
        .method("POST")
        .uri("/api/billing/trials/start")
        .header("Cookie", format!("auth_token={token}"))
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::json!({
                "country_code": "us",
                "postal_code": "78701"
            })
            .to_string(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let value: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(value["status"], "pending");
}

#[tokio::test]
async fn given_changed_billing_address_when_starting_trial_then_creates_new_address() {
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_billing_entitlement()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_db.expect_get_billing_profile().returning(|user_id| {
        let user_id = *user_id;
        Box::pin(async move {
            Ok(Some(BillingProfile {
                user_id,
                paddle_customer_id: Some("ctm_existing".to_string()),
                paddle_address_id: Some("add_existing".to_string()),
                billing_country_code: Some("US".to_string()),
                billing_postal_code: Some("78701".to_string()),
                created_at: Utc::now(),
                updated_at: Utc::now(),
            }))
        })
    });
    mock_db
        .expect_upsert_billing_profile()
        .returning(|_| Box::pin(async { Ok(()) }));

    let mut paddle = MockPaddleHttpClient::new();
    paddle.expect_create_cardless_trial().returning(|request| {
        assert_eq!(
            request.existing_customer_id.as_deref(),
            Some("ctm_existing")
        );
        assert!(request.existing_address_id.is_none());
        assert_eq!(request.country_code, "CA");
        assert_eq!(request.postal_code, "M5V 2T6");
        Box::pin(async {
            Ok(CreateCardlessTrialResponse {
                customer_id: "ctm_existing".to_string(),
                address_id: "add_new".to_string(),
                transaction_id: "txn_trial".to_string(),
            })
        })
    });
    let app = create_paddle_billing_app(mock_db, paddle).await;
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let request = Request::builder()
        .method("POST")
        .uri("/api/billing/trials/start")
        .header("Cookie", format!("auth_token={token}"))
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::json!({
                "country_code": "ca",
                "postal_code": "M5V 2T6"
            })
            .to_string(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn given_trials_disabled_when_starting_then_returns_not_found() {
    let mut mock_db = MockDatabaseRepository::new();
    mock_db.expect_get_billing_entitlement().never();
    mock_db.expect_get_billing_profile().never();
    let mut paddle = MockPaddleHttpClient::new();
    paddle.expect_create_cardless_trial().never();

    let app = TestFixtures::create_test_app_with_db_cache_config_categorizer_and_paddle(
        mock_db,
        billing_cache(),
        noop_categorizer(),
        TestFixtures::create_paddle_test_config_with_trials(false),
        Arc::new(paddle),
    )
    .await
    .unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let request = Request::builder()
        .method("POST")
        .uri("/api/billing/trials/start")
        .header("Cookie", format!("auth_token={token}"))
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::json!({
                "country_code": "US",
                "postal_code": "78701"
            })
            .to_string(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let value: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(value["code"], "TRIALS_DISABLED");
}

#[tokio::test]
async fn given_trialing_subscription_when_payment_method_requested_then_returns_checkout_data() {
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_billing_entitlement()
        .returning(|user_id| {
            let user_id = *user_id;
            Box::pin(async move { Ok(Some(active_entitlement(user_id))) })
        });
    let mut paddle = MockPaddleHttpClient::new();
    paddle
        .expect_create_payment_method_transaction()
        .returning(|request| {
            assert_eq!(request.subscription_id, "sub_123");
            Box::pin(async {
                Ok(CreatePaymentMethodTransactionResponse {
                    checkout_url: "https://checkout.paddle.test/payment-method".to_string(),
                    transaction_id: "txn_payment_method".to_string(),
                })
            })
        });
    let app = create_paddle_billing_app(mock_db, paddle).await;
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let request = Request::builder()
        .method("POST")
        .uri("/api/billing/payment-method")
        .header("Cookie", format!("auth_token={token}"))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let value: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        value["checkout_url"],
        "https://checkout.paddle.test/payment-method"
    );
    assert_eq!(value["transaction_id"], "txn_payment_method");
}

#[tokio::test]
async fn given_paddle_customer_when_portal_session_requested_then_returns_temporary_links() {
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_billing_entitlement()
        .returning(|user_id| {
            let user_id = *user_id;
            Box::pin(async move { Ok(Some(active_entitlement(user_id))) })
        });
    mock_db.expect_upsert_billing_profile().never();
    mock_db.expect_upsert_billing_entitlement().never();

    let mut paddle = MockPaddleHttpClient::new();
    paddle.expect_create_portal_session().returning(|request| {
        assert_eq!(request.customer_id, "ctm_123");
        assert_eq!(request.subscription_ids, vec!["sub_123".to_string()]);
        Box::pin(async {
            Ok(CreatePortalSessionResponse {
                overview_url: "https://portal.paddle.test/overview?token=temporary".to_string(),
                subscription_urls: vec![
                    "https://portal.paddle.test/cancel?token=temporary".to_string(),
                    "https://portal.paddle.test/payment?token=temporary".to_string(),
                ],
            })
        })
    });
    let app = create_paddle_billing_app(mock_db, paddle).await;
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let request = Request::builder()
        .method("POST")
        .uri("/api/billing/portal-session")
        .header("Cookie", format!("auth_token={token}"))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let value: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        value["overview_url"],
        "https://portal.paddle.test/overview?token=temporary"
    );
    assert_eq!(value["subscription_urls"].as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn given_active_subscription_when_cancel_requested_then_returns_and_persists_schedule() {
    let scheduled_cancel_at = Utc::now();
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_billing_entitlement()
        .returning(|user_id| {
            let user_id = *user_id;
            Box::pin(async move { Ok(Some(active_entitlement(user_id))) })
        });
    mock_db
        .expect_set_billing_entitlement_scheduled_cancel()
        .withf(move |_, scheduled_at| *scheduled_at == Some(scheduled_cancel_at))
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_db.expect_upsert_billing_entitlement().never();
    let mut paddle = MockPaddleHttpClient::new();
    paddle
        .expect_cancel_subscription()
        .return_once(move |request| {
            assert_eq!(request.subscription_id, "sub_123");
            Box::pin(async move {
                Ok(CancelSubscriptionResponse {
                    status: "active".to_string(),
                    scheduled_cancel_at: Some(scheduled_cancel_at),
                    canceled_at: None,
                })
            })
        });
    let app = create_paddle_billing_app(mock_db, paddle).await;
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let request = Request::builder()
        .method("POST")
        .uri("/api/billing/subscription/cancel")
        .header("Cookie", format!("auth_token={token}"))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let value: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(value["status"], "scheduled");
    let returned_scheduled_at: chrono::DateTime<Utc> =
        serde_json::from_value(value["scheduled_cancel_at"].clone()).unwrap();
    assert_eq!(returned_scheduled_at, scheduled_cancel_at);
}

#[tokio::test]
async fn given_billing_disabled_when_cancel_requested_then_returns_not_found() {
    let mock_db = MockDatabaseRepository::new();
    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let request = Request::builder()
        .method("POST")
        .uri("/api/billing/subscription/cancel")
        .header("Cookie", format!("auth_token={token}"))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let value: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(value["code"], "BILLING_DISABLED");
}

#[tokio::test]
async fn given_entitlement_without_subscription_when_cancel_requested_then_returns_conflict() {
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_billing_entitlement()
        .returning(|user_id| {
            let mut entitlement = active_entitlement(*user_id);
            entitlement.paddle_subscription_id = None;
            Box::pin(async move { Ok(Some(entitlement)) })
        });
    mock_db
        .expect_set_billing_entitlement_scheduled_cancel()
        .never();
    let mut paddle = MockPaddleHttpClient::new();
    paddle.expect_cancel_subscription().never();
    let app = create_paddle_billing_app(mock_db, paddle).await;
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let request = Request::builder()
        .method("POST")
        .uri("/api/billing/subscription/cancel")
        .header("Cookie", format!("auth_token={token}"))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::CONFLICT);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let value: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(value["code"], "BILLING_ENTITLEMENT_UNAVAILABLE");
}

#[tokio::test]
async fn given_paddle_failure_when_cancel_requested_then_returns_failed_dependency() {
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_billing_entitlement()
        .returning(|user_id| {
            let user_id = *user_id;
            Box::pin(async move { Ok(Some(active_entitlement(user_id))) })
        });
    mock_db
        .expect_set_billing_entitlement_scheduled_cancel()
        .never();
    let mut paddle = MockPaddleHttpClient::new();
    paddle
        .expect_cancel_subscription()
        .returning(|_| Box::pin(async { Err(anyhow::anyhow!("Paddle unavailable")) }));
    let app = create_paddle_billing_app(mock_db, paddle).await;
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let request = Request::builder()
        .method("POST")
        .uri("/api/billing/subscription/cancel")
        .header("Cookie", format!("auth_token={token}"))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::FAILED_DEPENDENCY);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let value: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(value["code"], "PADDLE_REQUEST_FAILED");
}

#[tokio::test]
async fn given_billing_disabled_when_mutation_endpoint_called_then_returns_billing_disabled() {
    let mock_db = MockDatabaseRepository::new();
    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let request = Request::builder()
        .method("POST")
        .uri("/api/billing/checkout")
        .header("Cookie", format!("auth_token={token}"))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let value: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(value["code"], "BILLING_DISABLED");
}

#[tokio::test]
async fn given_billing_disabled_when_paddle_webhook_called_then_returns_billing_disabled() {
    let mock_db = MockDatabaseRepository::new();
    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = Request::builder()
        .method("POST")
        .uri("/api/billing/webhooks/paddle")
        .header("content-type", "application/json")
        .body(Body::from("not-json"))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let value: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(value["code"], "BILLING_DISABLED");
}

#[tokio::test]
async fn given_valid_paddle_webhook_when_posting_then_returns_ok_without_entitlement_mutation_on_duplicate(
) {
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_record_paddle_webhook_event_if_new()
        .returning(|_| Box::pin(async { Ok(false) }));
    mock_db
        .expect_get_paddle_webhook_event()
        .withf(|event_id| event_id == "evt_duplicate")
        .returning(|_| {
            let now = Utc::now();
            Box::pin(async move {
                Ok(Some(PaddleWebhookEvent {
                    event_id: "evt_duplicate".to_string(),
                    event_type: "subscription.activated".to_string(),
                    occurred_at: now,
                    processed_at: now,
                    processing_status: "processed".to_string(),
                    related_user_id: None,
                    related_subscription_id: None,
                    error_code: None,
                    created_at: now,
                }))
            })
        });
    mock_db.expect_get_billing_entitlement().never();
    mock_db.expect_upsert_billing_entitlement().never();
    mock_db.expect_mark_paddle_webhook_event_processed().never();
    let app = create_paddle_billing_app(mock_db, MockPaddleHttpClient::new()).await;
    let user_id = Uuid::new_v4();
    let body = format!(
        r#"{{
            "event_id":"evt_duplicate",
            "event_type":"subscription.activated",
            "occurred_at":"2026-07-06T12:00:00Z",
            "data":{{
                "id":"sub_123",
                "status":"trialing",
                "customer_id":"ctm_123",
                "custom_data":{{"sumurai_user_id":"{user_id}"}},
                "items":[{{"price":{{"id":"pri_trial"}}}}]
            }}
        }}"#
    );
    let raw_body = body.as_bytes();
    let timestamp = Utc::now().timestamp();
    let header = sign_paddle_webhook("pdl_ntfset_test", raw_body, timestamp);

    let request = Request::builder()
        .method("POST")
        .uri("/api/billing/webhooks/paddle")
        .header("content-type", "application/json")
        .header("Paddle-Signature", header)
        .body(Body::from(body))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

fn sign_paddle_webhook(secret: &str, body: &[u8], timestamp: i64) -> String {
    use hmac::{Hmac, KeyInit, Mac};
    use sha2::Sha256;
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

#[tokio::test]
async fn given_paddle_billing_when_get_status_then_returns_entitlement_projection() {
    let scheduled_cancel_at = Utc::now();
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_billing_entitlement()
        .returning(move |user_id| {
            let user_id = *user_id;
            let scheduled_cancel_at = scheduled_cancel_at;
            Box::pin(async move {
                Ok(Some(BillingEntitlement {
                    user_id,
                    access_status: "trialing".to_string(),
                    source: "paddle".to_string(),
                    paddle_subscription_id: Some("sub_123".to_string()),
                    paddle_customer_id: Some("ctm_123".to_string()),
                    paddle_price_id: Some("pri_trial".to_string()),
                    trial_ends_at: None,
                    current_period_ends_at: None,
                    canceled_at: None,
                    scheduled_cancel_at: Some(scheduled_cancel_at),
                    last_event_at: None,
                    payment_method_required: true,
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                }))
            })
        });

    let mut mock_cache = MockCacheService::new();
    mock_cache
        .expect_health_check()
        .returning(|| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    mock_cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_get_counter()
        .times(0..)
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_increment_counter()
        .times(0..)
        .returning(|_, _| Box::pin(async { Ok(1) }));
    mock_cache
        .expect_set_with_ttl()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_invalidate_pattern()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_get_budgets()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_set_budgets()
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_clear_budgets()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_is_auth_ip_banned()
        .times(0..)
        .returning(|_| Box::pin(async { Ok(false) }));
    mock_cache
        .expect_record_auth_rate_limit_exceeded()
        .times(0..)
        .returning(|_| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db_cache_config_and_categorizer(
        mock_db,
        mock_cache,
        noop_categorizer(),
        TestFixtures::create_paddle_test_config(),
    )
    .await
    .unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let request = Request::builder()
        .method("GET")
        .uri("/api/billing/status")
        .header("Cookie", format!("auth_token={token}"))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let value: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(value["billing_enabled"], true);
    assert_eq!(value["trials_enabled"], true);
    assert_eq!(value["access_status"], "trialing");
    assert_eq!(value["can_use_own_data"], true);
    assert_eq!(value["payment_method_required"], true);
    assert_eq!(value["billing_portal_available"], true);
    assert_eq!(value["paddle_client_token"], "test-client-token");
    assert_eq!(value["paddle_environment"], "sandbox");
    let returned_scheduled_cancel_at: chrono::DateTime<Utc> =
        serde_json::from_value(value["scheduled_cancel_at"].clone()).unwrap();
    assert_eq!(returned_scheduled_cancel_at, scheduled_cancel_at);
    assert_eq!(
        value["enabled_financial_providers"],
        serde_json::json!(["diy", "plaid"])
    );
}

async fn create_paddle_billing_app(
    mock_db: MockDatabaseRepository,
    paddle: MockPaddleHttpClient,
) -> crate::Router {
    TestFixtures::create_test_app_with_db_cache_config_categorizer_and_paddle(
        mock_db,
        billing_cache(),
        noop_categorizer(),
        TestFixtures::create_paddle_test_config(),
        Arc::new(paddle),
    )
    .await
    .unwrap()
}

fn billing_cache() -> MockCacheService {
    let mut mock_cache = MockCacheService::new();
    mock_cache
        .expect_health_check()
        .returning(|| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    mock_cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_get_counter()
        .times(0..)
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_increment_counter()
        .times(0..)
        .returning(|_, _| Box::pin(async { Ok(1) }));
    mock_cache
        .expect_set_with_ttl()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_invalidate_pattern()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_get_budgets()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_set_budgets()
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_clear_budgets()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_is_auth_ip_banned()
        .times(0..)
        .returning(|_| Box::pin(async { Ok(false) }));
    mock_cache
        .expect_record_auth_rate_limit_exceeded()
        .times(0..)
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
}

fn active_entitlement(user_id: Uuid) -> BillingEntitlement {
    BillingEntitlement {
        user_id,
        access_status: "trialing".to_string(),
        source: "paddle".to_string(),
        paddle_subscription_id: Some("sub_123".to_string()),
        paddle_customer_id: Some("ctm_123".to_string()),
        paddle_price_id: Some("pri_trial".to_string()),
        trial_ends_at: None,
        current_period_ends_at: None,
        canceled_at: None,
        scheduled_cancel_at: None,
        last_event_at: None,
        payment_method_required: true,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}
