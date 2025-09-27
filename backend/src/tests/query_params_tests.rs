use crate::models::query::{AnalyticsQueryParams, BalancesQueryParams};
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