use crate::providers::simplefin_provider::{
    MockSimpleFinHttpClient, SimpleFinProvider, SimpleFinProviderError,
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

fn create_test_provider(mock_client: MockSimpleFinHttpClient) -> SimpleFinProvider {
    SimpleFinProvider::new(Arc::new(mock_client))
}

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
    let provider = create_test_provider(mock_client);

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

    let provider = create_test_provider(mock_client);
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

    let provider = create_test_provider(mock_client);
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
        .withf(move |url, params| url == access_url && !params.balances_only && params.pending)
        .times(1)
        .returning(move |_, _| Ok(fixture.clone()));

    let provider = create_test_provider(mock_client);
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
        move |_, params| {
            assert!(!params.balances_only);
            assert!(params.pending);
            assert!(params.start_date.is_some());
            assert!(params.end_date.is_some());
            Ok(fixture.clone())
        }
    });

    let provider = create_test_provider(mock_client);
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
    let provider = create_test_provider(mock_client);
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

#[test]
fn given_simplefin_account_with_brokerage_keyword_when_map_account_then_sets_investment_type() {
    let account = crate::models::simplefin::SimpleFinAccount {
        id: "investment-acct".to_string(),
        name: "Brokerage Account".to_string(),
        conn_id: None,
        org: None,
        currency: Some("USD".to_string()),
        balance: Some("50000.00".to_string()),
        available_balance: None,
        balance_date: None,
        holdings: vec![],
        transactions: vec![],
    };

    let mapped = SimpleFinProvider::map_account(&account);

    assert_eq!(mapped.account_type, "investment");
}

#[test]
fn given_simplefin_account_without_holdings_when_map_account_then_sets_depository_type() {
    let account = crate::models::simplefin::SimpleFinAccount {
        id: "checking-acct".to_string(),
        name: "Checking Account".to_string(),
        conn_id: None,
        org: None,
        currency: Some("USD".to_string()),
        balance: Some("5000.00".to_string()),
        available_balance: None,
        balance_date: None,
        holdings: vec![],
        transactions: vec![],
    };

    let mapped = SimpleFinProvider::map_account(&account);

    assert_eq!(mapped.account_type, "depository");
    assert_eq!(mapped.mask, Some("0000".to_string()));
}

#[test]
fn given_simplefin_account_with_mask_in_parentheses_when_map_account_then_extracts_mask() {
    let account = crate::models::simplefin::SimpleFinAccount {
        id: "ira-acct".to_string(),
        name: "Empower Premier Roth IRA (I-R3)".to_string(),
        conn_id: None,
        org: None,
        currency: Some("USD".to_string()),
        balance: Some("22639.87".to_string()),
        available_balance: None,
        balance_date: None,
        holdings: vec![],
        transactions: vec![],
    };

    let mapped = SimpleFinProvider::map_account(&account);

    assert_eq!(mapped.mask, Some("I-R3".to_string()));
}

#[test]
fn given_simplefin_account_with_mask_in_parentheses_when_map_account_then_removes_mask_from_name() {
    let account = crate::models::simplefin::SimpleFinAccount {
        id: "trad-ira".to_string(),
        name: "Empower Premier Traditional IRA (I-01)".to_string(),
        conn_id: None,
        org: None,
        currency: Some("USD".to_string()),
        balance: Some("39428.78".to_string()),
        available_balance: None,
        balance_date: None,
        holdings: vec![],
        transactions: vec![],
    };

    let mapped = SimpleFinProvider::map_account(&account);

    assert_eq!(mapped.name, "Empower Premier Traditional IRA");
    assert_eq!(mapped.mask, Some("I-01".to_string()));
}

#[test]
fn given_simplefin_account_with_credit_in_name_when_map_account_then_sets_credit_type() {
    let account = crate::models::simplefin::SimpleFinAccount {
        id: "credit-acct".to_string(),
        name: "Chase Credit Card".to_string(),
        conn_id: None,
        org: None,
        currency: Some("USD".to_string()),
        balance: Some("-1500.00".to_string()),
        available_balance: None,
        balance_date: None,
        holdings: vec![],
        transactions: vec![],
    };

    let mapped = SimpleFinProvider::map_account(&account);

    assert_eq!(mapped.account_type, "credit");
}

#[test]
fn given_simplefin_account_with_mortgage_in_name_when_map_account_then_sets_loan_type() {
    let account = crate::models::simplefin::SimpleFinAccount {
        id: "mortgage-acct".to_string(),
        name: "Home Mortgage".to_string(),
        conn_id: None,
        org: None,
        currency: Some("USD".to_string()),
        balance: Some("350000.00".to_string()),
        available_balance: None,
        balance_date: None,
        holdings: vec![],
        transactions: vec![],
    };

    let mapped = SimpleFinProvider::map_account(&account);

    assert_eq!(mapped.account_type, "loan");
}

