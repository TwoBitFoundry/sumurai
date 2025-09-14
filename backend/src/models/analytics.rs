use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct MonthlySpending {
    pub month: String,
    pub total: Decimal,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CategorySpending {
    pub name: String,
    pub value: Decimal,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DailySpending {
    pub day: u32,
    pub spend: Decimal,
    pub cumulative: Decimal,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PeriodComparison {
    pub current: Decimal,
    pub previous: Decimal,
    pub change: Decimal,
    pub change_percent: Decimal,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TopMerchant {
    pub name: String,
    pub amount: Decimal,
    pub count: u32,
    pub percentage: Decimal,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DailyTrend {
    pub date: String,
    pub amount: Decimal,
    pub display_date: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetWorthSeriesPoint {
    pub date: String,
    pub value: Decimal,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct NetWorthDataPoint {
    pub date: String,
    pub net_worth: Decimal,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetWorthOverTimeResponse {
    pub series: Vec<NetWorthSeriesPoint>,
    pub currency: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BalanceCategory {
    Cash,
    Credit,
    Loan,
    Investments,
}

#[derive(Deserialize)]
pub struct DateRangeQuery {
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Deserialize)]
pub struct MonthlyTotalsQuery {
    pub months: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Totals {
    pub cash: Decimal,
    pub credit: Decimal,
    pub loan: Decimal,
    pub investments: Decimal,
    pub positives_total: Decimal,
    pub negatives_total: Decimal,
    pub net: Decimal,
    pub ratio: Option<Decimal>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BankTotals {
    pub bank_id: String,
    pub bank_name: String,
    #[serde(flatten)]
    pub totals: Totals,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BalancesOverviewResponse {
    pub as_of: String,
    pub overall: Totals,
    pub banks: Vec<BankTotals>,
    pub mixed_currency: bool,
}

fn round2(v: Decimal) -> Decimal {
    v.round_dp(2)
}

pub fn finalize_totals(
    cash: Decimal,
    credit: Decimal,
    loan: Decimal,
    investments: Decimal,
) -> Totals {
    let positives = cash + investments;
    let negatives = credit + loan;
    let net = positives + negatives;
    let ratio = if negatives == Decimal::ZERO {
        None
    } else {
        let denom = (-negatives).max(Decimal::ONE);
        Some(round2(positives / denom))
    };
    Totals {
        cash: round2(cash),
        credit: round2(credit),
        loan: round2(loan),
        investments: round2(investments),
        positives_total: round2(positives),
        negatives_total: round2(negatives),
        net: round2(net),
        ratio,
    }
}
