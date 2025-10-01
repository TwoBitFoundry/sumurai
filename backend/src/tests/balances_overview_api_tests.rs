use crate::models::plaid::LatestAccountBalance;
use crate::services::repository_service::MockDatabaseRepository;
use crate::test_fixtures::TestFixtures;
use axum::body::to_bytes;
use rust_decimal_macros::dec;
use tower::ServiceExt;
use uuid::Uuid;

#[tokio::test]
async fn given_snapshots_when_get_balances_overview_then_groups_and_computes_totals() {
    let mut mock = MockDatabaseRepository::new();
    // Default expectations for unrelated endpoints
    mock.expect_get_all_plaid_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock.expect_get_transactions_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock.expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    // Provide latest balances: two institutions, mixed categories
    let rows = vec![
        LatestAccountBalance {
            account_id: Uuid::new_v4(),
            institution_id: "ins_123".to_string(),
            account_type: "depository".to_string(),
            account_subtype: Some("checking".to_string()),
            currency: "USD".to_string(),
            current_balance: dec!(12500.00),
        },
        LatestAccountBalance {
            account_id: Uuid::new_v4(),
            institution_id: "ins_123".to_string(),
            account_type: "credit".to_string(),
            account_subtype: None,
            currency: "USD".to_string(),
            current_balance: dec!(2500.10),
        },
        LatestAccountBalance {
            account_id: Uuid::new_v4(),
            institution_id: "ins_456".to_string(),
            account_type: "loan".to_string(),
            account_subtype: None,
            currency: "USD".to_string(),
            current_balance: dec!(15400.00),
        },
        LatestAccountBalance {
            account_id: Uuid::new_v4(),
            institution_id: "ins_456".to_string(),
            account_type: "investment".to_string(),
            account_subtype: None,
            currency: "USD".to_string(),
            current_balance: dec!(42000.00),
        },
    ];
    mock.expect_get_latest_account_balances_for_user()
        .returning(move |_| {
            let rows = rows.clone();
            Box::pin(async move { Ok(rows) })
        });

    let app = TestFixtures::create_test_app_with_db(mock).await.unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();
    let req =
        TestFixtures::create_authenticated_get_request("/api/analytics/balances/overview", &token);
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), 200);
    let body = to_bytes(res.into_body(), 1024 * 1024).await.unwrap();
    let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(v["asOf"], "latest");
    // Overall assertions
    assert_eq!(v["overall"]["cash"], "12500.00");
    assert_eq!(v["overall"]["credit"], "-2500.10");
    assert_eq!(v["overall"]["loan"], "-15400.00");
    assert_eq!(v["overall"]["investments"], "42000.00");
    assert_eq!(v["mixedCurrency"], false);
}

#[tokio::test]
async fn given_mixed_currency_when_get_balances_overview_then_excludes_non_usd_and_sets_flag() {
    let mut mock = MockDatabaseRepository::new();
    mock.expect_get_all_plaid_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock.expect_get_transactions_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock.expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let rows = vec![
        LatestAccountBalance {
            account_id: Uuid::new_v4(),
            institution_id: "ins_789".to_string(),
            account_type: "depository".to_string(),
            account_subtype: Some("checking".to_string()),
            currency: "USD".to_string(),
            current_balance: dec!(100.00),
        },
        LatestAccountBalance {
            account_id: Uuid::new_v4(),
            institution_id: "ins_789".to_string(),
            account_type: "credit".to_string(),
            account_subtype: None,
            currency: "EUR".to_string(),
            current_balance: dec!(50.00),
        },
    ];
    mock.expect_get_latest_account_balances_for_user()
        .returning(move |_| {
            let rows = rows.clone();
            Box::pin(async move { Ok(rows) })
        });

    let app = TestFixtures::create_test_app_with_db(mock).await.unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();
    let req =
        TestFixtures::create_authenticated_get_request("/api/analytics/balances/overview", &token);
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), 200);
    let body = to_bytes(res.into_body(), 1024 * 1024).await.unwrap();
    let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(v["mixedCurrency"], true);
    assert_eq!(v["overall"]["cash"], "100.00");
    assert_eq!(v["overall"]["credit"], "0"); // EUR excluded
}

#[tokio::test]
async fn given_no_snapshots_when_get_balances_overview_then_falls_back_to_accounts() {
    use crate::models::account::Account;
    use uuid::Uuid;

    let mut mock = MockDatabaseRepository::new();
    mock.expect_get_all_plaid_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock.expect_get_transactions_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock.expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock.expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock.expect_get_accounts_for_user().returning(|_| {
        Box::pin(async {
            Ok(vec![
                Account {
                    id: Uuid::new_v4(),
                    user_id: None,
                    plaid_account_id: None,
                    plaid_connection_id: None,
                    name: "Check".to_string(),
                    account_type: "depository".to_string(),
                    balance_current: Some(dec!(500.00)),
                    mask: None,
                    institution_name: None,
                },
                Account {
                    id: Uuid::new_v4(),
                    user_id: None,
                    plaid_account_id: None,
                    plaid_connection_id: None,
                    name: "Card".to_string(),
                    account_type: "credit".to_string(),
                    balance_current: Some(dec!(200.00)),
                    mask: None,
                    institution_name: None,
                },
            ])
        })
    });

    let app = TestFixtures::create_test_app_with_db(mock).await.unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();
    let req =
        TestFixtures::create_authenticated_get_request("/api/analytics/balances/overview", &token);
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), 200);
    let body = to_bytes(res.into_body(), 1024 * 1024).await.unwrap();
    let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(v["asOf"], "latest");
    assert_eq!(v["overall"]["cash"], "500.00");
    assert_eq!(v["overall"]["credit"], "-200.00");
}

#[tokio::test]
async fn given_cache_hit_when_get_balances_overview_then_returns_cached() {
    use crate::services::cache_service::MockCacheService;
    use crate::{
        models::analytics::{BalancesOverviewResponse, Totals},
        services::cache_service::CacheService,
    };
    use std::sync::Arc;

    let mock_db = MockDatabaseRepository::new();

    let mut mock_cache = MockCacheService::new();
    mock_cache
        .expect_health_check()
        .returning(|| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));

    // Prepare cached response
    let cached = BalancesOverviewResponse {
        as_of: "latest".to_string(),
        overall: crate::analytics_service::Totals {
            cash: dec!(1),
            credit: dec!(0),
            loan: dec!(0),
            investments: dec!(0),
            positives_total: dec!(1),
            negatives_total: dec!(0),
            net: dec!(1),
            ratio: None,
        },
        banks: vec![],
        mixed_currency: false,
    };
    let serialized = serde_json::to_string(&cached).unwrap();
    mock_cache.expect_get_string().returning(move |_| {
        let s = serialized.clone();
        Box::pin(async move { Ok(Some(s)) })
    });

    // Allow set_with_ttl to be called or not (won't be on cache hit)
    mock_cache
        .expect_set_with_ttl()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_invalidate_pattern()
        .returning(|_| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();
    let req =
        TestFixtures::create_authenticated_get_request("/api/analytics/balances/overview", &token);
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), 200);
}
