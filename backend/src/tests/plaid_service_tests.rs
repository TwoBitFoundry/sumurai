use crate::models::transaction::Transaction;
use crate::test_fixtures::TestFixtures;
use axum::{extract::Json, routing::post, Router};
use rust_decimal::Decimal;
use serde_json::Value;
use std::io::ErrorKind;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use tokio::net::TcpListener;
use uuid::Uuid;

fn plaid_transaction_page(offset: usize) -> Vec<Value> {
    let batch_size = match offset {
        0 | 500 => 500,
        1000 => 100,
        _ => 0,
    };

    (0..batch_size)
        .map(|index| {
            let absolute_index = offset + index;
            serde_json::json!({
                "amount": absolute_index as f64,
                "date": "2024-01-01",
                "transaction_id": format!("txn_{absolute_index}"),
                "account_id": "acc_123",
                "merchant_name": format!("Merchant {absolute_index}"),
                "personal_finance_category": {
                    "primary": "FOOD_AND_DRINK",
                    "detailed": "FOOD_AND_DRINK_RESTAURANT",
                    "confidence_level": "VERY_HIGH"
                },
                "payment_channel": "in_store",
                "pending": false
            })
        })
        .collect()
}

async fn spawn_plaid_test_server(requests: Arc<Mutex<Vec<(usize, usize)>>>) -> Option<String> {
    let app = Router::new().route(
        "/transactions/get",
        post(move |Json(payload): Json<Value>| {
            let requests = Arc::clone(&requests);
            async move {
                let count = payload["options"]["count"].as_u64().unwrap_or(0) as usize;
                let offset = payload["options"]["offset"].as_u64().unwrap_or(0) as usize;
                requests.lock().unwrap().push((count, offset));
                Json(serde_json::json!({
                    "transactions": plaid_transaction_page(offset),
                    "total_transactions": 1100
                }))
            }
        }),
    );

    let listener = match TcpListener::bind("127.0.0.1:0").await {
        Ok(listener) => listener,
        Err(error) if error.kind() == ErrorKind::PermissionDenied => return None,
        Err(error) => panic!("failed to bind Plaid test server: {error}"),
    };
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    Some(format!("http://{}", addr))
}

#[test]
fn test_category_parsing_logic_extracts_correct_values() {
    let plaid_transaction: Value =
        serde_json::from_str(TestFixtures::plaid_transaction_with_category_json()).unwrap();

    let transaction = Transaction::from_plaid(&plaid_transaction, &Uuid::nil());

    assert_eq!(transaction.amount, Decimal::from_str("-15.5").unwrap());
    assert_eq!(transaction.category_primary, "FOOD_AND_DRINK");
    assert_eq!(transaction.category_detailed, "FOOD_AND_DRINK_RESTAURANT");
    assert_eq!(transaction.category_confidence, "VERY_HIGH");
    assert_eq!(transaction.payment_channel, Some("in_store".to_string()));
    assert!(!transaction.pending);
}

#[test]
fn test_category_parsing_handles_missing_fields() {
    let plaid_transaction: Value =
        serde_json::from_str(TestFixtures::plaid_transaction_minimal_json()).unwrap();

    let transaction = Transaction::from_plaid(&plaid_transaction, &Uuid::nil());

    assert_eq!(transaction.amount, Decimal::from_str("-25").unwrap());
    assert_eq!(transaction.category_primary, "OTHER");
    assert_eq!(transaction.category_detailed, "OTHER");
    assert_eq!(transaction.category_confidence, "MEDIUM");
    assert_eq!(transaction.payment_channel, None);
    assert!(!transaction.pending);
}

#[test]
fn test_category_parsing_falls_back_to_primary_when_detailed_missing() {
    let plaid_transaction: Value = serde_json::json!({
        "transaction_id": "test_txn_missing_detailed",
        "account_id": "test_acc_456",
        "amount": 15.5,
        "date": "2025-09-10",
        "name": "Starbucks Coffee",
        "personal_finance_category": {
            "primary": "FOOD_AND_DRINK"
        },
        "payment_channel": "in_store",
        "pending": false
    });

    let transaction = Transaction::from_plaid(&plaid_transaction, &Uuid::nil());

    assert_eq!(transaction.amount, Decimal::from_str("-15.5").unwrap());
    assert_eq!(transaction.category_primary, "FOOD_AND_DRINK");
    assert_eq!(transaction.category_detailed, "FOOD_AND_DRINK");
    assert_eq!(transaction.category_confidence, "MEDIUM");
}

#[test]
fn merchant_name_from_plaid_uses_merchant_name_only() {
    let v: Value = serde_json::json!({
        "merchant_name": "Starbucks",
        "name": "CARD PURCHASE STARBUCKS"
    });
    assert_eq!(
        Transaction::merchant_name_from_plaid(&v),
        Some("Starbucks".to_string())
    );
}

#[test]
fn merchant_name_from_plaid_falls_back_to_transaction_name() {
    let v: Value = serde_json::json!({
        "name": "ATM WITHDRAWAL"
    });
    assert_eq!(
        Transaction::merchant_name_from_plaid(&v),
        Some("Atm Withdrawal".to_string())
    );
}

#[tokio::test]
async fn given_plaid_transactions_when_getting_transactions_then_paginates_until_total_is_loaded() {
    let requests = Arc::new(Mutex::new(Vec::new()));
    let Some(base_url) = spawn_plaid_test_server(Arc::clone(&requests)).await else {
        return;
    };
    let client = crate::services::plaid_service::RealPlaidClient::new_for_test(base_url);

    let result = client
        .get_transactions(
            "access_token",
            chrono::NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
            chrono::NaiveDate::from_ymd_opt(2024, 12, 31).unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(result.transactions.len(), 1100);
    assert_eq!(result.page_count, 3);
    assert_eq!(
        *requests.lock().unwrap(),
        vec![(500, 0), (500, 500), (500, 1000)]
    );
}
