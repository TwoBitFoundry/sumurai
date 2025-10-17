use chrono::{NaiveDate, Utc};
use rust_decimal_macros::dec;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::{auth::User, transaction::Transaction};
use crate::providers::ProviderRegistry;

use crate::services::{
    analytics_service::AnalyticsService,
    auth_service::AuthService,
    budget_service::BudgetService,
    cache_service::{CacheService, MockCacheService},
    connection_service::ConnectionService,
    plaid_service::{PlaidService, RealPlaidClient},
    repository_service::DatabaseRepository,
    repository_service::MockDatabaseRepository,
    sync_service::SyncService,
};

use crate::{create_app, AppState, Config, Router};

use axum::{
    body::Body,
    http::{
        header::{AUTHORIZATION, CONTENT_TYPE},
        Method, Request,
    },
};

pub struct TestFixtures;

impl TestFixtures {
    pub fn sample_transactions() -> Vec<Transaction> {
        let account_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        let user_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap();

        vec![
            Transaction {
                id: Uuid::parse_str("550e8400-e29b-41d4-a716-446655440010").unwrap(),
                account_id,
                user_id: Some(user_id),
                provider_account_id: None,
                provider_transaction_id: Some("mock_txn_001".to_string()),
                amount: dec!(-45.67),
                date: NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
                merchant_name: Some("Starbucks Coffee".to_string()),
                category_primary: "Food and Drink".to_string(),
                category_detailed: "Coffee Shop".to_string(),
                category_confidence: "HIGH".to_string(),
                payment_channel: Some("in_store".to_string()),
                pending: false,
                created_at: Some(Utc::now()),
            },
            Transaction {
                id: Uuid::parse_str("550e8400-e29b-41d4-a716-446655440011").unwrap(),
                account_id,
                user_id: Some(user_id),
                provider_account_id: None,
                provider_transaction_id: Some("mock_txn_002".to_string()),
                amount: dec!(-123.45),
                date: NaiveDate::from_ymd_opt(2024, 1, 14).unwrap(),
                merchant_name: Some("Whole Foods Market".to_string()),
                category_primary: "Food and Drink".to_string(),
                category_detailed: "Groceries".to_string(),
                category_confidence: "HIGH".to_string(),
                payment_channel: Some("in_store".to_string()),
                pending: false,
                created_at: Some(Utc::now()),
            },
            Transaction {
                id: Uuid::parse_str("550e8400-e29b-41d4-a716-446655440012").unwrap(),
                account_id,
                user_id: Some(user_id),
                provider_account_id: None,
                provider_transaction_id: Some("mock_txn_003".to_string()),
                amount: dec!(2500.00),
                date: NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
                merchant_name: Some("Employer Direct Deposit".to_string()),
                category_primary: "Deposit".to_string(),
                category_detailed: "Payroll".to_string(),
                category_confidence: "HIGH".to_string(),
                payment_channel: Some("ach".to_string()),
                pending: false,
                created_at: Some(Utc::now()),
            },
        ]
    }

    pub fn empty_transactions() -> Vec<Transaction> {
        vec![]
    }

