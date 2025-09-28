use crate::models::analytics::{
    BalanceCategory, CategorySpending, DailySpending, DailyTrend, MonthlySpending,
    NetWorthDataPoint, PeriodComparison, TopMerchant,
};
use crate::models::transaction::Transaction;
use chrono::Datelike;
use rust_decimal::Decimal;

pub struct AnalyticsService;

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

    pub fn filter_by_period<'a>(
        &self,
        transactions: &'a [Transaction],
        period: &str,
    ) -> Vec<&'a Transaction> {
        if let Some((start, end)) = Self::get_period_date_range(period) {
            transactions
                .iter()
                .filter(|t| t.date >= start && t.date <= end)
                .collect()
        } else {
            transactions.iter().collect()
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
        amount.round_dp(2)
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
            if transaction.amount <= Decimal::ZERO {
                continue;
            }
            let category_name = Self::get_category_name(transaction);
            *category_map.entry(category_name).or_insert(Decimal::ZERO) += transaction.amount;
        }

        category_map
            .into_iter()
            .map(|(name, value)| CategorySpending { name, value })
            .collect()
    }

    pub fn group_by_category(
        &self,
        transactions: &[Transaction],
        period: &str,
    ) -> Vec<CategorySpending> {
        let filtered_transactions = self.filter_by_period(transactions, period);
        Self::group_transactions_by_category(filtered_transactions)
    }

    pub fn group_by_cat(&self, transactions: &[Transaction]) -> Vec<CategorySpending> {
        Self::group_transactions_by_category(transactions.iter().collect())
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

    pub fn limit_categories_to_ten(
        &self,
        categories: Vec<CategorySpending>,
    ) -> Vec<CategorySpending> {
        let mut sorted = categories;
        sorted.sort_by(|a, b| b.value.cmp(&a.value));

        if sorted.len() <= 10 {
            return sorted;
        }

        let mut result = sorted[0..9].to_vec();

        let other_value: Decimal = sorted[9..].iter().map(|cat| cat.value).sum();

        if other_value > Decimal::ZERO {
            result.push(CategorySpending {
                name: "Other".to_string(),
                value: other_value,
            });
        }

        result
    }

    pub fn get_period_comparison(
        &self,
        transactions: &[Transaction],
        date_range: &str,
    ) -> PeriodComparison {
        use chrono::Duration;

        let now = chrono::Utc::now().naive_utc().date();
        let current_year = now.year();
        let current_month = now.month();

        let (current_start, current_end, previous_start, previous_end) = match date_range {
            "current-month" => {
                let (current_period_start, current_period_end) =
                    Self::get_month_range_static(current_year, current_month);
                let (previous_year, previous_month) =
                    Self::get_previous_month_info(current_year, current_month);
                let (previous_period_start, previous_period_end) =
                    Self::get_month_range_static(previous_year, previous_month);

                (
                    current_period_start,
                    current_period_end,
                    previous_period_start,
                    previous_period_end,
                )
            }
            "all-time" => {
                let mut dates: Vec<chrono::NaiveDate> =
                    transactions.iter().map(|t| t.date).collect();
                dates.sort();

                if dates.is_empty() {
                    let _today = now;
                    return PeriodComparison {
                        current: Decimal::ZERO,
                        previous: Decimal::ZERO,
                        change: Decimal::ZERO,
                        change_percent: Decimal::ZERO,
                    };
                }

                let earliest = dates[0];
                let latest = dates[dates.len() - 1];
                let total_days = latest.signed_duration_since(earliest).num_days();
                let half_point = earliest + Duration::days(total_days / 2);

                (half_point, latest, earliest, half_point)
            }
            _ => {
                let (current_period_start, current_period_end) =
                    Self::get_month_range_static(current_year, current_month);
                let (previous_year, previous_month) =
                    Self::get_previous_month_info(current_year, current_month);
                let (previous_period_start, previous_period_end) =
                    Self::get_month_range_static(previous_year, previous_month);

                (
                    current_period_start,
                    current_period_end,
                    previous_period_start,
                    previous_period_end,
                )
            }
        };

        let current_spend: Decimal = transactions
            .iter()
            .filter(|t| t.date >= current_start && t.date <= current_end)
            .map(|t| t.amount)
            .sum();

        let previous_spend: Decimal = transactions
            .iter()
            .filter(|t| t.date >= previous_start && t.date <= previous_end)
            .map(|t| t.amount)
            .sum();

        let change = current_spend - previous_spend;
        let change_percent = if previous_spend > Decimal::ZERO {
            (change / previous_spend) * Decimal::from(100)
        } else {
            Decimal::ZERO
        };

        PeriodComparison {
            current: Self::round_amount(current_spend),
            previous: Self::round_amount(previous_spend),
            change: Self::round_amount(change),
            change_percent: Self::round_percentage(change_percent),
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
            let month_key = format!(
                "{}-{:02}",
                transaction.date.year(),
                transaction.date.month()
            );
            *monthly_totals.entry(month_key).or_insert(Decimal::ZERO) += transaction.amount;
        }

        let mut result: Vec<MonthlySpending> = monthly_totals
            .into_iter()
            .map(|(month, total)| MonthlySpending { month, total })
            .collect();

        result.sort_by(|a, b| a.month.cmp(&b.month));

        if result.len() > months as usize {
            result.truncate(months as usize);
        }

        result
    }

    pub fn get_top_merchants(
        &self,
        transactions: &[Transaction],
        limit: usize,
    ) -> Vec<TopMerchant> {
        use std::collections::HashMap;

        let mut merchant_map: HashMap<String, (Decimal, u32)> = HashMap::new();

        for transaction in transactions {
            if transaction.amount <= Decimal::ZERO {
                continue;
            }
            let merchant_name = transaction
                .merchant_name
                .clone()
                .unwrap_or_else(|| "Unknown Merchant".to_string());

            let entry = merchant_map
                .entry(merchant_name)
                .or_insert((Decimal::ZERO, 0));
            entry.0 += transaction.amount;
            entry.1 += 1;
        }

        let total_spend: Decimal = transactions
            .iter()
            .filter(|t| t.amount > Decimal::ZERO)
            .map(|t| t.amount)
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

        merchants.sort_by(|a, b| b.amount.cmp(&a.amount));

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

    pub fn get_daily_spending_by_date_range(
        &self,
        transactions: &[Transaction],
        start_date: Option<chrono::NaiveDate>,
        end_date: Option<chrono::NaiveDate>,
    ) -> Vec<DailyTrend> {
        use chrono::Duration;
        use std::collections::HashMap;

        let filtered_transactions = self.filter_by_date_range(transactions, start_date, end_date);

        if filtered_transactions.is_empty() {
            return vec![];
        }

        let (actual_start, actual_end) = if let (Some(s), Some(e)) = (start_date, end_date) {
            (s, e)
        } else {
            let mut dates: Vec<chrono::NaiveDate> =
                filtered_transactions.iter().map(|t| t.date).collect();
            dates.sort();
            (dates[0], dates[dates.len() - 1])
        };

        let mut day_map: HashMap<String, Decimal> = HashMap::new();
        for transaction in filtered_transactions {
            let date_key = transaction.date.format("%Y-%m-%d").to_string();
            *day_map.entry(date_key).or_insert(Decimal::ZERO) += transaction.amount;
        }

        let mut result = Vec::new();
        let mut current_date = actual_start;

        while current_date <= actual_end {
            let date_key = current_date.format("%Y-%m-%d").to_string();
            let amount =
                Self::round_amount(day_map.get(&date_key).copied().unwrap_or(Decimal::ZERO));

            let display_date = current_date.format("%b %-d").to_string();

            result.push(DailyTrend {
                date: date_key,
                amount,
                display_date,
            });

            current_date += Duration::days(1);
        }

        result
    }

    // Removed: day-of-week spending helpers (no API route exposed)

    pub fn calculate_current_month_spending(&self, transactions: &[Transaction]) -> Decimal {
        let now = chrono::Utc::now().naive_utc().date();
        let (start, end) = self.get_month_range(now.year(), now.month());
        transactions
            .iter()
            .filter(|t| t.date >= start && t.date <= end)
            .map(|t| t.amount)
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
            if t.date.year() == year && t.date.month() == month {
                let idx = (t.date.day() - 1) as usize;
                totals[idx] += t.amount;
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

    pub fn get_net_worth_over_time(
        &self,
        transactions: &[Transaction],
        start_date: chrono::NaiveDate,
        end_date: chrono::NaiveDate,
    ) -> Vec<NetWorthDataPoint> {
        use rust_decimal_macros::dec;
        use std::collections::BTreeMap;

        // Filter transactions within date range
        let mut filtered_transactions: Vec<&Transaction> = transactions
            .iter()
            .filter(|t| t.date >= start_date && t.date <= end_date)
            .collect();

        // Sort transactions by date
        filtered_transactions.sort_by_key(|t| t.date);

        // Group transactions by date and calculate running balance
        let mut daily_balances = BTreeMap::new();
        let mut running_balance = dec!(0.00);

        for transaction in &filtered_transactions {
            running_balance += transaction.amount;
            daily_balances.insert(transaction.date, running_balance);
        }

        // Convert to data points
        daily_balances
            .into_iter()
            .map(|(date, net_worth)| NetWorthDataPoint {
                date: date.to_string(),
                net_worth,
            })
            .collect()
    }
}
