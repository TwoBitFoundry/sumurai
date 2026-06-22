use crate::test_fixtures::TestFixtures;
use tower::ServiceExt;

#[tokio::test]
async fn given_valid_user_when_authentication_flow_then_returns_jwt() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();

    let auth_service = crate::services::auth_service::AuthService::new(
        "test_jwt_secret_key_for_integration_testing".to_string(),
    )
    .unwrap();
    let claims = auth_service.validate_token(&token).unwrap();

    assert_eq!(claims.user_id(), user.id.to_string());
}

#[tokio::test]
async fn given_test_app_when_health_check_then_returns_ok() {
    let app = TestFixtures::create_test_app().await.unwrap();

    let request = TestFixtures::create_get_request("/health");
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn given_authenticated_user_when_get_connection_status_then_returns_array() {
    use crate::models::plaid::{ProviderConnection, ProviderStatusResponse};
    use crate::services::repository_service::MockDatabaseRepository;
    use axum::body::to_bytes;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;

    let mut conn1 = ProviderConnection::new(user_id, "item_1");
    conn1.provider = "plaid".to_string();
    conn1.mark_connected("Bank A");
    let mut conn2 = ProviderConnection::new(user_id, "item_2");
    conn2.provider = "plaid".to_string();
    conn2.mark_connected("Bank B");

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(move |_| {
            let c1 = conn1.clone();
            let c2 = conn2.clone();
            Box::pin(async move { Ok(vec![c1, c2]) })
        });

    mock_db
        .expect_get_transactions_with_account_for_user()
        .returning(move |_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_transactions_for_user()
        .returning(move |_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_accounts_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let user_clone = user.clone();
    mock_db.expect_get_user_by_id().returning(move |_| {
        let user = user_clone.clone();
        Box::pin(async move { Ok(Some(user)) })
    });

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request("/api/providers/status", &token);
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let statuses: ProviderStatusResponse = serde_json::from_slice(&body).unwrap();

    assert!(statuses.provider.is_empty());
    assert_eq!(statuses.connections.len(), 2);
    assert_eq!(statuses.connections[0].provider, "plaid".to_string());
    assert_eq!(
        statuses.connections[0].institution_name,
        Some("Bank A".to_string())
    );
    assert_eq!(statuses.connections[1].provider, "plaid".to_string());
    assert_eq!(
        statuses.connections[1].institution_name,
        Some("Bank B".to_string())
    );
}

#[tokio::test]
async fn given_no_auth_token_when_protected_endpoint_then_returns_unauthorized() {
    let app = TestFixtures::create_test_app().await.unwrap();

    let request = TestFixtures::create_get_request("/api/providers/status");
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), 401);
}

#[tokio::test]
async fn given_authenticated_user_when_get_transactions_no_filter_then_returns_keyset_response() {
    use crate::models::transaction::CursorTransactionsResponse;
    use crate::services::repository_service::MockDatabaseRepository;
    use axum::body::to_bytes;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();

    mock_db.expect_get_user_by_id().returning(move |_| {
        let u = user.clone();
        Box::pin(async move { Ok(Some(u)) })
    });

    mock_db.expect_get_transactions_keyset().returning(
        move |_, limit, cursor, search, _, start_date, end_date, category, merchant| {
            assert_eq!(limit, 40);
            assert!(cursor.is_none());
            assert!(search.is_none());
            assert!(start_date.is_none());
            assert!(end_date.is_none());
            assert!(category.is_none());
            assert!(merchant.is_none());
            Box::pin(async {
                Ok(CursorTransactionsResponse {
                    transactions: vec![],
                    next_cursor: None,
                    prev_cursor: None,
                    has_more: false,
                })
            })
        },
    );

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request("/api/transactions", &token);
    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: CursorTransactionsResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload.transactions.len(), 0);
    assert!(!payload.has_more);
    assert!(payload.next_cursor.is_none());
}

#[tokio::test]
async fn given_authenticated_user_when_get_transactions_with_account_ids_then_returns_filtered_transactions(
) {
    use crate::models::plaid::ProviderConnection;
    use crate::models::transaction::{CursorTransactionsResponse, TransactionWithAccount};
    use crate::services::repository_service::MockDatabaseRepository;
    use axum::body::to_bytes;
    use chrono::NaiveDate;
    use rust_decimal_macros::dec;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();

    let account_id_1 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap();
    let account_id_2 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440002").unwrap();
    let user_id = user.id;
    let mut provider_connection = ProviderConnection::new(user_id, "item_1");
    provider_connection.provider = user.provider.clone();
    let provider_connection_id = provider_connection.id;

    let user_clone = user.clone();
    mock_db.expect_get_user_by_id().returning(move |_| {
        let user = user_clone.clone();
        Box::pin(async move { Ok(Some(user)) })
    });

    mock_db.expect_get_accounts_for_user().returning(move |_| {
        use crate::models::account::Account;
        let accounts = vec![
            Account {
                id: account_id_1,
                user_id: Some(user_id),
                provider_account_id: Some("plaid_acc_1".to_string()),
                provider_connection_id: Some(provider_connection_id),
                name: "Test Account 1".to_string(),
                account_type: "checking".to_string(),
                balance_current: Some(rust_decimal_macros::dec!(1000.00)),
                mask: Some("0001".to_string()),
                institution_name: Some("Test Bank".to_string()),
                provider_conn_id: None,
            },
            Account {
                id: account_id_2,
                user_id: Some(user_id),
                provider_account_id: Some("plaid_acc_2".to_string()),
                provider_connection_id: Some(provider_connection_id),
                name: "Test Account 2".to_string(),
                account_type: "savings".to_string(),
                balance_current: Some(rust_decimal_macros::dec!(5000.00)),
                mask: Some("0002".to_string()),
                institution_name: Some("Test Bank".to_string()),
                provider_conn_id: None,
            },
        ];
        Box::pin(async move { Ok(accounts) })
    });

    mock_db.expect_get_transactions_keyset().returning(
        move |_, limit, cursor, search, account_ids, start_date, end_date, category, merchant| {
            assert_eq!(limit, 40);
            assert!(cursor.is_none());
            assert!(search.is_none());
            assert!(start_date.is_none());
            assert!(end_date.is_none());
            assert!(category.is_none());
            assert!(merchant.is_none());
            assert_eq!(account_ids.map(|ids| ids.len()), Some(1));
            Box::pin(async move {
                Ok(CursorTransactionsResponse {
                    transactions: vec![TransactionWithAccount {
                        id: Uuid::new_v4(),
                        account_id: account_id_1,
                        user_id: Some(user_id),
                        provider_account_id: None,
                        provider_transaction_id: Some("txn_001".to_string()),
                        amount: dec!(-50.00),
                        date: NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
                        merchant_name: Some("Test Merchant".to_string()),
                        category_primary: "Food and Drink".to_string(),
                        category_detailed: "Restaurant".to_string(),
                        category_confidence: "HIGH".to_string(),
                        payment_channel: Some("in_store".to_string()),
                        pending: false,
                        created_at: Some(chrono::Utc::now()),
                        account_name: "Test Account 1".to_string(),
                        account_type: "checking".to_string(),
                        account_mask: Some("0001".to_string()),
                        is_custom: false,
                        is_overridden: false,
                        original_merchant_name: None,
                        normalized_merchant: None,
                        normalization_source: None,
                    }],
                    next_cursor: None,
                    prev_cursor: None,
                    has_more: false,
                })
            })
        },
    );

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(move |_| {
            let provider_connection = provider_connection.clone();
            Box::pin(async move { Ok(vec![provider_connection]) })
        });

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        &format!("/api/transactions?account_ids={}", account_id_1),
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: CursorTransactionsResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload.transactions.len(), 1);
}

