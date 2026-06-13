//! Aggregated analytics queries for dashboards.

use crate::models::analytics::{
    BalanceCategory, CashFlowPoint, CategorySpending, DailySpending, MonthlyCashFlowAggregate,
    MonthlySpending, SankeyLink, SankeyNode, SankeyNodeKind, SankeyResponse, SankeySummary,
    TopMerchant,
};
use crate::models::transaction::Transaction;
use crate::services::repository_service::{
    is_excluded_analytics_category, is_transfer_category, DatabaseRepository,
    EXCLUDED_ANALYTICS_CATEGORY_PRIMARIES,
};
use anyhow::Result;
use chrono::Datelike;
use rust_decimal::Decimal;
use uuid::Uuid;

pub struct SpendingTransactionQuery<'a> {
    pub start_date: Option<chrono::NaiveDate>,
    pub end_date: Option<chrono::NaiveDate>,
    pub account_ids: Option<&'a [Uuid]>,
}

pub struct AnalyticsService;

fn truncate_to_latest_months<T>(result: &mut Vec<T>, months: u32) {
    let keep = months as usize;
    if result.len() > keep {
        let drop_count = result.len() - keep;
        result.drain(0..drop_count);
    }
}

#[allow(dead_code)]
impl AnalyticsService {
    pub fn map_account_to_balance_category(
        account_type: &str,
        account_subtype: Option<&str>,
    ) -> BalanceCategory {
        let t = account_type.to_lowercase();
        match t.as_str() {
            "depository" => BalanceCategory::Cash,
            "credit" => BalanceCategory::Credit,
            "loan" => BalanceCategory::Loan,
            "investment" => BalanceCategory::Investments,
            _ => {
                // Fallback: try to infer based on subtype keywords, else Investments
                if let Some(st) = account_subtype {
                    let st = st.to_lowercase();
                    if st.contains("credit") {
                        return BalanceCategory::Credit;
                    }
                    if st.contains("loan") {
                        return BalanceCategory::Loan;
                    }
                    if st.contains("checking") || st.contains("savings") {
                        return BalanceCategory::Cash;
                    }
                    if st.contains("credit") {
                        return BalanceCategory::Credit;
                    }
                    if st.contains("loan") {
                        return BalanceCategory::Loan;
                    }
                    if st.contains("checking") || st.contains("savings") {
                        return BalanceCategory::Cash;
                    }
                }
                BalanceCategory::Investments
            }
        }
    }

    pub fn compute_positive_negative_ratio(
        positives_total: Decimal,
        negatives_total: Decimal,
    ) -> Option<Decimal> {
        if negatives_total == Decimal::ZERO {
            return None;
        }
        let denom = (-negatives_total).max(Decimal::ONE);
        let ratio = positives_total / denom;
        Some(Self::round_amount(ratio))
    }

    pub fn new() -> Self {
        Self
    }

    pub async fn load_spending_transactions(
        &self,
        repository: &dyn DatabaseRepository,
        user_id: &Uuid,
        query: SpendingTransactionQuery<'_>,
    ) -> Result<Vec<Transaction>> {
        match (query.start_date, query.end_date) {
            (Some(start_date), Some(end_date)) => {
                repository
                    .get_spending_transactions_by_date_range_for_user(
                        user_id,
                        start_date,
                        end_date,
                        query.account_ids,
                    )
                    .await
            }
            _ => {
                repository
                    .get_spending_transactions_for_user(user_id, query.account_ids)
                    .await
            }
        }
    }

    pub fn current_month_date_range(&self) -> (chrono::NaiveDate, chrono::NaiveDate) {
        let now = chrono::Utc::now().naive_utc().date();
        Self::get_month_range_static(now.year(), now.month())
    }

    pub fn month_date_range(
        &self,
        year: i32,
        month: u32,
    ) -> Option<(chrono::NaiveDate, chrono::NaiveDate)> {
        chrono::NaiveDate::from_ymd_opt(year, month, 1)
            .map(|_| Self::get_month_range_static(year, month))
    }

    fn get_previous_month_info(year: i32, month: u32) -> (i32, u32) {
        if month == 1 {
            (year - 1, 12)
        } else {
            (year, month - 1)
        }
    }

