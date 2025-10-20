use crate::models::analytics::CategorySpending;
use crate::models::transaction::Transaction;
use crate::services::analytics_service::AnalyticsService;
use chrono::{Datelike, NaiveDate};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use std::collections::HashMap;

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
        let key = if t.category_primary.is_empty() {
            "Uncategorized".to_string()
        } else {
            t.category_primary.clone()
        };
        *category_map
            .entry(key)
            .or_insert(rust_decimal::Decimal::ZERO) += t.amount;
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
    categories.sort_by(|a, b| b.value.cmp(&a.value));
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
        .filter(|t| t.date >= start && t.date <= end)
        .map(|t| t.amount)
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
        if t.date.year() == year && t.date.month() == month {
            let idx = (t.date.day() - 1) as usize;
            totals[idx] += t.amount;
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

#[test]
fn given_current_month_transactions_when_calculating_spending_then_sums_correctly() {
    let _analytics = AnalyticsService::new();
    let now = chrono::Utc::now().naive_utc().date();
    let (y, m) = (now.year(), now.month());

    let txns = vec![
        create_test_transaction(
            dec!(50.00),
            NaiveDate::from_ymd_opt(y, m, 10).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(25.50),
            NaiveDate::from_ymd_opt(y, m, 12).unwrap(),
            "Transport",
        ),
        create_test_transaction(
            dec!(100.00),
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
            dec!(50.00),
            NaiveDate::from_ymd_opt(2024, 3, 10).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(25.50),
            NaiveDate::from_ymd_opt(2024, 3, 12).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(30.00),
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
            dec!(25.50),
            NaiveDate::from_ymd_opt(2024, 3, 5).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(30.00),
            NaiveDate::from_ymd_opt(2024, 3, 5).unwrap(),
            "Transport",
        ),
        create_test_transaction(
            dec!(50.00),
            NaiveDate::from_ymd_opt(2024, 3, 10).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(15.00),
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
            dec!(100.00),
            NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(75.50),
            NaiveDate::from_ymd_opt(2024, 2, 10).unwrap(),
            "Transport",
        ),
        create_test_transaction(
            dec!(25.00),
            NaiveDate::from_ymd_opt(2024, 2, 20).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(50.00),
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
    let txns = vec![
        create_test_transaction(
            dec!(50.00),
            NaiveDate::from_ymd_opt(2024, 3, 10).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(25.50),
            NaiveDate::from_ymd_opt(2024, 3, 12).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(30.00),
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
            dec!(50.00),
            NaiveDate::from_ymd_opt(2024, 3, 5).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(25.50),
            NaiveDate::from_ymd_opt(2024, 3, 12).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(30.00),
            NaiveDate::from_ymd_opt(2024, 3, 15).unwrap(),
            "Transport",
        ),
        create_test_transaction(
            dec!(100.00),
            NaiveDate::from_ymd_opt(2024, 2, 10).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(75.00),
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
            dec!(150.00),
            NaiveDate::from_ymd_opt(2024, 3, 5).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(100.00),
            NaiveDate::from_ymd_opt(2024, 3, 12).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(75.00),
            NaiveDate::from_ymd_opt(2024, 3, 15).unwrap(),
            "Transport",
        ),
        create_test_transaction(
            dec!(200.00),
            NaiveDate::from_ymd_opt(2024, 2, 10).unwrap(),
            "Food",
        ),
        create_test_transaction(
            dec!(50.00),
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
