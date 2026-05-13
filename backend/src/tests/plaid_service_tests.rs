use crate::models::transaction::Transaction;
use crate::test_fixtures::TestFixtures;
use axum::{extract::Json, routing::post, Router};
use serde_json::Value;
use std::sync::{Arc, Mutex};
use tokio::net::TcpListener;

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
                    "detailed": "FOOD_AND_DRINK_RESTAURANTS",
                    "confidence_level": "VERY_HIGH"
                },
                "payment_channel": "in_store",
                "pending": false
            })
        })
        .collect()
}

async fn spawn_plaid_test_server(offsets: Arc<Mutex<Vec<usize>>>) -> String {
    let app = Router::new().route(
        "/transactions/get",
        post(move |Json(payload): Json<Value>| {
            let offsets = Arc::clone(&offsets);
            async move {
                let offset = payload["offset"].as_u64().unwrap_or(0) as usize;
                offsets.lock().unwrap().push(offset);
                Json(serde_json::json!({
                    "transactions": plaid_transaction_page(offset),
                    "total_transactions": 1100
                }))
            }
        }),
    );

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    format!("http://{}", addr)
}

#[test]
fn test_category_parsing_logic_extracts_correct_values() {
    // Test the category extraction logic from Plaid API responses
    let plaid_transaction: Value =
        serde_json::from_str(TestFixtures::plaid_transaction_with_category_json()).unwrap();

    // This mirrors the category extraction logic from PlaidService::get_transactions
    let category_primary = plaid_transaction
        .get("personal_finance_category")
        .and_then(|pfc| pfc.get("primary"))
        .and_then(|v| v.as_str())
        .unwrap_or("OTHER")
        .to_string();

    let category_detailed = plaid_transaction
        .get("personal_finance_category")
        .and_then(|pfc| pfc.get("detailed"))
        .and_then(|v| v.as_str())
        .unwrap_or(&category_primary)
        .to_string();

    let category_confidence = plaid_transaction
        .get("personal_finance_category")
        .and_then(|pfc| pfc.get("confidence_level"))
        .and_then(|v| v.as_str())
        .unwrap_or("MEDIUM")
        .to_string();

    let payment_channel = plaid_transaction
        .get("payment_channel")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let pending = plaid_transaction
        .get("pending")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    // Verify extracted values match expected Plaid API format
    assert_eq!(category_primary, "FOOD_AND_DRINK");
    assert_eq!(category_detailed, "FOOD_AND_DRINK_RESTAURANTS");
    assert_eq!(category_confidence, "VERY_HIGH");
    assert_eq!(payment_channel, Some("in_store".to_string()));
    assert!(!pending);
}

#[test]
fn test_category_parsing_handles_missing_fields() {
    // Test with minimal transaction data (missing optional fields)
    let plaid_transaction: Value =
        serde_json::from_str(TestFixtures::plaid_transaction_minimal_json()).unwrap();

    let category_primary = plaid_transaction
        .get("personal_finance_category")
        .and_then(|pfc| pfc.get("primary"))
        .and_then(|v| v.as_str())
        .unwrap_or("OTHER")
        .to_string();

    let category_detailed = plaid_transaction
        .get("personal_finance_category")
        .and_then(|pfc| pfc.get("detailed"))
        .and_then(|v| v.as_str())
        .unwrap_or(&category_primary)
        .to_string();

    let category_confidence = plaid_transaction
        .get("personal_finance_category")
        .and_then(|pfc| pfc.get("confidence_level"))
        .and_then(|v| v.as_str())
        .unwrap_or("MEDIUM")
        .to_string();

    let payment_channel = plaid_transaction
        .get("payment_channel")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let pending = plaid_transaction
        .get("pending")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    // Verify defaults are used when fields are missing
    assert_eq!(category_primary, "OTHER");
    assert_eq!(category_detailed, "OTHER"); // Falls back to primary when detailed missing
    assert_eq!(category_confidence, "MEDIUM");
    assert_eq!(payment_channel, None);
    assert!(!pending);
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
    let offsets = Arc::new(Mutex::new(Vec::new()));
    let base_url = spawn_plaid_test_server(Arc::clone(&offsets)).await;
    let client = crate::services::plaid_service::RealPlaidClient::new_for_test(base_url);

    let transactions = client
        .get_transactions(
            "access_token",
            chrono::NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
            chrono::NaiveDate::from_ymd_opt(2024, 12, 31).unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(transactions.len(), 1100);
    assert_eq!(*offsets.lock().unwrap(), vec![0, 500, 1000]);
}
