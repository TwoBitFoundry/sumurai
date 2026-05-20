use crate::providers::teller_provider::{MockTellerHttpClient, TellerHttpClient};
use crate::providers::trait_definition::{FinancialDataProvider, ProviderCredentials};
use crate::providers::TellerProvider;
use crate::test_fixtures::TestFixtures;
use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde_json::Value;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
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

fn teller_transaction(id: &str, date: &str) -> Value {
    serde_json::json!({
        "id": id,
        "amount": "10.00",
        "date": date,
        "status": "posted",
        "details": {
            "category": "general",
            "counterparty": {
                "name": "Merchant"
            }
        }
    })
}

#[tokio::test]
async fn given_teller_provider_when_provider_name_then_returns_teller() {
    let mock_client = MockTellerHttpClient::new();
    let client: Arc<dyn TellerHttpClient> = Arc::new(mock_client);
    let provider = TellerProvider::new_for_test("http://test.teller".to_string(), client);

    assert_eq!(provider.provider_name(), "teller");
}

#[tokio::test]
async fn given_user_id_when_create_link_token_then_returns_enrollment_placeholder() {
    let mock_client = MockTellerHttpClient::new();
    let client: Arc<dyn TellerHttpClient> = Arc::new(mock_client);
    let provider = TellerProvider::new_for_test("http://test.teller".to_string(), client);
    let user_id = Uuid::new_v4();

    let result = provider.create_link_token(&user_id).await;

    assert!(result.is_ok());
    let token = result.unwrap();
    assert!(token.contains("teller_enrollment"));
}

#[tokio::test]
async fn given_access_token_when_exchange_public_token_then_returns_credentials() {
    let mock_client = MockTellerHttpClient::new();
    let client: Arc<dyn TellerHttpClient> = Arc::new(mock_client);
    let provider = TellerProvider::new_for_test("http://test.teller".to_string(), client);
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
    let accounts_response: Vec<Value> = vec![
        serde_json::from_str(TestFixtures::teller_account_my_checking()).unwrap(),
        serde_json::from_str(TestFixtures::teller_account_my_savings()).unwrap(),
    ];

    let balance_response_1: Value =
        serde_json::from_str(TestFixtures::teller_balance_primary()).unwrap();

    let balance_response_2: Value =
        serde_json::from_str(TestFixtures::teller_balance_secondary()).unwrap();

    let mut mock_client = MockTellerHttpClient::new();
    let accounts_clone = accounts_response.clone();
    mock_client
        .expect_get_json_array()
        .withf(|url, token| url.ends_with("/accounts") && token == "test_access_token_123")
        .times(1)
        .returning(move |_, _| Ok(accounts_clone.clone()));

    mock_client
        .expect_get_json_value()
        .withf(|url, token| {
            url.ends_with("/accounts/acc_123/balances") && token == "test_access_token_123"
        })
        .times(1)
        .returning(move |_, _| Ok(balance_response_1.clone()));

    mock_client
        .expect_get_json_value()
        .withf(|url, token| {
            url.ends_with("/accounts/acc_456/balances") && token == "test_access_token_123"
        })
        .times(1)
        .returning(move |_, _| Ok(balance_response_2.clone()));

    let client: Arc<dyn TellerHttpClient> = Arc::new(mock_client);
    let provider = TellerProvider::new_for_test("http://test.teller".to_string(), client.clone());
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
    let accounts_response: Vec<Value> =
        vec![serde_json::from_str(TestFixtures::teller_account_my_checking()).unwrap()];

    let transactions_response: Vec<Value> = vec![
        serde_json::from_str(TestFixtures::teller_transaction_starbucks()).unwrap(),
        serde_json::from_str(TestFixtures::teller_transaction_walmart()).unwrap(),
        serde_json::from_str(TestFixtures::teller_transaction_gas_station()).unwrap(),
    ];

    let balance_response: Value =
        serde_json::from_str(TestFixtures::teller_balance_primary()).unwrap();

    let mut mock_client = MockTellerHttpClient::new();
    let accounts_clone_for_accounts = accounts_response.clone();
    mock_client
        .expect_get_json_array()
        .withf(|url, token| url.ends_with("/accounts") && token == "test_access_token_123")
        .times(1)
        .returning(move |_, _| Ok(accounts_clone_for_accounts.clone()));

    mock_client
        .expect_get_json_array()
        .withf(|url, token| {
            url.contains("/accounts/acc_123/transactions?count=100")
                && !url.contains("from_id=")
                && token == "test_access_token_123"
        })
        .times(1)
        .returning(move |_, _| Ok(transactions_response.clone()));

    mock_client
        .expect_get_json_value()
        .withf(|url, token| {
            url.ends_with("/accounts/acc_123/balances") && token == "test_access_token_123"
        })
        .times(1)
        .returning(move |_, _| Ok(balance_response.clone()));

    let client: Arc<dyn TellerHttpClient> = Arc::new(mock_client);
    let provider = TellerProvider::new_for_test("http://test.teller".to_string(), client.clone());
    let credentials = create_test_credentials();

    let start_date = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
    let end_date = NaiveDate::from_ymd_opt(2024, 1, 31).unwrap();

    let result = provider
        .get_transactions(&credentials, start_date, end_date)
        .await;

    assert!(result.is_ok());
    let result = result.unwrap();
    let transactions = result.transactions;

    assert_eq!(transactions.len(), 2);
    assert_eq!(transactions[0].merchant_name, Some("Starbucks".to_string()));
    assert_eq!(transactions[0].amount, Decimal::from_str("-89.40").unwrap());
    assert_eq!(
        transactions[1].merchant_name,
        Some("Gas Station".to_string())
    );
}

