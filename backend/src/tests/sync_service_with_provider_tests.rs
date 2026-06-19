use crate::models::{
    account::Account,
    plaid::ProviderConnection,
    transaction::{ProviderTransactionsResult, Transaction},
};
use crate::providers::{
    FinancialDataProvider, MockFinancialDataProvider, ProviderCredentials, ProviderRegistry,
};
use crate::services::sync_service::SyncService;
use chrono::{NaiveDate, Utc};
use std::sync::Arc;
use uuid::Uuid;

fn build_provider_mock(
    accounts: Vec<Account>,
    transactions: Vec<Transaction>,
) -> Arc<dyn FinancialDataProvider> {
    let mut provider = MockFinancialDataProvider::new();
    provider
        .expect_provider_name()
        .return_const("mock".to_string());
    provider
        .expect_create_link_token()
        .returning(|_| Ok("mock_link_token".to_string()));
    provider.expect_exchange_public_token().returning(|_| {
        Ok(crate::providers::ProviderCredentials {
            provider: "mock".to_string(),
            access_token: "mock_access_token".to_string(),
            item_id: "mock_item_id".to_string(),
            certificate: None,
            private_key: None,
        })
    });
    provider.expect_get_accounts().returning(move |_| {
        let accounts = accounts.clone();
        Ok(accounts)
    });
    provider
        .expect_get_transactions()
        .returning(move |_, _, _| {
            let transactions = transactions.clone();
            Ok(ProviderTransactionsResult {
                transactions,
                page_count: 1,
            })
        });
    provider.expect_get_institution_info().returning(|_| {
        Ok(crate::providers::InstitutionInfo {
            institution_id: "mock_inst".to_string(),
            name: "Mock Bank".to_string(),
            logo: None,
            color: None,
        })
    });

    Arc::new(provider)
}

#[tokio::test]
async fn given_sync_service_with_provider_when_sync_then_maps_accounts_correctly() {
    let account_id = Uuid::new_v4();
    let provider_account_id = "plaid_acc_123".to_string();

    let accounts = vec![Account {
        id: account_id,
        user_id: Some(Uuid::new_v4()),
        provider_account_id: Some(provider_account_id.clone()),
        provider_connection_id: None,
        name: "Test Account".to_string(),
        account_type: "checking".to_string(),
        balance_current: None,
        mask: None,
        institution_name: None,
        provider_conn_id: None,
    }];

    let transaction = Transaction {
        id: Uuid::new_v4(),
        account_id: Uuid::new_v4(),
        user_id: None,
        provider_account_id: Some(provider_account_id.clone()),
        provider_transaction_id: Some("txn_123".to_string()),
        amount: rust_decimal::Decimal::new(5000, 2),
        date: NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
        merchant_name: Some("Coffee Shop".to_string()),
        category_primary: "FOOD_AND_DRINK".to_string(),
        category_detailed: "FOOD_AND_DRINK_COFFEE".to_string(),
        category_confidence: "HIGH".to_string(),
        payment_channel: Some("in_store".to_string()),
        pending: false,
        created_at: Some(Utc::now()),
        original_merchant_name: None,
        normalized_merchant: None,
        normalization_source: None,
    };

    let provider = build_provider_mock(accounts.clone(), vec![transaction.clone()]);
    let registry = Arc::new(ProviderRegistry::from_providers([(
        "mock",
        Arc::clone(&provider),
    )]));
    let sync_service = SyncService::new(registry);

    let connection = ProviderConnection {
        id: Uuid::new_v4(),
        user_id: Uuid::new_v4(),
        item_id: "item_123".to_string(),
        provider: "mock".to_string(),
        is_connected: true,
        last_sync_at: None,
        connected_at: Some(Utc::now()),
        disconnected_at: None,
        institution_id: Some("inst_123".to_string()),
        institution_name: Some("Test Bank".to_string()),
        institution_logo_url: None,
        sync_cursor: None,
        transaction_count: 0,
        account_count: 0,
        created_at: Some(Utc::now()),
        updated_at: Some(Utc::now()),
    };

    let credentials = ProviderCredentials {
        provider: "mock".to_string(),
        access_token: "test_token".to_string(),
        item_id: "item_123".to_string(),
        certificate: None,
        private_key: None,
    };

    let (result_transactions, _cursor, page_count) = sync_service
        .sync_bank_connection_transactions(&credentials, &connection, &accounts, None)
        .await
        .unwrap();

    assert_eq!(result_transactions.len(), 1);
    assert_eq!(result_transactions[0].account_id, account_id);
    assert_eq!(page_count, 1);
}