#[test]
fn given_simplefin_account_with_loan_in_name_when_map_account_then_sets_loan_type() {
    let account = crate::models::simplefin::SimpleFinAccount {
        id: "loan-acct".to_string(),
        name: "Auto Loan".to_string(),
        conn_id: None,
        org: None,
        currency: Some("USD".to_string()),
        balance: Some("25000.00".to_string()),
        available_balance: None,
        balance_date: None,
        holdings: vec![],
        transactions: vec![],
    };

    let mapped = SimpleFinProvider::map_account(&account);

    assert_eq!(mapped.account_type, "loan");
}

#[test]
fn given_simplefin_account_with_ira_keyword_when_map_account_then_sets_investment_type() {
    let account = crate::models::simplefin::SimpleFinAccount {
        id: "ira-acct".to_string(),
        name: "Traditional IRA".to_string(),
        conn_id: None,
        org: None,
        currency: Some("USD".to_string()),
        balance: Some("125000.00".to_string()),
        available_balance: None,
        balance_date: None,
        holdings: vec![],
        transactions: vec![],
    };

    let mapped = SimpleFinProvider::map_account(&account);

    assert_eq!(mapped.account_type, "investment");
}

#[test]
fn given_simplefin_account_with_roth_keyword_when_map_account_then_sets_investment_type() {
    let account = crate::models::simplefin::SimpleFinAccount {
        id: "roth-acct".to_string(),
        name: "Roth IRA".to_string(),
        conn_id: None,
        org: None,
        currency: Some("USD".to_string()),
        balance: Some("85000.00".to_string()),
        available_balance: None,
        balance_date: None,
        holdings: vec![],
        transactions: vec![],
    };

    let mapped = SimpleFinProvider::map_account(&account);

    assert_eq!(mapped.account_type, "investment");
}

#[test]
fn given_simplefin_account_with_401k_keyword_when_map_account_then_sets_investment_type() {
    let account = crate::models::simplefin::SimpleFinAccount {
        id: "401k-acct".to_string(),
        name: "401(k) Plan".to_string(),
        conn_id: None,
        org: None,
        currency: Some("USD".to_string()),
        balance: Some("450000.00".to_string()),
        available_balance: None,
        balance_date: None,
        holdings: vec![],
        transactions: vec![],
    };

    let mapped = SimpleFinProvider::map_account(&account);

    assert_eq!(mapped.account_type, "investment");
}

#[test]
fn given_simplefin_account_with_visa_keyword_when_map_account_then_sets_credit_type() {
    let account = crate::models::simplefin::SimpleFinAccount {
        id: "visa-card".to_string(),
        name: "Business Visa".to_string(),
        conn_id: None,
        org: None,
        currency: Some("USD".to_string()),
        balance: Some("-2500.00".to_string()),
        available_balance: None,
        balance_date: None,
        holdings: vec![],
        transactions: vec![],
    };

    let mapped = SimpleFinProvider::map_account(&account);

    assert_eq!(mapped.account_type, "credit");
}

#[test]
fn given_simplefin_account_with_heloc_keyword_when_map_account_then_sets_loan_type() {
    let account = crate::models::simplefin::SimpleFinAccount {
        id: "heloc-acct".to_string(),
        name: "Home HELOC".to_string(),
        conn_id: None,
        org: None,
        currency: Some("USD".to_string()),
        balance: Some("50000.00".to_string()),
        available_balance: None,
        balance_date: None,
        holdings: vec![],
        transactions: vec![],
    };

    let mapped = SimpleFinProvider::map_account(&account);

    assert_eq!(mapped.account_type, "loan");
}

#[test]
fn given_simplefin_account_with_card_in_institution_name_when_map_account_then_sets_credit_type() {
    let account = crate::models::simplefin::SimpleFinAccount {
        id: "cc-acct".to_string(),
        name: "Premium Account".to_string(),
        conn_id: None,
        org: Some(crate::models::simplefin::SimpleFinOrg {
            id: "amex-services".to_string(),
            name: Some("American Express Card Services".to_string()),
            domain: None,
            sfin_url: None,
            url: None,
        }),
        currency: Some("USD".to_string()),
        balance: Some("-1000.00".to_string()),
        available_balance: None,
        balance_date: None,
        holdings: vec![],
        transactions: vec![],
    };

    let mapped = SimpleFinProvider::map_account(&account);

    assert_eq!(mapped.account_type, "credit");
}