    pub fn duplicate_test_transactions() -> (Vec<Transaction>, Vec<Transaction>) {
        let account_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        let user_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap();

        let existing = vec![Transaction {
            id: Uuid::parse_str("550e8400-e29b-41d4-a716-446655440020").unwrap(),
            account_id,
            user_id: Some(user_id),
            provider_account_id: None,
            provider_transaction_id: Some("duplicate_txn_001".to_string()),
            amount: dec!(-25.00),
            date: NaiveDate::from_ymd_opt(2024, 1, 10).unwrap(),
            merchant_name: Some("Coffee Shop".to_string()),
            category_primary: "Food and Drink".to_string(),
            category_detailed: "Coffee".to_string(),
            category_confidence: "HIGH".to_string(),
            payment_channel: Some("in_store".to_string()),
            pending: false,
            created_at: Some(Utc::now()),
        }];

        let new_with_duplicate = vec![
            Transaction {
                id: Uuid::parse_str("550e8400-e29b-41d4-a716-446655440021").unwrap(),
                account_id,
                user_id: Some(user_id),
                provider_account_id: None,
                provider_transaction_id: Some("duplicate_txn_001".to_string()),
                amount: dec!(-25.00),
                date: NaiveDate::from_ymd_opt(2024, 1, 10).unwrap(),
                merchant_name: Some("Coffee Shop".to_string()),
                category_primary: "Food and Drink".to_string(),
                category_detailed: "Coffee".to_string(),
                category_confidence: "HIGH".to_string(),
                payment_channel: Some("in_store".to_string()),
                pending: false,
                created_at: Some(Utc::now()),
            },
            Transaction {
                id: Uuid::parse_str("550e8400-e29b-41d4-a716-446655440022").unwrap(),
                account_id,
                user_id: Some(user_id),
                provider_account_id: None,
                provider_transaction_id: Some("new_txn_001".to_string()),
                amount: dec!(-50.00),
                date: NaiveDate::from_ymd_opt(2024, 1, 11).unwrap(),
                merchant_name: Some("Gas Station".to_string()),
                category_primary: "Transportation".to_string(),
                category_detailed: "Gas Stations".to_string(),
                category_confidence: "HIGH".to_string(),
                payment_channel: Some("in_store".to_string()),
                pending: false,
                created_at: Some(Utc::now()),
            },
        ];

        (existing, new_with_duplicate)
    }

    pub async fn create_test_app() -> Result<Router, anyhow::Error> {
        let plaid_client = Arc::new(RealPlaidClient::new(
            "test_client_id".to_string(),
            "test_secret".to_string(),
            "sandbox".to_string(),
        ));
        let plaid_service = Arc::new(PlaidService::new(plaid_client.clone()));
        let plaid_service_arc = plaid_service.clone();
        let plaid_client_arc = plaid_client.clone();
        let plaid_provider: Arc<dyn crate::providers::FinancialDataProvider> =
            Arc::new(crate::providers::PlaidProvider::new(plaid_client.clone()));
        let provider_registry = Arc::new(ProviderRegistry::from_providers([(
            "plaid",
            Arc::clone(&plaid_provider),
        )]));
        let sync_service = Arc::new(SyncService::new(provider_registry.clone(), "plaid"));
        let analytics_service = Arc::new(AnalyticsService::new());

        let mut mock_db = MockDatabaseRepository::new();

        mock_db
            .expect_get_all_provider_connections_by_user()
            .returning(|_| Box::pin(async { Ok(vec![]) }));

        mock_db
            .expect_get_transactions_for_user()
            .returning(|_| Box::pin(async { Ok(vec![]) }));

        mock_db
            .expect_get_budgets_for_user()
            .returning(|_| Box::pin(async { Ok(vec![]) }));

        mock_db
            .expect_get_latest_account_balances_for_user()
            .returning(|_| Box::pin(async { Ok(vec![]) }));

        let db_repository: Arc<dyn DatabaseRepository> = Arc::new(mock_db);

        let mut mock_cache = MockCacheService::new();
        mock_cache
            .expect_health_check()
            .returning(|| Box::pin(async { Ok(()) }));

        mock_cache
            .expect_is_session_valid()
            .returning(|_| Box::pin(async { Ok(true) }));

        mock_cache
            .expect_get_string()
            .returning(|_| Box::pin(async { Ok(None) }));

        mock_cache
            .expect_set_with_ttl()
            .returning(|_, _, _| Box::pin(async { Ok(()) }));

        mock_cache
            .expect_invalidate_pattern()
            .returning(|_| Box::pin(async { Ok(()) }));

        let cache_service: Arc<dyn CacheService> = Arc::new(mock_cache);

        let connection_service = Arc::new(ConnectionService::new(
            db_repository.clone(),
            cache_service.clone(),
            provider_registry.clone(),
        ));

        let auth_service = Arc::new(
            AuthService::new("test_jwt_secret_key_for_integration_testing".to_string()).unwrap(),
        );
        let budget_service = Arc::new(BudgetService::new());
        let config = Config::from_env().ok().unwrap_or_else(|| {
            Config::from_env_provider(&crate::config::SystemEnvironment).unwrap()
        });

        let state = AppState {
            plaid_service: plaid_service_arc,
            plaid_client: plaid_client_arc,
            sync_service,
            analytics_service,
            budget_service,
            config,
            db_repository,
            cache_service,
            connection_service,
            auth_service,
            provider_registry,
        };

        Ok(create_app(state))
    }