    fn months_back(year: i32, month: u32, back: u32) -> (i32, u32) {
        let total_months = year * 12 + (month as i32) - 1 - (back as i32);
        let new_year = total_months.div_euclid(12);
        let new_month0 = total_months.rem_euclid(12); // 0..11
        (new_year, (new_month0 + 1) as u32)
    }

    pub fn get_period_date_range(period: &str) -> Option<(chrono::NaiveDate, chrono::NaiveDate)> {
        use chrono::Datelike;
        let now = chrono::Utc::now().naive_utc().date();
        let year = now.year();
        let month = now.month();

        match period {
            "current-month" => Some(Self::get_month_range_static(year, month)),
            "past-2-months" => {
                let (sy, sm) = Self::months_back(year, month, 1);
                Some((
                    chrono::NaiveDate::from_ymd_opt(sy, sm, 1).unwrap(),
                    // end of current month
                    if month == 12 {
                        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1)
                            .unwrap()
                            .pred_opt()
                            .unwrap()
                    } else {
                        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1)
                            .unwrap()
                            .pred_opt()
                            .unwrap()
                    },
                ))
            }
            "past-6-months" => {
                let (sy, sm) = Self::months_back(year, month, 5);
                Some((
                    chrono::NaiveDate::from_ymd_opt(sy, sm, 1).unwrap(),
                    if month == 12 {
                        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1)
                            .unwrap()
                            .pred_opt()
                            .unwrap()
                    } else {
                        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1)
                            .unwrap()
                            .pred_opt()
                            .unwrap()
                    },
                ))
            }
            "past-year" => {
                let (sy, sm) = Self::months_back(year, month, 11);
                Some((
                    chrono::NaiveDate::from_ymd_opt(sy, sm, 1).unwrap(),
                    if month == 12 {
                        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1)
                            .unwrap()
                            .pred_opt()
                            .unwrap()
                    } else {
                        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1)
                            .unwrap()
                            .pred_opt()
                            .unwrap()
                    },
                ))
            }
            _ => None,
        }
    }

    pub fn filter_by_date_range<'a>(
        &self,
        transactions: &'a [Transaction],
        start: Option<chrono::NaiveDate>,
        end: Option<chrono::NaiveDate>,
    ) -> Vec<&'a Transaction> {
        match (start, end) {
            (Some(s), Some(e)) => transactions
                .iter()
                .filter(|t| t.date >= s && t.date <= e)
                .collect(),
            _ => transactions.iter().collect(),
        }
    }

    fn round_amount(amount: Decimal) -> Decimal {
        if amount.is_zero() {
            Decimal::new(0, 2)
        } else {
            amount.round_dp(2)
        }
    }

    fn round_percentage(percentage: Decimal) -> Decimal {
        percentage.round_dp(1)
    }

    fn get_category_name(transaction: &Transaction) -> String {
        if transaction.category_primary.is_empty() {
            "Uncategorized".to_string()
        } else {
            transaction.category_primary.clone()
        }
    }

    pub fn group_transactions_by_category(
        transactions: Vec<&Transaction>,
    ) -> Vec<CategorySpending> {
        let mut category_map = std::collections::HashMap::new();

        for transaction in transactions {
            if transaction.amount >= Decimal::ZERO {
                continue;
            }
            let category_name = Self::get_category_name(transaction);
            *category_map.entry(category_name).or_insert(Decimal::ZERO) += -transaction.amount;
        }

        category_map
            .into_iter()
            .map(|(name, value)| CategorySpending { name, value })
            .collect()
    }

    pub fn group_by_category_with_date_range(
        &self,
        transactions: &[Transaction],
        start_date: Option<chrono::NaiveDate>,
        end_date: Option<chrono::NaiveDate>,
    ) -> Vec<CategorySpending> {
        let filtered_transactions = self.filter_by_date_range(transactions, start_date, end_date);
        Self::group_transactions_by_category(filtered_transactions)
    }

    fn sankey_id_from_category(name: &str) -> String {
        let mut id = String::from("category_");
        let mut previous_was_separator = false;

        for ch in name.chars() {
            if ch.is_ascii_alphanumeric() {
                id.push(ch.to_ascii_lowercase());
                previous_was_separator = false;
            } else if !previous_was_separator {
                id.push('_');
                previous_was_separator = true;
            }
        }

        id.trim_matches('_').to_string()
    }

    const FIXED_EXPENSE_CATEGORY_PRIMARIES: &'static [&'static str] = &[
        "SUBSCRIPTION",
        "RENT_AND_UTILITIES",
        "LOAN_PAYMENTS",
        "INSURANCE",
    ];

    fn is_fixed_expense_category(name: &str) -> bool {
        let normalized = name.trim().replace(' ', "_").to_uppercase();
        if normalized == "BILL" {
            return true;
        }
        Self::FIXED_EXPENSE_CATEGORY_PRIMARIES.contains(&normalized.as_str())
    }

    fn push_category_links(
        links: &mut Vec<SankeyLink>,
        source_id: &str,
        buckets: &[CategorySpending],
    ) {
        for bucket in buckets {
            let node_id = Self::sankey_id_from_category(&bucket.name);
            links.push(SankeyLink {
                source: source_id.to_string(),
                target: node_id,
                value: Self::round_amount(bucket.value),
            });
        }
    }

    fn push_category_nodes(nodes: &mut Vec<SankeyNode>, buckets: &[CategorySpending]) {
        for bucket in buckets {
            let node_id = Self::sankey_id_from_category(&bucket.name);
            nodes.push(SankeyNode {
                id: node_id,
                label: bucket.name.clone(),
                kind: SankeyNodeKind::Category,
            });
        }
    }

    pub fn build_sankey(
        &self,
        income_total: Decimal,
        mut category_buckets: Vec<CategorySpending>,
        currency: &str,
    ) -> SankeyResponse {
        category_buckets.retain(|bucket| bucket.value > Decimal::ZERO);
        category_buckets.sort_by(|a, b| b.value.cmp(&a.value).then_with(|| a.name.cmp(&b.name)));

        let income = Self::round_amount(income_total.max(Decimal::ZERO));
        let expenses = Self::round_amount(
            category_buckets
                .iter()
                .map(|bucket| bucket.value)
                .sum::<Decimal>(),
        );
        let covered = Self::round_amount(income.min(expenses));
        let deficit = Self::round_amount((expenses - income).max(Decimal::ZERO));
        let surplus = Self::round_amount((income - expenses).max(Decimal::ZERO));
        let coverage_ratio = if expenses > Decimal::ZERO {
            Some(Self::round_amount(covered / expenses))
        } else {
            None
        };

        if income == Decimal::ZERO && expenses == Decimal::ZERO {
            return SankeyResponse {
                nodes: Vec::new(),
                links: Vec::new(),
                currency: currency.to_string(),
                summary: SankeySummary {
                    income,
                    expenses,
                    covered,
                    deficit,
                    surplus,
                    coverage_ratio,
                },
            };
        }

        let mut nodes = vec![
            SankeyNode {
                id: "income".to_string(),
                label: "Income".to_string(),
                kind: SankeyNodeKind::Income,
            },
            SankeyNode {
                id: "expenses".to_string(),
                label: "Expenses".to_string(),
                kind: SankeyNodeKind::Expenses,
            },
        ];
        let mut links = Vec::new();

        if income > Decimal::ZERO {
            links.push(SankeyLink {
                source: "income".to_string(),
                target: "expenses".to_string(),
                value: covered,
            });
        }

        if deficit > Decimal::ZERO {
            nodes.push(SankeyNode {
                id: "debt".to_string(),
                label: "Debt".to_string(),
                kind: SankeyNodeKind::Deficit,
            });
            links.push(SankeyLink {
                source: "debt".to_string(),
                target: "expenses".to_string(),
                value: deficit,
            });
        }

        if surplus > Decimal::ZERO {
            nodes.push(SankeyNode {
                id: "savings".to_string(),
                label: "Savings".to_string(),
                kind: SankeyNodeKind::Savings,
            });
            links.push(SankeyLink {
                source: "income".to_string(),
                target: "savings".to_string(),
                value: surplus,
            });
        }

        let mut fixed_buckets = Vec::new();
        let mut free_buckets = Vec::new();
        for bucket in category_buckets {
            if Self::is_fixed_expense_category(&bucket.name) {
                fixed_buckets.push(bucket);
            } else {
                free_buckets.push(bucket);
            }
        }

        let fixed_total = Self::round_amount(
            fixed_buckets
                .iter()
                .map(|bucket| bucket.value)
                .sum::<Decimal>(),
        );
        let free_total = Self::round_amount(
            free_buckets
                .iter()
                .map(|bucket| bucket.value)
                .sum::<Decimal>(),
        );

        if fixed_total > Decimal::ZERO {
            nodes.push(SankeyNode {
                id: "fixed_expenses".to_string(),
                label: "Fixed Expenses".to_string(),
                kind: SankeyNodeKind::FixedExpenses,
            });
            links.push(SankeyLink {
                source: "expenses".to_string(),
                target: "fixed_expenses".to_string(),
                value: fixed_total,
            });
            Self::push_category_nodes(&mut nodes, &fixed_buckets);
            Self::push_category_links(&mut links, "fixed_expenses", &fixed_buckets);
        }

        if free_total > Decimal::ZERO {
            nodes.push(SankeyNode {
                id: "free_spending".to_string(),
                label: "Free Spending".to_string(),
                kind: SankeyNodeKind::FreeSpending,
            });
            links.push(SankeyLink {
                source: "expenses".to_string(),
                target: "free_spending".to_string(),
                value: free_total,
            });
            Self::push_category_nodes(&mut nodes, &free_buckets);
            Self::push_category_links(&mut links, "free_spending", &free_buckets);
        }

        SankeyResponse {
            nodes,
            links,
            currency: currency.to_string(),
            summary: SankeySummary {
                income,
                expenses,
                covered,
                deficit,
                surplus,
                coverage_ratio,
            },
        }
    }

    pub fn calculate_monthly_totals(
        &self,
        transactions: &[Transaction],
        months: u32,
    ) -> Vec<MonthlySpending> {
        use chrono::Datelike;

        let mut monthly_totals = std::collections::HashMap::new();

        for transaction in transactions {
            if transaction.amount >= Decimal::ZERO {
                continue;
            }
            let month_key = format!(
                "{}-{:02}",
                transaction.date.year(),
                transaction.date.month()
            );
            *monthly_totals.entry(month_key).or_insert(Decimal::ZERO) += -transaction.amount;
        }

        let mut result: Vec<MonthlySpending> = monthly_totals
            .into_iter()
            .map(|(month, total)| MonthlySpending { month, total })
            .collect();

        result.sort_by(|a, b| a.month.cmp(&b.month));
        truncate_to_latest_months(&mut result, months);

        result
    }

    pub fn calculate_cash_flow(
        &self,
        transactions: &[Transaction],
        months: u32,
    ) -> Vec<CashFlowPoint> {
        use chrono::Datelike;

        #[derive(Default)]
        struct MonthlyCashFlow {
            income: Decimal,
            expenses: Decimal,
        }

        let mut monthly_flows = std::collections::HashMap::new();

        for transaction in transactions {
            let month_key = format!(
                "{}-{:02}",
                transaction.date.year(),
                transaction.date.month()
            );
            let flow = monthly_flows
                .entry(month_key)
                .or_insert(MonthlyCashFlow::default());

            if transaction.amount > Decimal::ZERO
                && !is_transfer_category(&transaction.category_primary)
            {
                flow.income += transaction.amount;
            } else if transaction.amount < Decimal::ZERO
                && !is_excluded_analytics_category(&transaction.category_primary)
            {
                flow.expenses += -transaction.amount;
            }
        }

        let aggregates = monthly_flows
            .into_iter()
            .map(|(month, flow)| MonthlyCashFlowAggregate {
                month,
                income: flow.income,
                expenses: flow.expenses,
            })
            .collect::<Vec<_>>();

        self.cash_flow_from_monthly_aggregates(&aggregates, months)
    }

    pub fn cash_flow_from_monthly_aggregates(
        &self,
        aggregates: &[MonthlyCashFlowAggregate],
        months: u32,
    ) -> Vec<CashFlowPoint> {
        let mut result: Vec<CashFlowPoint> = aggregates
            .iter()
            .map(|aggregate| {
                let income = Self::round_amount(aggregate.income);
                let expenses = Self::round_amount(aggregate.expenses);
                CashFlowPoint {
                    month: aggregate.month.clone(),
                    income,
                    expenses,
                    net: Self::round_amount(income - expenses),
                }
            })
            .collect();

        result.sort_by(|a, b| a.month.cmp(&b.month));
        truncate_to_latest_months(&mut result, months);

        result
    }

    fn is_spending_for_top_merchants(transaction: &Transaction) -> bool {
        transaction.amount < Decimal::ZERO
            && !EXCLUDED_ANALYTICS_CATEGORY_PRIMARIES
                .contains(&transaction.category_primary.as_str())
    }

    pub fn get_top_merchants(
        &self,
        transactions: &[Transaction],
        limit: usize,
    ) -> Vec<TopMerchant> {
        use std::collections::HashMap;

        let mut merchant_map: HashMap<String, (Decimal, u32)> = HashMap::new();

        for transaction in transactions {
            if !Self::is_spending_for_top_merchants(transaction) {
                continue;
            }
            let merchant_name = transaction
                .merchant_name
                .clone()
                .unwrap_or_else(|| "Unknown Merchant".to_string());

            let entry = merchant_map
                .entry(merchant_name)
                .or_insert((Decimal::ZERO, 0));
            entry.0 += -transaction.amount;
            entry.1 += 1;
        }

        let total_spend: Decimal = transactions
            .iter()
            .filter(|t| Self::is_spending_for_top_merchants(t))
            .map(|t| -t.amount)
            .sum();

        let mut merchants: Vec<TopMerchant> = merchant_map
            .into_iter()
            .map(|(name, (amount, count))| {
                let percentage = if total_spend > Decimal::ZERO {
                    Self::round_percentage((amount / total_spend) * Decimal::from(100))
                } else {
                    Decimal::ZERO
                };

                TopMerchant {
                    name,
                    amount: Self::round_amount(amount),
                    count,
                    percentage,
                }
            })
            .collect();

        merchants.sort_by_key(|merchant| std::cmp::Reverse(merchant.amount));

        merchants.truncate(limit);

        merchants
    }

    pub fn get_top_merchants_with_date_range(
        &self,
        transactions: &[Transaction],
        start_date: Option<chrono::NaiveDate>,
        end_date: Option<chrono::NaiveDate>,
        limit: usize,
    ) -> Vec<TopMerchant> {
        let filtered_transactions = self.filter_by_date_range(transactions, start_date, end_date);
        let transactions_slice: Vec<Transaction> =
            filtered_transactions.into_iter().cloned().collect();
        self.get_top_merchants(&transactions_slice, limit)
    }

    pub fn calculate_current_month_spending(&self, transactions: &[Transaction]) -> Decimal {
        let now = chrono::Utc::now().naive_utc().date();
        let (start, end) = self.get_month_range(now.year(), now.month());
        transactions
            .iter()
            .filter(|t| t.date >= start && t.date <= end && t.amount < Decimal::ZERO)
            .map(|t| -t.amount)
            .sum()
    }

    pub fn calculate_daily_spending(
        &self,
        transactions: &[Transaction],
        year: i32,
        month: u32,
    ) -> Vec<DailySpending> {
        let days_in_month = chrono::NaiveDate::from_ymd_opt(year, month + 1, 1)
            .unwrap_or(chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap())
            .pred_opt()
            .unwrap()
            .day();
        let mut totals = vec![Decimal::ZERO; days_in_month as usize];
        for t in transactions {
            if t.date.year() == year && t.date.month() == month && t.amount < Decimal::ZERO {
                let idx = (t.date.day() - 1) as usize;
                totals[idx] += -t.amount;
            }
        }
        let mut cumulative = Decimal::ZERO;
        totals
            .into_iter()
            .enumerate()
            .map(|(i, spend)| {
                cumulative += spend;
                DailySpending {
                    day: (i + 1) as u32,
                    spend,
                    cumulative,
                }
            })
            .collect()
    }

    fn get_month_range_static(year: i32, month: u32) -> (chrono::NaiveDate, chrono::NaiveDate) {
        let start_date = chrono::NaiveDate::from_ymd_opt(year, month, 1).unwrap();
        let end_date = if month == 12 {
            chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1)
                .unwrap()
                .pred_opt()
                .unwrap()
        } else {
            chrono::NaiveDate::from_ymd_opt(year, month + 1, 1)
                .unwrap()
                .pred_opt()
                .unwrap()
        };
        (start_date, end_date)
    }

    fn get_month_range(&self, year: i32, month: u32) -> (chrono::NaiveDate, chrono::NaiveDate) {
        Self::get_month_range_static(year, month)
    }
}
