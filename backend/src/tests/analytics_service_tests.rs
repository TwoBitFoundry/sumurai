use crate::models::analytics::SankeyNodeKind;
use crate::models::analytics::{
    BudgetSummary, CategoryAggregate, CategorySpending, IncomeExpenseTotals,
};
use crate::models::transaction::Transaction;
use crate::services::analytics_service::{AnalyticsService, SpendingTransactionQuery};
use crate::services::repository_service::MockDatabaseRepository;
use chrono::{Datelike, NaiveDate};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use std::collections::HashMap;
use uuid::Uuid;

fn create_test_transaction(
    amount: Decimal,
    date: NaiveDate,
    category_primary: &str,
) -> Transaction {
    use chrono::Utc;
    use uuid::Uuid;

    Transaction {
        id: Uuid::new_v4(),
        account_id: Uuid::new_v4(),
        user_id: None,
        provider_account_id: None,
        provider_transaction_id: None,
        amount,
        date,
        merchant_name: Some("Test Merchant".to_string()),
        category_primary: category_primary.to_string(),
        category_detailed: format!("{} - Details", category_primary),
        category_confidence: "VERY_HIGH".to_string(),
        payment_channel: Some("online".to_string()),
        pending: false,
        created_at: Some(Utc::now()),
        original_merchant_name: None,
        normalized_merchant: None,
        normalization_source: None,
    }
}

fn get_month_range(year: i32, month: u32) -> (NaiveDate, NaiveDate) {
    let start_date = NaiveDate::from_ymd_opt(year, month, 1).unwrap();
    let end_date = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1)
            .unwrap()
            .pred_opt()
            .unwrap()
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1)
            .unwrap()
            .pred_opt()
            .unwrap()
    };
    (start_date, end_date)
}

fn aggregate(category: &str, income: Decimal, expense: Decimal, count: i64) -> CategoryAggregate {
    CategoryAggregate {
        category: category.to_string(),
        income,
        expense,
        count,
    }
}

fn months_back(year: i32, month: u32, back: u32) -> (i32, u32) {
    let total_months = year * 12 + (month as i32) - 1 - (back as i32);
    let new_year = total_months.div_euclid(12);
    let new_month0 = total_months.rem_euclid(12);
    (new_year, (new_month0 + 1) as u32)
}

fn get_period_date_range(period: &str) -> Option<(NaiveDate, NaiveDate)> {
    let now = chrono::Utc::now().naive_utc().date();
    let year = now.year();
    let month = now.month();
    match period {
        "current-month" => Some(get_month_range(year, month)),
        "past-2-months" => {
            let (sy, sm) = months_back(year, month, 1);
            Some((
                NaiveDate::from_ymd_opt(sy, sm, 1).unwrap(),
                get_month_range(year, month).1,
            ))
        }
        "past-6-months" => {
            let (sy, sm) = months_back(year, month, 5);
            Some((
                NaiveDate::from_ymd_opt(sy, sm, 1).unwrap(),
                get_month_range(year, month).1,
            ))
        }
        "past-year" => {
            let (sy, sm) = months_back(year, month, 11);
            Some((
                NaiveDate::from_ymd_opt(sy, sm, 1).unwrap(),
                get_month_range(year, month).1,
            ))
        }
        _ => None,
    }
}

fn filter_by_period<'a>(transactions: &'a [Transaction], period: &str) -> Vec<&'a Transaction> {
    if let Some((start, end)) = get_period_date_range(period) {
        transactions
            .iter()
            .filter(|t| t.date >= start && t.date <= end)
            .collect()
    } else {
        transactions.iter().collect()
    }
}

fn group_transactions_by_category(transactions: Vec<&Transaction>) -> Vec<CategorySpending> {
    let mut category_map: HashMap<String, rust_decimal::Decimal> = HashMap::new();
    for t in transactions {
        if t.amount >= rust_decimal::Decimal::ZERO {
            continue;
        }
        let key = if t.category_primary.is_empty() {
            "Uncategorized".to_string()
        } else {
            t.category_primary.clone()
        };
        *category_map
            .entry(key)
            .or_insert(rust_decimal::Decimal::ZERO) += -t.amount;
    }
    category_map
        .into_iter()
        .map(|(name, value)| CategorySpending { name, value })
        .collect()
}

fn group_by_category(transactions: &[Transaction], period: &str) -> Vec<CategorySpending> {
    let filtered = filter_by_period(transactions, period);
    group_transactions_by_category(filtered)
}

fn limit_categories_to_ten(mut categories: Vec<CategorySpending>) -> Vec<CategorySpending> {
    categories.sort_by_key(|category| std::cmp::Reverse(category.value));
    if categories.len() <= 10 {
        return categories;
    }
    let mut top_ten = categories.drain(..9).collect::<Vec<_>>();
    let other_total: rust_decimal::Decimal = categories.into_iter().map(|c| c.value).sum();
    top_ten.push(CategorySpending {
        name: "Other".into(),
        value: other_total,
    });
    top_ten
}

