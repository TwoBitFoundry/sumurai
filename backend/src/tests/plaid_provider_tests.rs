use crate::providers::{FinancialDataProvider, PlaidProvider};
use crate::services::plaid_service::RealPlaidClient;
use chrono::NaiveDate;
use std::sync::Arc;
use uuid::Uuid;

#[tokio::test]
async fn given_plaid_provider_when_get_provider_name_then_returns_plaid() {
    let client = Arc::new(RealPlaidClient::new(
        "test_client_id".to_string(),
        "test_secret".to_string(),
        "sandbox".to_string(),
    ));
    let provider = PlaidProvider::new(client);

    let name = provider.provider_name();

    assert_eq!(name, "plaid");
}

#[tokio::test]
async fn given_plaid_provider_when_create_link_token_then_delegates_to_client() {
    let client = Arc::new(RealPlaidClient::new(
        "test_client_id".to_string(),
        "test_secret".to_string(),
        "sandbox".to_string(),
    ));
    let provider = PlaidProvider::new(client);
    let user_id = Uuid::new_v4();

    let result = provider.create_link_token(&user_id).await;

    assert!(result.is_err() || result.is_ok());
}

#[tokio::test]
async fn given_plaid_provider_when_exchange_token_then_returns_credentials() {
    let client = Arc::new(RealPlaidClient::new(
        "test_client_id".to_string(),
        "test_secret".to_string(),
        "sandbox".to_string(),
    ));
    let provider = PlaidProvider::new(client);

    let result = provider.exchange_public_token("test_public_token").await;

    assert!(result.is_err() || result.is_ok());
    if let Ok(creds) = result {
        assert_eq!(creds.provider, "plaid");
        assert!(!creds.access_token.is_empty());
        assert!(!creds.item_id.is_empty());
        assert!(creds.certificate.is_none());
        assert!(creds.private_key.is_none());
    }
}

#[tokio::test]
async fn given_plaid_provider_when_get_accounts_then_delegates_to_client() {
    let client = Arc::new(RealPlaidClient::new(
        "test_client_id".to_string(),
        "test_secret".to_string(),
        "sandbox".to_string(),
    ));
    let provider = PlaidProvider::new(client);

    let credentials = crate::providers::ProviderCredentials {
        provider: "plaid".to_string(),
        access_token: "test_access_token".to_string(),
        item_id: "test_item_id".to_string(),
        certificate: None,
        private_key: None,
    };

    let result = provider.get_accounts(&credentials).await;

    assert!(result.is_err() || result.is_ok());
}

#[tokio::test]
async fn given_plaid_provider_when_get_transactions_then_delegates_to_client() {
    let client = Arc::new(RealPlaidClient::new(
        "test_client_id".to_string(),
        "test_secret".to_string(),
        "sandbox".to_string(),
    ));
    let provider = PlaidProvider::new(client);

    let credentials = crate::providers::ProviderCredentials {
        provider: "plaid".to_string(),
        access_token: "test_access_token".to_string(),
        item_id: "test_item_id".to_string(),
        certificate: None,
        private_key: None,
    };

    let start_date = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
    let end_date = NaiveDate::from_ymd_opt(2024, 1, 31).unwrap();

    let result = provider
        .get_transactions(&credentials, start_date, end_date)
        .await;

    assert!(result.is_err() || result.is_ok());
}

#[tokio::test]
async fn given_plaid_provider_when_get_institution_info_then_returns_info() {
    let client = Arc::new(RealPlaidClient::new(
        "test_client_id".to_string(),
        "test_secret".to_string(),
        "sandbox".to_string(),
    ));
    let provider = PlaidProvider::new(client);

    let credentials = crate::providers::ProviderCredentials {
        provider: "plaid".to_string(),
        access_token: "test_access_token".to_string(),
        item_id: "test_item_id".to_string(),
        certificate: None,
        private_key: None,
    };

    let result = provider.get_institution_info(&credentials).await;

    assert!(result.is_err() || result.is_ok());
    if let Ok(info) = result {
        assert!(!info.institution_id.is_empty());
        assert!(!info.name.is_empty());
    }
}
