use std::collections::HashMap;

use anyhow::Result;
use chrono::NaiveDate;
use uuid::Uuid;

use crate::models::auto_categorization_job::TransactionCategoryUpdate;
use crate::services::repository_service::DatabaseRepository;
use crate::services::subscription_detection::cadence::{
    amount_coefficient_of_variation, classify_cadence, MIN_OCCURRENCES_LONG, MIN_OCCURRENCES_SHORT,
};

const DETECTION_WINDOW_MONTHS: i64 = 18;
const AMOUNT_CV_MAX: f64 = 0.35;

pub const ELIGIBLE_CATEGORIES: &[&str] = &["RENT_AND_UTILITIES", "LOAN_PAYMENTS", "INSURANCE"];

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
        .get_transactions_for_bill_detection(user_id, since)
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

    for (_normalized, group) in &groups {
        let already_processed = group
            .iter()
            .all(|t| t.category_primary == "BILL" || t.category_primary == "SUBSCRIPTION");
        if already_processed {
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

        for txn in &sorted {
            if txn.category_primary == "BILL" || txn.category_primary == "SUBSCRIPTION" {
                continue;
            }
            updates.push(TransactionCategoryUpdate {
                transaction_id: txn.id,
                category_primary: "BILL".to_string(),
                category_detailed: "Bill".to_string(),
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