fn calculate_current_month_spending(transactions: &[Transaction]) -> rust_decimal::Decimal {
    let now = chrono::Utc::now().naive_utc().date();
    let (start, end) = get_month_range(now.year(), now.month());
    transactions
        .iter()
        .filter(|t| t.date >= start && t.date <= end && t.amount < rust_decimal::Decimal::ZERO)
        .map(|t| -t.amount)
        .sum()
}

fn calculate_daily_spending(
    transactions: &[Transaction],
    year: i32,
    month: u32,
) -> Vec<(u32, rust_decimal::Decimal, rust_decimal::Decimal)> {
    use chrono::Datelike;
    let days_in_month = NaiveDate::from_ymd_opt(year, month + 1, 1)
        .unwrap_or(NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap())
        .pred_opt()
        .unwrap()
        .day();
    let mut totals = vec![rust_decimal::Decimal::ZERO; days_in_month as usize];
    for t in transactions {
        if t.date.year() == year
            && t.date.month() == month
            && t.amount < rust_decimal::Decimal::ZERO
        {
            let idx = (t.date.day() - 1) as usize;
            totals[idx] += -t.amount;
        }
    }
    let mut cumulative = rust_decimal::Decimal::ZERO;
    totals
        .into_iter()
        .enumerate()
        .map(|(i, spend)| {
            cumulative += spend;
            ((i + 1) as u32, spend, cumulative)
        })
        .collect()
}

#[tokio::test]
async fn given_date_range_when_loading_spending_transactions_then_uses_date_range_repository_call()
{
    let analytics = AnalyticsService::new();
    let mut repository = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();
    let start_date = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
    let end_date = NaiveDate::from_ymd_opt(2024, 1, 31).unwrap();
    let transactions = vec![create_test_transaction(dec!(10.00), start_date, "Food")];

    repository
        .expect_get_spending_transactions_by_date_range_for_user()
        .with(
            mockall::predicate::eq(user_id),
            mockall::predicate::eq(start_date),
            mockall::predicate::eq(end_date),
            mockall::predicate::always(),
        )
        .returning(move |_, _, _, _| {
            let transactions = transactions.clone();
            Box::pin(async move { Ok(transactions) })
        });

    let result = analytics
        .load_spending_transactions(
            &repository,
            &user_id,
            SpendingTransactionQuery {
                start_date: Some(start_date),
                end_date: Some(end_date),
                account_ids: None,
            },
        )
        .await
        .unwrap();

    assert_eq!(result.len(), 1);
    assert_eq!(result[0].amount, dec!(10.00));
}

#[tokio::test]
async fn given_missing_date_range_when_loading_spending_transactions_then_uses_base_repository_call(
) {
    let analytics = AnalyticsService::new();
    let mut repository = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();
    let transactions = vec![create_test_transaction(
        dec!(12.00),
        NaiveDate::from_ymd_opt(2024, 2, 1).unwrap(),
        "Food",
    )];

    repository
        .expect_get_spending_transactions_for_user()
        .returning(move |_, _| {
            let transactions = transactions.clone();
            Box::pin(async move { Ok(transactions) })
        });

    let result = analytics
        .load_spending_transactions(
            &repository,
            &user_id,
            SpendingTransactionQuery {
                start_date: None,
                end_date: None,
                account_ids: None,
            },
        )
        .await
        .unwrap();

    assert_eq!(result.len(), 1);
    assert_eq!(result[0].amount, dec!(12.00));
}

#[tokio::test]
async fn given_date_range_when_loading_category_spending_then_uses_category_aggregate_repository_call(
) {
    let analytics = AnalyticsService::new();
    let mut repository = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();
    let start_date = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
    let end_date = NaiveDate::from_ymd_opt(2026, 6, 15).unwrap();
    let grid = vec![
        aggregate("", dec!(0), dec!(90.00), 1),
        aggregate("FOOD_AND_DRINK", dec!(0), dec!(120.00), 2),
        aggregate("TRANSFER_OUT", dec!(0), dec!(200.00), 1),
    ];

    repository
        .expect_get_category_aggregates_for_date_range()
        .with(
            mockall::predicate::eq(user_id),
            mockall::predicate::eq(start_date),
            mockall::predicate::eq(end_date),
            mockall::predicate::always(),
        )
        .returning(move |_, _, _, _| {
            let grid = grid.clone();
            Box::pin(async move { Ok(grid) })
        });

    let result = analytics
        .get_category_spending(
            &repository,
            &user_id,
            SpendingTransactionQuery {
                start_date: Some(start_date),
                end_date: Some(end_date),
                account_ids: None,
            },
        )
        .await
        .unwrap();

    assert_eq!(
        result,
        vec![
            CategorySpending {
                name: "Uncategorized".to_string(),
                value: dec!(90.00),
            },
            CategorySpending {
                name: "FOOD_AND_DRINK".to_string(),
                value: dec!(120.00),
            },
        ]
    );
}

