use std::collections::HashSet;

use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::Json,
};
use chrono::{Datelike, NaiveDate};
use uuid::Uuid;

use crate::middleware::resource_authorization::AuthorizedQuery;
use crate::models::analytics::{
    AnalyticsFilter, AnalyticsRange, BalancesOverviewQuery, BalancesOverviewResponse,
    BudgetSummary, CashFlowResponse, CategorySpending, DailySpending, DateBoundsResponse,
    DateRangeQuery, IncomeExpenseTotals, MonthlySpending, NetWorthOverTimeResponse, SankeyResponse,
    TopMerchant,
};
use crate::models::app_state::AppState;
use crate::models::auth::AuthContext;

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

#[utoipa::path(
    get,
    path = "/api/analytics/spending/current-month",
    description = "Calculates the user's total spending for the current calendar month.",
    responses(
        (status = 200, description = "Current month spending total", body = String, example = json!("845.30")),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Analytics"
)]
pub async fn get_authenticated_current_month_spending(
    State(state): State<AppState>,
    auth_context: AuthContext,
    _headers: HeaderMap,
) -> Result<Json<rust_decimal::Decimal>, StatusCode> {
    state
        .analytics()
        .current_month_spending(auth_context.user_id)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    get,
    path = "/api/analytics/daily-spending",
    description = "Provides daily spending totals for a given month (defaults to current month).",
    params(("month" = Option<String>, Query, description = "Month in YYYY-MM format (defaults to current month)")),
    responses(
        (status = 200, description = "Daily spending data", body = Vec<DailySpending>),
        (status = 400, description = "Invalid month format"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Analytics"
)]
pub async fn get_authenticated_daily_spending(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Query(params): Query<crate::models::query::DailySpendingQuery>,
) -> Result<Json<Vec<DailySpending>>, StatusCode> {
    let (year, month) = parse_month_param(params.month)?;

    state
        .analytics()
        .daily_spending(auth_context.user_id, year, month)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    get,
    path = "/api/analytics/income-expense-totals",
    description = "Calculates the user's year-to-date income and expenses over the supplied date range.",
    params(("start_date" = Option<String>, Query, description = "Start date in YYYY-MM-DD format"),
           ("end_date" = Option<String>, Query, description = "End date in YYYY-MM-DD format"),
           ("account_ids" = Option<Vec<String>>, Query, description = "Filter by account IDs")),
    responses(
        (status = 200, description = "Income and expense totals", body = IncomeExpenseTotals),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Analytics"
)]
pub async fn get_authenticated_income_expense_totals(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedQuery {
        query,
        authorized_account_ids,
    }: AuthorizedQuery<DateRangeQuery>,
) -> Result<Json<crate::models::analytics::IncomeExpenseTotals>, StatusCode> {
    let filter = lenient_analytics_filter(&query, authorized_account_ids);

    state
        .analytics()
        .income_expense_totals(auth_context.user_id, filter)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    get,
    path = "/api/analytics/budget-summary",
    description = "Calculates budget income and category spending over the supplied date range.",
    params(("start_date" = Option<String>, Query, description = "Start date in YYYY-MM-DD format"),
           ("end_date" = Option<String>, Query, description = "End date in YYYY-MM-DD format"),
           ("account_ids" = Option<Vec<String>>, Query, description = "Filter by account IDs")),
    responses(
        (status = 200, description = "Budget summary", body = BudgetSummary),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Analytics"
)]
pub async fn get_authenticated_budget_summary(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedQuery {
        query,
        authorized_account_ids,
    }: AuthorizedQuery<DateRangeQuery>,
) -> Result<Json<BudgetSummary>, StatusCode> {
    let filter = lenient_analytics_filter(&query, authorized_account_ids);

    state
        .analytics()
        .budget_summary(auth_context.user_id, filter)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    get,
    path = "/api/analytics/spending",
    description = "Aggregates spending across a user-defined date range.",
    params(("start_date" = Option<String>, Query, description = "Start date in YYYY-MM-DD format"),
           ("end_date" = Option<String>, Query, description = "End date in YYYY-MM-DD format"),
           ("account_ids" = Option<Vec<String>>, Query, description = "Filter by account IDs")),
    responses(
        (status = 200, description = "Total spending for date range", body = String, example = json!("1540.22")),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Analytics"
)]
pub async fn get_authenticated_spending_by_date_range(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedQuery {
        query,
        authorized_account_ids,
    }: AuthorizedQuery<DateRangeQuery>,
) -> Result<Json<rust_decimal::Decimal>, StatusCode> {
    let filter = lenient_analytics_filter(&query, authorized_account_ids);

    state
        .analytics()
        .spending_by_date_range(auth_context.user_id, filter)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    get,
    path = "/api/analytics/categories",
    description = "Returns category-level spend for the supplied filters.",
    params(("start_date" = Option<String>, Query, description = "Start date in YYYY-MM-DD format"),
           ("end_date" = Option<String>, Query, description = "End date in YYYY-MM-DD format"),
           ("account_ids" = Option<Vec<String>>, Query, description = "Filter by account IDs")),
    responses(
        (status = 200, description = "Spending breakdown by category", body = Vec<CategorySpending>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Analytics"
)]
pub async fn get_authenticated_category_spending(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedQuery {
        query,
        authorized_account_ids,
    }: AuthorizedQuery<DateRangeQuery>,
) -> Result<Json<Vec<CategorySpending>>, StatusCode> {
    let filter = lenient_analytics_filter(&query, authorized_account_ids);

    state
        .analytics()
        .category_spending(auth_context.user_id, filter)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    get,
    path = "/api/analytics/monthly-totals",
    description = "Produces a timeline of monthly totals for dashboard charts.",
    params(("start_date" = String, Query, description = "Start date in YYYY-MM-DD format"),
           ("end_date" = String, Query, description = "End date in YYYY-MM-DD format"),
           ("account_ids" = Option<Vec<String>>, Query, description = "Filter by account IDs"),
           ("exclude_account_ids" = Option<Vec<String>>, Query, description = "Exclude these account IDs (ignored when account_ids is set)")),
    responses(
        (status = 200, description = "Monthly spending totals", body = Vec<MonthlySpending>),
        (status = 400, description = "Invalid date range"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Analytics"
)]
pub async fn get_authenticated_monthly_totals(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedQuery {
        query,
        authorized_account_ids,
    }: AuthorizedQuery<DateRangeQuery>,
) -> Result<Json<Vec<MonthlySpending>>, StatusCode> {
    let range = parse_analytics_range(&query, authorized_account_ids)?;

    state
        .analytics()
        .monthly_totals(auth_context.user_id, range)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    get,
    path = "/api/analytics/date-bounds",
    description = "Returns the earliest available transaction date in the active account scope and today's date as the maximum supported dashboard date.",
    params(("account_ids" = Option<Vec<String>>, Query, description = "Include only these account IDs"),
           ("exclude_account_ids" = Option<Vec<String>>, Query, description = "Exclude these account IDs (ignored when account_ids is set)")),
    responses(
        (status = 200, description = "Available date bounds for dashboard analytics", body = DateBoundsResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Analytics"
)]
pub async fn get_authenticated_date_bounds(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedQuery {
        authorized_account_ids,
        ..
    }: AuthorizedQuery<BalancesOverviewQuery>,
) -> Result<Json<DateBoundsResponse>, StatusCode> {
    state
        .analytics()
        .date_bounds(auth_context.user_id, authorized_account_ids)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    get,
    path = "/api/analytics/cash-flow",
    description = "Produces a timeline of monthly income, expenses, and net savings for dashboard charts.",
    params(("start_date" = String, Query, description = "Start date in YYYY-MM-DD format"),
           ("end_date" = String, Query, description = "End date in YYYY-MM-DD format"),
           ("account_ids" = Option<Vec<String>>, Query, description = "Include only these account IDs"),
           ("exclude_account_ids" = Option<Vec<String>>, Query, description = "Exclude these account IDs (ignored when account_ids is set)")),
    responses(
        (status = 200, description = "Monthly cash flow data", body = CashFlowResponse),
        (status = 400, description = "Invalid date range"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Analytics"
)]
pub async fn get_authenticated_cash_flow(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedQuery {
        query,
        authorized_account_ids,
    }: AuthorizedQuery<DateRangeQuery>,
) -> Result<Json<CashFlowResponse>, StatusCode> {
    let range = parse_analytics_range(&query, authorized_account_ids)?;

    state
        .analytics()
        .cash_flow(auth_context.user_id, range)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    get,
    path = "/api/analytics/sankey",
    description = "Produces a cached Sankey money-flow view centered on Expenses for the requested date range and account scope.",
    params(("start_date" = String, Query, description = "Start date in YYYY-MM-DD format"),
           ("end_date" = String, Query, description = "End date in YYYY-MM-DD format"),
           ("account_ids" = Option<Vec<String>>, Query, description = "Filter by account IDs")),
    responses(
        (status = 200, description = "Sankey money-flow data", body = SankeyResponse),
        (status = 400, description = "Bad request"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Analytics"
)]
pub async fn get_authenticated_sankey(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedQuery {
        query,
        authorized_account_ids,
    }: AuthorizedQuery<DateRangeQuery>,
) -> Result<Json<crate::models::analytics::SankeyResponse>, StatusCode> {
    let range = parse_analytics_range(&query, authorized_account_ids)?;

    state
        .analytics()
        .sankey(auth_context.user_id, &auth_context.jwt_id, range)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    get,
    path = "/api/analytics/top-merchants",
    description = "Surfaces the top merchants by spend within the filter window.",
    params(("start_date" = Option<String>, Query, description = "Start date in YYYY-MM-DD format"),
           ("end_date" = Option<String>, Query, description = "End date in YYYY-MM-DD format"),
           ("account_ids" = Option<Vec<String>>, Query, description = "Filter by account IDs")),
    responses(
        (status = 200, description = "Top merchants by spending", body = Vec<TopMerchant>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Analytics"
)]
pub async fn get_authenticated_top_merchants(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedQuery {
        query,
        authorized_account_ids,
    }: AuthorizedQuery<DateRangeQuery>,
) -> Result<Json<Vec<TopMerchant>>, StatusCode> {
    let filter = lenient_analytics_filter(&query, authorized_account_ids);

    state
        .analytics()
        .top_merchants(auth_context.user_id, filter)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    get,
    path = "/api/analytics/balances/overview",
    description = "Aggregates balances by institution and overall totals, with optional account filtering.",
    params(("account_ids" = Option<Vec<String>>, Query, description = "Filter by account IDs")),
    responses(
        (status = 200, description = "Balance overview across all institutions", body = BalancesOverviewResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Analytics"
)]
pub async fn get_authenticated_balances_overview(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedQuery {
        query: _,
        authorized_account_ids,
    }: AuthorizedQuery<BalancesOverviewQuery>,
) -> Result<Json<crate::models::analytics::BalancesOverviewResponse>, StatusCode> {
    state
        .analytics()
        .balances_overview(
            auth_context.user_id,
            &auth_context.jwt_id,
            authorized_account_ids,
        )
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    get,
    path = "/api/analytics/net-worth-over-time",
    description = "Generates a historical net worth series between the supplied start and end dates.",
    params(("start_date" = String, Query, description = "Start date in YYYY-MM-DD format"),
           ("end_date" = String, Query, description = "End date in YYYY-MM-DD format"),
           ("account_ids" = Option<Vec<String>>, Query, description = "Filter by account IDs")),
    responses(
        (status = 200, description = "Net worth trend over time", body = NetWorthOverTimeResponse),
        (status = 400, description = "Invalid date format or end_date before start_date"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Analytics"
)]
pub async fn get_authenticated_net_worth_over_time(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedQuery {
        query,
        authorized_account_ids,
    }: AuthorizedQuery<crate::models::analytics::DateRangeQuery>,
) -> Result<Json<crate::models::analytics::NetWorthOverTimeResponse>, StatusCode> {
    let range = parse_analytics_range(&query, authorized_account_ids)?;

    state
        .analytics()
        .net_worth_over_time(auth_context.user_id, &auth_context.jwt_id, range)
        .await
        .map(Json)
        .map_err(Into::into)
}
