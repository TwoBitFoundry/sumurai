use chrono::{NaiveDate, Utc};
use rust_decimal_macros::dec;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::{auth::User, transaction::Transaction};

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
        let plaid_provider = Arc::new(crate::providers::PlaidProvider::new(plaid_client.clone()));
        let sync_service = Arc::new(SyncService::new(plaid_provider.clone()));
        let analytics_service = Arc::new(AnalyticsService::new());
        let config = Config::default();

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
        ));

        let auth_service = Arc::new(
            AuthService::new("test_jwt_secret_key_for_integration_testing".to_string()).unwrap(),
        );
        let budget_service = Arc::new(BudgetService::new());

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
        let plaid_provider = Arc::new(crate::providers::PlaidProvider::new(plaid_client.clone()));
        let sync_service = Arc::new(SyncService::new(plaid_provider.clone()));
        let analytics_service = Arc::new(AnalyticsService::new());
        let config = Config::default();

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
        ));

        let auth_service = Arc::new(
            AuthService::new("test_jwt_secret_key_for_integration_testing".to_string()).unwrap(),
        );

        let budget_service = Arc::new(BudgetService::new());

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
        let plaid_provider = Arc::new(crate::providers::PlaidProvider::new(plaid_client.clone()));
        let sync_service = Arc::new(SyncService::new(plaid_provider.clone()));
        let analytics_service = Arc::new(AnalyticsService::new());
        let config = Config::default();

        let db_repository: Arc<dyn DatabaseRepository> = Arc::new(mock_db);
        let cache_service: Arc<dyn CacheService> = Arc::new(mock_cache);

        let connection_service = Arc::new(ConnectionService::new(
            db_repository.clone(),
            cache_service.clone(),
        ));

        let auth_service = Arc::new(
            AuthService::new("test_jwt_secret_key_for_integration_testing".to_string()).unwrap(),
        );

        let budget_service = Arc::new(BudgetService::new());

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
}