#[tokio::test]
async fn given_date_range_when_loading_income_expense_totals_then_uses_category_aggregate_repository_call(
) {
    let analytics = AnalyticsService::new();
    let mut repository = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();
    let start_date = NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
    let end_date = NaiveDate::from_ymd_opt(2026, 6, 15).unwrap();
    let grid = vec![
        aggregate("INCOME", dec!(5000.00), dec!(0), 2),
        aggregate("FOOD_AND_DRINK", dec!(0), dec!(120.00), 1),
        aggregate("TRANSFER_IN", dec!(300.00), dec!(0), 1),
    ];

    repository
        .expect_get_category_aggregates_for_date_range()
        .with(
            mockall::predicate::eq(user_id),
            mockall::predicate::eq(start_date),
            mockall::predicate::eq(end_date),
            mockall::predicate::always(),
        )
        .returning(move |_, _, _, _| {
            let grid = grid.clone();
            Box::pin(async move { Ok(grid) })
        });

    let result = analytics
        .get_income_expense_totals(
            &repository,
            &user_id,
            SpendingTransactionQuery {
                start_date: Some(start_date),
                end_date: Some(end_date),
                account_ids: None,
            },
        )
        .await
        .unwrap();

    assert_eq!(
        result,
        IncomeExpenseTotals {
            income: dec!(5000.00),
            expenses: dec!(120.00),
        }
    );
}