#[tokio::test]
async fn given_authenticated_user_when_get_transactions_with_foreign_account_ids_then_returns_403()
{
    use crate::services::repository_service::MockDatabaseRepository;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let foreign_account_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440999").unwrap();

    mock_db
        .expect_get_accounts_for_user()
        .returning(move |_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        &format!("/api/transactions?account_ids={}", foreign_account_id),
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 403);
}

#[tokio::test]
async fn given_authenticated_user_when_get_transactions_with_cursor_then_sends_cursor_to_service() {
    use crate::models::transaction::CursorTransactionsResponse;
    use crate::services::repository_service::MockDatabaseRepository;
    use axum::body::to_bytes;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();

    mock_db.expect_get_user_by_id().returning(move |_| {
        let u = user.clone();
        Box::pin(async move { Ok(Some(u)) })
    });

    mock_db.expect_get_transactions_keyset().returning(
        move |_, limit, cursor, search, _, start_date, end_date, category, merchant| {
            assert_eq!(limit, 10);
            assert!(cursor.is_some());
            assert!(search.is_none());
            assert!(start_date.is_none());
            assert!(end_date.is_none());
            assert!(category.is_none());
            assert!(merchant.is_none());
            Box::pin(async {
                Ok(CursorTransactionsResponse {
                    transactions: vec![],
                    next_cursor: None,
                    prev_cursor: None,
                    has_more: false,
                })
            })
        },
    );

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    use base64::Engine;
    let cursor = base64::engine::general_purpose::STANDARD
        .encode("2024-01-15:550e8400-e29b-41d4-a716-446655440001");
    let request = TestFixtures::create_authenticated_get_request(
        &format!("/api/transactions?limit=10&cursor={}", cursor),
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: CursorTransactionsResponse = serde_json::from_slice(&body).unwrap();
    assert!(!payload.has_more);
}

#[tokio::test]
async fn given_authenticated_user_when_get_transactions_limit_over_max_then_clamps_to_100() {
    use crate::models::transaction::CursorTransactionsResponse;
    use crate::services::repository_service::MockDatabaseRepository;
    use axum::body::to_bytes;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();

    mock_db.expect_get_user_by_id().returning(move |_| {
        let u = user.clone();
        Box::pin(async move { Ok(Some(u)) })
    });

    mock_db.expect_get_transactions_keyset().returning(
        move |_, limit, _cursor, _search, _, _start_date, _end_date, _category, _merchant| {
            assert_eq!(limit, 100);
            Box::pin(async {
                Ok(CursorTransactionsResponse {
                    transactions: vec![],
                    next_cursor: None,
                    prev_cursor: None,
                    has_more: false,
                })
            })
        },
    );

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request =
        TestFixtures::create_authenticated_get_request("/api/transactions?limit=999", &token);

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: CursorTransactionsResponse = serde_json::from_slice(&body).unwrap();
    assert!(!payload.has_more);
}

#[tokio::test]
async fn given_authenticated_user_when_get_transaction_categories_then_returns_sorted_categories() {
    use crate::services::repository_service::MockDatabaseRepository;
    use axum::body::to_bytes;

    let mut mock_db = MockDatabaseRepository::new();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    mock_db
        .expect_get_distinct_transaction_categories()
        .returning(move |_| {
            Box::pin(async {
                Ok(vec![
                    "FOOD_AND_DRINK".to_string(),
                    "TRANSPORTATION".to_string(),
                ])
            })
        });

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request =
        TestFixtures::create_authenticated_get_request("/api/transactions/categories", &token);

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let categories: Vec<String> = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        categories,
        vec!["FOOD_AND_DRINK".to_string(), "TRANSPORTATION".to_string()]
    );
}

#[tokio::test]
async fn given_authenticated_user_when_get_transactions_with_invalid_account_ids_then_returns_400()
{
    let app = TestFixtures::create_test_app().await.unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let request = TestFixtures::create_authenticated_get_request(
        "/api/transactions?account_ids=not-a-uuid",
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 400);
}

#[tokio::test]
async fn given_authenticated_user_when_get_transaction_insights_then_returns_aggregates() {
    use crate::models::plaid::ProviderConnection;
    use crate::models::transaction::{LargestTransaction, TransactionsInsightsResponse};
    use crate::services::repository_service::MockDatabaseRepository;
    use axum::body::to_bytes;
    use chrono::NaiveDate;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();

    let account_id_1 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap();
    let account_id_2 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440002").unwrap();
    let user_id = user.id;
    let mut provider_connection = ProviderConnection::new(user_id, "item_1");
    provider_connection.provider = user.provider.clone();
    let provider_connection_id = provider_connection.id;

    let user_clone = user.clone();
    mock_db.expect_get_user_by_id().returning(move |_| {
        let user = user_clone.clone();
        Box::pin(async move { Ok(Some(user)) })
    });

    mock_db.expect_get_accounts_for_user().returning(move |_| {
        use crate::models::account::Account;
        let accounts = vec![
            Account {
                id: account_id_1,
                user_id: Some(user_id),
                provider_account_id: Some("plaid_acc_1".to_string()),
                provider_connection_id: Some(provider_connection_id),
                name: "Test Account 1".to_string(),
                account_type: "checking".to_string(),
                balance_current: Some(rust_decimal_macros::dec!(1000.00)),
                mask: Some("0001".to_string()),
                institution_name: Some("Test Bank".to_string()),
                provider_conn_id: None,
            },
            Account {
                id: account_id_2,
                user_id: Some(user_id),
                provider_account_id: Some("plaid_acc_2".to_string()),
                provider_connection_id: Some(provider_connection_id),
                name: "Test Account 2".to_string(),
                account_type: "savings".to_string(),
                balance_current: Some(rust_decimal_macros::dec!(5000.00)),
                mask: Some("0002".to_string()),
                institution_name: Some("Test Bank".to_string()),
                provider_conn_id: None,
            },
        ];
        Box::pin(async { Ok(accounts) })
    });

    mock_db.expect_get_transactions_insights().returning(
        move |_, search, account_ids, start_date, end_date, category| {
            assert_eq!(search, Some("coffee"));
            assert_eq!(account_ids.map(|ids| ids.len()), Some(1));
            assert_eq!(
                account_ids.and_then(|ids| ids.first().copied()),
                Some(account_id_1)
            );
            assert_eq!(
                start_date,
                Some(NaiveDate::from_ymd_opt(2024, 3, 1).unwrap())
            );
            assert_eq!(
                end_date,
                Some(NaiveDate::from_ymd_opt(2024, 3, 31).unwrap())
            );
            assert_eq!(category, Some("FOOD_AND_DRINK"));
            Box::pin(async move {
                Ok(TransactionsInsightsResponse {
                    total_count: 3,
                    total_spent: 60.0,
                    average_amount: 20.0,
                    largest: Some(LargestTransaction {
                        amount: 30.0,
                        merchant: "Coffee Collective".to_string(),
                    }),
                    top_categories: vec!["FOOD_AND_DRINK".to_string()],
                })
            })
        },
    );

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(move |_| {
            let provider_connection = provider_connection.clone();
            Box::pin(async move { Ok(vec![provider_connection]) })
        });

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        &format!(
            "/api/transactions/insights?search=%20coffee%20&account_ids={}&start_date=2024-03-01&end_date=2024-03-31&category_primary=FOOD_AND_DRINK",
            account_id_1
        ),
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: TransactionsInsightsResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload.total_count, 3);
    assert_eq!(payload.total_spent, 60.0);
    assert_eq!(payload.average_amount, 20.0);
    assert_eq!(
        payload.largest,
        Some(LargestTransaction {
            amount: 30.0,
            merchant: "Coffee Collective".to_string(),
        })
    );
    assert_eq!(payload.top_categories, vec!["FOOD_AND_DRINK".to_string()]);
}

