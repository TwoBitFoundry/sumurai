use crate::providers::paddle_provider::{
    CancelSubscriptionRequest, CreateCheckoutRequest, CreatePaymentMethodTransactionRequest,
    PaddleClient, PaddleHttpClient,
};
use axum::{
    extract::Path,
    http::{Method, StatusCode},
    routing::{get, post},
    Json, Router,
};
use chrono::{TimeZone, Utc};
use serde_json::Value;
use std::io::ErrorKind;
use std::sync::{Arc, Mutex};
use tokio::net::TcpListener;
use uuid::Uuid;

async fn spawn_paddle_test_server(methods: Arc<Mutex<Vec<Method>>>) -> Option<String> {
    let app = Router::new().route(
        "/subscriptions/{subscription_id}/update-payment-method-transaction",
        get(move |Path(subscription_id): Path<String>, method: Method| {
            let methods = Arc::clone(&methods);
            async move {
                methods.lock().unwrap().push(method);
                assert_eq!(subscription_id, "sub_123");
                Json(serde_json::json!({
                    "data": {
                        "id": "txn_payment_method",
                        "checkout": {
                            "url": "https://checkout.paddle.test/payment-method"
                        }
                    }
                }))
            }
        }),
    );

    let listener = match TcpListener::bind("127.0.0.1:0").await {
        Ok(listener) => listener,
        Err(error) if error.kind() == ErrorKind::PermissionDenied => return None,
        Err(error) => panic!("failed to bind Paddle test server: {error}"),
    };
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    Some(format!("http://{}", addr))
}

async fn spawn_paddle_cancel_test_server(
    requests: Arc<Mutex<Vec<(Method, String, Value)>>>,
) -> Option<String> {
    let app = Router::new().route(
        "/subscriptions/{subscription_id}/cancel",
        post(
            move |Path(subscription_id): Path<String>, method: Method, Json(body): Json<Value>| {
                let requests = Arc::clone(&requests);
                async move {
                    requests
                        .lock()
                        .unwrap()
                        .push((method, subscription_id, body));
                    Json(serde_json::json!({
                        "data": {
                            "status": "active",
                            "scheduled_change": {
                                "action": "cancel",
                                "effective_at": "2026-08-22T00:00:00Z"
                            },
                            "canceled_at": null
                        }
                    }))
                }
            },
        ),
    );

    let listener = match TcpListener::bind("127.0.0.1:0").await {
        Ok(listener) => listener,
        Err(error) if error.kind() == ErrorKind::PermissionDenied => return None,
        Err(error) => panic!("failed to bind Paddle test server: {error}"),
    };
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    Some(format!("http://{}", addr))
}

async fn spawn_paddle_archived_customer_test_server() -> Option<String> {
    let app = Router::new()
        .route(
            "/customers",
            get(|| async {
                Json(serde_json::json!({
                    "data": [{"id": "ctm_archived", "status": "archived"}]
                }))
            }),
        )
        .route(
            "/customers/{customer_id}",
            axum::routing::get(|Path(customer_id): Path<String>| async move {
                assert_eq!(customer_id, "ctm_archived");
                Json(serde_json::json!({"data": {"id": "ctm_archived", "status": "archived"}}))
            })
            .patch(
                |Path(customer_id): Path<String>, Json(body): Json<Value>| async move {
                    assert_eq!(customer_id, "ctm_archived");
                    assert_eq!(body, serde_json::json!({"status": "active"}));
                    (
                        StatusCode::OK,
                        Json(serde_json::json!({"data": {"id": "ctm_archived"}})),
                    )
                },
            ),
        )
        .route(
            "/customers/ctm_archived/addresses",
            post(|| async { Json(serde_json::json!({"data": {"id": "add_123"}})) }),
        )
        .route(
            "/transactions",
            post(|| async {
                Json(serde_json::json!({
                    "data": {
                        "id": "txn_123",
                        "checkout": {"url": "https://checkout.paddle.test/txn_123"}
                    }
                }))
            }),
        );
    let listener = match TcpListener::bind("127.0.0.1:0").await {
        Ok(listener) => listener,
        Err(error) if error.kind() == ErrorKind::PermissionDenied => return None,
        Err(error) => panic!("failed to bind Paddle test server: {error}"),
    };
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    Some(format!("http://{}", addr))
}

async fn spawn_paddle_checkout_test_server(requests: Arc<Mutex<Vec<Value>>>) -> Option<String> {
    let app = Router::new().route(
        "/transactions",
        post(move |Json(body): Json<Value>| {
            let requests = Arc::clone(&requests);
            async move {
                requests.lock().unwrap().push(body);
                Json(serde_json::json!({
                    "data": {
                        "id": "txn_checkout",
                        "checkout": {"url": "https://checkout.paddle.test/txn_checkout"}
                    }
                }))
            }
        }),
    );
    let listener = match TcpListener::bind("127.0.0.1:0").await {
        Ok(listener) => listener,
        Err(error) if error.kind() == ErrorKind::PermissionDenied => return None,
        Err(error) => panic!("failed to bind Paddle test server: {error}"),
    };
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    Some(format!("http://{}", addr))
}