#[tokio::test]
async fn given_teller_accounts_when_get_institution_info_then_returns_institution_from_first_account(
) {
    let accounts_response: Vec<Value> =
        vec![serde_json::from_str(TestFixtures::teller_account_chase_bank()).unwrap()];

    let mut mock_client = MockTellerHttpClient::new();
    let accounts_clone = accounts_response.clone();
    mock_client
        .expect_get_json_array()
        .withf(|url, token| url.ends_with("/accounts") && token == "test_access_token_123")
        .times(1)
        .returning(move |_, _| Ok(accounts_clone.clone()));

    let client: Arc<dyn TellerHttpClient> = Arc::new(mock_client);
    let provider = TellerProvider::new_for_test("http://test.teller".to_string(), client.clone());
    let credentials = create_test_credentials();

    let result = provider.get_institution_info(&credentials).await;

    assert!(result.is_ok());
    let institution = result.unwrap();
    assert_eq!(institution.institution_id, "chase");
    assert_eq!(institution.name, "Chase Bank");
}

#[tokio::test]
async fn given_teller_transactions_when_get_transactions_then_pages_with_from_id_until_batch_under_page_size(
) {
    let accounts_response: Vec<Value> =
        vec![serde_json::from_str(TestFixtures::teller_account_my_checking()).unwrap()];
    let balance_response: Value =
        serde_json::from_str(TestFixtures::teller_balance_primary()).unwrap();
    let batches = [
        (0..100)
            .map(|index| teller_transaction(&format!("txn_{index:03}"), "2024-01-31"))
            .collect::<Vec<_>>(),
        (100..200)
            .map(|index| teller_transaction(&format!("txn_{index:03}"), "2024-01-30"))
            .collect::<Vec<_>>(),
        (200..240)
            .map(|index| teller_transaction(&format!("txn_{index:03}"), "2024-01-29"))
            .collect::<Vec<_>>(),
    ];

    let mut mock_client = MockTellerHttpClient::new();
    let accounts_clone = accounts_response.clone();
    mock_client
        .expect_get_json_array()
        .withf(|url, token| url.ends_with("/accounts") && token == "test_access_token_123")
        .times(1)
        .returning(move |_, _| Ok(accounts_clone.clone()));

    mock_client
        .expect_get_json_value()
        .withf(|url, token| {
            url.ends_with("/accounts/acc_123/balances") && token == "test_access_token_123"
        })
        .times(1)
        .returning(move |_, _| Ok(balance_response.clone()));

    let observed_urls = Arc::new(Mutex::new(Vec::new()));
    let observed_urls_clone = Arc::clone(&observed_urls);
    let call_index = Arc::new(Mutex::new(0usize));
    let call_index_clone = Arc::clone(&call_index);
    mock_client
        .expect_get_json_array()
        .withf(|url, token| {
            url.contains("/accounts/acc_123/transactions?count=100")
                && token == "test_access_token_123"
        })
        .times(3)
        .returning(move |url, _| {
            observed_urls_clone.lock().unwrap().push(url.to_string());
            let mut index = call_index_clone.lock().unwrap();
            let batch = batches[*index].clone();
            *index += 1;
            Ok(batch)
        });

    let client: Arc<dyn TellerHttpClient> = Arc::new(mock_client);
    let provider = TellerProvider::new_for_test("http://test.teller".to_string(), client.clone());
    let credentials = create_test_credentials();

    let result = provider
        .get_transactions(
            &credentials,
            NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
            NaiveDate::from_ymd_opt(2024, 1, 31).unwrap(),
        )
        .await;

    assert!(result.is_ok());
    let result = result.unwrap();
    assert_eq!(result.transactions.len(), 240);
    assert_eq!(result.page_count, 3);

    let urls = observed_urls.lock().unwrap();
    assert_eq!(urls.len(), 3);
    assert!(urls[0].contains("count=100"));
    assert!(!urls[0].contains("from_id="));
    assert!(urls[1].contains("count=100"));
    assert!(urls[1].contains("from_id=txn_099"));
    assert!(urls[2].contains("count=100"));
    assert!(urls[2].contains("from_id=txn_199"));
}

