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
async fn given_authenticated_user_when_get_connection_status_then_returns_status() {
    let app = TestFixtures::create_test_app().await.unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let request = TestFixtures::create_authenticated_get_request("/api/plaid/status", &token);
    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn given_no_auth_token_when_protected_endpoint_then_returns_unauthorized() {
    let app = TestFixtures::create_test_app().await.unwrap();

    let request = TestFixtures::create_get_request("/api/plaid/status");
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), 401);
}

#[tokio::test]
async fn given_authenticated_user_when_get_transactions_no_filter_then_returns_all_transactions() {
    use crate::services::repository_service::MockDatabaseRepository;

    let mut mock_db = MockDatabaseRepository::new();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    mock_db
        .expect_get_transactions_with_account_for_user()
        .returning(move |_| {
            let transactions = vec![];
            Box::pin(async { Ok(transactions) })
        });

    mock_db
        .expect_get_plaid_connection_by_user()
        .returning(|_| Box::pin(async { Ok(None) }));

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
}

#[tokio::test]
async fn given_authenticated_user_when_get_transactions_with_account_ids_then_returns_filtered_transactions(
) {
    use crate::models::transaction::TransactionWithAccount;
    use crate::services::repository_service::MockDatabaseRepository;
    use chrono::NaiveDate;
    use rust_decimal_macros::dec;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let account_id_1 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap();
    let account_id_2 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440002").unwrap();
    let user_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();

    mock_db.expect_get_accounts_for_user().returning(move |_| {
        use crate::models::account::Account;
        let accounts = vec![
            Account {
                id: account_id_1,
                user_id: Some(user_id),
                plaid_account_id: Some("plaid_acc_1".to_string()),
                plaid_connection_id: Some(Uuid::new_v4()),
                name: "Test Account 1".to_string(),
                account_type: "checking".to_string(),
                balance_current: Some(rust_decimal_macros::dec!(1000.00)),
                mask: Some("0001".to_string()),
                institution_name: Some("Test Bank".to_string()),
            },
            Account {
                id: account_id_2,
                user_id: Some(user_id),
                plaid_account_id: Some("plaid_acc_2".to_string()),
                plaid_connection_id: Some(Uuid::new_v4()),
                name: "Test Account 2".to_string(),
                account_type: "savings".to_string(),
                balance_current: Some(rust_decimal_macros::dec!(5000.00)),
                mask: Some("0002".to_string()),
                institution_name: Some("Test Bank".to_string()),
            },
        ];
        Box::pin(async { Ok(accounts) })
    });

    mock_db
        .expect_get_transactions_with_account_for_user()
        .returning(move |_| {
            let filtered_transactions = vec![TransactionWithAccount {
                id: Uuid::new_v4(),
                account_id: account_id_1,
                user_id: Some(user_id),
                plaid_account_id: None,
                plaid_transaction_id: Some("txn_001".to_string()),
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
            }];
            Box::pin(async { Ok(filtered_transactions) })
        });

    mock_db
        .expect_get_plaid_connection_by_user()
        .returning(|_| Box::pin(async { Ok(None) }));

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
        .expect_get_transactions_with_account_for_user()
        .returning(move |_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_plaid_connection_by_user()
        .returning(|_| Box::pin(async { Ok(None) }));

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
async fn given_authenticated_user_when_get_spending_with_account_ids_then_returns_filtered_spending(
) {
    use crate::models::transaction::Transaction;
    use crate::services::repository_service::MockDatabaseRepository;
    use chrono::NaiveDate;
    use rust_decimal_macros::dec;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let account_id_1 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap();
    let account_id_2 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440002").unwrap();
    let user_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();

    mock_db.expect_get_accounts_for_user().returning(move |_| {
        use crate::models::account::Account;
        let accounts = vec![
            Account {
                id: account_id_1,
                user_id: Some(user_id),
                plaid_account_id: Some("plaid_acc_1".to_string()),
                plaid_connection_id: Some(Uuid::new_v4()),
                name: "Test Account 1".to_string(),
                account_type: "checking".to_string(),
                balance_current: Some(rust_decimal_macros::dec!(1000.00)),
                mask: Some("0001".to_string()),
                institution_name: Some("Test Bank".to_string()),
            },
            Account {
                id: account_id_2,
                user_id: Some(user_id),
                plaid_account_id: Some("plaid_acc_2".to_string()),
                plaid_connection_id: Some(Uuid::new_v4()),
                name: "Test Account 2".to_string(),
                account_type: "savings".to_string(),
                balance_current: Some(rust_decimal_macros::dec!(5000.00)),
                mask: Some("0002".to_string()),
                institution_name: Some("Test Bank".to_string()),
            },
        ];
        Box::pin(async { Ok(accounts) })
    });

    mock_db
        .expect_get_transactions_for_user()
        .returning(move |_| {
            let transactions = vec![
                Transaction {
                    id: Uuid::new_v4(),
                    account_id: account_id_1,
                    user_id: Some(user_id),
                    plaid_account_id: Some("plaid_acc_1".to_string()),
                    plaid_transaction_id: Some("txn_001".to_string()),
                    amount: dec!(-50.00),
                    date: NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
                    merchant_name: Some("Test Merchant 1".to_string()),
                    category_primary: "Food and Drink".to_string(),
                    category_detailed: "Restaurant".to_string(),
                    category_confidence: "HIGH".to_string(),
                    payment_channel: Some("in_store".to_string()),
                    pending: false,
                    created_at: Some(chrono::Utc::now()),
                },
                Transaction {
                    id: Uuid::new_v4(),
                    account_id: account_id_2,
                    user_id: Some(user_id),
                    plaid_account_id: Some("plaid_acc_2".to_string()),
                    plaid_transaction_id: Some("txn_002".to_string()),
                    amount: dec!(-25.00),
                    date: NaiveDate::from_ymd_opt(2024, 1, 16).unwrap(),
                    merchant_name: Some("Test Merchant 2".to_string()),
                    category_primary: "Food and Drink".to_string(),
                    category_detailed: "Restaurant".to_string(),
                    category_confidence: "HIGH".to_string(),
                    payment_channel: Some("in_store".to_string()),
                    pending: false,
                    created_at: Some(chrono::Utc::now()),
                },
            ];
            Box::pin(async { Ok(transactions) })
        });

    mock_db
        .expect_get_plaid_connection_by_user()
        .returning(|_| Box::pin(async { Ok(None) }));

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
        .expect_get_transactions_for_user()
        .returning(move |_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_plaid_connection_by_user()
        .returning(|_| Box::pin(async { Ok(None) }));

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
    use crate::models::transaction::Transaction;
    use crate::services::repository_service::MockDatabaseRepository;
    use chrono::NaiveDate;
    use rust_decimal_macros::dec;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let account_id_1 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap();
    let account_id_2 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440002").unwrap();
    let user_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();

    mock_db.expect_get_accounts_for_user().returning(move |_| {
        use crate::models::account::Account;
        let accounts = vec![
            Account {
                id: account_id_1,
                user_id: Some(user_id),
                plaid_account_id: Some("plaid_acc_1".to_string()),
                plaid_connection_id: Some(Uuid::new_v4()),
                name: "Test Account 1".to_string(),
                account_type: "checking".to_string(),
                balance_current: Some(rust_decimal_macros::dec!(1000.00)),
                mask: Some("0001".to_string()),
                institution_name: None,
            },
            Account {
                id: account_id_2,
                user_id: Some(user_id),
                plaid_account_id: Some("plaid_acc_2".to_string()),
                plaid_connection_id: Some(Uuid::new_v4()),
                name: "Test Account 2".to_string(),
                account_type: "savings".to_string(),
                balance_current: Some(rust_decimal_macros::dec!(5000.00)),
                mask: Some("0002".to_string()),
                institution_name: None,
            },
        ];
        Box::pin(async { Ok(accounts) })
    });

    mock_db
        .expect_get_transactions_for_user()
        .returning(move |_| {
            let transactions = vec![
                Transaction {
                    id: Uuid::new_v4(),
                    account_id: account_id_1,
                    user_id: Some(user_id),
                    plaid_account_id: Some("plaid_acc_1".to_string()),
                    plaid_transaction_id: Some("txn_001".to_string()),
                    amount: dec!(-50.00),
                    date: NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
                    merchant_name: Some("Test Merchant 1".to_string()),
                    category_primary: "Food and Drink".to_string(),
                    category_detailed: "Restaurant".to_string(),
                    category_confidence: "HIGH".to_string(),
                    payment_channel: Some("in_store".to_string()),
                    pending: false,
                    created_at: Some(chrono::Utc::now()),
                },
                Transaction {
                    id: Uuid::new_v4(),
                    account_id: account_id_2,
                    user_id: Some(user_id),
                    plaid_account_id: Some("plaid_acc_2".to_string()),
                    plaid_transaction_id: Some("txn_002".to_string()),
                    amount: dec!(-25.00),
                    date: NaiveDate::from_ymd_opt(2024, 1, 16).unwrap(),
                    merchant_name: Some("Test Merchant 2".to_string()),
                    category_primary: "Transportation".to_string(),
                    category_detailed: "Gas".to_string(),
                    category_confidence: "HIGH".to_string(),
                    payment_channel: Some("in_store".to_string()),
                    pending: false,
                    created_at: Some(chrono::Utc::now()),
                },
            ];
            Box::pin(async { Ok(transactions) })
        });

    mock_db
        .expect_get_plaid_connection_by_user()
        .returning(|_| Box::pin(async { Ok(None) }));

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
        .expect_get_transactions_for_user()
        .returning(move |_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_plaid_connection_by_user()
        .returning(|_| Box::pin(async { Ok(None) }));

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
    use crate::services::repository_service::MockDatabaseRepository;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();

    let account_id_1 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap();
    let account_id_2 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440002").unwrap();

    let accounts = vec![
        Account {
            id: account_id_1,
            user_id: Some(user.id),
            plaid_account_id: Some("acc1".to_string()),
            plaid_connection_id: Some(Uuid::new_v4()),
            name: "Account 1".to_string(),
            account_type: "checking".to_string(),
            balance_current: Some(rust_decimal_macros::dec!(1000.00)),
            mask: Some("0001".to_string()),
            institution_name: None,
        },
        Account {
            id: account_id_2,
            user_id: Some(user.id),
            plaid_account_id: Some("acc2".to_string()),
            plaid_connection_id: Some(Uuid::new_v4()),
            name: "Account 2".to_string(),
            account_type: "savings".to_string(),
            balance_current: Some(rust_decimal_macros::dec!(5000.00)),
            mask: Some("0002".to_string()),
            institution_name: None,
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
        .expect_get_plaid_connection_by_user()
        .returning(|_| Box::pin(async { Ok(None) }));

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
        .expect_get_plaid_connection_by_user()
        .returning(|_| Box::pin(async { Ok(None) }));

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
    use crate::services::repository_service::MockDatabaseRepository;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (user, token) = TestFixtures::create_authenticated_user_with_token();

    let account_id_1 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap();
    let account_id_2 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440002").unwrap();

    let accounts = vec![
        crate::models::account::Account {
            id: account_id_1,
            user_id: Some(user.id),
            plaid_account_id: Some("acc1".to_string()),
            plaid_connection_id: Some(Uuid::new_v4()),
            name: "Account 1".to_string(),
            account_type: "checking".to_string(),
            balance_current: Some(rust_decimal_macros::dec!(1000.00)),
            mask: Some("0001".to_string()),
            institution_name: None,
        },
        crate::models::account::Account {
            id: account_id_2,
            user_id: Some(user.id),
            plaid_account_id: Some("acc2".to_string()),
            plaid_connection_id: Some(Uuid::new_v4()),
            name: "Account 2".to_string(),
            account_type: "savings".to_string(),
            balance_current: Some(rust_decimal_macros::dec!(5000.00)),
            mask: Some("0002".to_string()),
            institution_name: None,
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
        .expect_get_plaid_connection_by_user()
        .returning(|_| Box::pin(async { Ok(None) }));

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let mut mock_cache = crate::services::cache_service::MockCacheService::new();
    let mut cache_keys = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));

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
