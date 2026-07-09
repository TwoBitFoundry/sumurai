use crate::providers::paddle_provider::{
    CreatePaymentMethodTransactionRequest, PaddleClient, PaddleHttpClient,
};
use axum::{extract::Path, http::Method, routing::get, Json, Router};
use std::io::ErrorKind;
use std::sync::{Arc, Mutex};
use tokio::net::TcpListener;

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