#[tokio::test]
async fn given_authenticated_user_when_get_transaction_insights_with_empty_result_then_returns_zero_values(
) {
    use crate::models::transaction::{LargestTransaction, TransactionsInsightsResponse};
    use crate::services::repository_service::MockDatabaseRepository;
    use axum::body::to_bytes;
    use chrono::NaiveDate;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();

    mock_db.expect_get_user_by_id().returning(move |_| {
        let u = user.clone();
        Box::pin(async move { Ok(Some(u)) })
    });

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db.expect_get_transactions_insights().returning(
        move |_, search, _, start_date, end_date, category| {
            assert!(search.is_none());
            assert_eq!(
                start_date,
                Some(NaiveDate::from_ymd_opt(2025, 1, 1).unwrap())
            );
            assert_eq!(
                end_date,
                Some(NaiveDate::from_ymd_opt(2025, 1, 31).unwrap())
            );
            assert!(category.is_none());
            Box::pin(async move {
                Ok(TransactionsInsightsResponse {
                    total_count: 0,
                    total_spent: 0.0,
                    average_amount: 0.0,
                    largest: None::<LargestTransaction>,
                    top_categories: vec![],
                })
            })
        },
    );

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        "/api/transactions/insights?start_date=2025-01-01&end_date=2025-01-31",
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: TransactionsInsightsResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload.total_count, 0);
    assert_eq!(payload.total_spent, 0.0);
    assert_eq!(payload.average_amount, 0.0);
    assert_eq!(payload.largest, None);
    assert!(payload.top_categories.is_empty());
}

#[tokio::test]
async fn given_unauthenticated_request_when_get_transaction_insights_then_returns_401() {
    let app = TestFixtures::create_test_app().await.unwrap();

    let request = TestFixtures::create_get_request("/api/transactions/insights");
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), 401);
}

#[tokio::test]
async fn given_authenticated_user_when_get_transaction_insights_with_foreign_account_ids_then_returns_403(
) {
    use crate::models::plaid::ProviderConnection;
    use crate::services::repository_service::MockDatabaseRepository;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();

    let owned_account_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap();
    let foreign_account_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440999").unwrap();
    let user_id = user.id;
    let connection_id = Uuid::new_v4();

    mock_db.expect_get_user_by_id().returning(move |_| {
        let u = user.clone();
        Box::pin(async move { Ok(Some(u)) })
    });

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(move |_| {
            let mut connection = ProviderConnection::new(user_id, "item_1");
            connection.id = connection_id;
            connection.provider = "teller".to_string();
            connection.mark_connected("Test Bank");
            Box::pin(async move { Ok(vec![connection]) })
        });

    mock_db.expect_get_accounts_for_user().returning(move |_| {
        use crate::models::account::Account;
        let accounts = vec![Account {
            id: owned_account_id,
            user_id: Some(user_id),
            provider_account_id: Some("plaid_acc_1".to_string()),
            provider_connection_id: Some(connection_id),
            name: "Test Account 1".to_string(),
            account_type: "checking".to_string(),
            balance_current: Some(rust_decimal_macros::dec!(1000.00)),
            mask: Some("0001".to_string()),
            institution_name: Some("Test Bank".to_string()),
            provider_conn_id: None,
        }];
        Box::pin(async { Ok(accounts) })
    });

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        &format!("/api/transactions/insights?account_ids={foreign_account_id}"),
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 403);
}

#[tokio::test]
async fn given_authenticated_user_when_get_transaction_insights_with_invalid_date_range_then_returns_400(
) {
    let mut mock_db = crate::services::repository_service::MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();

    mock_db.expect_get_user_by_id().returning(move |_| {
        let u = user.clone();
        Box::pin(async move { Ok(Some(u)) })
    });
    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        "/api/transactions/insights?start_date=2024-03-31&end_date=2024-03-01",
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 400);
}

#[tokio::test]
async fn given_authenticated_user_when_get_spending_with_account_ids_then_returns_filtered_spending(
) {
    use crate::models::plaid::ProviderConnection;
    use crate::models::transaction::Transaction;
    use crate::services::repository_service::MockDatabaseRepository;
    use chrono::NaiveDate;
    use rust_decimal_macros::dec;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();

    let account_id_1 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap();
    let account_id_2 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440002").unwrap();
    let user_id = user.id;
    let mut provider_connection = ProviderConnection::new(user_id, "item_1");
    provider_connection.provider = user.provider.clone();
    let provider_connection_id = provider_connection.id;

    let user_clone = user.clone();
    mock_db.expect_get_user_by_id().returning(move |_| {
        let user = user_clone.clone();
        Box::pin(async move { Ok(Some(user)) })
    });

    mock_db.expect_get_accounts_for_user().returning(move |_| {
        use crate::models::account::Account;
        let accounts = vec![
            Account {
                id: account_id_1,
                user_id: Some(user_id),
                provider_account_id: Some("plaid_acc_1".to_string()),
                provider_connection_id: Some(provider_connection_id),
                name: "Test Account 1".to_string(),
                account_type: "checking".to_string(),
                balance_current: Some(rust_decimal_macros::dec!(1000.00)),
                mask: Some("0001".to_string()),
                institution_name: Some("Test Bank".to_string()),
                provider_conn_id: None,
            },
            Account {
                id: account_id_2,
                user_id: Some(user_id),
                provider_account_id: Some("plaid_acc_2".to_string()),
                provider_connection_id: Some(provider_connection_id),
                name: "Test Account 2".to_string(),
                account_type: "savings".to_string(),
                balance_current: Some(rust_decimal_macros::dec!(5000.00)),
                mask: Some("0002".to_string()),
                institution_name: Some("Test Bank".to_string()),
                provider_conn_id: None,
            },
        ];
        Box::pin(async { Ok(accounts) })
    });

    mock_db
        .expect_get_spending_transactions_for_user()
        .returning(move |_, _| {
            let transactions = vec![
                Transaction {
                    id: Uuid::new_v4(),
                    account_id: account_id_1,
                    user_id: Some(user_id),
                    provider_account_id: Some("plaid_acc_1".to_string()),
                    provider_transaction_id: Some("txn_001".to_string()),
                    amount: dec!(-50.00),
                    date: NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
                    merchant_name: Some("Test Merchant 1".to_string()),
                    category_primary: "FOOD_AND_DRINK".to_string(),
                    category_detailed: "Restaurant".to_string(),
                    category_confidence: "HIGH".to_string(),
                    payment_channel: Some("in_store".to_string()),
                    pending: false,
                    created_at: Some(chrono::Utc::now()),
                    original_merchant_name: None,
                    normalized_merchant: None,
                    normalization_source: None,
                },
                Transaction {
                    id: Uuid::new_v4(),
                    account_id: account_id_1,
                    user_id: Some(user_id),
                    provider_account_id: Some("plaid_acc_1".to_string()),
                    provider_transaction_id: Some("txn_002".to_string()),
                    amount: dec!(-25.00),
                    date: NaiveDate::from_ymd_opt(2024, 1, 16).unwrap(),
                    merchant_name: Some("Test Merchant 2".to_string()),
                    category_primary: "FOOD_AND_DRINK".to_string(),
                    category_detailed: "Restaurant".to_string(),
                    category_confidence: "HIGH".to_string(),
                    payment_channel: Some("in_store".to_string()),
                    pending: false,
                    created_at: Some(chrono::Utc::now()),
                    original_merchant_name: None,
                    normalized_merchant: None,
                    normalization_source: None,
                },
            ];
            Box::pin(async { Ok(transactions) })
        });

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(move |_| {
            let provider_connection = provider_connection.clone();
            Box::pin(async move { Ok(vec![provider_connection]) })
        });

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        &format!("/api/analytics/spending?account_ids={}", account_id_1),
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let total: rust_decimal::Decimal = serde_json::from_slice(&body).unwrap();
    assert_eq!(total, dec!(75.00));
}

