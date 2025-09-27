use axum::http::Uri;
use uuid::Uuid;

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

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::Uri;

    #[test]
    fn given_analytics_query_with_params_when_parsing_then_extracts_all_values() {
        let uri: Uri = "/test?start_date=2024-01-01&end_date=2024-01-31&account_ids=123&account_ids=456".parse().unwrap();
        let params = AnalyticsQueryParams::from_uri(&uri);

        assert_eq!(params.start_date, Some("2024-01-01".to_string()));
        assert_eq!(params.end_date, Some("2024-01-31".to_string()));
        assert_eq!(params.account_ids, vec!["123", "456"]);
    }

    #[test]
    fn given_empty_query_when_parsing_then_returns_defaults() {
        let uri: Uri = "/test".parse().unwrap();
        let params = AnalyticsQueryParams::from_uri(&uri);

        assert_eq!(params.start_date, None);
        assert_eq!(params.end_date, None);
        assert!(params.account_ids.is_empty());
    }

    #[test]
    fn given_valid_date_when_parsing_then_returns_naive_date() {
        let uri: Uri = "/test?start_date=2024-01-01".parse().unwrap();
        let params = AnalyticsQueryParams::from_uri(&uri);

        let start_date = params.parse_start_date();
        assert!(start_date.is_some());
        assert_eq!(start_date.unwrap().to_string(), "2024-01-01");
    }

    #[test]
    fn given_balances_query_with_account_ids_when_parsing_then_extracts_values() {
        let uri: Uri = "/test?account_ids=123&account_ids=456".parse().unwrap();
        let params = BalancesQueryParams::from_uri(&uri);

        assert_eq!(params.account_ids, vec!["123", "456"]);
    }
}