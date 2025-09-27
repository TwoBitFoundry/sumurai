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
    use crate::models::transaction::TransactionWithAccount;

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

    let app = TestFixtures::create_test_app_with_db(mock_db).await.unwrap();

    let request = TestFixtures::create_authenticated_get_request("/api/transactions", &token);
    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn given_authenticated_user_when_get_transactions_with_account_ids_then_returns_filtered_transactions() {
    use crate::services::repository_service::MockDatabaseRepository;
    use crate::models::transaction::TransactionWithAccount;
    use rust_decimal_macros::dec;
    use chrono::NaiveDate;
    use uuid::Uuid;

    let mut mock_db = MockDatabaseRepository::new();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let account_id_1 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap();
    let account_id_2 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440002").unwrap();
    let user_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();

    mock_db
        .expect_get_accounts_for_user()
        .returning(move |_| {
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
                }
            ];
            Box::pin(async { Ok(accounts) })
        });

    mock_db
        .expect_get_transactions_with_account_for_user()
        .returning(move |_| {
            let filtered_transactions = vec![
                TransactionWithAccount {
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
                }
            ];
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

    let app = TestFixtures::create_test_app_with_db(mock_db).await.unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        &format!("/api/transactions?account_ids={}", account_id_1),
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn given_authenticated_user_when_get_transactions_with_foreign_account_ids_then_returns_403() {
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

    let app = TestFixtures::create_test_app_with_db(mock_db).await.unwrap();

    let request = TestFixtures::create_authenticated_get_request(
        &format!("/api/transactions?account_ids={}", foreign_account_id),
        &token,
    );

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 403);
}
