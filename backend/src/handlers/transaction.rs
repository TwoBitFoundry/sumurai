use std::collections::HashSet;

use axum::{extract::State, http::StatusCode, response::Json};
use chrono::NaiveDate;
use uuid::Uuid;

use crate::middleware::resource_authorization::AuthorizedQuery;
use crate::models::app_state::AppState;
use crate::models::auth::AuthContext;
use crate::models::transaction::{
    ContextualInsightsResponse, CursorTransactionsResponse, TransactionFilter,
    TransactionsInsightsResponse, TransactionsQuery,
};

const DEFAULT_PAGE_LIMIT: i64 = 40;
const MIN_PAGE_LIMIT: i64 = 1;
const MAX_PAGE_LIMIT: i64 = 100;

pub(crate) fn normalize_page_limit(limit: Option<i64>) -> i64 {
    limit
        .unwrap_or(DEFAULT_PAGE_LIMIT)
        .clamp(MIN_PAGE_LIMIT, MAX_PAGE_LIMIT)
}

pub(crate) fn trimmed(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

#[utoipa::path(
    get,
    path = "/api/transactions",
    description = "Returns cursor-paginated transactions with optional filtering.",
    params(("search" = Option<String>, Query, description = "Fuzzy search by merchant, category, or account"),
           ("account_ids" = Option<Vec<String>>, Query, description = "Filter by account IDs"),
           ("cursor" = Option<String>, Query, description = "Opaque cursor from next_cursor; omit for first page"),
           ("limit" = Option<i64>, Query, description = "Page size, default 40, clamped 1..=100"),
           ("merchant" = Option<String>, Query, description = "Exact normalized-merchant match"),
           ("start_date" = Option<String>, Query, description = "Start date in YYYY-MM-DD format"),
           ("end_date" = Option<String>, Query, description = "End date in YYYY-MM-DD format"),
           ("category_primary" = Option<String>, Query, description = "Filter by effective primary category"),
           ("sort" = Option<String>, Query, description = "Reserved – not implemented; default date"),
           ("order" = Option<String>, Query, description = "Reserved – not implemented; default desc")),
    responses(
        (status = 200, description = "Cursor-paginated transactions", body = CursorTransactionsResponse),
        (status = 400, description = "Invalid date range or account filter"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Account filter references another user"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Transactions"
)]
pub async fn get_authenticated_transactions(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedQuery {
        query,
        authorized_account_ids,
    }: AuthorizedQuery<TransactionsQuery>,
) -> Result<Json<CursorTransactionsResponse>, StatusCode> {
    let TransactionsQuery {
        search,
        account_ids: _,
        cursor,
        limit,
        merchant,
        start_date,
        end_date,
        category_primary,
    } = query;

    let mut filter = parse_transaction_filter(
        search,
        category_primary,
        start_date.as_deref(),
        end_date.as_deref(),
        authorized_account_ids.as_ref(),
    )?;
    filter.merchant = merchant;

    let limit = normalize_page_limit(limit);
    let search = trimmed(filter.search.as_deref());
    let category_primary = trimmed(filter.category_primary.as_deref());
    let merchant = trimmed(filter.merchant.as_deref());
    let account_ids = filter.account_ids.as_deref();

    tracing::info!(
        search = ?search,
        limit,
        has_cursor = cursor.is_some(),
        "Transactions keyset query params"
    );

    let result = state
        .db_repository
        .get_transactions_keyset(
            &auth_context.user_id,
            limit,
            cursor.as_deref(),
            search,
            account_ids,
            filter.start_date,
            filter.end_date,
            category_primary,
            merchant,
        )
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to fetch transactions for user {}: {}",
                auth_context.user_id,
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    tracing::info!(
        record_count = result.transactions.len(),
        has_more = result.has_more,
        "Data access: transactions"
    );

    Ok(Json(result))
}

#[utoipa::path(
    get,
    path = "/api/transactions/insights",
    description = "Returns aggregated transaction insights for the current filters.",
    params(("search" = Option<String>, Query, description = "Search transactions by merchant, category, or account"),
           ("account_ids" = Option<Vec<String>>, Query, description = "Filter by account IDs"),
           ("start_date" = Option<String>, Query, description = "Start date in YYYY-MM-DD format"),
           ("end_date" = Option<String>, Query, description = "End date in YYYY-MM-DD format"),
           ("category_primary" = Option<String>, Query, description = "Filter by primary category")),
    responses(
        (status = 200, description = "Transaction insights", body = TransactionsInsightsResponse),
        (status = 400, description = "Invalid account filter"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Account filter references another user"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Transactions"
)]
pub async fn get_authenticated_transactions_insights(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedQuery {
        query,
        authorized_account_ids,
    }: AuthorizedQuery<TransactionsQuery>,
) -> Result<Json<TransactionsInsightsResponse>, StatusCode> {
    let TransactionsQuery {
        search,
        account_ids: _,
        cursor: _,
        limit: _,
        merchant: _,
        start_date,
        end_date,
        category_primary,
    } = query;

    let filter = parse_transaction_filter(
        search,
        category_primary,
        start_date.as_deref(),
        end_date.as_deref(),
        authorized_account_ids.as_ref(),
    )?;

    state
        .db_repository
        .get_transactions_insights(
            &auth_context.user_id,
            trimmed(filter.search.as_deref()),
            filter.account_ids.as_deref(),
            filter.start_date,
            filter.end_date,
            trimmed(filter.category_primary.as_deref()),
        )
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!(
                "Failed to load transaction insights for user {}: {}",
                auth_context.user_id,
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

#[utoipa::path(
    get,
    path = "/api/transactions/contextual-insights",
    description = "Returns contextual transaction insights driven by the active filter state.",
    params(
        ("search" = Option<String>, Query, description = "Search transactions by merchant, category, or account"),
        ("account_ids" = Option<Vec<String>>, Query, description = "Filter by account IDs"),
        ("start_date" = Option<String>, Query, description = "Start date in YYYY-MM-DD format"),
        ("end_date" = Option<String>, Query, description = "End date in YYYY-MM-DD format"),
        ("category_primary" = Option<String>, Query, description = "Filter by primary category")
    ),
    responses(
        (status = 200, description = "Contextual transaction insights", body = ContextualInsightsResponse),
        (status = 400, description = "Invalid date or account filter"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Account filter references another user"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Transactions"
)]
pub async fn get_authenticated_transactions_contextual_insights(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedQuery {
        query,
        authorized_account_ids,
    }: AuthorizedQuery<TransactionsQuery>,
) -> Result<Json<ContextualInsightsResponse>, StatusCode> {
    let TransactionsQuery {
        search,
        account_ids: _,
        cursor: _,
        limit: _,
        merchant: _,
        start_date,
        end_date,
        category_primary,
    } = query;

    let filter = parse_transaction_filter(
        search,
        category_primary,
        start_date.as_deref(),
        end_date.as_deref(),
        authorized_account_ids.as_ref(),
    )?;

    state
        .db_repository
        .get_transactions_contextual_insights(
            &auth_context.user_id,
            trimmed(filter.search.as_deref()),
            filter.account_ids.as_deref(),
            filter.start_date,
            filter.end_date,
            trimmed(filter.category_primary.as_deref()),
        )
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!(
                "Failed to load contextual insights for user {}: {}",
                auth_context.user_id,
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })
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