#[tokio::test]
async fn given_teller_transactions_before_start_date_when_get_transactions_then_stops_after_first_page(
) {
    let accounts_response: Vec<Value> =
        vec![serde_json::from_str(TestFixtures::teller_account_my_checking()).unwrap()];
    let balance_response: Value =
        serde_json::from_str(TestFixtures::teller_balance_primary()).unwrap();
    let first_batch = vec![
        teller_transaction("txn_010", "2023-12-01"),
        teller_transaction("txn_009", "2023-11-30"),
    ];

    let mut mock_client = MockTellerHttpClient::new();
    let accounts_clone = accounts_response.clone();
    mock_client
        .expect_get_json_array()
        .withf(|url, token| url.ends_with("/accounts") && token == "test_access_token_123")
        .times(1)
        .returning(move |_, _| Ok(accounts_clone.clone()));

    mock_client
        .expect_get_json_value()
        .withf(|url, token| {
            url.ends_with("/accounts/acc_123/balances") && token == "test_access_token_123"
        })
        .times(1)
        .returning(move |_, _| Ok(balance_response.clone()));

    let observed_urls = Arc::new(Mutex::new(Vec::new()));
    let observed_urls_clone = Arc::clone(&observed_urls);
    mock_client
        .expect_get_json_array()
        .withf(|url, token| {
            url.contains("/accounts/acc_123/transactions?count=100")
                && token == "test_access_token_123"
        })
        .times(1)
        .returning(move |url, _| {
            observed_urls_clone.lock().unwrap().push(url.to_string());
            Ok(first_batch.clone())
        });

    let client: Arc<dyn TellerHttpClient> = Arc::new(mock_client);
    let provider = TellerProvider::new_for_test("http://test.teller".to_string(), client.clone());
    let credentials = create_test_credentials();

    let result = provider
        .get_transactions(
            &credentials,
            NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
            NaiveDate::from_ymd_opt(2024, 1, 31).unwrap(),
        )
        .await;

    assert!(result.is_ok());
    let result = result.unwrap();
    assert_eq!(result.transactions.len(), 0);
    assert_eq!(result.page_count, 1);
    assert_eq!(observed_urls.lock().unwrap().len(), 1);
}
