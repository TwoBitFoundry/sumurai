#![allow(dead_code)]

pub const AMOUNT_CV_MAX: f64 = 0.15;
pub const MIN_OCCURRENCES_SHORT: usize = 3;
pub const MIN_OCCURRENCES_LONG: usize = 2;

const WEEKLY_TARGET: i64 = 7;
const WEEKLY_TOLERANCE: i64 = 2;
const BIWEEKLY_TARGET: i64 = 14;
const BIWEEKLY_TOLERANCE: i64 = 2;
const MONTHLY_TARGET: i64 = 30;
const MONTHLY_TOLERANCE: i64 = 5;
const QUARTERLY_TARGET: i64 = 91;
const QUARTERLY_TOLERANCE: i64 = 10;
const ANNUAL_TARGET: i64 = 365;
const ANNUAL_TOLERANCE: i64 = 20;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Cadence {
    Weekly,
    Biweekly,
    Monthly,
    Quarterly,
    Annual,
}

impl Cadence {
    pub fn as_str(&self) -> &'static str {
        match self {
            Cadence::Weekly => "weekly",
            Cadence::Biweekly => "biweekly",
            Cadence::Monthly => "monthly",
            Cadence::Quarterly => "quarterly",
            Cadence::Annual => "annual",
        }
    }

    pub fn is_long(&self) -> bool {
        matches!(self, Cadence::Quarterly | Cadence::Annual)
    }
}

fn within(gap: i64, target: i64, tolerance: i64) -> bool {
    (gap - target).abs() <= tolerance
}

pub fn classify_cadence(day_gaps: &[i64]) -> Option<Cadence> {
    if day_gaps.is_empty() {
        return None;
    }

    let mean = day_gaps.iter().sum::<i64>() as f64 / day_gaps.len() as f64;

    let all_fit =
        |target: i64, tolerance: i64| day_gaps.iter().all(|&g| within(g, target, tolerance));

    if all_fit(WEEKLY_TARGET, WEEKLY_TOLERANCE) {
        Some(Cadence::Weekly)
    } else if all_fit(BIWEEKLY_TARGET, BIWEEKLY_TOLERANCE) {
        Some(Cadence::Biweekly)
    } else if within(mean as i64, MONTHLY_TARGET, MONTHLY_TOLERANCE)
        && day_gaps.iter().all(|&g| within(g, MONTHLY_TARGET, 10))
    {
        Some(Cadence::Monthly)
    } else if all_fit(QUARTERLY_TARGET, QUARTERLY_TOLERANCE) {
        Some(Cadence::Quarterly)
    } else if all_fit(ANNUAL_TARGET, ANNUAL_TOLERANCE) {
        Some(Cadence::Annual)
    } else {
        None
    }
}

pub fn amount_coefficient_of_variation(amounts: &[f64]) -> f64 {
    if amounts.len() < 2 {
        return 0.0;
    }
    let mean = amounts.iter().sum::<f64>() / amounts.len() as f64;
    if mean == 0.0 {
        return 0.0;
    }
    let variance = amounts.iter().map(|a| (a - mean).powi(2)).sum::<f64>() / amounts.len() as f64;
    variance.sqrt() / mean
}

pub fn normalize_to_monthly_cost(representative_amount: f64, cadence: Cadence) -> f64 {
    match cadence {
        Cadence::Weekly => representative_amount * (52.0 / 12.0),
        Cadence::Biweekly => representative_amount * (26.0 / 12.0),
        Cadence::Monthly => representative_amount,
        Cadence::Quarterly => representative_amount / 3.0,
        Cadence::Annual => representative_amount / 12.0,
    }
}