#[tokio::test]
async fn given_authenticated_user_when_get_spending_with_foreign_account_ids_then_returns_403() {
    use crate::services::repository_service::MockDatabaseRepository;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let foreign_account_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440999").unwrap();

    mock_db
        .expect_get_accounts_for_user()
        .returning(move |_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_spending_transactions_for_user()
        .returning(move |_, _| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        &format!("/api/analytics/spending?account_ids={}", foreign_account_id),
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 403);
}

#[tokio::test]
async fn given_authenticated_user_when_get_categories_with_account_ids_then_returns_filtered_categories(
) {
    use crate::models::analytics::{CategoryAggregate, CategorySpending};
    use crate::models::plaid::ProviderConnection;
    use crate::services::repository_service::MockDatabaseRepository;
    use rust_decimal_macros::dec;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();

    let account_id_1 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap();
    let account_id_2 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440002").unwrap();
    let user_id = user.id;
    let mut provider_connection = ProviderConnection::new(user_id, "item_1");
    provider_connection.provider = user.provider.clone();
    let provider_connection_id = provider_connection.id;

    let user_clone = user.clone();
    mock_db.expect_get_user_by_id().returning(move |_| {
        let user = user_clone.clone();
        Box::pin(async move { Ok(Some(user)) })
    });

    mock_db.expect_get_accounts_for_user().returning(move |_| {
        use crate::models::account::Account;
        let accounts = vec![
            Account {
                id: account_id_1,
                user_id: Some(user_id),
                provider_account_id: Some("plaid_acc_1".to_string()),
                provider_connection_id: Some(provider_connection_id),
                name: "Test Account 1".to_string(),
                account_type: "checking".to_string(),
                balance_current: Some(rust_decimal_macros::dec!(1000.00)),
                mask: Some("0001".to_string()),
                institution_name: None,
                provider_conn_id: None,
            },
            Account {
                id: account_id_2,
                user_id: Some(user_id),
                provider_account_id: Some("plaid_acc_2".to_string()),
                provider_connection_id: Some(provider_connection_id),
                name: "Test Account 2".to_string(),
                account_type: "savings".to_string(),
                balance_current: Some(rust_decimal_macros::dec!(5000.00)),
                mask: Some("0002".to_string()),
                institution_name: None,
                provider_conn_id: None,
            },
        ];
        Box::pin(async { Ok(accounts) })
    });

    mock_db
        .expect_get_category_aggregates_for_date_range()
        .returning(move |_, _, _, _| {
            let grid = vec![
                CategoryAggregate {
                    category: "Food and Drink".to_string(),
                    income: dec!(0),
                    expense: dec!(50.00),
                    count: 1,
                },
                CategoryAggregate {
                    category: "Transportation".to_string(),
                    income: dec!(0),
                    expense: dec!(25.00),
                    count: 1,
                },
            ];
            Box::pin(async move { Ok(grid) })
        });

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(move |_| {
            let provider_connection = provider_connection.clone();
            Box::pin(async move { Ok(vec![provider_connection]) })
        });

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        &format!("/api/analytics/categories?account_ids={}", account_id_1),
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let categories: Vec<CategorySpending> = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        categories,
        vec![
            CategorySpending {
                name: "Food and Drink".to_string(),
                value: dec!(50.00),
            },
            CategorySpending {
                name: "Transportation".to_string(),
                value: dec!(25.00),
            },
        ]
    );
}

#[tokio::test]
async fn given_authenticated_user_when_get_income_expense_totals_then_returns_full_range_totals() {
    use crate::models::analytics::{CategoryAggregate, IncomeExpenseTotals};
    use crate::services::repository_service::MockDatabaseRepository;
    use rust_decimal_macros::dec;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();

    mock_db.expect_get_user_by_id().returning(move |_| {
        let u = user.clone();
        Box::pin(async move { Ok(Some(u)) })
    });
    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_category_aggregates_for_date_range()
        .returning(move |_, _, _, _| {
            let grid = vec![
                CategoryAggregate {
                    category: "INCOME".to_string(),
                    income: dec!(5000.00),
                    expense: dec!(0),
                    count: 2,
                },
                CategoryAggregate {
                    category: "FOOD_AND_DRINK".to_string(),
                    income: dec!(0),
                    expense: dec!(120.00),
                    count: 1,
                },
                CategoryAggregate {
                    category: "TRANSFER_OUT".to_string(),
                    income: dec!(0),
                    expense: dec!(200.00),
                    count: 1,
                },
            ];
            Box::pin(async move { Ok(grid) })
        });

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        "/api/analytics/income-expense-totals?start_date=2026-01-01&end_date=2026-06-15",
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let totals: IncomeExpenseTotals = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        totals,
        IncomeExpenseTotals {
            income: dec!(5000.00),
            expenses: dec!(120.00),
        }
    );
}

#[tokio::test]
async fn given_authenticated_user_when_get_budget_summary_then_returns_category_spending() {
    use crate::models::analytics::{BudgetSummary, CategoryAggregate, CategorySpending};
    use crate::services::repository_service::MockDatabaseRepository;
    use rust_decimal_macros::dec;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();

    mock_db.expect_get_user_by_id().returning(move |_| {
        let u = user.clone();
        Box::pin(async move { Ok(Some(u)) })
    });
    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_category_aggregates_for_date_range()
        .returning(move |_, _, _, _| {
            let grid = vec![
                CategoryAggregate {
                    category: "INCOME".to_string(),
                    income: dec!(5000.00),
                    expense: dec!(0),
                    count: 2,
                },
                CategoryAggregate {
                    category: "FOOD_AND_DRINK".to_string(),
                    income: dec!(0),
                    expense: dec!(420.00),
                    count: 3,
                },
                CategoryAggregate {
                    category: "TRANSFER_OUT".to_string(),
                    income: dec!(0),
                    expense: dec!(200.00),
                    count: 1,
                },
            ];
            Box::pin(async move { Ok(grid) })
        });

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        "/api/analytics/budget-summary?start_date=2026-06-01&end_date=2026-06-30",
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let summary: BudgetSummary = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        summary,
        BudgetSummary {
            income: dec!(5000.00),
            category_spending: vec![
                CategorySpending {
                    name: "FOOD_AND_DRINK".to_string(),
                    value: dec!(420.00),
                },
                CategorySpending {
                    name: "TRANSFER_OUT".to_string(),
                    value: dec!(200.00),
                },
            ],
        }
    );
}

