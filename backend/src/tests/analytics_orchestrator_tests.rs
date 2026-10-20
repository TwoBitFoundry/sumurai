use std::collections::HashSet;
use std::sync::Arc;

use chrono::NaiveDate;
use rust_decimal_macros::dec;
use uuid::Uuid;

use crate::models::account::Account;
use crate::models::analytics::{
    AnalyticsFilter, AnalyticsRange, BalancesOverviewResponse, MonthlyCashFlowAggregate,
    NetWorthOverTimeResponse,
};
use crate::models::plaid::LatestAccountBalance;
use crate::models::transaction::Transaction;
use crate::services::analytics_orchestrator::{AnalyticsOrchestrationError, AnalyticsOrchestrator};
use crate::services::cache_service::MockCacheService;
use crate::services::repository_service::MockDatabaseRepository;
use crate::services::{AnalyticsService, AuthService};

fn orchestrator(
    repository: MockDatabaseRepository,
    cache: MockCacheService,
) -> AnalyticsOrchestrator {
    AnalyticsOrchestrator::new(
        Arc::new(AnalyticsService::new()),
        Arc::new(repository),
        Arc::new(cache),
        Arc::new(AuthService::new("a".repeat(64)).unwrap()),
    )
}

fn date(year: i32, month: u32, day: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(year, month, day).unwrap()
}

fn make_transaction(account_id: Uuid, amount: rust_decimal::Decimal, on: NaiveDate) -> Transaction {
    Transaction {
        id: Uuid::new_v4(),
        account_id,
        user_id: None,
        provider_account_id: None,
        provider_transaction_id: None,
        amount,
        date: on,
        merchant_name: Some("Store".to_string()),
        category_primary: "FOOD_AND_DRINK".to_string(),
        category_detailed: "FOOD_AND_DRINK_GROCERIES".to_string(),
        category_confidence: "HIGH".to_string(),
        payment_channel: None,
        pending: false,
        created_at: None,
        original_merchant_name: None,
        normalized_merchant: None,
        normalization_source: None,
    }
}

fn make_account(id: Uuid, account_type: &str, balance: Option<rust_decimal::Decimal>) -> Account {
    Account {
        id,
        user_id: None,
        provider_account_id: None,
        provider_connection_id: None,
        name: "Account".to_string(),
        account_type: account_type.to_string(),
        balance_current: balance,
        mask: None,
        institution_name: None,
        provider_conn_id: None,
    }
}

fn scope(ids: &[Uuid]) -> Option<HashSet<Uuid>> {
    Some(ids.iter().copied().collect())
}

fn range(start: NaiveDate, end: NaiveDate, ids: Option<HashSet<Uuid>>) -> AnalyticsRange {
    AnalyticsRange {
        start_date: start,
        end_date: end,
        account_ids: ids,
    }
}

#[tokio::test]
async fn given_out_of_range_month_when_requesting_daily_spending_then_reports_invalid_month() {
    let result = orchestrator(MockDatabaseRepository::new(), MockCacheService::new())
        .daily_spending(Uuid::new_v4(), 2024, 13)
        .await;

    assert_eq!(
        result.err(),
        Some(AnalyticsOrchestrationError::InvalidMonth)
    );
}

#[tokio::test]
async fn given_repository_failure_when_loading_current_month_spending_then_reports_load_failure() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_spending_transactions_by_date_range_for_user()
        .times(1)
        .returning(|_, _, _, _| Box::pin(async { Err(anyhow::anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .current_month_spending(Uuid::new_v4())
        .await;

    assert_eq!(
        result,
        Err(AnalyticsOrchestrationError::LoadSpendingTransactions)
    );
}

#[tokio::test]
async fn given_mixed_transactions_when_summing_date_range_spending_then_counts_only_outflows() {
    let account_id = Uuid::new_v4();
    let transactions = vec![
        make_transaction(account_id, dec!(-25.50), date(2024, 1, 5)),
        make_transaction(account_id, dec!(-10.00), date(2024, 1, 6)),
        make_transaction(account_id, dec!(500.00), date(2024, 1, 7)),
    ];
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_spending_transactions_by_date_range_for_user()
        .times(1)
        .returning(move |_, _, _, _| {
            let transactions = transactions.clone();
            Box::pin(async move { Ok(transactions) })
        });

    let total = orchestrator(repository, MockCacheService::new())
        .spending_by_date_range(
            Uuid::new_v4(),
            AnalyticsFilter {
                start_date: Some(date(2024, 1, 1)),
                end_date: Some(date(2024, 1, 31)),
                account_ids: scope(&[account_id]),
            },
        )
        .await
        .unwrap();

    assert_eq!(total, dec!(35.50));
}

#[tokio::test]
async fn given_unbounded_filter_when_summing_spending_then_loads_all_spending_transactions() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_spending_transactions_for_user()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(Vec::new()) }));

    let total = orchestrator(repository, MockCacheService::new())
        .spending_by_date_range(Uuid::new_v4(), AnalyticsFilter::default())
        .await
        .unwrap();

    assert_eq!(total, dec!(0));
}

