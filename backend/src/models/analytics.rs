use rust_decimal::Decimal;
use serde::de::{self, Deserializer, IgnoredAny, MapAccess, Visitor};
use serde::{Deserialize, Serialize};
use std::fmt;
use utoipa::ToSchema;

#[allow(unused_imports)]
use serde_json::json;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[schema(example = json!({"month": "2024-01", "total": "1250.40"}))]
pub struct MonthlySpending {
    pub month: String,
    #[schema(value_type = String)]
    pub total: Decimal,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
#[schema(example = json!({"name": "groceries", "value": "450.00"}))]
pub struct CategorySpending {
    pub name: String,
    #[schema(value_type = String)]
    pub value: Decimal,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[schema(example = json!({"day": 15, "spend": "75.60", "cumulative": "890.25"}))]
pub struct DailySpending {
    pub day: u32,
    #[schema(value_type = String)]
    pub spend: Decimal,
    #[schema(value_type = String)]
    pub cumulative: Decimal,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[schema(example = json!({"name": "Coffee Collective", "amount": "125.75", "count": 8, "percentage": "12.50"}))]
pub struct TopMerchant {
    pub name: String,
    #[schema(value_type = String)]
    pub amount: Decimal,
    pub count: u32,
    #[schema(value_type = String)]
    pub percentage: Decimal,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[schema(example = json!({"date": "2024-01-31", "value": "12500.90"}))]
pub struct NetWorthSeriesPoint {
    pub date: String,
    #[schema(value_type = String)]
    pub value: Decimal,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[schema(example = json!({
    "series": [
        {"date": "2024-01-31", "value": "12500.90"},
        {"date": "2024-02-29", "value": "13150.25"}
    ],
    "currency": "USD"
}))]
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

pub struct DateRangeQuery {
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub account_ids: Vec<String>,
}

pub struct MonthlyTotalsQuery {
    pub months: Option<u32>,
    pub account_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, ToSchema)]
#[serde(rename_all = "camelCase")]
#[schema(example = json!({
    "cash": "9500.00",
    "credit": "-2500.00",
    "loan": "-15000.00",
    "investments": "12000.00",
    "positives_total": "21500.00",
    "negatives_total": "-17500.00",
    "net": "4000.00",
    "ratio": "1.23"
}))]
pub struct Totals {
    #[schema(value_type = String)]
    pub cash: Decimal,
    #[schema(value_type = String)]
    pub credit: Decimal,
    #[schema(value_type = String)]
    pub loan: Decimal,
    #[schema(value_type = String)]
    pub investments: Decimal,
    #[schema(value_type = String)]
    pub positives_total: Decimal,
    #[schema(value_type = String)]
    pub negatives_total: Decimal,
    #[schema(value_type = String)]
    pub net: Decimal,
    #[schema(value_type = Option<String>)]
    pub ratio: Option<Decimal>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, ToSchema)]
#[serde(rename_all = "camelCase")]
#[schema(example = json!({
    "bank_id": "bank-1",
    "bank_name": "Demo Bank",
    "cash": "5000.00",
    "credit": "-1200.00",
    "loan": "0.00",
    "investments": "2500.00",
    "positives_total": "7500.00",
    "negatives_total": "-1200.00",
    "net": "6300.00",
    "ratio": "1.40"
}))]
pub struct BankTotals {
    pub bank_id: String,
    pub bank_name: String,
    #[serde(flatten)]
    pub totals: Totals,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, ToSchema)]
#[serde(rename_all = "camelCase")]
#[schema(example = json!({
    "as_of": "2024-02-15T12:00:00Z",
    "overall": {
        "cash": "9500.00",
        "credit": "-2500.00",
        "loan": "-15000.00",
        "investments": "12000.00",
        "positives_total": "21500.00",
        "negatives_total": "-17500.00",
        "net": "4000.00",
        "ratio": "1.23"
    },
    "banks": [{
        "bank_id": "bank-1",
        "bank_name": "Demo Bank",
        "cash": "5000.00",
        "credit": "-1200.00",
        "loan": "0.00",
        "investments": "2500.00",
        "positives_total": "7500.00",
        "negatives_total": "-1200.00",
        "net": "6300.00",
        "ratio": "1.40"
    }],
    "mixed_currency": false
}))]
pub struct BalancesOverviewResponse {
    pub as_of: String,
    pub overall: Totals,
    pub banks: Vec<BankTotals>,
    pub mixed_currency: bool,
}

impl<'de> Deserialize<'de> for DateRangeQuery {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct DateRangeVisitor;

        impl<'de> Visitor<'de> for DateRangeVisitor {
            type Value = DateRangeQuery;

            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("date range query parameters")
            }

            fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
            where
                A: MapAccess<'de>,
            {
                let mut start_date: Option<Option<String>> = None;
                let mut end_date: Option<Option<String>> = None;
                let mut account_ids: Vec<String> = Vec::new();

                while let Some(key) = map.next_key::<String>()? {
                    match key.as_str() {
                        "start_date" => {
                            if start_date.is_some() {
                                return Err(de::Error::duplicate_field("start_date"));
                            }
                            start_date = Some(map.next_value()?);
                        }
                        "end_date" => {
                            if end_date.is_some() {
                                return Err(de::Error::duplicate_field("end_date"));
                            }
                            end_date = Some(map.next_value()?);
                        }
                        "account_ids" | "account_ids[]" | "account_ids%5B%5D" => {
                            let values: VecOrOne<String> = map.next_value()?;
                            account_ids.extend(values.into_vec());
                        }
                        _ => {
                            map.next_value::<IgnoredAny>()?;
                        }
                    }
                }

                Ok(DateRangeQuery {
                    start_date: start_date.unwrap_or(None),
                    end_date: end_date.unwrap_or(None),
                    account_ids,
                })
            }
        }

        deserializer.deserialize_map(DateRangeVisitor)
    }
}

impl<'de> Deserialize<'de> for MonthlyTotalsQuery {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct MonthlyTotalsVisitor;

        impl<'de> Visitor<'de> for MonthlyTotalsVisitor {
            type Value = MonthlyTotalsQuery;

            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("monthly totals query parameters")
            }

            fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
            where
                A: MapAccess<'de>,
            {
                let mut months: Option<Option<u32>> = None;
                let mut account_ids: Vec<String> = Vec::new();

                while let Some(key) = map.next_key::<String>()? {
                    match key.as_str() {
                        "months" => {
                            if months.is_some() {
                                return Err(de::Error::duplicate_field("months"));
                            }
                            months = Some(map.next_value()?);
                        }
                        "account_ids" | "account_ids[]" | "account_ids%5B%5D" => {
                            let values: VecOrOne<String> = map.next_value()?;
                            account_ids.extend(values.into_vec());
                        }
                        _ => {
                            map.next_value::<IgnoredAny>()?;
                        }
                    }
                }

                Ok(MonthlyTotalsQuery {
                    months: months.unwrap_or(None),
                    account_ids,
                })
            }
        }

        deserializer.deserialize_map(MonthlyTotalsVisitor)
    }
}

#[derive(Deserialize)]
#[serde(untagged)]
enum VecOrOne<T> {
    Vec(Vec<T>),
    One(T),
}

impl<T> VecOrOne<T> {
    fn into_vec(self) -> Vec<T> {
        match self {
            VecOrOne::Vec(vec) => vec,
            VecOrOne::One(item) => vec![item],
        }
    }
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