#[tokio::test]
async fn given_authenticated_user_when_get_date_bounds_then_returns_earliest_scoped_date_and_today()
{
    use crate::models::account::Account;
    use crate::models::plaid::ProviderConnection;
    use crate::services::repository_service::MockDatabaseRepository;
    use chrono::NaiveDate;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let checking_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440021").unwrap();
    let savings_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440022").unwrap();
    let mut provider_connection = ProviderConnection::new(user_id, "item_1");
    provider_connection.provider = user.provider.clone();
    let provider_connection_id = provider_connection.id;

    let user_clone = user.clone();
    mock_db.expect_get_user_by_id().returning(move |_| {
        let user = user_clone.clone();
        Box::pin(async move { Ok(Some(user)) })
    });

    mock_db.expect_get_accounts_for_user().returning(move |_| {
        let accounts = vec![
            Account {
                id: checking_id,
                user_id: Some(user_id),
                provider_account_id: Some("plaid_acc_1".to_string()),
                provider_connection_id: Some(provider_connection_id),
                name: "Checking".to_string(),
                account_type: "checking".to_string(),
                balance_current: None,
                mask: Some("0021".to_string()),
                institution_name: None,
                provider_conn_id: None,
            },
            Account {
                id: savings_id,
                user_id: Some(user_id),
                provider_account_id: Some("plaid_acc_2".to_string()),
                provider_connection_id: Some(provider_connection_id),
                name: "Savings".to_string(),
                account_type: "savings".to_string(),
                balance_current: None,
                mask: Some("0022".to_string()),
                institution_name: None,
                provider_conn_id: None,
            },
        ];
        Box::pin(async move { Ok(accounts) })
    });

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(move |_| {
            let provider_connection = provider_connection.clone();
            Box::pin(async move { Ok(vec![provider_connection]) })
        });

    mock_db
        .expect_get_earliest_transaction_date_for_user()
        .withf(move |observed_user_id, account_ids| {
            *observed_user_id == user_id
                && account_ids
                    .map(|ids| ids.len() == 1 && ids[0] == checking_id)
                    .unwrap_or(false)
        })
        .returning(|_, _| {
            Box::pin(async move { Ok(Some(NaiveDate::from_ymd_opt(2021, 4, 9).unwrap())) })
        });

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        &format!("/api/analytics/date-bounds?account_ids={checking_id}"),
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(payload["start_date"], "2021-04-09");
    assert_eq!(
        payload["end_date"],
        chrono::Utc::now().naive_utc().date().to_string()
    );
}

#[tokio::test]
async fn given_scoped_account_without_transactions_when_get_date_bounds_then_returns_null_bounds() {
    use crate::models::account::Account;
    use crate::models::plaid::ProviderConnection;
    use crate::services::repository_service::MockDatabaseRepository;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let checking_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440031").unwrap();
    let mut provider_connection = ProviderConnection::new(user_id, "item_1");
    provider_connection.provider = user.provider.clone();
    let provider_connection_id = provider_connection.id;

    let user_clone = user.clone();
    mock_db.expect_get_user_by_id().returning(move |_| {
        let user = user_clone.clone();
        Box::pin(async move { Ok(Some(user)) })
    });

    mock_db.expect_get_accounts_for_user().returning(move |_| {
        let accounts = vec![Account {
            id: checking_id,
            user_id: Some(user_id),
            provider_account_id: Some("plaid_acc_1".to_string()),
            provider_connection_id: Some(provider_connection_id),
            name: "Checking".to_string(),
            account_type: "checking".to_string(),
            balance_current: None,
            mask: Some("0031".to_string()),
            institution_name: None,
            provider_conn_id: None,
        }];
        Box::pin(async move { Ok(accounts) })
    });

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(move |_| {
            let provider_connection = provider_connection.clone();
            Box::pin(async move { Ok(vec![provider_connection]) })
        });

    mock_db
        .expect_get_earliest_transaction_date_for_user()
        .returning(|_, _| Box::pin(async move { Ok(None) }));

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        &format!("/api/analytics/date-bounds?account_ids={checking_id}"),
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(payload["start_date"], serde_json::Value::Null);
    assert_eq!(payload["end_date"], serde_json::Value::Null);
}

#[tokio::test]
async fn given_authenticated_user_when_get_cash_flow_with_explicit_dates_then_returns_requested_window(
) {
    use crate::models::analytics::{CashFlowResponse, MonthlyCashFlowAggregate};
    use crate::services::repository_service::MockDatabaseRepository;
    use chrono::NaiveDate;
    use rust_decimal_macros::dec;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_clone = user.clone();
    let user_id = user.id;

    mock_db.expect_get_user_by_id().returning(move |_| {
        let user = user_clone.clone();
        Box::pin(async move { Ok(Some(user)) })
    });

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db.expect_get_accounts_for_user().returning(move |_| {
        let account = crate::models::account::Account {
            id: Uuid::parse_str("550e8400-e29b-41d4-a716-446655440041").unwrap(),
            user_id: Some(user_id),
            provider_account_id: Some("plaid_acc_1".to_string()),
            provider_connection_id: None,
            name: "Checking".to_string(),
            account_type: "checking".to_string(),
            balance_current: None,
            mask: Some("0041".to_string()),
            institution_name: None,
            provider_conn_id: None,
        };
        Box::pin(async move { Ok(vec![account]) })
    });

    mock_db
        .expect_get_monthly_cash_flow_aggregates_for_user()
        .withf(|_, start_date, end_date, _| {
            *start_date == NaiveDate::from_ymd_opt(2026, 1, 1).unwrap()
                && *end_date == NaiveDate::from_ymd_opt(2026, 3, 31).unwrap()
        })
        .returning(|_, _, _, _| {
            Box::pin(async move {
                Ok(vec![
                    MonthlyCashFlowAggregate {
                        month: "2026-01".to_string(),
                        income: dec!(5000.00),
                        expenses: dec!(3200.00),
                    },
                    MonthlyCashFlowAggregate {
                        month: "2026-03".to_string(),
                        income: dec!(5100.00),
                        expenses: dec!(3300.00),
                    },
                ])
            })
        });

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        "/api/analytics/cash-flow?start_date=2026-01-01&end_date=2026-03-31",
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let payload: CashFlowResponse = serde_json::from_slice(&body).unwrap();

    assert_eq!(payload.series.len(), 2);
    assert_eq!(payload.series[0].month, "2026-01");
    assert_eq!(payload.series[0].income, dec!(5000.00));
    assert_eq!(payload.series[0].expenses, dec!(3200.00));
    assert_eq!(payload.series[0].net, dec!(1800.00));
    assert_eq!(payload.series[1].month, "2026-03");
}

#[tokio::test]
async fn given_end_date_before_start_date_when_get_cash_flow_then_returns_400() {
    use crate::services::repository_service::MockDatabaseRepository;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();

    mock_db.expect_get_user_by_id().returning(move |_| {
        let user = user.clone();
        Box::pin(async move { Ok(Some(user)) })
    });

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_accounts_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        "/api/analytics/cash-flow?start_date=2026-03-31&end_date=2026-01-01",
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 400);
}

#[tokio::test]
async fn given_authenticated_user_when_get_monthly_totals_with_explicit_dates_then_returns_requested_window(
) {
    use crate::models::transaction::Transaction;
    use crate::services::repository_service::MockDatabaseRepository;
    use chrono::NaiveDate;
    use rust_decimal_macros::dec;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let account_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440051").unwrap();
    let user_clone = user.clone();
    let user_id = user.id;

    mock_db.expect_get_user_by_id().returning(move |_| {
        let user = user_clone.clone();
        Box::pin(async move { Ok(Some(user)) })
    });

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_accounts_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_spending_transactions_by_date_range_for_user()
        .withf(|_, start_date, end_date, _| {
            *start_date == NaiveDate::from_ymd_opt(2026, 1, 1).unwrap()
                && *end_date == NaiveDate::from_ymd_opt(2026, 3, 31).unwrap()
        })
        .returning(move |_, _, _, _| {
            let transactions = vec![
                Transaction {
                    id: Uuid::new_v4(),
                    account_id,
                    user_id: Some(user_id),
                    provider_account_id: Some("plaid_acc_1".to_string()),
                    provider_transaction_id: Some("txn_051".to_string()),
                    amount: dec!(-125.50),
                    date: NaiveDate::from_ymd_opt(2026, 1, 15).unwrap(),
                    merchant_name: Some("Coffee Shop".to_string()),
                    category_primary: "FOOD_AND_DRINK".to_string(),
                    category_detailed: "Coffee Shop".to_string(),
                    category_confidence: "HIGH".to_string(),
                    payment_channel: Some("in_store".to_string()),
                    pending: false,
                    created_at: Some(chrono::Utc::now()),
                    original_merchant_name: None,
                    normalized_merchant: None,
                    normalization_source: None,
                },
                Transaction {
                    id: Uuid::new_v4(),
                    account_id,
                    user_id: Some(user_id),
                    provider_account_id: Some("plaid_acc_1".to_string()),
                    provider_transaction_id: Some("txn_052".to_string()),
                    amount: dec!(-200.00),
                    date: NaiveDate::from_ymd_opt(2026, 3, 10).unwrap(),
                    merchant_name: Some("Grocery Store".to_string()),
                    category_primary: "FOOD_AND_DRINK".to_string(),
                    category_detailed: "Groceries".to_string(),
                    category_confidence: "HIGH".to_string(),
                    payment_channel: Some("in_store".to_string()),
                    pending: false,
                    created_at: Some(chrono::Utc::now()),
                    original_merchant_name: None,
                    normalized_merchant: None,
                    normalization_source: None,
                },
            ];
            Box::pin(async move { Ok(transactions) })
        });

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        "/api/analytics/monthly-totals?start_date=2026-01-01&end_date=2026-03-31",
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(
        payload,
        serde_json::json!([
            { "month": "2026-01", "total": "125.50" },
            { "month": "2026-03", "total": "200.00" }
        ])
    );
}