#[tokio::test]
async fn given_checkout_request_when_creating_transaction_then_omits_unsupported_ip_field() {
    let requests = Arc::new(Mutex::new(Vec::new()));
    let Some(base_url) = spawn_paddle_checkout_test_server(Arc::clone(&requests)).await else {
        return;
    };
    let client = PaddleClient::new_for_test(base_url);
    let response = client
        .create_checkout(CreateCheckoutRequest {
            user_email: "me@test.com".to_string(),
            existing_customer_id: None,
            price_id: "pri_monthly".to_string(),
            user_id: Uuid::nil(),
        })
        .await
        .expect("checkout transaction should succeed");

    assert_eq!(response.transaction_id, "txn_checkout");
    assert_eq!(
        response.checkout_url,
        "https://checkout.paddle.test/txn_checkout"
    );
    assert_eq!(
        requests.lock().unwrap()[0],
        serde_json::json!({
            "items": [{"price_id": "pri_monthly", "quantity": 1}],
            "customer_id": null,
            "custom_data": {"sumurai_user_id": Uuid::nil().to_string()},
            "collection_mode": "automatic"
        })
    );
}

#[tokio::test]
async fn given_archived_customer_when_creating_cardless_trial_then_restores_and_reuses_it() {
    let Some(base_url) = spawn_paddle_archived_customer_test_server().await else {
        return;
    };
    let client = PaddleClient::new_for_test(base_url);
    let response = client
        .create_cardless_trial(
            crate::providers::paddle_provider::CreateCardlessTrialRequest {
                user_id: Uuid::nil(),
                user_email: "me@test.com".to_string(),
                existing_customer_id: None,
                existing_address_id: None,
                country_code: "US".to_string(),
                postal_code: "60601".to_string(),
                price_id: "pri_trial".to_string(),
            },
        )
        .await
        .expect("archived customer should be restored and reused");

    assert_eq!(response.customer_id, "ctm_archived");
    assert_eq!(response.address_id, "add_123");
    assert_eq!(response.transaction_id, "txn_123");
}

#[tokio::test]
async fn given_stored_archived_customer_when_creating_checkout_then_restores_and_reuses_it() {
    let Some(base_url) = spawn_paddle_archived_customer_test_server().await else {
        return;
    };
    let client = PaddleClient::new_for_test(base_url);
    let response = client
        .create_checkout(CreateCheckoutRequest {
            user_email: "me@test.com".to_string(),
            existing_customer_id: Some("ctm_archived".to_string()),
            price_id: "pri_monthly".to_string(),
            user_id: Uuid::nil(),
        })
        .await
        .expect("archived checkout customer should be restored");

    assert_eq!(response.transaction_id, "txn_123");
}

#[tokio::test]
async fn given_payment_method_request_when_calling_paddle_then_uses_get() {
    let methods = Arc::new(Mutex::new(Vec::new()));
    let Some(base_url) = spawn_paddle_test_server(Arc::clone(&methods)).await else {
        return;
    };

    let client = PaddleClient::new_for_test(base_url);
    let response = client
        .create_payment_method_transaction(CreatePaymentMethodTransactionRequest {
            subscription_id: "sub_123".to_string(),
        })
        .await
        .expect("payment method transaction should succeed");

    assert_eq!(response.transaction_id, "txn_payment_method");
    assert_eq!(
        response.checkout_url,
        "https://checkout.paddle.test/payment-method"
    );
    assert_eq!(*methods.lock().unwrap(), vec![Method::GET]);
}

#[tokio::test]
async fn given_cancel_request_when_calling_paddle_then_schedules_next_billing_period() {
    let requests = Arc::new(Mutex::new(Vec::new()));
    let Some(base_url) = spawn_paddle_cancel_test_server(Arc::clone(&requests)).await else {
        return;
    };

    let client = PaddleClient::new_for_test(base_url);
    let response = client
        .cancel_subscription(CancelSubscriptionRequest {
            subscription_id: "sub_123".to_string(),
        })
        .await
        .expect("subscription cancellation should succeed");

    let expected = Utc.with_ymd_and_hms(2026, 8, 22, 0, 0, 0).unwrap();
    assert_eq!(response.status, "active");
    assert_eq!(response.scheduled_cancel_at, Some(expected));
    assert!(response.canceled_at.is_none());
    let requests = requests.lock().unwrap();
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0].0, Method::POST);
    assert_eq!(requests[0].1, "sub_123");
    assert_eq!(
        requests[0].2,
        serde_json::json!({"effective_from": "next_billing_period"})
    );
}