#[tokio::test]
async fn given_aggregate_failure_when_loading_income_expense_totals_then_reports_totals_failure() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_category_aggregates_for_date_range()
        .times(1)
        .returning(|_, _, _, _| Box::pin(async { Err(anyhow::anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .income_expense_totals(Uuid::new_v4(), AnalyticsFilter::default())
        .await;

    assert!(matches!(
        result,
        Err(AnalyticsOrchestrationError::LoadIncomeExpenseTotals)
    ));
}

#[tokio::test]
async fn given_aggregate_failure_when_loading_budget_summary_then_reports_summary_failure() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_category_aggregates_for_date_range()
        .times(1)
        .returning(|_, _, _, _| Box::pin(async { Err(anyhow::anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .budget_summary(Uuid::new_v4(), AnalyticsFilter::default())
        .await;

    assert!(matches!(
        result,
        Err(AnalyticsOrchestrationError::LoadBudgetSummary)
    ));
}

#[tokio::test]
async fn given_aggregate_failure_when_loading_category_spending_then_reports_category_failure() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_category_aggregates_for_date_range()
        .times(1)
        .returning(|_, _, _, _| Box::pin(async { Err(anyhow::anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .category_spending(Uuid::new_v4(), AnalyticsFilter::default())
        .await;

    assert!(matches!(
        result,
        Err(AnalyticsOrchestrationError::LoadCategorySpending)
    ));
}

#[tokio::test]
async fn given_earliest_transaction_when_loading_date_bounds_then_returns_start_and_today() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_earliest_transaction_date_for_user()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(Some(date(2021, 4, 9))) }));

    let bounds = orchestrator(repository, MockCacheService::new())
        .date_bounds(Uuid::new_v4(), None)
        .await
        .unwrap();

    assert_eq!(bounds.start_date.as_deref(), Some("2021-04-09"));
    assert_eq!(
        bounds.end_date,
        Some(chrono::Utc::now().naive_utc().date().to_string())
    );
}

#[tokio::test]
async fn given_repository_failure_when_loading_date_bounds_then_reports_bounds_failure() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_earliest_transaction_date_for_user()
        .times(1)
        .returning(|_, _| Box::pin(async { Err(anyhow::anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .date_bounds(Uuid::new_v4(), None)
        .await;

    assert!(matches!(
        result,
        Err(AnalyticsOrchestrationError::LoadDateBounds)
    ));
}

#[tokio::test]
async fn given_empty_account_scope_when_loading_cash_flow_then_returns_empty_series_without_querying(
) {
    let response = orchestrator(MockDatabaseRepository::new(), MockCacheService::new())
        .cash_flow(
            Uuid::new_v4(),
            range(date(2024, 1, 1), date(2024, 3, 31), scope(&[])),
        )
        .await
        .unwrap();

    assert!(response.series.is_empty());
    assert_eq!(response.currency, "USD");
}

#[tokio::test]
async fn given_monthly_aggregates_when_loading_cash_flow_then_builds_series() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_monthly_cash_flow_aggregates_for_user()
        .times(1)
        .returning(|_, _, _, _| {
            Box::pin(async {
                Ok(vec![MonthlyCashFlowAggregate {
                    month: "2024-01".to_string(),
                    income: dec!(5000),
                    expenses: dec!(3500),
                }])
            })
        });

    let response = orchestrator(repository, MockCacheService::new())
        .cash_flow(
            Uuid::new_v4(),
            range(date(2024, 1, 1), date(2024, 1, 31), None),
        )
        .await
        .unwrap();

    assert_eq!(response.currency, "USD");
    assert_eq!(response.series.len(), 1);
    assert_eq!(response.series[0].month, "2024-01");
    assert_eq!(response.series[0].net, dec!(1500));
}

#[tokio::test]
async fn given_aggregate_failure_when_loading_cash_flow_then_reports_cash_flow_failure() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_monthly_cash_flow_aggregates_for_user()
        .times(1)
        .returning(|_, _, _, _| Box::pin(async { Err(anyhow::anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .cash_flow(
            Uuid::new_v4(),
            range(date(2024, 1, 1), date(2024, 1, 31), None),
        )
        .await;

    assert!(matches!(
        result,
        Err(AnalyticsOrchestrationError::LoadCashFlow)
    ));
}

#[tokio::test]
async fn given_spending_transactions_when_loading_monthly_totals_then_returns_monthly_buckets() {
    let account_id = Uuid::new_v4();
    let transactions = vec![make_transaction(account_id, dec!(-40), date(2024, 1, 10))];
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_spending_transactions_by_date_range_for_user()
        .times(1)
        .returning(move |_, _, _, _| {
            let transactions = transactions.clone();
            Box::pin(async move { Ok(transactions) })
        });

    let totals = orchestrator(repository, MockCacheService::new())
        .monthly_totals(
            Uuid::new_v4(),
            range(date(2024, 1, 1), date(2024, 1, 31), scope(&[account_id])),
        )
        .await
        .unwrap();

    assert_eq!(totals.len(), 1);
    assert_eq!(totals[0].total, dec!(40));
}

#[tokio::test]
async fn given_repository_failure_when_loading_top_merchants_then_reports_load_failure() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_spending_transactions_for_user()
        .times(1)
        .returning(|_, _| Box::pin(async { Err(anyhow::anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .top_merchants(Uuid::new_v4(), AnalyticsFilter::default())
        .await;

    assert_eq!(
        result.err(),
        Some(AnalyticsOrchestrationError::LoadSpendingTransactions)
    );
}

#[tokio::test]
async fn given_account_lookup_failure_when_building_sankey_then_reports_accounts_failure() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_accounts_for_user()
        .times(1)
        .returning(|_| Box::pin(async { Err(anyhow::anyhow!("db down")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .sankey(
            Uuid::new_v4(),
            "jwt",
            range(date(2024, 1, 1), date(2024, 1, 31), None),
        )
        .await;

    assert!(matches!(
        result,
        Err(AnalyticsOrchestrationError::LoadAccounts)
    ));
}

#[tokio::test]
async fn given_only_loan_accounts_when_building_sankey_then_returns_empty_sankey_without_cache() {
    let loan_id = Uuid::new_v4();
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_accounts_for_user()
        .returning(move |_| {
            let accounts = vec![make_account(loan_id, "loan", Some(dec!(-1000)))];
            Box::pin(async move { Ok(accounts) })
        });

    let response = orchestrator(repository, MockCacheService::new())
        .sankey(
            Uuid::new_v4(),
            "jwt",
            range(date(2024, 1, 1), date(2024, 1, 31), None),
        )
        .await
        .unwrap();

    assert_eq!(response.currency, "USD");
    assert_eq!(response.summary.income, dec!(0));
    assert_eq!(response.summary.expenses, dec!(0));
}

#[tokio::test]
async fn given_cached_sankey_when_building_sankey_then_skips_aggregate_queries() {
    let account_id = Uuid::new_v4();
    let cached = AnalyticsService::new().build_sankey(dec!(1234), Vec::new(), "USD");
    let serialized = serde_json::to_string(&cached).unwrap();

    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_accounts_for_user()
        .returning(move |_| {
            let accounts = vec![make_account(account_id, "depository", Some(dec!(10)))];
            Box::pin(async move { Ok(accounts) })
        });
    let mut cache = MockCacheService::new();
    cache
        .expect_get_string()
        .withf(|key| key.starts_with("jwt_sankey_2024-01-01_2024-01-31"))
        .times(1)
        .returning(move |_| {
            let serialized = serialized.clone();
            Box::pin(async move { Ok(Some(serialized)) })
        });

    let response = orchestrator(repository, cache)
        .sankey(
            Uuid::new_v4(),
            "jwt",
            range(date(2024, 1, 1), date(2024, 1, 31), None),
        )
        .await
        .unwrap();

    assert_eq!(response, cached);
}

#[tokio::test]
async fn given_cache_miss_when_building_sankey_then_stores_response_with_fixed_ttl() {
    let account_id = Uuid::new_v4();
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_accounts_for_user()
        .returning(move |_| {
            let accounts = vec![make_account(account_id, "depository", Some(dec!(10)))];
            Box::pin(async move { Ok(accounts) })
        });
    repository
        .expect_get_monthly_cash_flow_aggregates_for_user()
        .times(1)
        .returning(|_, _, _, _| {
            Box::pin(async {
                Ok(vec![MonthlyCashFlowAggregate {
                    month: "2024-01".to_string(),
                    income: dec!(900),
                    expenses: dec!(0),
                }])
            })
        });
    repository
        .expect_get_spending_transactions_by_date_range_for_user()
        .times(1)
        .returning(|_, _, _, _| Box::pin(async { Ok(Vec::new()) }));
    let mut cache = MockCacheService::new();
    cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));
    cache
        .expect_set_with_ttl()
        .withf(|key, _, ttl| key.starts_with("jwt_sankey_2024-01-01_2024-01-31") && *ttl == 1800)
        .times(1)
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    let response = orchestrator(repository, cache)
        .sankey(
            Uuid::new_v4(),
            "jwt",
            range(date(2024, 1, 1), date(2024, 1, 31), None),
        )
        .await
        .unwrap();

    assert_eq!(response.summary.income, dec!(900));
}

#[tokio::test]
async fn given_cached_overview_when_loading_balances_then_skips_repository() {
    let account_id = Uuid::new_v4();
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_latest_account_balances_for_user()
        .returning(move |_| {
            let rows = vec![LatestAccountBalance {
                account_id,
                institution_id: "inst".to_string(),
                account_type: "depository".to_string(),
                account_subtype: None,
                currency: "USD".to_string(),
                current_balance: dec!(100),
                provider_connection_id: None,
                institution_name: Some("Bank".to_string()),
            }];
            Box::pin(async move { Ok(rows) })
        });
    let mut cache = MockCacheService::new();
    cache
        .expect_get_string()
        .times(1)
        .returning(|_| Box::pin(async { Ok(None) }));
    cache
        .expect_get_jwt_token()
        .returning(|_| Box::pin(async { Ok(None) }));
    cache
        .expect_set_with_ttl()
        .withf(|key, _, ttl| key.starts_with("jwt_balances_overview") && *ttl == 1800)
        .times(1)
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    let response = orchestrator(repository, cache)
        .balances_overview(Uuid::new_v4(), "jwt", None)
        .await
        .unwrap();

    assert_eq!(response.as_of, "latest");
    assert_eq!(response.banks.len(), 1);
    assert_eq!(response.banks[0].bank_name, "Bank");
    assert_eq!(response.overall.cash, dec!(100));
    assert!(!response.mixed_currency);
}

#[tokio::test]
async fn given_cached_balances_overview_when_loading_then_returns_cached_value() {
    let cached = BalancesOverviewResponse {
        as_of: "latest".to_string(),
        overall: crate::models::analytics::finalize_totals(dec!(7), dec!(0), dec!(0), dec!(0)),
        banks: Vec::new(),
        mixed_currency: true,
    };
    let serialized = serde_json::to_string(&cached).unwrap();
    let mut cache = MockCacheService::new();
    cache.expect_get_string().times(1).returning(move |_| {
        let serialized = serialized.clone();
        Box::pin(async move { Ok(Some(serialized)) })
    });

    let response = orchestrator(MockDatabaseRepository::new(), cache)
        .balances_overview(Uuid::new_v4(), "jwt", None)
        .await
        .unwrap();

    assert_eq!(response.overall.cash, dec!(7));
    assert!(response.mixed_currency);
}

#[tokio::test]
async fn given_non_usd_balances_when_loading_balances_then_flags_mixed_currency_and_falls_back_to_accounts(
) {
    let account_id = Uuid::new_v4();
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_latest_account_balances_for_user()
        .returning(move |_| {
            let rows = vec![LatestAccountBalance {
                account_id,
                institution_id: "inst".to_string(),
                account_type: "depository".to_string(),
                account_subtype: None,
                currency: "EUR".to_string(),
                current_balance: dec!(100),
                provider_connection_id: None,
                institution_name: None,
            }];
            Box::pin(async move { Ok(rows) })
        });
    repository
        .expect_get_accounts_for_user()
        .returning(move |_| {
            let accounts = vec![make_account(account_id, "depository", Some(dec!(55)))];
            Box::pin(async move { Ok(accounts) })
        });
    let mut cache = MockCacheService::new();
    cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));
    cache
        .expect_get_jwt_token()
        .returning(|_| Box::pin(async { Ok(None) }));
    cache
        .expect_set_with_ttl()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    let response = orchestrator(repository, cache)
        .balances_overview(Uuid::new_v4(), "jwt", None)
        .await
        .unwrap();

    assert!(response.mixed_currency);
    assert_eq!(response.banks.len(), 1);
    assert_eq!(response.banks[0].bank_id, "unknown_institution");
    assert_eq!(response.overall.cash, dec!(55));
}

#[tokio::test]
async fn given_balance_query_failure_when_loading_balances_then_reports_balances_failure() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_latest_account_balances_for_user()
        .times(1)
        .returning(|_| Box::pin(async { Err(anyhow::anyhow!("db down")) }));
    let mut cache = MockCacheService::new();
    cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));

    let result = orchestrator(repository, cache)
        .balances_overview(Uuid::new_v4(), "jwt", None)
        .await;

    assert!(matches!(
        result,
        Err(AnalyticsOrchestrationError::LoadBalances)
    ));
}

#[tokio::test]
async fn given_no_depository_accounts_when_loading_net_worth_then_returns_empty_series() {
    let account_id = Uuid::new_v4();
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_accounts_for_user()
        .returning(move |_| {
            let accounts = vec![make_account(account_id, "credit", Some(dec!(-20)))];
            Box::pin(async move { Ok(accounts) })
        });
    let mut cache = MockCacheService::new();
    cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));

    let response = orchestrator(repository, cache)
        .net_worth_over_time(
            Uuid::new_v4(),
            "jwt",
            range(date(2024, 1, 1), date(2024, 1, 3), None),
        )
        .await
        .unwrap();

    assert!(response.series.is_empty());
    assert_eq!(response.currency, "USD");
}

#[tokio::test]
async fn given_ledger_failure_when_loading_net_worth_then_reports_ledger_failure() {
    let account_id = Uuid::new_v4();
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_accounts_for_user()
        .returning(move |_| {
            let accounts = vec![make_account(account_id, "depository", Some(dec!(10)))];
            Box::pin(async move { Ok(accounts) })
        });
    repository
        .expect_get_transactions_by_date_range_for_user()
        .times(1)
        .returning(|_, _, _| Box::pin(async { Err(anyhow::anyhow!("db down")) }));
    let mut cache = MockCacheService::new();
    cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));

    let result = orchestrator(repository, cache)
        .net_worth_over_time(
            Uuid::new_v4(),
            "jwt",
            range(date(2024, 1, 1), date(2024, 1, 3), None),
        )
        .await;

    assert!(matches!(
        result,
        Err(AnalyticsOrchestrationError::LoadLedgerTransactions)
    ));
}

#[tokio::test]
async fn given_depository_flows_when_loading_net_worth_then_rolls_back_from_current_balance() {
    let account_id = Uuid::new_v4();
    let other_id = Uuid::new_v4();
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_accounts_for_user()
        .returning(move |_| {
            let accounts = vec![make_account(account_id, "depository", Some(dec!(1000)))];
            Box::pin(async move { Ok(accounts) })
        });
    repository
        .expect_get_transactions_by_date_range_for_user()
        .times(1)
        .returning(move |_, _, _| {
            let transactions = vec![
                make_transaction(account_id, dec!(-100), date(2024, 1, 2)),
                make_transaction(account_id, dec!(-50), date(2024, 1, 3)),
                make_transaction(other_id, dec!(-999), date(2024, 1, 2)),
            ];
            Box::pin(async move { Ok(transactions) })
        });
    let mut cache = MockCacheService::new();
    cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));
    cache
        .expect_get_jwt_token()
        .returning(|_| Box::pin(async { Ok(None) }));
    cache
        .expect_set_with_ttl()
        .withf(|key, _, ttl| {
            key.starts_with("jwt_net_worth_over_time_2024-01-01_2024-01-03") && *ttl == 1800
        })
        .times(1)
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    let response: NetWorthOverTimeResponse = orchestrator(repository, cache)
        .net_worth_over_time(
            Uuid::new_v4(),
            "jwt",
            range(date(2024, 1, 1), date(2024, 1, 3), scope(&[account_id])),
        )
        .await
        .unwrap();

    let points: Vec<(String, rust_decimal::Decimal)> = response
        .series
        .into_iter()
        .map(|point| (point.date, point.value))
        .collect();
    assert_eq!(
        points,
        vec![
            ("2024-01-01".to_string(), dec!(1150)),
            ("2024-01-02".to_string(), dec!(1050)),
            ("2024-01-03".to_string(), dec!(1000)),
        ]
    );
}
