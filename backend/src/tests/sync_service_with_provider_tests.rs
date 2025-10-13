use crate::models::{account::Account, plaid::ProviderConnection, transaction::Transaction};
use crate::providers::{FinancialDataProvider, InstitutionInfo, ProviderCredentials};
use crate::services::sync_service::SyncService;
use anyhow::Result;
use async_trait::async_trait;
use chrono::{NaiveDate, Utc};
use std::sync::Arc;
use uuid::Uuid;

struct MockProvider {
    transactions: Vec<Transaction>,
    accounts: Vec<Account>,
}

#[async_trait]
impl FinancialDataProvider for MockProvider {
    fn provider_name(&self) -> &str {
        "mock"
    }

    async fn create_link_token(&self, _user_id: &Uuid) -> Result<String> {
        Ok("mock_link_token".to_string())
    }

    async fn exchange_public_token(&self, _public_token: &str) -> Result<ProviderCredentials> {
        Ok(ProviderCredentials {
            provider: "mock".to_string(),
            access_token: "mock_access_token".to_string(),
            item_id: "mock_item_id".to_string(),
            certificate: None,
            private_key: None,
        })
    }

    async fn get_accounts(&self, _credentials: &ProviderCredentials) -> Result<Vec<Account>> {
        Ok(self.accounts.clone())
    }

    async fn get_transactions(
        &self,
        _credentials: &ProviderCredentials,
        _start_date: NaiveDate,
        _end_date: NaiveDate,
    ) -> Result<Vec<Transaction>> {
        Ok(self.transactions.clone())
    }

    async fn get_institution_info(
        &self,
        _credentials: &ProviderCredentials,
    ) -> Result<InstitutionInfo> {
        Ok(InstitutionInfo {
            institution_id: "mock_inst".to_string(),
            name: "Mock Bank".to_string(),
            logo: None,
            color: None,
        })
    }
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
    }];

    let mut transaction = Transaction {
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
    };

    let provider = Arc::new(MockProvider {
        transactions: vec![transaction.clone()],
        accounts: accounts.clone(),
    });

    let sync_service = SyncService::new(provider);

    let connection = ProviderConnection {
        id: Uuid::new_v4(),
        user_id: Uuid::new_v4(),
        item_id: "item_123".to_string(),
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

    let (result_transactions, _cursor) = sync_service
        .sync_bank_connection_transactions(&credentials, &connection, &accounts)
        .await
        .unwrap();

    assert_eq!(result_transactions.len(), 1);
    assert_eq!(result_transactions[0].account_id, account_id);
}