    pub async fn create_test_app_with_db(
        mock_db: MockDatabaseRepository,
    ) -> Result<Router, anyhow::Error> {
        let plaid_client = Arc::new(RealPlaidClient::new(
            "test_client_id".to_string(),
            "test_secret".to_string(),
            "sandbox".to_string(),
        ));
        let plaid_service = Arc::new(PlaidService::new(plaid_client.clone()));
        let plaid_service_arc = plaid_service.clone();
        let plaid_client_arc = plaid_client.clone();
        let plaid_provider: Arc<dyn crate::providers::FinancialDataProvider> =
            Arc::new(crate::providers::PlaidProvider::new(plaid_client.clone()));
        let provider_registry = Arc::new(ProviderRegistry::from_providers([(
            "plaid",
            Arc::clone(&plaid_provider),
        )]));
        let sync_service = Arc::new(SyncService::new(provider_registry.clone(), "plaid"));
        let analytics_service = Arc::new(AnalyticsService::new());

        let db_repository: Arc<dyn DatabaseRepository> = Arc::new(mock_db);

        let mut mock_cache = MockCacheService::new();

        mock_cache
            .expect_health_check()
            .returning(|| Box::pin(async { Ok(()) }));

        mock_cache
            .expect_is_session_valid()
            .returning(|_| Box::pin(async { Ok(true) }));

        mock_cache
            .expect_get_string()
            .returning(|_| Box::pin(async { Ok(None) }));

        mock_cache
            .expect_set_with_ttl()
            .returning(|_, _, _| Box::pin(async { Ok(()) }));

        mock_cache
            .expect_invalidate_pattern()
            .returning(|_| Box::pin(async { Ok(()) }));

        let cache_service: Arc<dyn CacheService> = Arc::new(mock_cache);

        let connection_service = Arc::new(ConnectionService::new(
            db_repository.clone(),
            cache_service.clone(),
            provider_registry.clone(),
        ));

        let auth_service = Arc::new(
            AuthService::new("test_jwt_secret_key_for_integration_testing".to_string()).unwrap(),
        );

        let budget_service = Arc::new(BudgetService::new());
        let config = Config::from_env().ok().unwrap_or_else(|| {
            Config::from_env_provider(&crate::config::SystemEnvironment).unwrap()
        });

        let state = AppState {
            plaid_service: plaid_service_arc,
            plaid_client: plaid_client_arc,
            sync_service,
            analytics_service,
            budget_service,
            config,
            db_repository,
            cache_service,
            connection_service,
            auth_service,
            provider_registry,
        };

        Ok(create_app(state))
    }

    pub async fn create_test_app_with_db_and_cache(
        mock_db: MockDatabaseRepository,
        mock_cache: MockCacheService,
    ) -> Result<Router, anyhow::Error> {
        let plaid_client = Arc::new(RealPlaidClient::new(
            "test_client_id".to_string(),
            "test_secret".to_string(),
            "sandbox".to_string(),
        ));
        let plaid_service = Arc::new(PlaidService::new(plaid_client.clone()));
        let plaid_service_arc = plaid_service.clone();
        let plaid_client_arc = plaid_client.clone();
        let plaid_provider: Arc<dyn crate::providers::FinancialDataProvider> =
            Arc::new(crate::providers::PlaidProvider::new(plaid_client.clone()));
        let provider_registry = Arc::new(ProviderRegistry::from_providers([(
            "plaid",
            Arc::clone(&plaid_provider),
        )]));
        let sync_service = Arc::new(SyncService::new(provider_registry.clone(), "plaid"));
        let analytics_service = Arc::new(AnalyticsService::new());

        let db_repository: Arc<dyn DatabaseRepository> = Arc::new(mock_db);
        let cache_service: Arc<dyn CacheService> = Arc::new(mock_cache);

        let connection_service = Arc::new(ConnectionService::new(
            db_repository.clone(),
            cache_service.clone(),
            provider_registry.clone(),
        ));

        let auth_service = Arc::new(
            AuthService::new("test_jwt_secret_key_for_integration_testing".to_string()).unwrap(),
        );

        let budget_service = Arc::new(BudgetService::new());
        let config = Config::from_env().ok().unwrap_or_else(|| {
            Config::from_env_provider(&crate::config::SystemEnvironment).unwrap()
        });

        let state = AppState {
            plaid_service: plaid_service_arc,
            plaid_client: plaid_client_arc,
            sync_service,
            analytics_service,
            budget_service,
            config,
            db_repository,
            cache_service,
            connection_service,
            auth_service,
            provider_registry,
        };

        Ok(create_app(state))
    }