#[tokio::test]
async fn given_end_date_before_start_date_when_get_monthly_totals_then_returns_400() {
    use crate::services::repository_service::MockDatabaseRepository;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_clone = user.clone();

    mock_db.expect_get_user_by_id().returning(move |_| {
        let user = user_clone.clone();
        Box::pin(async move { Ok(Some(user)) })
    });

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_accounts_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        "/api/analytics/monthly-totals?start_date=2026-03-31&end_date=2026-01-01",
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 400);
}

#[tokio::test]
async fn given_authenticated_user_when_get_top_merchants_then_returns_expected_ranking() {
    use crate::models::analytics::TopMerchant;
    use crate::models::transaction::Transaction;
    use crate::services::repository_service::MockDatabaseRepository;
    use axum::body::to_bytes;
    use chrono::NaiveDate;
    use rust_decimal_macros::dec;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
    let teller_conn_id = Uuid::new_v4();
    let account_id_1 = Uuid::new_v4();
    let account_id_2 = Uuid::new_v4();

    mock_db.expect_get_user_by_id().returning(move |_| {
        let u = user.clone();
        Box::pin(async move { Ok(Some(u)) })
    });

    mock_db
        .expect_get_spending_transactions_for_user()
        .returning(move |_, _| {
            let transactions = vec![
                Transaction {
                    id: Uuid::new_v4(),
                    account_id: account_id_1,
                    user_id: Some(user_id),
                    provider_account_id: Some("teller_acc_1".to_string()),
                    provider_transaction_id: Some("txn_001".to_string()),
                    amount: dec!(-50.00),
                    date: NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
                    merchant_name: Some("Coffee Shop".to_string()),
                    category_primary: "FOOD_AND_DRINK".to_string(),
                    category_detailed: "Coffee Shop".to_string(),
                    category_confidence: "HIGH".to_string(),
                    payment_channel: Some("in_store".to_string()),
                    pending: false,
                    created_at: Some(chrono::Utc::now()),
                    original_merchant_name: None,
                    normalized_merchant: None,
                    normalization_source: None,
                },
                Transaction {
                    id: Uuid::new_v4(),
                    account_id: account_id_2,
                    user_id: Some(user_id),
                    provider_account_id: Some("teller_acc_2".to_string()),
                    provider_transaction_id: Some("txn_002".to_string()),
                    amount: dec!(-100.00),
                    date: NaiveDate::from_ymd_opt(2024, 1, 16).unwrap(),
                    merchant_name: Some("Grocery Store".to_string()),
                    category_primary: "FOOD_AND_DRINK".to_string(),
                    category_detailed: "Groceries".to_string(),
                    category_confidence: "HIGH".to_string(),
                    payment_channel: Some("in_store".to_string()),
                    pending: false,
                    created_at: Some(chrono::Utc::now()),
                    original_merchant_name: None,
                    normalized_merchant: None,
                    normalization_source: None,
                },
            ];
            Box::pin(async { Ok(transactions) })
        });

    mock_db.expect_get_accounts_for_user().returning(move |_| {
        use crate::models::account::Account;
        let accounts = vec![
            Account {
                id: account_id_1,
                user_id: Some(user_id),
                provider_account_id: Some("teller_acc_1".to_string()),
                provider_connection_id: Some(teller_conn_id),
                name: "Teller Checking".to_string(),
                account_type: "depository".to_string(),
                balance_current: None,
                mask: None,
                institution_name: None,
                provider_conn_id: None,
            },
            Account {
                id: account_id_2,
                user_id: Some(user_id),
                provider_account_id: Some("teller_acc_2".to_string()),
                provider_connection_id: Some(teller_conn_id),
                name: "Teller Savings".to_string(),
                account_type: "depository".to_string(),
                balance_current: None,
                mask: None,
                institution_name: None,
                provider_conn_id: None,
            },
        ];
        Box::pin(async move { Ok(accounts) })
    });

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(move |_| {
            let conn =
                crate::models::plaid::ProviderConnection::new(Uuid::new_v4(), "teller_item_1");
            let mut c = conn;
            c.id = teller_conn_id;
            c.provider = "teller".to_string();
            Box::pin(async move { Ok(vec![c]) })
        });

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request =
        TestFixtures::create_authenticated_get_request("/api/analytics/top-merchants", &token);

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let merchants: Vec<TopMerchant> = serde_json::from_slice(&body).unwrap();

    assert_eq!(merchants.len(), 2);
    assert_eq!(merchants[0].name, "Grocery Store");
    assert_eq!(merchants[0].amount, dec!(100.00));
    assert_eq!(merchants[1].name, "Coffee Shop");
    assert_eq!(merchants[1].amount, dec!(50.00));
}

