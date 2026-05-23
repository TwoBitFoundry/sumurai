use crate::providers::simplefin_provider::{
    AccountsQuery, MockSimpleFinHttpClient, SimpleFinProvider, SimpleFinProviderError,
};
use crate::providers::trait_definition::{FinancialDataProvider, ProviderCredentials};
use base64::Engine;
use chrono::NaiveDate;
use std::sync::Arc;

const BETA_DEMO_ACCOUNTS_FIXTURE: &str = r#"{
  "errors": [],
  "accounts": [
    {
      "id": "Demo Savings",
      "name": "SimpleFIN Savings",
      "currency": "USD",
      "balance": "114265.51",
      "available-balance": "114265.51",
      "balance-date": 1779580800,
      "transactions": [],
      "holdings": [],
      "org": {
        "domain": "beta-bridge.simplefin.org",
        "name": "SimpleFIN Demo",
        "sfin-url": "https://beta-bridge.simplefin.org/simplefin",
        "url": "https://beta-bridge.simplefin.org",
        "id": "simplefin.demoorg"
      }
    }
  ]
}"#;

const ACCOUNTS_FIXTURE: &str = r#"{
  "errors": [],
  "connections": [
    {
      "conn_id": "conn-checking",
      "name": "Demo Bank",
      "org_id": "org-1",
      "org_url": "https://bank.example",
      "sfin_url": "https://sfin.example"
    },
    {
      "conn_id": "conn-savings",
      "name": "Demo Savings",
      "org_id": "org-2",
      "org_url": "https://bank.example",
      "sfin_url": "https://sfin.example"
    }
  ],
  "accounts": [
    {
      "id": "acct-1",
      "name": "Checking",
      "conn_id": "conn-checking",
      "currency": "USD",
      "balance": "100.00",
      "available-balance": "90.00",
      "balance-date": 978366153,
      "transactions": []
    },
    {
      "id": "acct-2",
      "name": "Savings",
      "conn_id": "conn-savings",
      "currency": "USD",
      "balance": "250.00",
      "available-balance": "250.00",
      "balance-date": 978366153,
      "transactions": []
    }
  ]
}"#;

fn create_test_credentials(access_url: &str) -> ProviderCredentials {
    ProviderCredentials {
        provider: "simplefin".to_string(),
        access_token: access_url.to_string(),
        item_id: "simplefin_root".to_string(),
        certificate: None,
        private_key: None,
    }
}

#[test]
fn given_simplefin_provider_when_provider_name_then_returns_simplefin() {
    let mock_client = MockSimpleFinHttpClient::new();
    let provider = SimpleFinProvider::new_for_test(Arc::new(mock_client));

    assert_eq!(provider.provider_name(), "simplefin");
}

#[tokio::test]
async fn given_setup_token_when_exchange_public_token_then_returns_simplefin_credentials() {
    let claim_url = "https://bridge.simplefin.org/simplefin/claim/demo";
    let setup_token = base64::engine::general_purpose::STANDARD.encode(claim_url.as_bytes());
    let access_url = "https://demo:pass@beta-bridge.simplefin.org/simplefin";

    let mut mock_client = MockSimpleFinHttpClient::new();
    mock_client
        .expect_claim()
        .with(mockall::predicate::eq(claim_url))
        .times(1)
        .returning(move |_| Ok(access_url.to_string()));

    let provider = SimpleFinProvider::new_for_test(Arc::new(mock_client));
    let result = provider.exchange_public_token(&setup_token).await.unwrap();

    assert_eq!(result.provider, "simplefin");
    assert_eq!(result.access_token, access_url);
    assert!(result.certificate.is_none());
    assert!(result.private_key.is_none());
}

#[tokio::test]
async fn given_claim_forbidden_when_exchange_public_token_then_returns_setup_token_already_claimed()
{
    let claim_url = "https://bridge.simplefin.org/simplefin/claim/used";
    let setup_token = base64::engine::general_purpose::STANDARD.encode(claim_url.as_bytes());

    let mut mock_client = MockSimpleFinHttpClient::new();
    mock_client.expect_claim().times(1).returning(|_| {
        Err(anyhow::Error::new(
            SimpleFinProviderError::SetupTokenAlreadyClaimed,
        ))
    });

    let provider = SimpleFinProvider::new_for_test(Arc::new(mock_client));
    let error = provider
        .exchange_public_token(&setup_token)
        .await
        .expect_err("expected claim failure");

    assert!(error.is::<SimpleFinProviderError>());
    assert_eq!(
        error.downcast_ref::<SimpleFinProviderError>(),
        Some(&SimpleFinProviderError::SetupTokenAlreadyClaimed)
    );
}

