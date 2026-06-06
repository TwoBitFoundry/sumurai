#![allow(dead_code)]

use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::services::subscription_detection::cadence::Cadence;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct SubscriptionSummary {
    pub merchant: String,
    pub normalized_merchant: String,
    #[schema(value_type = String)]
    pub monthly_cost: Decimal,
    pub cadence: String,
    pub first_charged: NaiveDate,
    pub last_charged: NaiveDate,
    pub occurrence_count: i64,
}

impl SubscriptionSummary {
    #[allow(clippy::too_many_arguments)]
    pub fn from_cadence(
        merchant: String,
        normalized_merchant: String,
        representative_amount: Decimal,
        cadence: Cadence,
        first_charged: NaiveDate,
        last_charged: NaiveDate,
        occurrence_count: i64,
    ) -> Self {
        let monthly_cost_f64 =
            crate::services::subscription_detection::cadence::normalize_to_monthly_cost(
                representative_amount.abs().try_into().unwrap_or(0.0f64),
                cadence.clone(),
            );
        let monthly_cost =
            Decimal::try_from(monthly_cost_f64).unwrap_or(representative_amount.abs());
        Self {
            merchant,
            normalized_merchant,
            monthly_cost,
            cadence: cadence.as_str().to_string(),
            first_charged,
            last_charged,
            occurrence_count,
        }
    }
}