#[tokio::test]
async fn given_authenticated_user_when_get_categories_with_foreign_account_ids_then_returns_403() {
    use crate::services::repository_service::MockDatabaseRepository;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let foreign_account_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440999").unwrap();

    mock_db
        .expect_get_accounts_for_user()
        .returning(move |_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_spending_transactions_for_user()
        .returning(move |_, _| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        &format!(
            "/api/analytics/categories?account_ids={}",
            foreign_account_id
        ),
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 403);
}

#[tokio::test]
async fn given_authenticated_user_when_get_balances_with_account_ids_then_returns_filtered_balances(
) {
    use crate::models::account::Account;
    use crate::models::plaid::ProviderConnection;
    use crate::services::repository_service::MockDatabaseRepository;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();

    let account_id_1 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap();
    let account_id_2 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440002").unwrap();
    let mut provider_connection = ProviderConnection::new(user.id, "item_1");
    provider_connection.provider = user.provider.clone();
    let provider_connection_id = provider_connection.id;

    let user_clone = user.clone();
    mock_db.expect_get_user_by_id().returning(move |_| {
        let user = user_clone.clone();
        Box::pin(async move { Ok(Some(user)) })
    });

    let accounts = vec![
        Account {
            id: account_id_1,
            user_id: Some(user.id),
            provider_account_id: Some("acc1".to_string()),
            provider_connection_id: Some(provider_connection_id),
            name: "Account 1".to_string(),
            account_type: "checking".to_string(),
            balance_current: Some(rust_decimal_macros::dec!(1000.00)),
            mask: Some("0001".to_string()),
            institution_name: None,
            provider_conn_id: None,
        },
        Account {
            id: account_id_2,
            user_id: Some(user.id),
            provider_account_id: Some("acc2".to_string()),
            provider_connection_id: Some(provider_connection_id),
            name: "Account 2".to_string(),
            account_type: "savings".to_string(),
            balance_current: Some(rust_decimal_macros::dec!(5000.00)),
            mask: Some("0002".to_string()),
            institution_name: None,
            provider_conn_id: None,
        },
    ];

    mock_db.expect_get_accounts_for_user().returning(move |_| {
        let accounts_clone = accounts.clone();
        Box::pin(async { Ok(accounts_clone) })
    });

    mock_db
        .expect_get_transactions_for_user()
        .returning(move |_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(move |_| {
            let provider_connection = provider_connection.clone();
            Box::pin(async move { Ok(vec![provider_connection]) })
        });

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let mut mock_cache = crate::services::cache_service::MockCacheService::new();
    mock_cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_get_jwt_token()
        .returning(|_| Box::pin(async { Ok(Some("test_token".to_string())) }));
    mock_cache
        .expect_set_with_ttl()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        &format!(
            "/api/analytics/balances/overview?account_ids={}&account_ids={}",
            account_id_1, account_id_2
        ),
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn given_authenticated_user_when_get_balances_with_foreign_account_ids_then_returns_403() {
    use crate::services::repository_service::MockDatabaseRepository;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let foreign_account_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440999").unwrap();

    mock_db
        .expect_get_accounts_for_user()
        .returning(move |_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_transactions_for_user()
        .returning(move |_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let mut mock_cache = crate::services::cache_service::MockCacheService::new();
    mock_cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_get_jwt_token()
        .returning(|_| Box::pin(async { Ok(Some("test_token".to_string())) }));
    mock_cache
        .expect_set_with_ttl()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        &format!(
            "/api/analytics/balances/overview?account_ids={}",
            foreign_account_id
        ),
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 403);
}

#[tokio::test]
async fn given_different_account_filters_when_caching_then_uses_different_cache_keys() {
    use crate::models::plaid::ProviderConnection;
    use crate::services::repository_service::MockDatabaseRepository;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();

    let account_id_1 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap();
    let account_id_2 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440002").unwrap();
    let mut provider_connection = ProviderConnection::new(user.id, "item_1");
    provider_connection.provider = user.provider.clone();
    let provider_connection_id = provider_connection.id;

    let user_clone = user.clone();
    mock_db.expect_get_user_by_id().returning(move |_| {
        let user = user_clone.clone();
        Box::pin(async move { Ok(Some(user)) })
    });

    let accounts = vec![
        crate::models::account::Account {
            id: account_id_1,
            user_id: Some(user.id),
            provider_account_id: Some("acc1".to_string()),
            provider_connection_id: Some(provider_connection_id),
            name: "Account 1".to_string(),
            account_type: "checking".to_string(),
            balance_current: Some(rust_decimal_macros::dec!(1000.00)),
            mask: Some("0001".to_string()),
            institution_name: None,
            provider_conn_id: None,
        },
        crate::models::account::Account {
            id: account_id_2,
            user_id: Some(user.id),
            provider_account_id: Some("acc2".to_string()),
            provider_connection_id: Some(provider_connection_id),
            name: "Account 2".to_string(),
            account_type: "savings".to_string(),
            balance_current: Some(rust_decimal_macros::dec!(5000.00)),
            mask: Some("0002".to_string()),
            institution_name: None,
            provider_conn_id: None,
        },
    ];

    mock_db.expect_get_accounts_for_user().returning(move |_| {
        let accounts_clone = accounts.clone();
        Box::pin(async { Ok(accounts_clone) })
    });

    mock_db
        .expect_get_transactions_for_user()
        .returning(move |_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(move |_| {
            let provider_connection = provider_connection.clone();
            Box::pin(async move { Ok(vec![provider_connection]) })
        });

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let mut mock_cache = crate::services::cache_service::MockCacheService::new();
    let cache_keys = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));

    mock_cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));

    let cache_keys_clone = cache_keys.clone();
    mock_cache
        .expect_set_with_ttl()
        .returning(move |key, _, _| {
            let mut keys = cache_keys_clone.lock().unwrap();
            keys.push(key.to_string());
            Box::pin(async { Ok(()) })
        });

    mock_cache
        .expect_get_jwt_token()
        .returning(|_| Box::pin(async { Ok(Some("test_token".to_string())) }));

    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request1 = TestFixtures::create_authenticated_get_request(
        &format!(
            "/api/analytics/balances/overview?account_ids={}",
            account_id_1
        ),
        &token,
    );
    let response1 = app.clone().oneshot(request1).await.unwrap();
    assert_eq!(response1.status(), 200);

    let request2 = TestFixtures::create_authenticated_get_request(
        &format!(
            "/api/analytics/balances/overview?account_ids={}",
            account_id_2
        ),
        &token,
    );
    let response2 = app.clone().oneshot(request2).await.unwrap();
    assert_eq!(response2.status(), 200);

    let request3 = TestFixtures::create_authenticated_get_request(
        &format!(
            "/api/analytics/balances/overview?account_ids={}&account_ids={}",
            account_id_1, account_id_2
        ),
        &token,
    );
    let response3 = app.clone().oneshot(request3).await.unwrap();
    assert_eq!(response3.status(), 200);

    let final_keys = cache_keys.lock().unwrap();
    assert!(
        final_keys.len() >= 3,
        "Expected at least 3 cache operations"
    );

    let unique_keys: std::collections::HashSet<String> = final_keys.iter().cloned().collect();
    assert!(
        unique_keys.len() >= 3,
        "Expected different cache keys for different account filters, but got: {:?}",
        final_keys
    );
}

#[tokio::test]
async fn given_user_with_multiple_banks_when_get_accounts_then_returns_all_accounts() {
    use crate::models::{account::Account, plaid::ProviderConnection};
    use crate::services::repository_service::MockDatabaseRepository;
    use axum::body::to_bytes;
    use rust_decimal_macros::dec;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();

    let conn1_id = Uuid::new_v4();
    let conn2_id = Uuid::new_v4();

    let accounts = vec![
        Account {
            id: Uuid::new_v4(),
            user_id: Some(user_id),
            provider_account_id: Some("acc1".to_string()),
            provider_connection_id: Some(conn1_id),
            name: "Chase Checking".to_string(),
            account_type: "checking".to_string(),
            balance_current: Some(dec!(1000.00)),
            mask: Some("1234".to_string()),
            institution_name: Some("Chase".to_string()),
            provider_conn_id: None,
        },
        Account {
            id: Uuid::new_v4(),
            user_id: Some(user_id),
            provider_account_id: Some("acc2".to_string()),
            provider_connection_id: Some(conn2_id),
            name: "BofA Savings".to_string(),
            account_type: "savings".to_string(),
            balance_current: Some(dec!(5000.00)),
            mask: Some("5678".to_string()),
            institution_name: Some("Bank of America".to_string()),
            provider_conn_id: None,
        },
    ];

    mock_db.expect_get_accounts_for_user().returning(move |_| {
        let accts = accounts.clone();
        Box::pin(async move { Ok(accts) })
    });

    mock_db
        .expect_get_transaction_count_by_account_for_user()
        .returning(|_| Box::pin(async { Ok(std::collections::HashMap::new()) }));

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(move |_| {
            let mut conn1 = ProviderConnection::new(user_id, "item_1");
            conn1.id = conn1_id;
            conn1.provider = "plaid".to_string();
            conn1.mark_connected("Chase");

            let mut conn2 = ProviderConnection::new(user_id, "item_2");
            conn2.id = conn2_id;
            conn2.provider = "simplefin".to_string();
            conn2.mark_connected("Bank of America");

            Box::pin(async move { Ok(vec![conn1, conn2]) })
        });

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_transactions_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();
    let request = TestFixtures::create_authenticated_get_request("/api/plaid/accounts", &token);
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), 200);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let account_responses: Vec<serde_json::Value> = serde_json::from_slice(&body).unwrap();

    assert_eq!(account_responses.len(), 2);
    assert_eq!(account_responses[0]["name"], "Chase Checking");
    assert_eq!(account_responses[0]["provider"], "plaid");
    assert_eq!(account_responses[0]["institution_name"], "Chase");
    assert_eq!(account_responses[1]["name"], "BofA Savings");
    assert_eq!(account_responses[1]["provider"], "simplefin");
    assert_eq!(account_responses[1]["institution_name"], "Bank of America");
}

