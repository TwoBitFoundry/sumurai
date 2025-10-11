use crate::providers::trait_definition::{FinancialDataProvider, ProviderCredentials};
use crate::providers::TellerProvider;
use chrono::NaiveDate;
use mockito::Server;
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;

fn create_test_credentials() -> ProviderCredentials {
    ProviderCredentials {
        provider: "teller".to_string(),
        access_token: "test_access_token_123".to_string(),
        item_id: "enr_test_123".to_string(),
        certificate: None,
        private_key: None,
    }
}

#[tokio::test]
async fn given_teller_provider_when_provider_name_then_returns_teller() {
    let server = Server::new_async().await;
    let provider = TellerProvider::new_for_test(server.url());

    assert_eq!(provider.provider_name(), "teller");
}

#[tokio::test]
async fn given_user_id_when_create_link_token_then_returns_enrollment_placeholder() {
    let server = Server::new_async().await;
    let provider = TellerProvider::new_for_test(server.url());
    let user_id = Uuid::new_v4();

    let result = provider.create_link_token(&user_id).await;

    assert!(result.is_ok());
    let token = result.unwrap();
    assert!(token.contains("teller_enrollment"));
}

#[tokio::test]
async fn given_access_token_when_exchange_public_token_then_returns_credentials() {
    let server = Server::new_async().await;
    let provider = TellerProvider::new_for_test(server.url());
    let access_token = "access_token_abc123".to_string();

    let result = provider.exchange_public_token(&access_token).await;

    assert!(result.is_ok());
    let credentials = result.unwrap();
    assert_eq!(credentials.provider, "teller");
    assert_eq!(credentials.access_token, access_token);
    assert_eq!(credentials.item_id, "teller_enrollment");
}

#[tokio::test]
async fn given_teller_accounts_when_get_accounts_then_fetches_balances_in_parallel() {
    let mut server = Server::new_async().await;

    let accounts_response = serde_json::json!([
        {
            "id": "acc_123",
            "name": "My Checking",
            "type": "depository",
            "subtype": "checking",
            "last_four": "1234",
            "status": "open",
            "currency": "USD",
            "institution": {
                "id": "chase",
                "name": "Chase"
            }
        },
        {
            "id": "acc_456",
            "name": "My Savings",
            "type": "depository",
            "subtype": "savings",
            "last_four": "5678",
            "status": "open",
            "currency": "USD",
            "institution": {
                "id": "chase",
                "name": "Chase"
            }
        }
    ]);

    let balance_response_1 = serde_json::json!({
        "ledger": "1234.56",
        "available": "1000.00"
    });

    let balance_response_2 = serde_json::json!({
        "ledger": "5678.90",
        "available": "5678.90"
    });

    let _accounts_mock = server
        .mock("GET", "/accounts")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(accounts_response.to_string())
        .create_async()
        .await;

    let _balance_mock_1 = server
        .mock("GET", "/accounts/acc_123/balances")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(balance_response_1.to_string())
        .create_async()
        .await;

    let _balance_mock_2 = server
        .mock("GET", "/accounts/acc_456/balances")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(balance_response_2.to_string())
        .create_async()
        .await;

    let provider = TellerProvider::new_for_test(server.url());
    let credentials = create_test_credentials();

    let result = provider.get_accounts(&credentials).await;

    assert!(result.is_ok());
    let accounts = result.unwrap();
    assert_eq!(accounts.len(), 2);

    assert_eq!(accounts[0].name, "My Checking");
    assert_eq!(accounts[0].account_type, "depository");
    assert_eq!(
        accounts[0].balance_current,
        Some(Decimal::from_str("1234.56").unwrap())
    );

    assert_eq!(accounts[1].name, "My Savings");
    assert_eq!(
        accounts[1].balance_current,
        Some(Decimal::from_str("5678.90").unwrap())
    );
}

#[tokio::test]
async fn given_teller_transactions_when_get_transactions_then_filters_by_date_range() {
    let mut server = Server::new_async().await;

    let accounts_response = serde_json::json!([
        {
            "id": "acc_123",
            "name": "My Checking",
            "type": "depository",
            "subtype": "checking",
            "last_four": "1234",
            "status": "open",
            "currency": "USD",
            "institution": {
                "id": "chase",
                "name": "Chase"
            }
        }
    ]);

    let transactions_response = serde_json::json!([
        {
            "id": "txn_1",
            "date": "2024-01-15",
            "amount": "-89.40",
            "description": "Starbucks",
            "status": "posted",
            "details": {
                "category": "general",
                "counterparty": {
                    "type": "merchant",
                    "name": "Starbucks"
                }
            }
        },
        {
            "id": "txn_2",
            "date": "2023-12-20",
            "amount": "-150.00",
            "description": "Walmart",
            "status": "posted",
            "details": {
                "category": "general"
            }
        },
        {
            "id": "txn_3",
            "date": "2024-01-20",
            "amount": "-45.00",
            "description": "Gas Station",
            "status": "posted",
            "details": {
                "category": "service"
            }
        }
    ]);

    let balance_response = serde_json::json!({
        "ledger": "1234.56",
        "available": "1000.00"
    });

    let _accounts_mock = server
        .mock("GET", "/accounts")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(accounts_response.to_string())
        .create_async()
        .await;

    let _balance_mock = server
        .mock("GET", "/accounts/acc_123/balances")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(balance_response.to_string())
        .create_async()
        .await;

    let _transactions_mock = server
        .mock("GET", "/accounts/acc_123/transactions")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(transactions_response.to_string())
        .create_async()
        .await;

    let provider = TellerProvider::new_for_test(server.url());
    let credentials = create_test_credentials();

    let start_date = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
    let end_date = NaiveDate::from_ymd_opt(2024, 1, 31).unwrap();

    let result = provider
        .get_transactions(&credentials, start_date, end_date)
        .await;

    assert!(result.is_ok());
    let transactions = result.unwrap();

    assert_eq!(transactions.len(), 2);
    assert_eq!(transactions[0].merchant_name, Some("Starbucks".to_string()));
    assert_eq!(
        transactions[0].amount,
        Decimal::from_str("89.40").unwrap()
    );
    assert_eq!(transactions[1].merchant_name, Some("Gas Station".to_string()));
}

#[tokio::test]
async fn given_teller_accounts_when_get_institution_info_then_returns_institution_from_first_account()
{
    let mut server = Server::new_async().await;

    let accounts_response = serde_json::json!([
        {
            "id": "acc_123",
            "name": "My Checking",
            "type": "depository",
            "subtype": "checking",
            "last_four": "1234",
            "status": "open",
            "currency": "USD",
            "institution": {
                "id": "chase",
                "name": "Chase Bank"
            }
        }
    ]);

    let _accounts_mock = server
        .mock("GET", "/accounts")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(accounts_response.to_string())
        .create_async()
        .await;

    let provider = TellerProvider::new_for_test(server.url());
    let credentials = create_test_credentials();

    let result = provider.get_institution_info(&credentials).await;

    assert!(result.is_ok());
    let institution = result.unwrap();
    assert_eq!(institution.institution_id, "chase");
    assert_eq!(institution.name, "Chase Bank");
}
