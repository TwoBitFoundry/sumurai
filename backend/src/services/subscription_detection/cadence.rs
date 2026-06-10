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
const MONTHLY_GAP_TOLERANCE: i64 = 6;
const SHORT_MONTHLY_AVG_GAP_DAYS: i64 = 22;
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
        && day_gaps
            .iter()
            .all(|&g| within(g, MONTHLY_TARGET, MONTHLY_GAP_TOLERANCE))
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

fn median_gap(day_gaps: &[i64]) -> i64 {
    let mut sorted = day_gaps.to_vec();
    sorted.sort_unstable();
    let mid = sorted.len() / 2;
    if sorted.is_empty() {
        return MONTHLY_TARGET;
    }
    if sorted.len().is_multiple_of(2) {
        (sorted[mid - 1] + sorted[mid]) / 2
    } else {
        sorted[mid]
    }
}

pub fn nearest_cadence_for_gap(gap_days: i64) -> Cadence {
    const CANDIDATES: [(Cadence, i64); 5] = [
        (Cadence::Weekly, WEEKLY_TARGET),
        (Cadence::Biweekly, BIWEEKLY_TARGET),
        (Cadence::Monthly, MONTHLY_TARGET),
        (Cadence::Quarterly, QUARTERLY_TARGET),
        (Cadence::Annual, ANNUAL_TARGET),
    ];

    CANDIDATES
        .into_iter()
        .min_by_key(|(_, target)| (gap_days - target).abs())
        .map(|(cadence, _)| cadence)
        .unwrap_or(Cadence::Monthly)
}

pub fn resolve_cadence(day_gaps: &[i64]) -> Cadence {
    if day_gaps.is_empty() {
        return Cadence::Monthly;
    }

    if let Some(cadence) = classify_cadence(day_gaps) {
        if cadence == Cadence::Monthly && median_gap(day_gaps) < SHORT_MONTHLY_AVG_GAP_DAYS {
            return nearest_cadence_for_gap(median_gap(day_gaps));
        }
        return cadence;
    }

    nearest_cadence_for_gap(median_gap(day_gaps))
}

pub fn reconcile_cadence_with_span(
    cadence: Cadence,
    occurrence_count: usize,
    span_days: i64,
) -> Cadence {
    if occurrence_count < 2 || span_days <= 0 {
        return cadence;
    }

    let avg_gap = span_days as f64 / (occurrence_count - 1) as f64;
    if cadence == Cadence::Monthly && avg_gap < SHORT_MONTHLY_AVG_GAP_DAYS as f64 {
        return nearest_cadence_for_gap(avg_gap.round() as i64);
    }

    cadence
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