    pub fn create_authenticated_user_with_token() -> (User, String) {
        let auth_service =
            AuthService::new("test_jwt_secret_key_for_integration_testing".to_string()).unwrap();
        let user_id = Uuid::new_v4();
        let user = User {
            id: user_id,
            email: format!("test-{}@example.com", user_id),
            password_hash: auth_service.hash_password("SecurePass123!").unwrap(),
            provider: "teller".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            onboarding_completed: false,
        };

        let auth_token = auth_service.generate_token(user_id).unwrap();
        (user, auth_token.token)
    }

    pub fn create_authenticated_request(method: Method, uri: &str, token: &str) -> Request<Body> {
        Request::builder()
            .method(method)
            .uri(uri)
            .header(AUTHORIZATION, format!("Bearer {}", token))
            .header(CONTENT_TYPE, "application/json")
            .body(Body::empty())
            .unwrap()
    }

    pub fn create_unauthenticated_request(method: Method, uri: &str) -> Request<Body> {
        Request::builder()
            .method(method)
            .uri(uri)
            .body(Body::empty())
            .unwrap()
    }

    pub fn create_authenticated_get_request(uri: &str, token: &str) -> Request<Body> {
        Self::create_authenticated_request(Method::GET, uri, token)
    }

    pub fn create_get_request(uri: &str) -> Request<Body> {
        Self::create_unauthenticated_request(Method::GET, uri)
    }

    pub fn create_authenticated_post_request<T: serde::Serialize>(
        uri: &str,
        token: &str,
        body: T,
    ) -> Request<Body> {
        let body_json = serde_json::to_string(&body).unwrap();
        Request::builder()
            .method(Method::POST)
            .uri(uri)
            .header(AUTHORIZATION, format!("Bearer {}", token))
            .header(CONTENT_TYPE, "application/json")
            .body(Body::from(body_json))
            .unwrap()
    }

