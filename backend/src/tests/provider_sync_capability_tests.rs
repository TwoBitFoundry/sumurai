use std::sync::Arc;

use crate::providers::simplefin_provider::{MockSimpleFinHttpClient, SimpleFinProvider};
use crate::providers::{DiyProvider, FinancialDataProvider, PlaidProvider};
use crate::services::plaid_service::RealPlaidClient;

#[test]
fn given_plaid_provider_when_checking_sync_support_then_reports_supported() {
    let client = Arc::new(RealPlaidClient::new_for_test(
        "http://localhost".to_string(),
    ));

    assert!(PlaidProvider::new(client).supports_transaction_sync());
}

#[test]
fn given_simplefin_provider_when_checking_sync_support_then_reports_supported() {
    let provider = SimpleFinProvider::new(Arc::new(MockSimpleFinHttpClient::new()));

    assert!(provider.supports_transaction_sync());
}

#[test]
fn given_diy_provider_when_checking_sync_support_then_reports_unsupported() {
    assert!(!DiyProvider.supports_transaction_sync());
}
