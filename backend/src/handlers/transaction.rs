use std::collections::HashSet;

use axum::http::StatusCode;
use chrono::NaiveDate;
use uuid::Uuid;

use crate::services::transaction_orchestrator::{TransactionFilter, TransactionOrchestrationError};

impl From<TransactionOrchestrationError> for StatusCode {
    fn from(_error: TransactionOrchestrationError) -> Self {
        StatusCode::INTERNAL_SERVER_ERROR
    }
}

pub fn parse_transaction_filter(
    search: Option<String>,
    category_primary: Option<String>,
    start_date: Option<&str>,
    end_date: Option<&str>,
    authorized_account_ids: Option<&HashSet<Uuid>>,
) -> Result<TransactionFilter, StatusCode> {
    let start_date = parse_filter_date(start_date)?;
    let end_date = parse_filter_date(end_date)?;

    if let (Some(start_date), Some(end_date)) = (start_date, end_date) {
        if end_date < start_date {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    let account_ids: Option<Vec<Uuid>> =
        authorized_account_ids.map(|ids| ids.iter().copied().collect());

    Ok(TransactionFilter {
        search,
        merchant: None,
        category_primary,
        account_ids,
        start_date,
        end_date,
    })
}

fn parse_filter_date(raw: Option<&str>) -> Result<Option<NaiveDate>, StatusCode> {
    raw.map(|raw| NaiveDate::parse_from_str(raw, "%Y-%m-%d").map_err(|_| StatusCode::BAD_REQUEST))
        .transpose()
}