#[tokio::test]
async fn given_connection_id_when_sync_then_uses_get_provider_connection_by_id() {
    use crate::models::plaid::{ProviderConnection, SyncTransactionsRequest};
    use crate::services::repository_service::MockDatabaseRepository;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;

    let connection_id = Uuid::new_v4();
    let mut expected_conn = ProviderConnection::new(user_id, "item_123");
    expected_conn.id = connection_id;
    expected_conn.provider = "plaid".to_string();
    expected_conn.mark_connected("Chase");

    mock_db
        .expect_get_provider_connection_by_id()
        .with(
            mockall::predicate::eq(connection_id),
            mockall::predicate::eq(user_id),
        )
        .times(1)
        .returning(move |_, _| {
            let conn = expected_conn.clone();
            Box::pin(async move { Ok(Some(conn)) })
        });

    mock_db
        .expect_get_provider_credentials_for_user()
        .returning(|_, _| Box::pin(async { Ok(None) }));

    mock_db
        .expect_get_accounts_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_transactions_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let sync_request = SyncTransactionsRequest {
        connection_id: Some(connection_id.to_string()),
        client_date: "2026-06-02".to_string(),
        client_timezone: "America/Chicago".to_string(),
    };

    let request = TestFixtures::create_authenticated_post_request(
        "/api/providers/sync-transactions",
        &token,
        sync_request,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 404);
}

#[tokio::test]
async fn given_foreign_connection_id_when_sync_then_returns_404() {
    use crate::models::plaid::SyncTransactionsRequest;
    use crate::services::repository_service::MockDatabaseRepository;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let connection_id = Uuid::new_v4();

    mock_db
        .expect_get_provider_connection_by_id()
        .with(
            mockall::predicate::eq(connection_id),
            mockall::predicate::eq(user.id),
        )
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(None) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let sync_request = SyncTransactionsRequest {
        connection_id: Some(connection_id.to_string()),
        client_date: "2026-06-02".to_string(),
        client_timezone: "America/Chicago".to_string(),
    };

    let request = TestFixtures::create_authenticated_post_request(
        "/api/providers/sync-transactions",
        &token,
        sync_request,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 404);
}

#[tokio::test]
async fn given_invalid_client_timezone_when_sync_then_returns_400() {
    use crate::models::plaid::SyncTransactionsRequest;
    use crate::services::repository_service::MockDatabaseRepository;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;

    let connection_id = Uuid::new_v4();
    let mut expected_conn = crate::models::plaid::ProviderConnection::new(user_id, "item_123");
    expected_conn.id = connection_id;
    expected_conn.provider = "plaid".to_string();
    expected_conn.mark_connected("Chase");

    mock_db
        .expect_get_provider_connection_by_id()
        .with(
            mockall::predicate::eq(connection_id),
            mockall::predicate::eq(user_id),
        )
        .times(1)
        .returning(move |_, _| {
            let conn = expected_conn.clone();
            Box::pin(async move { Ok(Some(conn)) })
        });

    mock_db
        .expect_get_provider_credentials_for_user()
        .returning(|_, _| Box::pin(async { Ok(None) }));

    mock_db
        .expect_get_accounts_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_transactions_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let sync_request = SyncTransactionsRequest {
        connection_id: Some(connection_id.to_string()),
        client_date: "2026-06-02".to_string(),
        client_timezone: "Not/A_Timezone".to_string(),
    };

    let request = TestFixtures::create_authenticated_post_request(
        "/api/providers/sync-transactions",
        &token,
        sync_request,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 400);
}

#[tokio::test]
async fn given_invalid_connection_id_when_sync_then_returns_400() {
    let app = TestFixtures::create_test_app().await.unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/providers/sync-transactions")
        .header("Cookie", format!("auth_token={}", token))
        .header("content-type", "application/json")
        .body(axum::body::Body::from(
            r#"{"connection_id":"not-a-uuid","client_date":"2026-06-02","client_timezone":"America/Chicago"}"#,
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 400);
}

#[tokio::test]
async fn given_invalid_content_type_when_sync_then_returns_415() {
    let app = TestFixtures::create_test_app().await.unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/providers/sync-transactions")
        .header("Cookie", format!("auth_token={}", token))
        .header("content-type", "text/plain")
        .body(axum::body::Body::from(
            r#"{"connection_id":"550e8400-e29b-41d4-a716-446655440000"}"#,
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 415);
}

#[tokio::test]
async fn given_owned_connection_id_when_disconnect_then_returns_200() {
    use crate::models::plaid::{DisconnectRequest, ProviderConnection};
    use crate::services::cache_service::MockCacheService;
    use crate::services::repository_service::MockDatabaseRepository;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let mut mock_cache = MockCacheService::new();

    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let connection_id = Uuid::new_v4();
    let mut expected_conn = ProviderConnection::new(user.id, "item_123");
    expected_conn.id = connection_id;
    expected_conn.mark_connected("Chase");

    mock_db
        .expect_get_provider_connection_by_id()
        .with(
            mockall::predicate::eq(connection_id),
            mockall::predicate::eq(user.id),
        )
        .times(1)
        .returning(move |_, _| {
            let conn = expected_conn.clone();
            Box::pin(async move { Ok(Some(conn)) })
        });

    mock_db
        .expect_disconnect_provider_connection_cascade()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok((10, 2)) }));
    mock_db
        .expect_get_all_provider_connections_by_user()
        .with(mockall::predicate::eq(user.id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock_db
        .expect_update_user_provider()
        .with(mockall::predicate::eq(user.id), mockall::predicate::eq(""))
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_health_check()
        .returning(|| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    mock_cache
        .expect_delete_access_token()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_invalidate_pattern()
        .times(2)
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_clear_jwt_scoped_bank_connection_cache()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_post_request(
        "/api/providers/disconnect",
        &token,
        DisconnectRequest {
            connection_id: connection_id.to_string(),
        },
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn given_foreign_connection_id_when_disconnect_then_returns_404() {
    use crate::models::plaid::DisconnectRequest;
    use crate::services::repository_service::MockDatabaseRepository;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let connection_id = Uuid::new_v4();

    mock_db
        .expect_get_provider_connection_by_id()
        .with(
            mockall::predicate::eq(connection_id),
            mockall::predicate::eq(user.id),
        )
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(None) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = TestFixtures::create_authenticated_post_request(
        "/api/providers/disconnect",
        &token,
        DisconnectRequest {
            connection_id: connection_id.to_string(),
        },
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 404);
}

#[tokio::test]
async fn given_invalid_content_type_when_disconnect_then_returns_415() {
    let app = TestFixtures::create_test_app().await.unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/providers/disconnect")
        .header("Cookie", format!("auth_token={}", token))
        .header("content-type", "text/plain")
        .body(axum::body::Body::from(
            r#"{"connection_id":"550e8400-e29b-41d4-a716-446655440000"}"#,
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 415);
}
