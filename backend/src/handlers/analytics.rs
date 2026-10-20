use std::collections::HashSet;

use axum::http::StatusCode;
use chrono::{Datelike, NaiveDate};
use uuid::Uuid;

use crate::models::analytics::DateRangeQuery;
use crate::services::analytics_orchestrator::{
    AnalyticsFilter, AnalyticsOrchestrationError, AnalyticsRange,
};

impl From<AnalyticsOrchestrationError> for StatusCode {
    fn from(error: AnalyticsOrchestrationError) -> Self {
        match error {
            AnalyticsOrchestrationError::InvalidMonth => StatusCode::BAD_REQUEST,
            AnalyticsOrchestrationError::LoadSpendingTransactions
            | AnalyticsOrchestrationError::LoadIncomeExpenseTotals
            | AnalyticsOrchestrationError::LoadBudgetSummary
            | AnalyticsOrchestrationError::LoadCategorySpending
            | AnalyticsOrchestrationError::LoadDateBounds
            | AnalyticsOrchestrationError::LoadCashFlow
            | AnalyticsOrchestrationError::LoadAccounts
            | AnalyticsOrchestrationError::LoadSankeyIncome
            | AnalyticsOrchestrationError::LoadSankeyTransactions
            | AnalyticsOrchestrationError::LoadBalances
            | AnalyticsOrchestrationError::LoadLedgerTransactions => {
                StatusCode::INTERNAL_SERVER_ERROR
            }
        }
    }
}

pub fn lenient_analytics_filter(
    query: &DateRangeQuery,
    authorized_account_ids: Option<HashSet<Uuid>>,
) -> AnalyticsFilter {
    AnalyticsFilter {
        start_date: query.start_date.as_deref().and_then(parse_date),
        end_date: query.end_date.as_deref().and_then(parse_date),
        account_ids: authorized_account_ids,
    }
}

pub fn parse_analytics_range(
    query: &DateRangeQuery,
    authorized_account_ids: Option<HashSet<Uuid>>,
) -> Result<AnalyticsRange, StatusCode> {
    let start_date = query
        .start_date
        .as_deref()
        .and_then(parse_date)
        .ok_or(StatusCode::BAD_REQUEST)?;
    let end_date = query
        .end_date
        .as_deref()
        .and_then(parse_date)
        .ok_or(StatusCode::BAD_REQUEST)?;

    if end_date < start_date {
        return Err(StatusCode::BAD_REQUEST);
    }

    Ok(AnalyticsRange {
        start_date,
        end_date,
        account_ids: authorized_account_ids,
    })
}

pub fn parse_month_param(month: Option<String>) -> Result<(i32, u32), StatusCode> {
    match month {
        Some(month_str) => {
            let parts: Vec<&str> = month_str.split('-').collect();
            if parts.len() == 2 {
                let year = parts[0]
                    .parse::<i32>()
                    .map_err(|_| StatusCode::BAD_REQUEST)?;
                let month = parts[1]
                    .parse::<u32>()
                    .map_err(|_| StatusCode::BAD_REQUEST)?;
                Ok((year, month))
            } else {
                Err(StatusCode::BAD_REQUEST)
            }
        }
        None => {
            let now = chrono::Utc::now().naive_utc().date();
            Ok((now.year(), now.month()))
        }
    }
}

fn parse_date(raw: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(raw, "%Y-%m-%d").ok()
}