#[tokio::test]
async fn given_date_range_when_loading_budget_summary_then_uses_category_aggregate_repository_call()
{
    let analytics = AnalyticsService::new();
    let mut repository = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();
    let start_date = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
    let end_date = NaiveDate::from_ymd_opt(2026, 6, 30).unwrap();
    let grid = vec![
        aggregate("INCOME", dec!(5000.00), dec!(0), 2),
        aggregate("FOOD_AND_DRINK", dec!(0), dec!(420.00), 3),
        aggregate("TRANSFER_OUT", dec!(0), dec!(200.00), 1),
    ];

    repository
        .expect_get_category_aggregates_for_date_range()
        .with(
            mockall::predicate::eq(user_id),
            mockall::predicate::eq(start_date),
            mockall::predicate::eq(end_date),
            mockall::predicate::always(),
        )
        .returning(move |_, _, _, _| {
            let grid = grid.clone();
            Box::pin(async move { Ok(grid) })
        });

    let result = analytics
        .get_budget_summary(
            &repository,
            &user_id,
            SpendingTransactionQuery {
                start_date: Some(start_date),
                end_date: Some(end_date),
                account_ids: None,
            },
        )
        .await
        .unwrap();

    assert_eq!(
        result,
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

#[test]
fn given_aggregates_when_reducing_ytd_totals_then_excludes_transfers_only() {
    let analytics = AnalyticsService::new();
    let grid = vec![
        aggregate("INCOME", dec!(5250.00), dec!(0), 2),
        aggregate("TRANSFER_IN", dec!(300.00), dec!(0), 1),
        aggregate("TRANSFER_OUT", dec!(0), dec!(200.00), 1),
        aggregate("LOAN_PAYMENTS", dec!(0), dec!(405.00), 2),
        aggregate("FOOD_AND_DRINK", dec!(0), dec!(45.00), 1),
    ];

    let result = analytics.ytd_income_expense_totals(&grid);

    assert_eq!(
        result,
        IncomeExpenseTotals {
            income: dec!(5250.00),
            expenses: dec!(450.00),
        }
    );
}

#[test]
fn given_aggregates_when_reducing_budget_summary_then_excludes_only_transfer_in_for_income() {
    let analytics = AnalyticsService::new();
    let grid = vec![
        aggregate("INCOME", dec!(5000.00), dec!(0), 2),
        aggregate("TRANSFER_IN", dec!(300.00), dec!(0), 1),
        aggregate("TRANSFER_OUT", dec!(0), dec!(200.00), 1),
        aggregate("FOOD_AND_DRINK", dec!(0), dec!(420.00), 3),
        aggregate("BANK_FEES", dec!(0), dec!(5.00), 1),
    ];

    let result = analytics.budget_summary(&grid);

    assert_eq!(
        result,
        BudgetSummary {
            income: dec!(5000.00),
            category_spending: vec![
                CategorySpending {
                    name: "BANK_FEES".to_string(),
                    value: dec!(5.00),
                },
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

#[test]
fn given_aggregates_when_reducing_category_chart_then_excludes_analytics_categories_and_uses_uncategorized(
) {
    let analytics = AnalyticsService::new();
    let grid = vec![
        aggregate("", dec!(0), dec!(90.00), 1),
        aggregate("FOOD_AND_DRINK", dec!(0), dec!(120.00), 2),
        aggregate("TRANSFER_OUT", dec!(0), dec!(200.00), 1),
        aggregate("BANK_FEES", dec!(0), dec!(5.00), 1),
        aggregate("RENT_AND_UTILITIES", dec!(0), dec!(800.00), 1),
    ];

    let result = analytics.category_spending_chart(&grid);

    assert_eq!(
        result,
        vec![
            CategorySpending {
                name: "Uncategorized".to_string(),
                value: dec!(90.00),
            },
            CategorySpending {
                name: "FOOD_AND_DRINK".to_string(),
                value: dec!(120.00),
            },
            CategorySpending {
                name: "RENT_AND_UTILITIES".to_string(),
                value: dec!(800.00),
            },
        ]
    );
}

#[test]
fn given_current_month_transactions_when_calculating_spending_then_sums_correctly() {
    let _analytics = AnalyticsService::new();
    let now = chrono::Utc::now().naive_utc().date();
    let (y, m) = (now.year(), now.month());

    let txns = vec![
        create_test_transaction(
            dec!(-50.00),
            NaiveDate::from_ymd_opt(y, m, 10).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(-25.50),
            NaiveDate::from_ymd_opt(y, m, 12).unwrap(),
            "Transport",
        ),
        create_test_transaction(
            dec!(-100.00),
            NaiveDate::from_ymd_opt(y, if m == 1 { 12 } else { m - 1 }, 15).unwrap(),
            "Food",
        ),
    ];

    let result = calculate_current_month_spending(&txns);
    assert_eq!(result, dec!(75.50));
}

#[test]
fn given_transactions_with_categories_when_grouping_all_time_then_sums_by_category() {
    let _analytics = AnalyticsService::new();
    let txns = vec![
        create_test_transaction(
            dec!(-50.00),
            NaiveDate::from_ymd_opt(2024, 3, 10).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(-25.50),
            NaiveDate::from_ymd_opt(2024, 3, 12).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(-30.00),
            NaiveDate::from_ymd_opt(2024, 3, 5).unwrap(),
            "Transport",
        ),
    ];

    let result = group_by_category(&txns, "all-time");
    assert_eq!(result.len(), 2);
    let food = result.iter().find(|c| c.name == "Food").unwrap();
    let transport = result.iter().find(|c| c.name == "Transport").unwrap();
    assert_eq!(food.value, dec!(75.50));
    assert_eq!(transport.value, dec!(30.00));
}

#[test]
fn given_transactions_in_month_when_calculating_daily_spending_then_groups_by_day() {
    let _analytics = AnalyticsService::new();
    let txns = vec![
        create_test_transaction(
            dec!(-25.50),
            NaiveDate::from_ymd_opt(2024, 3, 5).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(-30.00),
            NaiveDate::from_ymd_opt(2024, 3, 5).unwrap(),
            "Transport",
        ),
        create_test_transaction(
            dec!(-50.00),
            NaiveDate::from_ymd_opt(2024, 3, 10).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(-15.00),
            NaiveDate::from_ymd_opt(2024, 2, 10).unwrap(),
            "Food",
        ),
    ];

    let daily = calculate_daily_spending(&txns, 2024, 3);
    assert_eq!(daily.len(), 31);
    assert_eq!(daily[4].0, 5);
    assert_eq!(daily[4].1, dec!(55.50));
    assert_eq!(daily[4].2, dec!(55.50));
    assert_eq!(daily[9].0, 10);
    assert_eq!(daily[9].1, dec!(50.00));
    assert_eq!(daily[9].2, dec!(105.50));
}

#[test]
fn given_transactions_across_months_when_calculating_monthly_totals_then_groups_correctly() {
    let analytics = AnalyticsService::new();
    let txns = vec![
        create_test_transaction(
            dec!(-100.00),
            NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(-75.50),
            NaiveDate::from_ymd_opt(2024, 2, 10).unwrap(),
            "Transport",
        ),
        create_test_transaction(
            dec!(-25.00),
            NaiveDate::from_ymd_opt(2024, 2, 20).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(-50.00),
            NaiveDate::from_ymd_opt(2024, 3, 5).unwrap(),
            "Food",
        ),
    ];
    let result = analytics.calculate_monthly_totals(&txns, 3);
    assert_eq!(result.len(), 3);
    let jan = result.iter().find(|m| m.month == "2024-01").unwrap();
    let feb = result.iter().find(|m| m.month == "2024-02").unwrap();
    let mar = result.iter().find(|m| m.month == "2024-03").unwrap();
    assert_eq!(jan.total, dec!(100.00));
    assert_eq!(feb.total, dec!(100.50));
    assert_eq!(mar.total, dec!(50.00));
}

#[test]
fn given_transactions_when_grouping_by_category_with_frontend_logic_then_handles_uncategorized() {
    let _analytics = AnalyticsService::new();
    let txns = [
        create_test_transaction(
            dec!(-50.00),
            NaiveDate::from_ymd_opt(2024, 3, 10).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(-25.50),
            NaiveDate::from_ymd_opt(2024, 3, 12).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(-30.00),
            NaiveDate::from_ymd_opt(2024, 3, 5).unwrap(),
            "",
        ),
    ];
    let result = group_transactions_by_category(txns.iter().collect());
    assert_eq!(result.len(), 2);
    let food = result.iter().find(|c| c.name == "Food").unwrap();
    let uncategorized = result.iter().find(|c| c.name == "Uncategorized").unwrap();
    assert_eq!(food.value, dec!(75.50));
    assert_eq!(uncategorized.value, dec!(30.00));
}

#[test]
fn given_many_categories_when_limiting_to_ten_then_combines_bottom_ones_as_other() {
    let _analytics = AnalyticsService::new();
    let categories = vec![
        CategorySpending {
            name: "Food".into(),
            value: dec!(500.00),
        },
        CategorySpending {
            name: "Transport".into(),
            value: dec!(400.00),
        },
        CategorySpending {
            name: "Entertainment".into(),
            value: dec!(300.00),
        },
        CategorySpending {
            name: "Shopping".into(),
            value: dec!(250.00),
        },
        CategorySpending {
            name: "Bills".into(),
            value: dec!(200.00),
        },
        CategorySpending {
            name: "Healthcare".into(),
            value: dec!(150.00),
        },
        CategorySpending {
            name: "Education".into(),
            value: dec!(100.00),
        },
        CategorySpending {
            name: "Travel".into(),
            value: dec!(90.00),
        },
        CategorySpending {
            name: "Fitness".into(),
            value: dec!(80.00),
        },
        CategorySpending {
            name: "Books".into(),
            value: dec!(30.00),
        },
        CategorySpending {
            name: "Music".into(),
            value: dec!(20.00),
        },
        CategorySpending {
            name: "Apps".into(),
            value: dec!(10.00),
        },
    ];

    let result = limit_categories_to_ten(categories);
    assert_eq!(result.len(), 10);
    let other = result.iter().find(|c| c.name == "Other").unwrap();
    assert_eq!(other.value, dec!(60.00));
    assert!(result[0].value >= result[1].value);
}

#[test]
fn given_transactions_when_grouping_by_category_with_date_range_then_filters_and_groups_correctly()
{
    let analytics = AnalyticsService::new();
    let txns = vec![
        create_test_transaction(
            dec!(-50.00),
            NaiveDate::from_ymd_opt(2024, 3, 5).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(-25.50),
            NaiveDate::from_ymd_opt(2024, 3, 12).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(-30.00),
            NaiveDate::from_ymd_opt(2024, 3, 15).unwrap(),
            "Transport",
        ),
        create_test_transaction(
            dec!(-100.00),
            NaiveDate::from_ymd_opt(2024, 2, 10).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(-75.00),
            NaiveDate::from_ymd_opt(2024, 4, 5).unwrap(),
            "Transport",
        ),
    ];

    let start_date = NaiveDate::from_ymd_opt(2024, 3, 1).unwrap();
    let end_date = NaiveDate::from_ymd_opt(2024, 3, 31).unwrap();

    let result =
        analytics.group_by_category_with_date_range(&txns, Some(start_date), Some(end_date));
    assert_eq!(result.len(), 2);

    let food = result.iter().find(|c| c.name == "Food").unwrap();
    let transport = result.iter().find(|c| c.name == "Transport").unwrap();

    assert_eq!(food.value, dec!(75.50));
    assert_eq!(transport.value, dec!(30.00));
}

#[test]
fn given_transactions_when_getting_top_merchants_with_date_range_then_filters_and_ranks_correctly()
{
    let analytics = AnalyticsService::new();
    let txns = vec![
        create_test_transaction(
            dec!(-150.00),
            NaiveDate::from_ymd_opt(2024, 3, 5).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(-100.00),
            NaiveDate::from_ymd_opt(2024, 3, 12).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(-75.00),
            NaiveDate::from_ymd_opt(2024, 3, 15).unwrap(),
            "Transport",
        ),
        create_test_transaction(
            dec!(-200.00),
            NaiveDate::from_ymd_opt(2024, 2, 10).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(-50.00),
            NaiveDate::from_ymd_opt(2024, 4, 5).unwrap(),
            "Transport",
        ),
    ];

    let start_date = NaiveDate::from_ymd_opt(2024, 3, 1).unwrap();
    let end_date = NaiveDate::from_ymd_opt(2024, 3, 31).unwrap();

    let result =
        analytics.get_top_merchants_with_date_range(&txns, Some(start_date), Some(end_date), 5);
    assert_eq!(result.len(), 1);

    let merchant = &result[0];
    assert_eq!(merchant.name, "Test Merchant");
    assert_eq!(merchant.amount, dec!(325.00));
    assert_eq!(merchant.count, 3);
}

#[test]
fn given_non_spending_categories_when_getting_top_merchants_then_excludes_them() {
    let analytics = AnalyticsService::new();
    let txns = vec![
        create_test_transaction(
            dec!(-150.00),
            NaiveDate::from_ymd_opt(2024, 3, 5).unwrap(),
            "FOOD_AND_DRINK",
        ),
        create_test_transaction(
            dec!(500.00),
            NaiveDate::from_ymd_opt(2024, 3, 6).unwrap(),
            "INCOME",
        ),
        create_test_transaction(
            dec!(-200.00),
            NaiveDate::from_ymd_opt(2024, 3, 7).unwrap(),
            "TRANSFER_OUT",
        ),
        create_test_transaction(
            dec!(100.00),
            NaiveDate::from_ymd_opt(2024, 3, 8).unwrap(),
            "TRANSFER_IN",
        ),
        create_test_transaction(
            dec!(-75.00),
            NaiveDate::from_ymd_opt(2024, 3, 9).unwrap(),
            "LOAN_PAYMENTS",
        ),
        create_test_transaction(
            dec!(-12.00),
            NaiveDate::from_ymd_opt(2024, 3, 10).unwrap(),
            "BANK_FEES",
        ),
    ];

    let result = analytics.get_top_merchants(&txns, 5);

    assert_eq!(result.len(), 1);
    assert_eq!(result[0].name, "Test Merchant");
    assert_eq!(result[0].amount, dec!(150.00));
    assert_eq!(result[0].count, 1);
    assert_eq!(result[0].percentage, dec!(100.0));
}

#[test]
fn given_income_and_expense_transactions_when_calculating_cash_flow_then_buckets_by_month() {
    let analytics = AnalyticsService::new();
    let txns = vec![
        create_test_transaction(
            dec!(5000.00),
            NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
            "INCOME",
        ),
        create_test_transaction(
            dec!(-3500.00),
            NaiveDate::from_ymd_opt(2024, 1, 20).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(5200.00),
            NaiveDate::from_ymd_opt(2024, 2, 10).unwrap(),
            "INCOME",
        ),
        create_test_transaction(
            dec!(-3600.00),
            NaiveDate::from_ymd_opt(2024, 2, 15).unwrap(),
            "Transport",
        ),
    ];

    let result = analytics.calculate_cash_flow(&txns, 3);
    assert_eq!(result.len(), 2);

    let jan = result.iter().find(|m| m.month == "2024-01").unwrap();
    assert_eq!(jan.income, dec!(5000.00));
    assert_eq!(jan.expenses, dec!(3500.00));
    assert_eq!(jan.net, dec!(1500.00));

    let feb = result.iter().find(|m| m.month == "2024-02").unwrap();
    assert_eq!(feb.income, dec!(5200.00));
    assert_eq!(feb.expenses, dec!(3600.00));
    assert_eq!(feb.net, dec!(1600.00));
}

#[test]
fn given_transfer_transactions_when_calculating_cash_flow_then_excludes_transfers() {
    let analytics = AnalyticsService::new();
    let txns = vec![
        create_test_transaction(
            dec!(5000.00),
            NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
            "INCOME",
        ),
        create_test_transaction(
            dec!(-3500.00),
            NaiveDate::from_ymd_opt(2024, 1, 20).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(-1000.00),
            NaiveDate::from_ymd_opt(2024, 1, 25).unwrap(),
            "TRANSFER_OUT",
        ),
        create_test_transaction(
            dec!(500.00),
            NaiveDate::from_ymd_opt(2024, 1, 28).unwrap(),
            "TRANSFER_IN",
        ),
        create_test_transaction(
            dec!(750.00),
            NaiveDate::from_ymd_opt(2024, 1, 29).unwrap(),
            "TRANSFER_OUT",
        ),
        create_test_transaction(
            dec!(-250.00),
            NaiveDate::from_ymd_opt(2024, 1, 30).unwrap(),
            "TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS",
        ),
    ];

    let result = analytics.calculate_cash_flow(&txns, 3);
    assert_eq!(result.len(), 1);

    let jan = result.iter().find(|m| m.month == "2024-01").unwrap();
    assert_eq!(jan.income, dec!(5000.00));
    assert_eq!(jan.expenses, dec!(3500.00));
    assert_eq!(jan.net, dec!(1500.00));
}

#[test]
fn given_loan_payment_transactions_when_calculating_cash_flow_then_excludes_loan_payments() {
    let analytics = AnalyticsService::new();
    let txns = vec![
        create_test_transaction(
            dec!(5000.00),
            NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
            "INCOME",
        ),
        create_test_transaction(
            dec!(-3500.00),
            NaiveDate::from_ymd_opt(2024, 1, 20).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(-500.00),
            NaiveDate::from_ymd_opt(2024, 1, 25).unwrap(),
            "LOAN_PAYMENTS",
        ),
    ];

    let result = analytics.calculate_cash_flow(&txns, 3);
    assert_eq!(result.len(), 1);

    let jan = result.iter().find(|m| m.month == "2024-01").unwrap();
    assert_eq!(jan.income, dec!(5000.00));
    assert_eq!(jan.expenses, dec!(3500.00));
    assert_eq!(jan.net, dec!(1500.00));
}

#[test]
fn given_multiple_months_when_calculating_cash_flow_then_truncates_to_month_limit() {
    let analytics = AnalyticsService::new();
    let txns = vec![
        create_test_transaction(
            dec!(1000.00),
            NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
            "INCOME",
        ),
        create_test_transaction(
            dec!(-500.00),
            NaiveDate::from_ymd_opt(2024, 1, 20).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(1100.00),
            NaiveDate::from_ymd_opt(2024, 2, 10).unwrap(),
            "INCOME",
        ),
        create_test_transaction(
            dec!(-600.00),
            NaiveDate::from_ymd_opt(2024, 2, 15).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(1200.00),
            NaiveDate::from_ymd_opt(2024, 3, 10).unwrap(),
            "INCOME",
        ),
        create_test_transaction(
            dec!(-700.00),
            NaiveDate::from_ymd_opt(2024, 3, 15).unwrap(),
            "Food",
        ),
    ];

    let result = analytics.calculate_cash_flow(&txns, 2);
    assert_eq!(result.len(), 2);
    assert!(result[0].month == "2024-02");
    assert!(result[1].month == "2024-03");
}

#[test]
fn given_no_income_when_calculating_cash_flow_then_handles_zero_income() {
    let analytics = AnalyticsService::new();
    let txns = vec![
        create_test_transaction(
            dec!(-500.00),
            NaiveDate::from_ymd_opt(2024, 1, 20).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(-100.00),
            NaiveDate::from_ymd_opt(2024, 1, 25).unwrap(),
            "Transport",
        ),
    ];

    let result = analytics.calculate_cash_flow(&txns, 3);
    assert_eq!(result.len(), 1);

    let jan = result.iter().find(|m| m.month == "2024-01").unwrap();
    assert_eq!(jan.income, dec!(0.00));
    assert_eq!(jan.expenses, dec!(600.00));
    assert_eq!(jan.net, dec!(-600.00));
}

#[test]
fn given_income_exceeds_expenses_when_building_sankey_then_balances_with_surplus() {
    let analytics = AnalyticsService::new();
    let categories = vec![
        CategorySpending {
            name: "Housing".to_string(),
            value: dec!(200.00),
        },
        CategorySpending {
            name: "Food".to_string(),
            value: dec!(300.00),
        },
    ];

    let result = analytics.build_sankey(dec!(1000.00), categories, "USD");

    assert_eq!(result.currency, "USD");
    assert_eq!(result.summary.income, dec!(1000.00));
    assert_eq!(result.summary.expenses, dec!(500.00));
    assert_eq!(result.summary.covered, dec!(500.00));
    assert_eq!(result.summary.deficit, dec!(0.00));
    assert_eq!(result.summary.surplus, dec!(500.00));
    assert_eq!(result.summary.coverage_ratio, Some(dec!(1.00)));

    let node_kinds: Vec<_> = result.nodes.iter().map(|node| &node.kind).collect();
    assert_eq!(
        node_kinds,
        vec![
            &SankeyNodeKind::Income,
            &SankeyNodeKind::Expenses,
            &SankeyNodeKind::Savings,
            &SankeyNodeKind::FreeSpending,
            &SankeyNodeKind::Category,
            &SankeyNodeKind::Category,
        ]
    );

    assert_eq!(result.links.len(), 5);
    assert_eq!(result.links[0].source, "income");
    assert_eq!(result.links[0].target, "expenses");
    assert_eq!(result.links[0].value, dec!(500.00));
    assert_eq!(result.links[1].source, "income");
    assert_eq!(result.links[1].target, "savings");
    assert_eq!(result.links[1].value, dec!(500.00));
    assert_eq!(result.links[2].source, "expenses");
    assert_eq!(result.links[2].target, "free_spending");
    assert_eq!(result.links[2].value, dec!(500.00));
    assert_eq!(result.links[3].source, "free_spending");
    assert_eq!(result.links[3].target, "category_food");
    assert_eq!(result.links[3].value, dec!(300.00));
    assert_eq!(result.links[4].source, "free_spending");
    assert_eq!(result.links[4].target, "category_housing");
    assert_eq!(result.links[4].value, dec!(200.00));
}

#[test]
fn given_mixed_fixed_and_free_categories_when_building_sankey_then_splits_through_intermediaries() {
    let analytics = AnalyticsService::new();
    let categories = vec![
        CategorySpending {
            name: "SUBSCRIPTION".to_string(),
            value: dec!(100.00),
        },
        CategorySpending {
            name: "RENT_AND_UTILITIES".to_string(),
            value: dec!(200.00),
        },
        CategorySpending {
            name: "FOOD_AND_DRINK".to_string(),
            value: dec!(300.00),
        },
    ];

    let result = analytics.build_sankey(dec!(700.00), categories, "USD");

    assert_eq!(result.summary.expenses, dec!(600.00));
    assert!(result.nodes.iter().any(|node| node.id == "fixed_expenses"));
    assert!(result.nodes.iter().any(|node| node.id == "free_spending"));
    assert_eq!(
        result
            .links
            .iter()
            .find(|link| link.source == "expenses" && link.target == "fixed_expenses")
            .map(|link| link.value),
        Some(dec!(300.00))
    );
    assert_eq!(
        result
            .links
            .iter()
            .find(|link| link.source == "expenses" && link.target == "free_spending")
            .map(|link| link.value),
        Some(dec!(300.00))
    );
    assert!(result
        .links
        .iter()
        .any(|link| { link.source == "fixed_expenses" && link.target == "category_subscription" }));
    assert!(result.links.iter().any(|link| {
        link.source == "fixed_expenses" && link.target == "category_rent_and_utilities"
    }));
    assert!(result.links.iter().any(|link| {
        link.source == "free_spending" && link.target == "category_food_and_drink"
    }));
}

#[test]
fn given_expenses_exceed_income_when_building_sankey_then_balances_with_debt() {
    let analytics = AnalyticsService::new();
    let categories = vec![
        CategorySpending {
            name: "Travel".to_string(),
            value: dec!(100.00),
        },
        CategorySpending {
            name: "Groceries".to_string(),
            value: dec!(150.00),
        },
    ];

    let result = analytics.build_sankey(dec!(200.00), categories, "USD");

    assert_eq!(result.summary.income, dec!(200.00));
    assert_eq!(result.summary.expenses, dec!(250.00));
    assert_eq!(result.summary.covered, dec!(200.00));
    assert_eq!(result.summary.deficit, dec!(50.00));
    assert_eq!(result.summary.surplus, dec!(0.00));
    assert_eq!(result.summary.coverage_ratio, Some(dec!(0.80)));

    assert!(result.nodes.iter().any(|node| node.id == "debt"));
    assert!(result.links.iter().any(|link| link.source == "debt"));
    assert_eq!(
        result
            .links
            .iter()
            .find(|link| link.source == "debt" && link.target == "expenses")
            .map(|link| link.value),
        Some(dec!(50.00))
    );
}

#[test]
fn given_no_spending_and_no_income_when_building_sankey_then_returns_empty_response() {
    let analytics = AnalyticsService::new();

    let result = analytics.build_sankey(dec!(0.00), Vec::new(), "USD");

    assert_eq!(result.nodes.len(), 0);
    assert_eq!(result.links.len(), 0);
    assert_eq!(result.summary.income, dec!(0.00));
    assert_eq!(result.summary.expenses, dec!(0.00));
    assert_eq!(result.summary.covered, dec!(0.00));
    assert_eq!(result.summary.deficit, dec!(0.00));
    assert_eq!(result.summary.surplus, dec!(0.00));
    assert_eq!(result.summary.coverage_ratio, None);
}

#[test]
fn given_no_income_when_building_sankey_then_routes_inflow_through_debt() {
    let analytics = AnalyticsService::new();
    let categories = vec![
        CategorySpending {
            name: "Food".to_string(),
            value: dec!(100.00),
        },
        CategorySpending {
            name: "Rent".to_string(),
            value: dec!(250.00),
        },
    ];

    let result = analytics.build_sankey(dec!(0.00), categories, "USD");

    assert_eq!(result.summary.income, dec!(0.00));
    assert_eq!(result.summary.expenses, dec!(350.00));
    assert_eq!(result.summary.covered, dec!(0.00));
    assert_eq!(result.summary.deficit, dec!(350.00));
    assert_eq!(result.summary.surplus, dec!(0.00));
    assert_eq!(result.summary.coverage_ratio, Some(dec!(0.00)));
    assert!(result.links.iter().any(|link| link.source == "debt"));
    assert!(!result
        .links
        .iter()
        .any(|link| link.source == "income" && link.target == "expenses"));
}
