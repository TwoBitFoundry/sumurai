use crate::models::{
    account::Account, analytics::MonthlyCashFlowAggregate, plaid::ProviderConnection,
    transaction::Transaction,
};
use crate::services::cache_service::MockCacheService;
use crate::services::repository_service::MockDatabaseRepository;
use crate::test_fixtures::TestFixtures;
use axum::body::to_bytes;
use chrono::NaiveDate;
use mockall::predicate::eq;
use rust_decimal_macros::dec;
use tower::ServiceExt;
use uuid::Uuid;

fn make_account(id: Uuid, provider_connection_id: Uuid, account_type: &str) -> Account {
    Account {
        id,
        user_id: None,
        provider_account_id: Some(format!("provider-{id}")),
        provider_connection_id: Some(provider_connection_id),
        name: format!("Account {id}"),
        account_type: account_type.to_string(),
        balance_current: Some(dec!(100.00)),
        mask: None,
        institution_name: Some("Demo Bank".to_string()),
        provider_conn_id: None,
    }
}

fn make_transaction(
    account_id: Uuid,
    amount: rust_decimal::Decimal,
    category: &str,
) -> Transaction {
    Transaction {
        id: Uuid::new_v4(),
        account_id,
        user_id: None,
        provider_account_id: None,
        provider_transaction_id: None,
        amount,
        date: NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
        merchant_name: Some("Demo Merchant".to_string()),
        category_primary: category.to_string(),
        category_detailed: format!("{category} details"),
        category_confidence: "HIGH".to_string(),
        payment_channel: Some("online".to_string()),
        pending: false,
        created_at: None,
        original_merchant_name: None,
        normalized_merchant: None,
        normalization_source: None,
    }
}

#[tokio::test]
async fn given_mixed_account_scope_when_getting_sankey_then_excludes_loan_and_investments() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let user_for_db = user.clone();
    let connection_id = Uuid::new_v4();
    let cash_account_id = Uuid::new_v4();
    let loan_account_id = Uuid::new_v4();
    let investment_account_id = Uuid::new_v4();
    let start_date = "2024-01-01";
    let end_date = "2024-01-31";

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_provider_transaction_ids_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock_db
        .expect_count_transactions()
        .returning(|_, _, _, _, _, _| Box::pin(async { Ok(0) }));
    mock_db
        .expect_get_user_by_id()
        .with(eq(user_id))
        .returning(move |_| {
            let user = user_for_db.clone();
            Box::pin(async move { Ok(Some(user)) })
        });
    mock_db
        .expect_get_all_provider_connections_by_user()
        .with(eq(user_id))
        .returning(move |_| {
            let connection = ProviderConnection {
                id: connection_id,
                user_id,
                item_id: "item-1".to_string(),
                provider: "teller".to_string(),
                is_connected: true,
                last_sync_at: None,
                connected_at: None,
                disconnected_at: None,
                institution_id: None,
                institution_name: Some("Demo Bank".to_string()),
                institution_logo_url: None,
                sync_cursor: None,
                transaction_count: 0,
                account_count: 3,
                created_at: None,
                updated_at: None,
            };
            Box::pin(async move { Ok(vec![connection]) })
        });
    mock_db
        .expect_get_accounts_for_user()
        .with(eq(user_id))
        .returning(move |_| {
            let accounts = vec![
                make_account(cash_account_id, connection_id, "depository"),
                make_account(loan_account_id, connection_id, "loan"),
                make_account(investment_account_id, connection_id, "investment"),
            ];
            Box::pin(async move { Ok(accounts) })
        });
    mock_db
        .expect_get_monthly_cash_flow_aggregates_for_user()
        .withf(
            move |actual_user_id, actual_start, actual_end, account_ids| {
                *actual_user_id == user_id
                    && *actual_start == NaiveDate::from_ymd_opt(2024, 1, 1).unwrap()
                    && *actual_end == NaiveDate::from_ymd_opt(2024, 1, 31).unwrap()
                    && account_ids.is_some_and(|ids| ids == [cash_account_id].as_slice())
            },
        )
        .returning(|_, _, _, _| {
            Box::pin(async {
                Ok(vec![MonthlyCashFlowAggregate {
                    month: "2024-01".to_string(),
                    income: dec!(500.00),
                    expenses: dec!(200.00),
                }])
            })
        });
    mock_db
        .expect_get_spending_transactions_by_date_range_for_user()
        .with(
            eq(user.id),
            eq(NaiveDate::from_ymd_opt(2024, 1, 1).unwrap()),
            eq(NaiveDate::from_ymd_opt(2024, 1, 31).unwrap()),
        )
        .returning(move |_, _, _| {
            let transactions = vec![
                make_transaction(cash_account_id, dec!(-200.00), "Food"),
                make_transaction(loan_account_id, dec!(-400.00), "Debt"),
                make_transaction(investment_account_id, dec!(-300.00), "Investments"),
            ];
            Box::pin(async move { Ok(transactions) })
        });

    let mut mock_cache = MockCacheService::new();
    mock_cache
        .expect_health_check()
        .returning(|| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    mock_cache
        .expect_get_string()
        .withf(|key| key.contains("_sankey_"))
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_set_with_ttl()
        .withf(|key, _, ttl| key.contains("_sankey_") && *ttl == 1800)
        .returning(|_, _, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_get_counter()
        .times(0..)
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_increment_counter()
        .times(0..)
        .returning(|_, _| Box::pin(async { Ok(1) }));
    mock_cache
        .expect_invalidate_pattern()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_get_budgets()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_set_budgets()
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_clear_budgets()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_is_auth_ip_banned()
        .times(0..)
        .returning(|_| Box::pin(async { Ok(false) }));
    mock_cache
        .expect_record_auth_rate_limit_exceeded()
        .times(0..)
        .returning(|_| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();
    let request = TestFixtures::create_authenticated_get_request(
        &format!(
            "/api/analytics/sankey?start_date={start_date}&end_date={end_date}&account_ids[]={cash_account_id}&account_ids[]={loan_account_id}&account_ids[]={investment_account_id}"
        ),
        &token,
    );
    let response = app.clone().oneshot(request).await.unwrap();

    assert_eq!(response.status(), 200);
    let body = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
    let value: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(value["currency"], "USD");
    assert_eq!(value["summary"]["income"], "500.00");
    assert_eq!(value["summary"]["expenses"], "200.00");
    assert_eq!(value["summary"]["covered"], "200.00");
    assert_eq!(value["summary"]["deficit"], "0.00");
    assert_eq!(value["summary"]["surplus"], "300.00");
    assert_eq!(value["nodes"].as_array().unwrap().len(), 4);
    assert!(value["nodes"]
        .as_array()
        .unwrap()
        .iter()
        .all(|node| node["id"] != "debt"));
    assert!(value["links"]
        .as_array()
        .unwrap()
        .iter()
        .all(|link| link["source"] != "debt"));
}
