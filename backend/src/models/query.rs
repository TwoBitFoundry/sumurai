use axum::http::Uri;
use serde::Deserialize;

#[derive(Debug, Default)]
pub struct AnalyticsQueryParams {
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub account_ids: Vec<String>,
}

impl AnalyticsQueryParams {
    pub fn from_uri(uri: &Uri) -> Self {
        let query_string = uri.query().unwrap_or("");
        let mut params = Self::default();

        for pair in query_string.split('&') {
            if let Some((key, value)) = pair.split_once('=') {
                match key {
                    "start_date" => params.start_date = Some(value.to_string()),
                    "end_date" => params.end_date = Some(value.to_string()),
                    "account_ids" => params.account_ids.push(value.to_string()),
                    _ => {}
                }
            }
        }

        params
    }

    pub fn parse_start_date(&self) -> Option<chrono::NaiveDate> {
        self.start_date
            .as_deref()
            .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
    }

    pub fn parse_end_date(&self) -> Option<chrono::NaiveDate> {
        self.end_date
            .as_deref()
            .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
    }
}

#[derive(Debug, Default)]
pub struct BalancesQueryParams {
    pub account_ids: Vec<String>,
}

impl BalancesQueryParams {
    pub fn from_uri(uri: &Uri) -> Self {
        let query_string = uri.query().unwrap_or("");
        let mut params = Self::default();

        for pair in query_string.split('&') {
            if pair.starts_with("account_ids=") {
                if let Some(value) = pair.split('=').nth(1) {
                    params.account_ids.push(value.to_string());
                }
            }
        }

        params
    }
}

#[derive(Deserialize)]
pub struct DailySpendingQuery {
    pub month: Option<String>, // Format: YYYY-MM
}
