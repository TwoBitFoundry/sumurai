use crate::models::analytics::{
    BalanceCategory, CategorySpending, DailySpending, MonthlySpending, TopMerchant,
};
use crate::models::transaction::Transaction;
use chrono::Datelike;
use rust_decimal::Decimal;

pub struct AnalyticsService;

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

    pub fn group_by_category_with_date_range(
        &self,
        transactions: &[Transaction],
        start_date: Option<chrono::NaiveDate>,
        end_date: Option<chrono::NaiveDate>,
    ) -> Vec<CategorySpending> {
        let filtered_transactions = self.filter_by_date_range(transactions, start_date, end_date);
        Self::group_transactions_by_category(filtered_transactions)
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
}