    pub fn budget_payload_create_groceries_200() -> &'static str {
        r#"{"category":"Groceries","amount":"200.00"}"#
    }

    pub fn budget_payload_create_groceries_100() -> &'static str {
        r#"{"category":"Groceries","amount":"100.00"}"#
    }

    pub fn budget_payload_create_groceries_0() -> &'static str {
        r#"{"category":"Groceries","amount":"0"}"#
    }

    pub fn budget_payload_create_rent_1200() -> &'static str {
        r#"{"category":"Rent","amount":"1200.00"}"#
    }

    pub fn teller_account_test_checking() -> &'static str {
        r#"{"id":"acc_test_123","name":"Test Checking Account","type":"depository","subtype":"checking","last_four":"9876","status":"open","currency":"USD","institution":{"id":"test_bank","name":"Test Bank"}}"#
    }

    pub fn teller_account_minimal() -> &'static str {
        r#"{"id":"acc_456","institution":{}}"#
    }

    pub fn teller_account_my_checking() -> &'static str {
        r#"{"id":"acc_123","name":"My Checking","type":"depository","subtype":"checking","last_four":"1234","status":"open","currency":"USD","institution":{"id":"chase","name":"Chase"}}"#
    }

    pub fn teller_account_my_savings() -> &'static str {
        r#"{"id":"acc_456","name":"My Savings","type":"depository","subtype":"savings","last_four":"5678","status":"open","currency":"USD","institution":{"id":"chase","name":"Chase"}}"#
    }

    pub fn teller_account_chase_bank() -> &'static str {
        r#"{"id":"acc_123","name":"My Checking","type":"depository","subtype":"checking","last_four":"1234","status":"open","currency":"USD","institution":{"id":"chase","name":"Chase Bank"}}"#
    }

    pub fn teller_balance_primary() -> &'static str {
        r#"{"ledger":"1234.56","available":"1000.00"}"#
    }

    pub fn teller_balance_secondary() -> &'static str {
        r#"{"ledger":"5678.90","available":"5678.90"}"#
    }

    pub fn teller_transaction_starbucks() -> &'static str {
        r#"{"id":"txn_1","date":"2024-01-15","amount":"-89.40","description":"Starbucks","status":"posted","details":{"category":"general","counterparty":{"type":"merchant","name":"Starbucks"}}}"#
    }

    pub fn teller_transaction_walmart() -> &'static str {
        r#"{"id":"txn_2","date":"2023-12-20","amount":"-150.00","description":"Walmart","status":"posted","details":{"category":"general"}}"#
    }

    pub fn teller_transaction_gas_station() -> &'static str {
        r#"{"id":"txn_3","date":"2024-01-20","amount":"-45.00","description":"Gas Station","status":"posted","details":{"category":"service"}}"#
    }

    pub fn teller_transaction_coffee_shop() -> &'static str {
        r#"{"id":"txn_test_123","date":"2024-01-15","amount":"-89.40","description":"Coffee Shop","status":"posted","details":{"category":"general","counterparty":{"type":"merchant","name":"Starbucks"}}}"#
    }

    pub fn teller_transaction_deposit() -> &'static str {
        r#"{"id":"txn_deposit","date":"2024-01-20","amount":"1500.00","description":"Paycheck","status":"posted","details":{"category":"service"}}"#
    }

    pub fn teller_transaction_service_category() -> &'static str {
        r#"{"id":"txn_service","date":"2024-01-10","amount":"-45.00","description":"Haircut","status":"posted","details":{"category":"service"}}"#
    }

    pub fn teller_transaction_unknown_category() -> &'static str {
        r#"{"id":"txn_unknown","date":"2024-01-05","amount":"-25.00","description":"Unknown","status":"posted","details":{"category":"some_unknown_category"}}"#
    }

    pub fn teller_transaction_pending_purchase() -> &'static str {
        r#"{"id":"txn_pending","date":"2024-01-25","amount":"-100.00","description":"Pending Purchase","status":"pending","details":{"category":"general"}}"#
    }

    pub fn teller_transaction_generic_store() -> &'static str {
        r#"{"id":"txn_no_counterparty","date":"2024-01-12","amount":"-75.00","description":"Generic Store","status":"posted","details":{"category":"general"}}"#
    }

    pub fn teller_transaction_invalid_date() -> &'static str {
        r#"{"id":"txn_bad_date","date":"invalid-date","amount":"-50.00","description":"Test","status":"posted","details":{"category":"general"}}"#
    }

    pub fn teller_transaction_zero_amount() -> &'static str {
        r#"{"id":"txn_zero","date":"2024-01-15","amount":"0.00","description":"Fee Reversal","status":"posted","details":{"category":"general"}}"#
    }

    pub fn plaid_transaction_with_category_json() -> &'static str {
        r#"{"transaction_id":"test_txn_123","account_id":"test_acc_456","amount":15.5,"date":"2025-09-10","name":"Starbucks Coffee","personal_finance_category":{"primary":"FOOD_AND_DRINK","detailed":"FOOD_AND_DRINK_RESTAURANTS","confidence_level":"VERY_HIGH"},"payment_channel":"in_store","pending":false}"#
    }

    pub fn plaid_transaction_minimal_json() -> &'static str {
        r#"{"transaction_id":"test_txn_minimal","account_id":"test_acc_minimal","amount":25.0,"date":"2025-09-10","name":"Unknown Merchant"}"#
    }
}
