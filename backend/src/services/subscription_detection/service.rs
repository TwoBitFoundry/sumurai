#![allow(dead_code)]

use std::collections::HashMap;

use anyhow::Result;
use chrono::NaiveDate;
use uuid::Uuid;

use crate::models::auto_categorization_job::TransactionCategoryUpdate;
use crate::services::repository_service::DatabaseRepository;

use super::cadence::{
    amount_coefficient_of_variation, classify_cadence, normalize_to_monthly_cost, AMOUNT_CV_MAX,
    MIN_OCCURRENCES_LONG, MIN_OCCURRENCES_SHORT,
};
use super::exclusions::is_excluded;

const DETECTION_WINDOW_MONTHS: i64 = 18;

pub const ELIGIBLE_CATEGORIES: &[&str] = &[
    "ENTERTAINMENT",
    "GENERAL_SERVICES",
    "GENERAL_MERCHANDISE",
    "RENT_AND_UTILITIES",
    "PERSONAL_CARE",
];

pub async fn detect_and_assign_for_user<R: DatabaseRepository + ?Sized>(
    repo: &R,
    user_id: &Uuid,
) -> Result<usize> {
    let since = chrono::Local::now()
        .naive_local()
        .date()
        .checked_sub_months(chrono::Months::new(DETECTION_WINDOW_MONTHS as u32))
        .unwrap_or(NaiveDate::from_ymd_opt(2000, 1, 1).unwrap());

    let transactions = repo
        .get_transactions_for_subscription_detection(user_id, since)
        .await?;

    let mut groups: HashMap<String, Vec<_>> = HashMap::new();
    for txn in &transactions {
        let key = txn.normalized_merchant.clone().unwrap_or_default();
        if key.is_empty() {
            continue;
        }
        groups.entry(key).or_default().push(txn);
    }

    let mut updates: Vec<TransactionCategoryUpdate> = Vec::new();

    for (normalized, group) in &groups {
        if is_excluded(normalized) {
            continue;
        }

        let already_subscription = group.iter().all(|t| t.category_primary == "SUBSCRIPTION");
        if already_subscription {
            continue;
        }

        let mut sorted = group.clone();
        sorted.sort_by_key(|t| t.date);

        let dates: Vec<NaiveDate> = sorted.iter().map(|t| t.date).collect();
        let day_gaps: Vec<i64> = dates.windows(2).map(|w| (w[1] - w[0]).num_days()).collect();

        let Some(cadence) = classify_cadence(&day_gaps) else {
            continue;
        };

        let min_occurrences = if cadence.is_long() {
            MIN_OCCURRENCES_LONG
        } else {
            MIN_OCCURRENCES_SHORT
        };

        if sorted.len() < min_occurrences {
            continue;
        }

        let amounts: Vec<f64> = sorted
            .iter()
            .map(|t| t.amount.abs().try_into().unwrap_or(0.0f64))
            .collect();

        if amount_coefficient_of_variation(&amounts) > AMOUNT_CV_MAX {
            continue;
        }

        let representative_amount = amounts.iter().copied().fold(0.0f64, f64::max);
        let _ = normalize_to_monthly_cost(representative_amount, cadence);

        for txn in &sorted {
            if txn.category_primary == "SUBSCRIPTION" {
                continue;
            }
            updates.push(TransactionCategoryUpdate {
                transaction_id: txn.id,
                category_primary: "SUBSCRIPTION".to_string(),
                category_detailed: "Subscription".to_string(),
                category_confidence: "HIGH".to_string(),
            });
        }
    }

    let count = updates.len();
    if !updates.is_empty() {
        repo.update_transaction_categories_batch(user_id, &updates)
            .await?;
    }

    Ok(count)
}