#[test]
fn given_beta_demo_setup_token_when_checking_demo_marker_then_returns_true() {
    let claim_url = "https://beta-bridge.simplefin.org/simplefin/claim/DEMO-v2-test-fixture";
    let setup_token = base64::engine::general_purpose::STANDARD.encode(claim_url.as_bytes());

    assert!(SimpleFinProvider::is_beta_demo_setup_token(&setup_token));
    assert_eq!(
        SimpleFinProvider::beta_demo_access_url_for_consumed_setup_token(&setup_token).as_deref(),
        Some("https://demo:demo@beta-bridge.simplefin.org/simplefin")
    );
}

#[test]
fn given_beta_demo_accounts_fixture_when_normalized_then_builds_connection_from_org() {
    let mut fixture: crate::models::simplefin::SimpleFinAccountsResponse =
        serde_json::from_str(BETA_DEMO_ACCOUNTS_FIXTURE).unwrap();

    fixture.normalize();

    assert_eq!(fixture.connections.len(), 1);
    assert_eq!(fixture.connections[0].conn_id, "simplefin.demoorg");
    assert_eq!(
        fixture.accounts[0].org_conn_id().as_deref(),
        Some("simplefin.demoorg")
    );
}

#[tokio::test]
async fn given_accounts_fixture_when_get_accounts_then_maps_accounts_with_conn_id() {
    let access_url = "https://demo:pass@beta-bridge.simplefin.org/simplefin";
    let fixture: crate::models::simplefin::SimpleFinAccountsResponse =
        serde_json::from_str(ACCOUNTS_FIXTURE).unwrap();

    let mut mock_client = MockSimpleFinHttpClient::new();
    mock_client
        .expect_get_accounts()
        .with(
            mockall::predicate::eq(access_url),
            mockall::predicate::function(|params: &AccountsQuery| params.balances_only),
        )
        .times(1)
        .returning(move |_, _| Ok(fixture.clone()));

    let provider = SimpleFinProvider::new_for_test(Arc::new(mock_client));
    let accounts = provider
        .get_accounts(&create_test_credentials(access_url))
        .await
        .unwrap();

    assert_eq!(accounts.len(), 2);
    assert_eq!(
        accounts[0].provider_conn_id.as_deref(),
        Some("conn-checking")
    );
    assert_eq!(
        accounts[1].provider_conn_id.as_deref(),
        Some("conn-savings")
    );
}

#[tokio::test]
async fn given_two_hundred_day_range_when_get_transactions_then_fetches_three_windows() {
    let access_url = "https://demo:pass@beta-bridge.simplefin.org/simplefin";
    let balances_fixture: crate::models::simplefin::SimpleFinAccountsResponse =
        serde_json::from_str(ACCOUNTS_FIXTURE).unwrap();
    let mut mock_client = MockSimpleFinHttpClient::new();
    mock_client.expect_get_accounts().times(4).returning({
        let fixture = balances_fixture.clone();
        let mut call = 0usize;
        move |_, params| {
            call += 1;
            if call == 1 {
                assert!(params.balances_only);
            } else {
                assert!(!params.balances_only);
                assert!(params.pending);
                assert!(params.start_date.is_some());
                assert!(params.end_date.is_some());
            }
            Ok(fixture.clone())
        }
    });

    let provider = SimpleFinProvider::new_for_test(Arc::new(mock_client));
    let start_date = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
    let end_date = NaiveDate::from_ymd_opt(2024, 7, 18).unwrap();

    let result = provider
        .get_transactions(&create_test_credentials(access_url), start_date, end_date)
        .await
        .unwrap();

    assert_eq!(result.page_count, 3);
}

#[tokio::test]
async fn given_simplefin_provider_when_get_institution_info_then_returns_not_applicable_error() {
    let mock_client = MockSimpleFinHttpClient::new();
    let provider = SimpleFinProvider::new_for_test(Arc::new(mock_client));
    let credentials =
        create_test_credentials("https://demo:pass@beta-bridge.simplefin.org/simplefin");

    let error = provider
        .get_institution_info(&credentials)
        .await
        .expect_err("expected not applicable error");

    assert_eq!(
        error.downcast_ref::<SimpleFinProviderError>(),
        Some(&SimpleFinProviderError::NotApplicableForSimpleFin)
    );
}
