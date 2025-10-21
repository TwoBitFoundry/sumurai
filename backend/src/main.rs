use anyhow::Context;
use axum::{
    body::Body,
    extract::{Path, Query, Request, State},
    http::{header::CONTENT_TYPE, HeaderMap, StatusCode, Uri},
    middleware::{from_fn, Next},
    response::{IntoResponse, Json, Response},
    routing::{delete, get, post, put},
    Router,
};
use axum_tracing_opentelemetry::middleware::{OtelAxumLayer, OtelInResponseLayer};
use axum_tracing_opentelemetry::tracing_opentelemetry_instrumentation_sdk as otel_sdk;
use chrono::Utc;
use opentelemetry::trace::Tracer;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use uuid::Uuid;

#[allow(unused_imports)]
use serde_json::json;

mod auth_middleware;
mod config;
mod models;
mod openapi;
mod telemetry;

pub mod providers;
mod services;
#[cfg(test)]
mod tests;
mod utils;
#[cfg(test)]
pub use tests::test_fixtures;

use crate::models::analytics::{
    BalanceCategory, BalancesOverviewResponse, CategorySpending, DailySpending, MonthlySpending,
    NetWorthOverTimeResponse, TopMerchant,
};
use crate::models::app_state::AppState;
use crate::models::auth::{AuthContext, AuthMiddlewareState};
use crate::models::{
    account::AccountResponse,
    analytics::{DateRangeQuery, MonthlyTotalsQuery},
    auth as auth_models,
    budget::{Budget, CreateBudgetRequest, DeleteBudgetResponse, UpdateBudgetRequest},
    plaid::{
        ClearSyncedDataResponse, DisconnectRequest, DisconnectResult, ExchangeTokenRequest,
        ExchangeTokenResponse, LinkTokenRequest, LinkTokenResponse, ProviderConnectRequest,
        ProviderConnectResponse, ProviderConnectionStatus, ProviderInfoResponse,
        ProviderSelectRequest, ProviderSelectResponse, ProviderStatusResponse,
        SyncTransactionsRequest,
    },
    transaction::{SyncTransactionsResponse, TransactionsQuery},
};
use crate::models::{
    api_error::ApiErrorResponse,
    auth::{
        ChangePasswordRequest, ChangePasswordResponse, DeleteAccountResponse, LogoutResponse,
        OnboardingCompleteResponse, User,
    },
    transaction::TransactionWithAccount,
};
use auth_middleware::auth_middleware;
use config::Config;
use services::repository_service::{DatabaseRepository, PostgresRepository};
use services::{AnalyticsService, RealPlaidClient};
use services::{
    AuthService, BudgetService, CacheService, ConnectionService, ExchangeTokenError,
    LinkTokenError, PlaidService, ProviderSyncError, RedisCache, SyncConnectionParams, SyncService,
    TellerConnectError, TellerSyncError,
};
use sqlx::PgPool;
use telemetry::{with_bearer_token_attribute, TelemetryConfig};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let telemetry_config = TelemetryConfig::from_env();
    let telemetry = telemetry::init(&telemetry_config)?;
    tracing::info!(
        event = "startup_trace_probe",
        "Tracing formatter initialized test log"
    );

    if std::env::var("OTEL_STARTUP_TEST_SPAN")
        .map(|v| v == "1")
        .unwrap_or(false)
    {
        println!("Startup test span enabled; emitting probe span");
        let tracer = opentelemetry::global::tracer("startup-test");
        tracer.in_span("startup-test-span", |_cx| {
            println!("Emitting startup test span for OTLP connectivity check");
        });
        telemetry.force_flush()?;
    }

    let config = Config::from_env()?;

    let plaid_client = Arc::new(RealPlaidClient::new(
        std::env::var("PLAID_CLIENT_ID").unwrap_or_else(|_| "test_client_id".to_string()),
        std::env::var("PLAID_SECRET").unwrap_or_else(|_| "test_secret".to_string()),
        std::env::var("PLAID_ENV").unwrap_or_else(|_| "sandbox".to_string()),
    ));
    let plaid_service = Arc::new(PlaidService::new(plaid_client.clone()));
    let plaid_provider: Arc<dyn providers::FinancialDataProvider> =
        Arc::new(providers::PlaidProvider::new(plaid_client.clone()));
    let teller_provider: Arc<dyn providers::FinancialDataProvider> =
        Arc::new(providers::TellerProvider::new()?);

    let provider_registry = Arc::new(providers::ProviderRegistry::from_providers([
        ("plaid", Arc::clone(&plaid_provider)),
        ("teller", Arc::clone(&teller_provider)),
    ]));

    let sync_service = Arc::new(SyncService::new(
        provider_registry.clone(),
        config.get_default_provider(),
    ));

    let analytics_service = Arc::new(AnalyticsService::new());
    let budget_service = Arc::new(BudgetService::new());

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:password@localhost:5432/accounting".to_string());

    let pool = PgPool::connect(&database_url).await?;
    let db_repository: Arc<dyn DatabaseRepository> = Arc::new(PostgresRepository::new(pool)?);

    let redis_url =
        std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string());
    let cache_service: Arc<dyn CacheService> = Arc::new(RedisCache::new(&redis_url).await?);

    cache_service.health_check().await.map_err(|e| {
        anyhow::anyhow!(
            "Redis connection failed: {}. Redis is required for production deployment.",
            e
        )
    })?;
    tracing::info!("Redis connection verified successfully");

    // Clear all cached sessions on app startup for security
    if let Err(e) = cache_service.invalidate_pattern("*_session_valid").await {
        tracing::warn!("Failed to clear cached sessions on startup: {}", e);
    } else {
        tracing::info!("Cleared all cached sessions on app startup");
    }

    // Clear all JWT tokens on startup for security
    if let Err(e) = cache_service.invalidate_pattern("*_session_token").await {
        tracing::warn!("Failed to clear JWT tokens on startup: {}", e);
    } else {
        tracing::info!("Cleared all JWT tokens on app startup");
    }

    let connection_service = Arc::new(ConnectionService::new(
        db_repository.clone(),
        cache_service.clone(),
        provider_registry.clone(),
    ));

    let jwt_secret = std::env::var("JWT_SECRET").context(
        "JWT_SECRET environment variable is required. Generate one with `openssl rand -hex 32`.",
    )?;

    let auth_service = Arc::new(AuthService::new(jwt_secret)?);

    let state = AppState {
        plaid_service,
        plaid_client,
        sync_service,
        analytics_service,
        budget_service,
        config,
        db_repository,
        cache_service,
        connection_service,
        auth_service,
        provider_registry,
    };

    let app = create_app(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    tracing::info!("Server running on http://0.0.0.0:3000");
    axum::serve(listener, app).await?;

    telemetry.shutdown()?;

    Ok(())
}

pub fn create_app(state: AppState) -> Router {
    let public_routes = Router::new()
        .route("/health", get(health_check))
        .route("/api/auth/register", post(register_user))
        .route("/api/auth/login", post(login_user))
        .route("/api/auth/refresh", post(refresh_user_session))
        .route("/api/auth/logout", post(logout_user));

    let protected_routes = Router::new()
        .route(
            "/api/auth/onboarding/complete",
            put(complete_user_onboarding),
        )
        .route("/api/transactions", get(get_authenticated_transactions))
        .route("/api/providers/info", get(get_authenticated_provider_info))
        .route("/api/providers/select", post(select_authenticated_provider))
        .route(
            "/api/providers/connect",
            post(connect_authenticated_provider),
        )
        .route(
            "/api/providers/status",
            get(get_authenticated_provider_status),
        )
        .route(
            "/api/providers/accounts",
            get(get_authenticated_plaid_accounts),
        )
        .route(
            "/api/plaid/link-token",
            post(create_authenticated_link_token),
        )
        .route(
            "/api/plaid/exchange-token",
            post(exchange_authenticated_public_token),
        )
        .route("/api/plaid/accounts", get(get_authenticated_plaid_accounts))
        .route(
            "/api/providers/sync-transactions",
            post(sync_authenticated_provider_transactions),
        )
        .route(
            "/api/providers/disconnect",
            post(disconnect_authenticated_connection),
        )
        .route(
            "/api/plaid/clear-synced-data",
            post(clear_authenticated_synced_data),
        )
        .route(
            "/api/analytics/spending/current-month",
            get(get_authenticated_current_month_spending),
        )
        .route(
            "/api/analytics/spending",
            get(get_authenticated_spending_by_date_range),
        )
        .route(
            "/api/analytics/daily-spending",
            get(get_authenticated_daily_spending),
        )
        .route(
            "/api/analytics/categories",
            get(get_authenticated_category_spending),
        )
        .route(
            "/api/analytics/monthly-totals",
            get(get_authenticated_monthly_totals),
        )
        .route(
            "/api/analytics/top-merchants",
            get(get_authenticated_top_merchants),
        )
        .route(
            "/api/analytics/balances/overview",
            get(get_authenticated_balances_overview),
        )
        .route(
            "/api/analytics/net-worth-over-time",
            get(get_authenticated_net_worth_over_time),
        )
        .route("/api/budgets", get(get_authenticated_budgets))
        .route("/api/budgets", post(create_authenticated_budget))
        .route("/api/budgets/{id}", put(update_authenticated_budget))
        .route("/api/budgets/{id}", delete(delete_authenticated_budget))
        .route("/api/auth/change-password", put(change_user_password))
        .route("/api/auth/account", delete(delete_user_account))
        .layer(axum::middleware::from_fn_with_state(
            AuthMiddlewareState {
                auth_service: state.auth_service.clone(),
                cache_service: state.cache_service.clone(),
            },
            auth_middleware,
        ));

    let docs_routes = Router::new()
        .route("/api-docs/openapi.json", get(openapi_json_handler))
        .route("/scalar", get(scalar_handler));

    async fn openapi_json_handler() -> axum::Json<utoipa::openapi::OpenApi> {
        axum::Json(openapi::init_openapi())
    }

    async fn scalar_handler() -> axum::response::Html<String> {
        let openapi_spec = openapi::init_openapi();
        let mut html = utoipa_scalar::Scalar::new(openapi_spec).to_html();

        html = html.replace(
            r#"id="api-reference""#,
            r#"id="api-reference" data-configuration='{"theme":"elysiajs","darkMode":true,"layout":"modern","showSidebar":true,"hideClientButton":true,"hideModels":true}'"#
        );

        axum::response::Html(html)
    }

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .merge(docs_routes)
        .layer(from_fn(error_handling_middleware))
        .layer(from_fn(with_bearer_token_attribute))
        .layer(OtelInResponseLayer::default())
        .layer(OtelAxumLayer::default().try_extract_client_ip(true))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

async fn error_handling_middleware(request: Request<Body>, next: Next) -> Response {
    let response = next.run(request).await;
    let status = response.status();
    let has_json_content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|content_type| content_type.starts_with("application/json"))
        .unwrap_or(false);

    if status.is_server_error() {
        let trace_id = otel_sdk::find_current_trace_id();
        match trace_id.as_deref() {
            Some(trace_id) => {
                tracing::error!(status = %status, %trace_id, "request resulted in server error")
            }
            None => tracing::error!(status = %status, "request resulted in server error"),
        };
        if !has_json_content_type {
            let mut error = ApiErrorResponse::new(
                "INTERNAL_SERVER_ERROR",
                "An unexpected server error occurred",
            );
            error.details = trace_id.map(|id| json!({ "trace_id": id }));
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(error)).into_response();
        }
    } else if status.is_client_error() {
        if let Some(trace_id) = otel_sdk::find_current_trace_id() {
            tracing::warn!(status = %status, %trace_id, "request resulted in client error");
        } else {
            tracing::warn!(status = %status, "request resulted in client error");
        }
    }

    response
}

#[utoipa::path(
    post,
    path = "/api/auth/register",
    description = "Registers a new user and seeds default provider metadata.",
    request_body = auth_models::RegisterRequest,
    responses(
        (status = 200, description = "User registered successfully", body = auth_models::AuthResponse),
        (status = 409, description = "Email already registered", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    tag = "Authentication"
)]
async fn register_user(
    State(state): State<AppState>,
    Json(req): Json<auth_models::RegisterRequest>,
) -> Result<Json<auth_models::AuthResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    let password_hash = state
        .auth_service
        .hash_password(&req.password)
        .map_err(|e| {
            tracing::error!("Password hashing failed: {}", e);
            ApiErrorResponse::internal_server_error("Failed to process password")
        })?;

    let user_id = Uuid::new_v4();
    let user = User {
        id: user_id,
        email: req.email.clone(),
        password_hash,
        provider: state.config.get_default_provider().to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        onboarding_completed: false,
    };

    if let Err(e) = state.db_repository.create_user(&user).await {
        tracing::error!("User creation failed for email {}: {}", req.email, e);
        return Err(ApiErrorResponse::conflict(
            "Email address is already registered",
        ));
    }

    let auth_token = state.auth_service.generate_token(user_id).map_err(|e| {
        tracing::error!("Token generation failed for user {}: {}", user_id, e);
        ApiErrorResponse::internal_server_error("Failed to generate authentication token")
    })?;

    let ttl = (auth_token.expires_at - Utc::now()).num_seconds().max(0) as u64;
    if ttl > 0 {
        // Set session validity flag in cache with JWT TTL
        if let Err(e) = state
            .cache_service
            .set_session_valid(&auth_token.jwt_id, ttl)
            .await
        {
            tracing::warn!("Failed to set session validity in cache: {}", e);
        }

        // Cache JWT token for reuse
        if let Err(e) = state
            .cache_service
            .set_jwt_token(&auth_token.jwt_id, &auth_token.token, ttl)
            .await
        {
            tracing::warn!("Failed to cache JWT token: {}", e);
        }
    }

    let expires_at = auth_token.expires_at.to_rfc3339();

    Ok(Json(auth_models::AuthResponse {
        token: auth_token.token,
        user_id: user_id.to_string(),
        expires_at,
        onboarding_completed: false,
    }))
}

#[utoipa::path(
    post,
    path = "/api/auth/login",
    description = "Authenticates a user and returns a signed JWT for subsequent requests.",
    request_body = auth_models::LoginRequest,
    responses(
        (status = 200, description = "Login successful", body = auth_models::AuthResponse),
        (status = 401, description = "Invalid credentials", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    tag = "Authentication"
)]
async fn login_user(
    State(state): State<AppState>,
    Json(req): Json<auth_models::LoginRequest>,
) -> Result<Json<auth_models::AuthResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    let user = match state.db_repository.get_user_by_email(&req.email).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            tracing::info!("Login attempt with non-existent email: {}", req.email);
            return Err(ApiErrorResponse::unauthorized("Invalid email or password"));
        }
        Err(e) => {
            tracing::error!("Database error during login for email {}: {}", req.email, e);
            return Err(ApiErrorResponse::internal_server_error(
                "Authentication service temporarily unavailable",
            ));
        }
    };

    let is_valid = state
        .auth_service
        .verify_password(&req.password, &user.password_hash)
        .map_err(|e| {
            tracing::error!("Password verification failed for user {}: {}", user.id, e);
            ApiErrorResponse::internal_server_error("Authentication service error")
        })?;

    if !is_valid {
        tracing::info!(
            "Login attempt with invalid password for email: {}",
            req.email
        );
        return Err(ApiErrorResponse::unauthorized("Invalid email or password"));
    }

    let auth_token = state.auth_service.generate_token(user.id).map_err(|e| {
        tracing::error!("Token generation failed for user {}: {}", user.id, e);
        ApiErrorResponse::internal_server_error("Failed to generate authentication token")
    })?;

    let ttl = (auth_token.expires_at - Utc::now()).num_seconds().max(0) as u64;
    if ttl > 0 {
        // Set session validity flag in cache with JWT TTL
        if let Err(e) = state
            .cache_service
            .set_session_valid(&auth_token.jwt_id, ttl)
            .await
        {
            tracing::warn!("Failed to set session validity in cache: {}", e);
        }

        // Cache JWT token for reuse
        if let Err(e) = state
            .cache_service
            .set_jwt_token(&auth_token.jwt_id, &auth_token.token, ttl)
            .await
        {
            tracing::warn!("Failed to cache JWT token: {}", e);
        }
    }

    let expires_at = auth_token.expires_at.to_rfc3339();

    Ok(Json(auth_models::AuthResponse {
        token: auth_token.token,
        user_id: user.id.to_string(),
        expires_at,
        onboarding_completed: user.onboarding_completed,
    }))
}

#[utoipa::path(
    post,
    path = "/api/auth/logout",
    description = "Invalidates the active JWT and clears cached session state.",
    responses(
        (status = 200, description = "Logout successful", body = LogoutResponse),
        (status = 401, description = "Unauthorized")
    ),
    security(("bearer_auth" = [])),
    tag = "Authentication"
)]
async fn logout_user(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<LogoutResponse>, StatusCode> {
    let auth_header = headers
        .get("authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let claims = state
        .auth_service
        .validate_token(auth_header)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    if let Err(e) = state.cache_service.invalidate_session(&claims.jti).await {
        tracing::warn!("Failed to invalidate session during logout: {}", e);
    }

    if let Err(e) = state.cache_service.clear_jwt_scoped_data(&claims.jti).await {
        tracing::warn!("Failed to clear JWT-scoped data during logout: {}", e);
    }

    if let Err(e) = state.cache_service.clear_transactions().await {
        tracing::warn!("Failed to clear transaction cache during logout: {}", e);
    }

    Ok(Json(LogoutResponse {
        message: "Logged out successfully".to_string(),
        cleared_session: claims.jti,
    }))
}

#[utoipa::path(
    post,
    path = "/api/auth/refresh",
    description = "Exchanges an existing token for a refreshed bearer token.",
    responses(
        (status = 200, description = "Token refreshed successfully", body = auth_models::AuthResponse),
        (status = 401, description = "Unauthorized or session expired"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer_auth" = [])),
    tag = "Authentication"
)]
async fn refresh_user_session(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<auth_models::AuthResponse>, StatusCode> {
    let auth_header = headers
        .get("authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let claims = state
        .auth_service
        .validate_token_for_refresh(auth_header)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    match state.cache_service.is_session_valid(&claims.jti).await {
        Ok(true) => {}
        Ok(false) => {
            tracing::warn!("Refresh rejected: Session not found in cache (app may have restarted)");
            return Err(StatusCode::UNAUTHORIZED);
        }
        Err(e) => {
            tracing::error!("Cache error during refresh session validation: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    let user_id = Uuid::parse_str(&claims.user_id()).map_err(|_| StatusCode::BAD_REQUEST)?;

    // Get user from database to fetch onboarding status
    let user = state
        .db_repository
        .get_user_by_id(&user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let auth_token = state
        .auth_service
        .generate_token(user_id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let expires_at = chrono::Utc::now() + chrono::Duration::hours(1);

    // Cache refreshed JWT in Redis with TTL
    let ttl = (auth_token.expires_at - Utc::now()).num_seconds().max(0) as u64;
    if ttl > 0 {
        if let Err(e) = state
            .cache_service
            .set_session_valid(&auth_token.jwt_id, ttl)
            .await
        {
            tracing::warn!("Failed to set refreshed session validity in cache: {}", e);
        }

        if let Err(e) = state
            .cache_service
            .set_jwt_token(&auth_token.jwt_id, &auth_token.token, ttl)
            .await
        {
            tracing::warn!("Failed to cache refreshed JWT token: {}", e);
        }
    }

    Ok(Json(auth_models::AuthResponse {
        token: auth_token.token,
        user_id: claims.user_id(),
        expires_at: expires_at.to_rfc3339(),
        onboarding_completed: user.onboarding_completed,
    }))
}

#[utoipa::path(
    put,
    path = "/api/auth/onboarding/complete",
    description = "Marks onboarding complete and refreshes user metadata.",
    responses(
        (status = 200, description = "Onboarding completed", body = OnboardingCompleteResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("bearer_auth" = [])),
    tag = "Authentication"
)]
async fn complete_user_onboarding(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<OnboardingCompleteResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    let user_id = auth_context.user_id;

    match state.db_repository.mark_onboarding_complete(&user_id).await {
        Ok(_) => {
            tracing::info!("User {} completed onboarding", user_id);
            Ok(Json(OnboardingCompleteResponse {
                message: "Onboarding completed successfully".to_string(),
                onboarding_completed: true,
            }))
        }
        Err(e) => {
            tracing::error!(
                "Failed to mark onboarding complete for user {}: {}",
                user_id,
                e
            );
            Err(ApiErrorResponse::internal_server_error(
                "Failed to update onboarding status",
            ))
        }
    }
}

#[utoipa::path(
    get,
    path = "/api/transactions",
    description = "Returns transactions with optional text search and account filtering.",
    params(("search" = Option<String>, Query, description = "Search transactions by merchant or category"),
           ("account_ids" = Option<Vec<String>>, Query, description = "Filter by account IDs")),
    responses(
        (status = 200, description = "List of transactions", body = Vec<TransactionWithAccount>),
        (status = 400, description = "Invalid account filter"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Account filter references another user"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer_auth" = [])),
    tag = "Transactions"
)]
async fn get_authenticated_transactions(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Query(query): Query<TransactionsQuery>,
) -> Result<Json<Vec<TransactionWithAccount>>, StatusCode> {
    let user_id = auth_context.user_id;

    let TransactionsQuery {
        search,
        account_ids,
    } = query;
    let account_ids_params = account_ids;

    tracing::info!(
        account_ids = ?account_ids_params,
        search = ?search,
        "Transactions query params"
    );

    if !account_ids_params.is_empty() {
        utils::account_validation::validate_account_ownership(
            &account_ids_params,
            &user_id,
            &state.db_repository,
        )
        .await?;
    }

    match state
        .db_repository
        .get_transactions_with_account_for_user(&user_id)
        .await
    {
        Ok(mut transactions) => {
            if !account_ids_params.is_empty() {
                let account_ids: Vec<Uuid> = account_ids_params
                    .iter()
                    .filter_map(|s| Uuid::parse_str(s).ok())
                    .collect();

                let account_id_set: std::collections::HashSet<Uuid> =
                    account_ids.into_iter().collect();
                transactions.retain(|t| account_id_set.contains(&t.account_id));
            }

            if let Some(search) = search.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
                let needle = search.to_lowercase();
                let filtered: Vec<TransactionWithAccount> = transactions
                    .into_iter()
                    .filter(|t| {
                        let merchant = t.merchant_name.as_deref().unwrap_or("").to_lowercase();
                        let cat_primary = t.category_primary.to_lowercase();
                        let cat_detailed = t.category_detailed.to_lowercase();
                        let account_name = t.account_name.to_lowercase();
                        merchant.contains(&needle)
                            || cat_primary.contains(&needle)
                            || cat_detailed.contains(&needle)
                            || account_name.contains(&needle)
                    })
                    .collect();
                Ok(Json(filtered))
            } else {
                Ok(Json(transactions))
            }
        }
        Err(_) => Ok(Json(vec![])),
    }
}

#[utoipa::path(
    post,
    path = "/api/plaid/link-token",
    description = "Generates a provider-specific link token for Plaid/Teller flows.",
    request_body = LinkTokenRequest,
    responses(
        (status = 200, description = "Link token created successfully", body = LinkTokenResponse),
        (status = 400, description = "Unsupported provider"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Failed to create link token"),
    ),
    security(("bearer_auth" = [])),
    tag = "Plaid"
)]
async fn create_authenticated_link_token(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(_req): Json<LinkTokenRequest>,
) -> Result<Json<LinkTokenResponse>, StatusCode> {
    let provider = state.config.get_default_provider();

    match state
        .connection_service
        .create_link_token(provider, &auth_context.user_id)
        .await
    {
        Ok(link_token) => Ok(Json(LinkTokenResponse { link_token })),
        Err(LinkTokenError::ProviderUnavailable(p)) => {
            tracing::error!(
                "Link token requested for unsupported provider '{}' by user {}",
                p,
                auth_context.user_id
            );
            Err(StatusCode::BAD_REQUEST)
        }
        Err(LinkTokenError::ProviderRequest(e)) => {
            tracing::error!(
                "Failed to create link token for provider {} and user {}: {}",
                provider,
                auth_context.user_id,
                e
            );
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[utoipa::path(
    post,
    path = "/api/plaid/exchange-token",
    description = "Exchanges a Plaid public token for a persisted access token.",
    request_body = ExchangeTokenRequest,
    responses(
        (status = 200, description = "Token exchanged successfully", body = ExchangeTokenResponse),
        (status = 400, description = "Unsupported provider"),
        (status = 401, description = "Unauthorized"),
        (status = 502, description = "Token exchange failed with provider"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer_auth" = [])),
    tag = "Plaid"
)]
async fn exchange_authenticated_public_token(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<ExchangeTokenRequest>,
) -> Result<Json<ExchangeTokenResponse>, StatusCode> {
    let user_id = auth_context.user_id;

    let provider = state.config.get_default_provider();

    match state
        .connection_service
        .exchange_public_token(provider, &user_id, &auth_context.jwt_id, &req.public_token)
        .await
    {
        Ok(response) => Ok(Json(response)),
        Err(ExchangeTokenError::ProviderUnavailable(p)) => {
            tracing::error!(
                "Exchange token requested for unsupported provider '{}' by user {}",
                p,
                user_id
            );
            Err(StatusCode::BAD_REQUEST)
        }
        Err(ExchangeTokenError::ExchangeFailed(e)) => {
            tracing::error!(
                "Failed to exchange public token for provider {} and user {}: {}",
                provider,
                user_id,
                e
            );
            Err(StatusCode::BAD_GATEWAY)
        }
    }
}

#[utoipa::path(
    get,
    path = "/api/plaid/accounts",
    description = "Lists linked accounts with transaction counts for the user.",
    responses(
        (status = 200, description = "List of user accounts with transaction counts", body = Vec<AccountResponse>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer_auth" = [])),
    tag = "Plaid"
)]
async fn get_authenticated_plaid_accounts(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<Vec<AccountResponse>>, StatusCode> {
    let user_id = auth_context.user_id;

    let db_accounts = match state.db_repository.get_accounts_for_user(&user_id).await {
        Ok(accounts) => accounts,
        Err(e) => {
            tracing::error!("Failed to get accounts for user {}: {}", user_id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let transaction_counts = state
        .db_repository
        .get_transaction_count_by_account_for_user(&user_id)
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to get transaction counts for user {}: {}",
                user_id,
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let account_responses: Vec<AccountResponse> = db_accounts
        .into_iter()
        .map(|account| {
            let transaction_count = transaction_counts.get(&account.id).unwrap_or(&0);
            AccountResponse {
                id: account.id,
                user_id: Some(user_id),
                provider_account_id: account.provider_account_id.clone(),
                provider_connection_id: account.provider_connection_id,
                name: account.name,
                account_type: account.account_type,
                balance_current: account.balance_current,
                mask: account.mask,
                transaction_count: *transaction_count as i64,
                institution_name: account.institution_name,
            }
        })
        .collect();

    Ok(Json(account_responses))
}

#[utoipa::path(
    post,
    path = "/api/providers/sync-transactions",
    description = "Kicks off a provider sync to pull the latest transactions.",
    request_body = SyncTransactionsRequest,
    responses(
        (status = 200, description = "Transactions synced successfully", body = SyncTransactionsResponse),
        (status = 400, description = "Missing connection_id"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Connection not found or credentials missing"),
        (status = 502, description = "Provider request failed"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer_auth" = [])),
    tag = "Financial Providers"
)]
async fn sync_authenticated_provider_transactions(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<Option<SyncTransactionsRequest>>,
) -> Result<Json<SyncTransactionsResponse>, StatusCode> {
    let user_id = auth_context.user_id;

    tracing::info!("Sync transactions requested for user {}", user_id);

    let connection_id_str = req
        .as_ref()
        .and_then(|r| r.connection_id.as_ref())
        .ok_or_else(|| {
            tracing::error!("connection_id is required for sync");
            StatusCode::BAD_REQUEST
        })?;

    let connection_id = Uuid::parse_str(connection_id_str).map_err(|_| StatusCode::BAD_REQUEST)?;

    let mut connection = match state
        .db_repository
        .get_provider_connection_by_id(&connection_id, &user_id)
        .await
    {
        Ok(Some(conn)) => conn,
        Ok(None) => {
            tracing::error!(
                "Connection {} not found for user {}",
                connection_id,
                user_id
            );
            return Err(StatusCode::NOT_FOUND);
        }
        Err(e) => {
            tracing::error!("Failed to get connection {}: {}", connection_id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    if connection.item_id.starts_with("teller_") {
        match state
            .connection_service
            .sync_teller_connection(&user_id, &auth_context.jwt_id, &mut connection)
            .await
        {
            Ok(response) => return Ok(Json(response)),
            Err(TellerSyncError::CredentialsMissing) => {
                tracing::error!(
                    "No Teller credentials for user {} and item {}",
                    user_id,
                    connection.item_id
                );
                return Err(StatusCode::NOT_FOUND);
            }
            Err(TellerSyncError::CredentialAccess(e)) => {
                tracing::error!(
                    "Failed to load Teller credentials for user {} and item {}: {}",
                    user_id,
                    connection.item_id,
                    e
                );
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
            Err(TellerSyncError::ProviderInitialization(e)) => {
                tracing::error!("Failed to initialize Teller provider: {}", e);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
            Err(TellerSyncError::ProviderRequest(e)) => {
                tracing::error!("Teller provider request failed for user {}: {}", user_id, e);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
            Err(TellerSyncError::AccountLookup(e)) => {
                tracing::error!(
                    "Failed to fetch accounts from database for Teller user {}: {}",
                    user_id,
                    e
                );
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
            Err(TellerSyncError::TransactionLookup(e)) => {
                tracing::error!(
                    "Failed to load transactions for Teller user {}: {}",
                    user_id,
                    e
                );
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
            Err(TellerSyncError::ConnectionPersistence(e)) => {
                tracing::error!(
                    "Failed to update Teller connection {} for user {}: {}",
                    connection_id,
                    user_id,
                    e
                );
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        }
    }

    let sync_params = SyncConnectionParams {
        provider: state.config.get_default_provider(),
        user_id: &user_id,
        jwt_id: &auth_context.jwt_id,
    };

    match state
        .connection_service
        .sync_provider_connection(sync_params, state.sync_service.as_ref(), &mut connection)
        .await
    {
        Ok(response) => Ok(Json(response)),
        Err(ProviderSyncError::CredentialsMissing) => {
            tracing::error!(
                "Sync transactions: no credentials for user {} and item {}",
                user_id,
                connection.item_id
            );
            Err(StatusCode::NOT_FOUND)
        }
        Err(ProviderSyncError::CredentialAccess(e)) => {
            tracing::error!(
                "Sync transactions: failed to access credentials for user {} and item {}: {}",
                user_id,
                connection.item_id,
                e
            );
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
        Err(ProviderSyncError::ProviderUnavailable(p)) => {
            tracing::error!(
                "Sync transactions: provider '{}' unavailable for user {}",
                p,
                user_id
            );
            Err(StatusCode::BAD_REQUEST)
        }
        Err(ProviderSyncError::ProviderRequest(e)) => {
            tracing::error!(
                "Provider request failed during sync for user {} and item {}: {}",
                user_id,
                connection.item_id,
                e
            );
            Err(StatusCode::BAD_GATEWAY)
        }
        Err(ProviderSyncError::AccountLookup(e)) => {
            tracing::error!(
                "Failed to load accounts during sync for user {} and item {}: {}",
                user_id,
                connection.item_id,
                e
            );
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
        Err(ProviderSyncError::TransactionLookup(e)) => {
            tracing::error!(
                "Failed to load transactions during sync for user {} and item {}: {}",
                user_id,
                connection.item_id,
                e
            );
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
        Err(ProviderSyncError::SyncFailure(e)) => {
            tracing::error!(
                "Sync service failed for user {} and item {}: {}",
                user_id,
                connection.item_id,
                e
            );
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
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
    security(("bearer_auth" = [])),
    tag = "Analytics"
)]
async fn get_authenticated_current_month_spending(
    State(state): State<AppState>,
    auth_context: AuthContext,
    _headers: HeaderMap,
) -> Result<Json<rust_decimal::Decimal>, StatusCode> {
    let user_id = auth_context.user_id;

    match state
        .db_repository
        .get_transactions_for_user(&user_id)
        .await
    {
        Ok(transactions) => {
            let total = state
                .analytics_service
                .calculate_current_month_spending(&transactions);
            Ok(Json(total))
        }
        Err(e) => {
            tracing::error!("Failed to get transactions for user {}: {}", user_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
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
    security(("bearer_auth" = [])),
    tag = "Analytics"
)]
async fn get_authenticated_daily_spending(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Query(params): Query<models::query::DailySpendingQuery>,
) -> Result<Json<Vec<DailySpending>>, StatusCode> {
    let user_id = auth_context.user_id;

    let (year, month) = if let Some(month_str) = params.month {
        let parts: Vec<&str> = month_str.split('-').collect();
        if parts.len() == 2 {
            let year = parts[0]
                .parse::<i32>()
                .map_err(|_| StatusCode::BAD_REQUEST)?;
            let month = parts[1]
                .parse::<u32>()
                .map_err(|_| StatusCode::BAD_REQUEST)?;
            (year, month)
        } else {
            return Err(StatusCode::BAD_REQUEST);
        }
    } else {
        use chrono::Datelike;
        let now = chrono::Utc::now().naive_utc().date();
        (now.year(), now.month())
    };

    match state
        .db_repository
        .get_transactions_for_user(&user_id)
        .await
    {
        Ok(transactions) => {
            let daily_spending =
                state
                    .analytics_service
                    .calculate_daily_spending(&transactions, year, month);
            Ok(Json(daily_spending))
        }
        Err(e) => {
            tracing::error!("Failed to get transactions for user {}: {}", user_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[utoipa::path(
    post,
    path = "/api/plaid/clear-synced-data",
    description = "Clears cached transactions for the calling user's session.",
    responses(
        (status = 200, description = "Synced data cleared successfully", body = ClearSyncedDataResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer_auth" = [])),
    tag = "Plaid"
)]
async fn clear_authenticated_synced_data(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<ClearSyncedDataResponse>, StatusCode> {
    let user_id = auth_context.user_id;

    match state.cache_service.clear_transactions().await {
        Ok(_) => Ok(Json(ClearSyncedDataResponse {
            cleared: true,
            user_id: user_id.to_string(),
        })),
        Err(e) => {
            tracing::error!("Failed to clear synced data for user {}: {}", user_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
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
    security(("bearer_auth" = [])),
    tag = "Analytics"
)]
async fn get_authenticated_spending_by_date_range(
    State(state): State<AppState>,
    auth_context: AuthContext,
    _headers: HeaderMap,
    uri: Uri,
) -> Result<Json<rust_decimal::Decimal>, StatusCode> {
    let user_id = auth_context.user_id;

    let query_string = uri.query().unwrap_or("");
    let mut start_date_param = None;
    let mut end_date_param = None;
    let mut account_ids_params = Vec::new();

    for pair in query_string.split('&') {
        if let Some((key, value)) = pair.split_once('=') {
            match key {
                "start_date" => start_date_param = Some(value.to_string()),
                "end_date" => end_date_param = Some(value.to_string()),
                "account_ids" | "account_ids[]" | "account_ids%5B%5D" => {
                    account_ids_params.push(value.to_string())
                }
                _ => {}
            }
        }
    }

    if !account_ids_params.is_empty() {
        utils::account_validation::validate_account_ownership(
            &account_ids_params,
            &user_id,
            &state.db_repository,
        )
        .await?;
    }

    let start = start_date_param
        .as_deref()
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
    let end = end_date_param
        .as_deref()
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

    match state
        .db_repository
        .get_transactions_for_user(&user_id)
        .await
    {
        Ok(mut transactions) => {
            if !account_ids_params.is_empty() {
                let account_ids: Vec<Uuid> = account_ids_params
                    .iter()
                    .filter_map(|s| Uuid::parse_str(s).ok())
                    .collect();

                let account_id_set: std::collections::HashSet<Uuid> =
                    account_ids.into_iter().collect();
                transactions.retain(|t| account_id_set.contains(&t.account_id));
            }

            let filtered = state
                .analytics_service
                .filter_by_date_range(&transactions, start, end);
            let total: rust_decimal::Decimal = filtered
                .into_iter()
                .filter(|t| t.amount > rust_decimal::Decimal::ZERO)
                .map(|t| t.amount)
                .sum();
            Ok(Json(total))
        }
        Err(e) => {
            tracing::error!("Failed to get transactions for user {}: {}", user_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
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
    security(("bearer_auth" = [])),
    tag = "Analytics"
)]
async fn get_authenticated_category_spending(
    State(state): State<AppState>,
    auth_context: AuthContext,
    _headers: HeaderMap,
    uri: Uri,
) -> Result<Json<Vec<CategorySpending>>, StatusCode> {
    let user_id = auth_context.user_id;

    let query_string = uri.query().unwrap_or("");
    let mut start_date_param = None;
    let mut end_date_param = None;
    let mut account_ids_params = Vec::new();

    for pair in query_string.split('&') {
        if let Some((key, value)) = pair.split_once('=') {
            match key {
                "start_date" => start_date_param = Some(value.to_string()),
                "end_date" => end_date_param = Some(value.to_string()),
                "account_ids" | "account_ids[]" | "account_ids%5B%5D" => {
                    account_ids_params.push(value.to_string())
                }
                _ => {}
            }
        }
    }

    if !account_ids_params.is_empty() {
        utils::account_validation::validate_account_ownership(
            &account_ids_params,
            &user_id,
            &state.db_repository,
        )
        .await?;
    }

    let start_date = start_date_param
        .as_ref()
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
    let end_date = end_date_param
        .as_ref()
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

    match state
        .db_repository
        .get_transactions_for_user(&user_id)
        .await
    {
        Ok(mut transactions) => {
            if !account_ids_params.is_empty() {
                let account_ids: Vec<Uuid> = account_ids_params
                    .iter()
                    .filter_map(|s| Uuid::parse_str(s).ok())
                    .collect();

                let account_id_set: std::collections::HashSet<Uuid> =
                    account_ids.into_iter().collect();
                transactions.retain(|t| account_id_set.contains(&t.account_id));
            }

            let categories = state.analytics_service.group_by_category_with_date_range(
                &transactions,
                start_date,
                end_date,
            );
            Ok(Json(categories))
        }
        Err(e) => {
            tracing::error!("Failed to get transactions for user {}: {}", user_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[utoipa::path(
    get,
    path = "/api/analytics/monthly-totals",
    description = "Produces a timeline of monthly totals for dashboard charts.",
    params(("months" = Option<i32>, Query, description = "Number of months to retrieve (default: 6)"),
           ("account_ids" = Option<Vec<String>>, Query, description = "Filter by account IDs")),
    responses(
        (status = 200, description = "Monthly spending totals", body = Vec<MonthlySpending>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer_auth" = [])),
    tag = "Analytics"
)]
async fn get_authenticated_monthly_totals(
    State(state): State<AppState>,
    auth_context: AuthContext,
    _headers: HeaderMap,
    Query(params): Query<MonthlyTotalsQuery>,
) -> Result<Json<Vec<MonthlySpending>>, StatusCode> {
    let user_id = auth_context.user_id;
    let months = params.months.unwrap_or(6);

    let filtered_account_ids = if !params.account_ids.is_empty() {
        let validated_ids = utils::account_validation::validate_account_ownership(
            &params.account_ids,
            &user_id,
            &state.db_repository,
        )
        .await?;
        Some(
            validated_ids
                .into_iter()
                .collect::<std::collections::HashSet<_>>(),
        )
    } else {
        None
    };

    match state
        .db_repository
        .get_transactions_for_user(&user_id)
        .await
    {
        Ok(transactions) => {
            let transactions = if let Some(ref allowed_ids) = filtered_account_ids {
                transactions
                    .into_iter()
                    .filter(|t| allowed_ids.contains(&t.account_id))
                    .collect()
            } else {
                transactions
            };
            let monthly_totals = state
                .analytics_service
                .calculate_monthly_totals(&transactions, months);
            Ok(Json(monthly_totals))
        }
        Err(e) => {
            tracing::error!("Failed to get transactions for user {}: {}", user_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
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
    security(("bearer_auth" = [])),
    tag = "Analytics"
)]
async fn get_authenticated_top_merchants(
    State(state): State<AppState>,
    auth_context: AuthContext,
    _headers: HeaderMap,
    Query(params): Query<DateRangeQuery>,
) -> Result<Json<Vec<TopMerchant>>, StatusCode> {
    let user_id = auth_context.user_id;
    let limit = 10usize;

    let start_date = params
        .start_date
        .as_ref()
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
    let end_date = params
        .end_date
        .as_ref()
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

    let filtered_account_ids = if !params.account_ids.is_empty() {
        let validated_ids = utils::account_validation::validate_account_ownership(
            &params.account_ids,
            &user_id,
            &state.db_repository,
        )
        .await?;
        Some(
            validated_ids
                .into_iter()
                .collect::<std::collections::HashSet<_>>(),
        )
    } else {
        None
    };

    match state
        .db_repository
        .get_transactions_for_user(&user_id)
        .await
    {
        Ok(transactions) => {
            let transactions = if let Some(ref allowed_ids) = filtered_account_ids {
                transactions
                    .into_iter()
                    .filter(|t| allowed_ids.contains(&t.account_id))
                    .collect()
            } else {
                transactions
            };
            let top_merchants = state.analytics_service.get_top_merchants_with_date_range(
                &transactions,
                start_date,
                end_date,
                limit,
            );
            Ok(Json(top_merchants))
        }
        Err(e) => {
            tracing::error!("Failed to get transactions for user {}: {}", user_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn load_connection_statuses(
    state: &AppState,
    user_id: &Uuid,
) -> Result<Vec<ProviderConnectionStatus>, StatusCode> {
    let connections = state
        .db_repository
        .get_all_provider_connections_by_user(user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get connections for user {}: {}", user_id, e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(connections
        .into_iter()
        .filter(|conn| conn.is_connected)
        .map(|conn| ProviderConnectionStatus {
            is_connected: conn.is_connected,
            last_sync_at: conn.last_sync_at.map(|dt| dt.to_rfc3339()),
            institution_name: conn.institution_name,
            connection_id: Some(conn.id.to_string()),
            transaction_count: conn.transaction_count,
            account_count: conn.account_count,
            sync_in_progress: false,
        })
        .collect())
}

#[utoipa::path(
    post,
    path = "/api/providers/connect",
    description = "Completes Teller Connect enrollment and stores provider credentials for the user.",
    request_body = ProviderConnectRequest,
    responses(
        (status = 200, description = "Provider connected successfully", body = ProviderConnectResponse),
        (status = 400, description = "Unsupported provider"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Failed to connect provider", body = ApiErrorResponse),
    ),
    security(("bearer_auth" = [])),
    tag = "Financial Providers"
)]
async fn connect_authenticated_provider(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<ProviderConnectRequest>,
) -> Result<Json<ProviderConnectResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    if req.provider != "teller" {
        return Err(ApiErrorResponse::new("BAD_REQUEST", "Unsupported provider")
            .into_response(StatusCode::BAD_REQUEST));
    }

    match state
        .connection_service
        .connect_teller_provider(&auth_context.user_id, &auth_context.jwt_id, &req)
        .await
    {
        Ok(response) => Ok(Json(response)),
        Err(TellerConnectError::InvalidProvider(_)) => {
            Err(ApiErrorResponse::new("BAD_REQUEST", "Unsupported provider")
                .into_response(StatusCode::BAD_REQUEST))
        }
        Err(TellerConnectError::CredentialStorage(e)) => {
            tracing::error!(
                "Failed to store Teller credentials for user {}: {}",
                auth_context.user_id,
                e
            );
            Err(ApiErrorResponse::internal_server_error(
                "Failed to store credentials",
            ))
        }
        Err(TellerConnectError::ConnectionPersistence(e)) => {
            tracing::error!(
                "Failed to persist Teller connection for user {}: {}",
                auth_context.user_id,
                e
            );
            Err(ApiErrorResponse::internal_server_error(
                "Failed to save connection",
            ))
        }
    }
}

#[utoipa::path(
    get,
    path = "/api/providers/status",
    description = "Summarizes connection status, sync metrics, and active institutions for the selected provider.",
    responses(
        (status = 200, description = "Provider connection status and statistics", body = ProviderStatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer_auth" = [])),
    tag = "Financial Providers"
)]
async fn get_authenticated_provider_status(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<ProviderStatusResponse>, StatusCode> {
    let user_id = auth_context.user_id;

    let provider = match state.db_repository.get_user_by_id(&user_id).await {
        Ok(Some(user)) => user.provider,
        Ok(None) => state.config.get_default_provider().to_string(),
        Err(e) => {
            tracing::error!("Failed to load user {} for provider status: {}", user_id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let connections = load_connection_statuses(&state, &user_id).await?;

    Ok(Json(ProviderStatusResponse {
        provider,
        connections,
    }))
}

#[utoipa::path(
    get,
    path = "/api/budgets",
    description = "Retrieves all budgets for the authenticated user, leveraging Redis caching when available.",
    responses(
        (status = 200, description = "List of user budgets", body = Vec<Budget>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("bearer_auth" = [])),
    tag = "Budgets"
)]
async fn get_authenticated_budgets(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<Vec<crate::models::budget::Budget>>, (StatusCode, Json<ApiErrorResponse>)> {
    let user_id = auth_context.user_id;

    let cache_key = format!("budgets:user:{}", user_id);
    if let Ok(Some(serialized)) = state.cache_service.get_string(&cache_key).await {
        if let Ok(cached) = serde_json::from_str::<Vec<crate::models::budget::Budget>>(&serialized)
        {
            return Ok(Json(cached));
        }
    }

    match state
        .budget_service
        .get_budgets_for_user(&*state.db_repository, user_id)
        .await
    {
        Ok(budgets) => {
            if let Ok(serialized) = serde_json::to_string(&budgets) {
                let _ = state
                    .cache_service
                    .set_with_ttl(&cache_key, &serialized, 300)
                    .await;
            }
            Ok(Json(budgets))
        }
        Err(e) => {
            tracing::error!("Failed to get budgets for user {}: {}", user_id, e);
            Err(ApiErrorResponse::internal_server_error(
                "Failed to fetch budgets",
            ))
        }
    }
}

#[utoipa::path(
    post,
    path = "/api/budgets",
    description = "Creates a new budget entry for the user with category and amount.",
    request_body = CreateBudgetRequest,
    responses(
        (status = 200, description = "Budget created", body = crate::models::budget::Budget),
        (status = 400, description = "Invalid budget data", body = ApiErrorResponse),
        (status = 401, description = "Unauthorized"),
        (status = 409, description = "Budget category already exists", body = ApiErrorResponse),
    ),
    security(("bearer_auth" = [])),
    tag = "Budgets"
)]
async fn create_authenticated_budget(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<CreateBudgetRequest>,
) -> Result<Json<crate::models::budget::Budget>, (StatusCode, Json<ApiErrorResponse>)> {
    let user_id = auth_context.user_id;

    match state
        .budget_service
        .create_budget_for_user(&*state.db_repository, user_id, req.category, req.amount)
        .await
    {
        Ok(created_budget) => {
            let _ = state
                .cache_service
                .invalidate_pattern(&format!("budgets:user:{}", user_id))
                .await;
            Ok(Json(created_budget))
        }
        Err(e) => {
            tracing::error!("Failed to create budget for user {}: {}", user_id, e);
            if e.contains("greater than zero") {
                Err(
                    ApiErrorResponse::new("BAD_REQUEST", "Budget amount must be greater than zero")
                        .into_response(StatusCode::BAD_REQUEST),
                )
            } else if e.contains("already exists") {
                Err(
                    ApiErrorResponse::new("CONFLICT", "Budget category already exists")
                        .into_response(StatusCode::CONFLICT),
                )
            } else {
                Err(ApiErrorResponse::internal_server_error(
                    "Failed to create budget",
                ))
            }
        }
    }
}

#[utoipa::path(
    put,
    path = "/api/budgets/{id}",
    description = "Updates the amount of an existing budget owned by the authenticated user.",
    params(("id" = String, Path, description = "Budget ID")),
    request_body = UpdateBudgetRequest,
    responses(
        (status = 200, description = "Budget updated successfully", body = Budget),
        (status = 400, description = "Invalid budget amount"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Budget not found", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("bearer_auth" = [])),
    tag = "Budgets"
)]
async fn update_authenticated_budget(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Path(budget_id): Path<String>,
    Json(req): Json<UpdateBudgetRequest>,
) -> Result<Json<crate::models::budget::Budget>, (StatusCode, Json<ApiErrorResponse>)> {
    let user_id = auth_context.user_id;
    let budget_uuid = Uuid::parse_str(&budget_id).map_err(|_| {
        ApiErrorResponse::new("BAD_REQUEST", "Invalid budget id")
            .into_response(StatusCode::BAD_REQUEST)
    })?;

    match state
        .budget_service
        .update_budget_for_user(&*state.db_repository, budget_uuid, user_id, req.amount)
        .await
    {
        Ok(updated_budget) => {
            let _ = state
                .cache_service
                .invalidate_pattern(&format!("budgets:user:{}", user_id))
                .await;
            Ok(Json(updated_budget))
        }
        Err(e) => {
            tracing::error!(
                "Failed to update budget {} for user {}: {}",
                budget_id,
                user_id,
                e
            );
            if e.contains("greater than zero") {
                Err(
                    ApiErrorResponse::new("BAD_REQUEST", "Budget amount must be greater than zero")
                        .into_response(StatusCode::BAD_REQUEST),
                )
            } else if e.contains("not found") || e.contains("access denied") {
                Err(ApiErrorResponse::new("NOT_FOUND", "Budget not found")
                    .into_response(StatusCode::NOT_FOUND))
            } else {
                Err(ApiErrorResponse::internal_server_error(
                    "Failed to update budget",
                ))
            }
        }
    }
}

#[utoipa::path(
    delete,
    path = "/api/budgets/{id}",
    description = "Deletes a budget and invalidates cached budget data.",
    params(("id" = String, Path, description = "Budget ID")),
    responses(
        (status = 200, description = "Budget deleted successfully", body = DeleteBudgetResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Budget not found", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("bearer_auth" = [])),
    tag = "Budgets"
)]
async fn delete_authenticated_budget(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Path(budget_id): Path<String>,
) -> Result<Json<DeleteBudgetResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    let user_id = auth_context.user_id;
    let budget_uuid = Uuid::parse_str(&budget_id).map_err(|_| {
        ApiErrorResponse::new("BAD_REQUEST", "Invalid budget id")
            .into_response(StatusCode::BAD_REQUEST)
    })?;

    match state
        .budget_service
        .delete_budget_for_user(&*state.db_repository, budget_uuid, user_id)
        .await
    {
        Ok(_) => {
            let _ = state
                .cache_service
                .invalidate_pattern(&format!("budgets:user:{}", user_id))
                .await;
            Ok(Json(DeleteBudgetResponse {
                deleted: true,
                budget_id,
            }))
        }
        Err(e) => {
            tracing::error!(
                "Failed to delete budget {} for user {}: {}",
                budget_id,
                user_id,
                e
            );
            if e.contains("not found") || e.contains("access denied") {
                Err(ApiErrorResponse::new("NOT_FOUND", "Budget not found")
                    .into_response(StatusCode::NOT_FOUND))
            } else {
                Err(ApiErrorResponse::internal_server_error(
                    "Failed to delete budget",
                ))
            }
        }
    }
}

#[utoipa::path(
    post,
    path = "/api/providers/disconnect",
    description = "Disconnects a provider connection and clears related cached artifacts.",
    request_body = DisconnectRequest,
    responses(
        (status = 200, description = "Provider connection disconnected", body = DisconnectResult),
        (status = 400, description = "Invalid connection_id format"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer_auth" = [])),
    tag = "Financial Providers"
)]
async fn disconnect_authenticated_connection(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<DisconnectRequest>,
) -> Result<Json<DisconnectResult>, StatusCode> {
    let user_id = auth_context.user_id;
    let connection_id = Uuid::parse_str(&req.connection_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match state
        .connection_service
        .disconnect_connection_by_id(&connection_id, &user_id, &auth_context.jwt_id)
        .await
    {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            tracing::error!("Failed to disconnect: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[utoipa::path(
    get,
    path = "/health",
    description = "Simple readiness probe for service health verification.",
    responses(
        (status = 200, description = "Service is healthy", body = crate::openapi::schemas::HealthCheckResponse),
    ),
    tag = "Health"
)]
async fn health_check() -> &'static str {
    tracing::info!(
        event = "health_check",
        route = "/health",
        status = "ok",
        "Health check invoked"
    );
    "OK"
}

#[utoipa::path(
    get,
    path = "/api/providers/info",
    description = "Describes available providers and the caller's current selection.",
    responses(
        (status = 200, description = "Available providers and current user provider configuration", body = ProviderInfoResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "User not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer_auth" = [])),
    tag = "Financial Providers"
)]
async fn get_authenticated_provider_info(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<ProviderInfoResponse>, StatusCode> {
    let user_id = auth_context.user_id;

    let user = state
        .db_repository
        .get_user_by_id(&user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get user {}: {}", user_id, e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or_else(|| {
            tracing::error!("User {} not found", user_id);
            StatusCode::NOT_FOUND
        })?;

    let default_provider = state.config.get_default_provider();
    let available_providers = vec!["plaid".to_string(), "teller".to_string()];

    let user_provider = if user.onboarding_completed {
        user.provider
    } else {
        default_provider.to_string()
    };

    Ok(Json(ProviderInfoResponse {
        available_providers,
        default_provider: default_provider.to_string(),
        user_provider,
        teller_application_id: state
            .config
            .get_teller_application_id()
            .map(|value| value.to_string()),
        teller_environment: state.config.get_teller_environment().to_string(),
    }))
}

#[utoipa::path(
    post,
    path = "/api/providers/select",
    description = "Persists a provider switch for the authenticated user.",
    request_body = ProviderSelectRequest,
    responses(
        (status = 200, description = "Provider selected successfully", body = ProviderSelectResponse),
        (status = 400, description = "Invalid provider specified", body = ApiErrorResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("bearer_auth" = [])),
    tag = "Financial Providers"
)]
async fn select_authenticated_provider(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<ProviderSelectRequest>,
) -> Result<Json<ProviderSelectResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    let user_id = auth_context.user_id;

    let provider = req.provider;

    if provider != "plaid" && provider != "teller" {
        return Err(ApiErrorResponse::new(
            "BAD_REQUEST",
            "Invalid provider. Must be 'plaid' or 'teller'",
        )
        .into_response(StatusCode::BAD_REQUEST));
    }

    match state
        .db_repository
        .update_user_provider(&user_id, &provider)
        .await
    {
        Ok(_) => {
            tracing::info!("User {} selected provider: {}", user_id, provider);
            Ok(Json(ProviderSelectResponse {
                user_provider: provider,
            }))
        }
        Err(e) => {
            tracing::error!("Failed to update provider for user {}: {}", user_id, e);
            Err(ApiErrorResponse::internal_server_error(
                "Failed to update provider selection",
            ))
        }
    }
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
    security(("bearer_auth" = [])),
    tag = "Analytics"
)]
async fn get_authenticated_balances_overview(
    State(state): State<AppState>,
    auth_context: AuthContext,
    uri: Uri,
) -> Result<Json<models::analytics::BalancesOverviewResponse>, StatusCode> {
    let user_id = auth_context.user_id;

    let query_string = uri.query().unwrap_or("");
    let mut account_ids_params = Vec::new();
    for pair in query_string.split('&') {
        if let Some((key, value)) = pair.split_once('=') {
            if matches!(key, "account_ids" | "account_ids[]" | "account_ids%5B%5D") {
                account_ids_params.push(value.to_string());
            }
        }
    }

    let filtered_account_ids = if !account_ids_params.is_empty() {
        let validated_account_ids = utils::account_validation::validate_account_ownership(
            &account_ids_params,
            &user_id,
            &state.db_repository,
        )
        .await?;
        Some(
            validated_account_ids
                .into_iter()
                .collect::<std::collections::HashSet<_>>(),
        )
    } else {
        None
    };

    let base_cache_key = format!("{}_balances_overview", auth_context.jwt_id);
    let cache_key = utils::cache_keys::generate_cache_key_with_account_filter(
        &base_cache_key,
        filtered_account_ids.as_ref(),
    );
    if let Ok(Some(serialized)) = state.cache_service.get_string(&cache_key).await {
        if let Ok(cached) =
            serde_json::from_str::<models::analytics::BalancesOverviewResponse>(&serialized)
        {
            return Ok(Json(cached));
        }
    }

    let latest_rows = state
        .db_repository
        .get_latest_account_balances_for_user(&user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch latest account balances: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    type LatestMapValue = (String, Option<String>, String, rust_decimal::Decimal);
    let mut latest_map: std::collections::HashMap<String, Vec<LatestMapValue>> =
        std::collections::HashMap::new();
    let mut name_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    let mut mixed_currency = false;
    for row in latest_rows.into_iter() {
        if let Some(ref filter_ids) = filtered_account_ids {
            if !filter_ids.contains(&row.account_id) {
                continue;
            }
        }
        if row.currency.to_uppercase() != "USD" {
            mixed_currency = true;
            continue;
        }
        if let Some(ref inst_name) = row.institution_name {
            name_map
                .entry(row.institution_id.clone())
                .or_insert(inst_name.clone());
        }
        latest_map.entry(row.institution_id).or_default().push((
            row.account_type,
            row.account_subtype,
            row.currency,
            row.current_balance,
        ));
    }

    // Fallback: if no snapshots present, use current account balances
    if latest_map.is_empty() {
        let accounts = state
            .db_repository
            .get_accounts_for_user(&user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch accounts for fallback: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        for acc in accounts.into_iter() {
            if let Some(ref filter_ids) = filtered_account_ids {
                if !filter_ids.contains(&acc.id) {
                    continue;
                }
            }
            let bal = acc.balance_current.unwrap_or(rust_decimal::Decimal::ZERO);
            latest_map
                .entry("unknown_institution".to_string())
                .or_default()
                .push((acc.account_type, None, "USD".to_string(), bal));
        }
    }

    use rust_decimal::Decimal;
    let mut overall_cash = Decimal::ZERO;
    let mut overall_credit = Decimal::ZERO;
    let mut overall_loan = Decimal::ZERO;
    let mut overall_investments = Decimal::ZERO;
    let mut banks: Vec<models::analytics::BankTotals> = Vec::new();

    for (bank_id, accounts) in latest_map.iter() {
        let mut cash = Decimal::ZERO;
        let mut credit = Decimal::ZERO;
        let mut loan = Decimal::ZERO;
        let mut investments = Decimal::ZERO;

        for (account_type, account_subtype, _currency, balance) in accounts.iter() {
            let category = AnalyticsService::map_account_to_balance_category(
                account_type,
                account_subtype.as_deref(),
            );
            match category {
                BalanceCategory::Cash => {
                    cash += *balance;
                }
                BalanceCategory::Investments => {
                    investments += *balance;
                }
                BalanceCategory::Credit => {
                    credit += -balance.abs();
                }
                BalanceCategory::Loan => {
                    loan += -balance.abs();
                }
            }
        }

        let totals = models::analytics::finalize_totals(cash, credit, loan, investments);

        let bank_name = name_map
            .get(bank_id)
            .cloned()
            .unwrap_or_else(|| bank_id.clone());
        banks.push(models::analytics::BankTotals {
            bank_id: bank_id.clone(),
            bank_name,
            totals: totals.clone(),
        });

        overall_cash += cash;
        overall_credit += credit;
        overall_loan += loan;
        overall_investments += investments;
    }

    let overall = models::analytics::finalize_totals(
        overall_cash,
        overall_credit,
        overall_loan,
        overall_investments,
    );
    let response = models::analytics::BalancesOverviewResponse {
        as_of: "latest".to_string(),
        overall,
        banks,
        mixed_currency,
    };

    if let Ok(serialized) = serde_json::to_string(&response) {
        // Use JWT's remaining TTL to align cache lifetime with session
        let mut ttl_seconds: u64 = 1800; // fallback
        if let Ok(Some(jwt_token)) = state
            .cache_service
            .get_jwt_token(&auth_context.jwt_id)
            .await
        {
            if let Ok(claims) = state.auth_service.validate_token(&jwt_token) {
                let now = chrono::Utc::now().timestamp() as usize;
                if claims.exp > now {
                    ttl_seconds = (claims.exp - now) as u64;
                }
            }
        }
        let _ = state
            .cache_service
            .set_with_ttl(&cache_key, &serialized, ttl_seconds)
            .await;
    }

    Ok(Json(response))
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
    security(("bearer_auth" = [])),
    tag = "Analytics"
)]
async fn get_authenticated_net_worth_over_time(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Query(params): Query<models::analytics::DateRangeQuery>,
) -> Result<Json<models::analytics::NetWorthOverTimeResponse>, StatusCode> {
    use rust_decimal::Decimal;
    use std::collections::{BTreeMap, HashMap, HashSet};

    let user_id = auth_context.user_id;

    // Parse and validate dates
    let (start_date, end_date) = match (&params.start_date, &params.end_date) {
        (Some(s), Some(e)) => {
            let s = chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d")
                .map_err(|_| StatusCode::BAD_REQUEST)?;
            let e = chrono::NaiveDate::parse_from_str(e, "%Y-%m-%d")
                .map_err(|_| StatusCode::BAD_REQUEST)?;
            if e < s {
                return Err(StatusCode::BAD_REQUEST);
            }
            (s, e)
        }
        _ => return Err(StatusCode::BAD_REQUEST),
    };

    let filtered_account_ids = if !params.account_ids.is_empty() {
        let validated_ids = utils::account_validation::validate_account_ownership(
            &params.account_ids,
            &user_id,
            &state.db_repository,
        )
        .await?;
        Some(validated_ids.into_iter().collect::<HashSet<_>>())
    } else {
        None
    };

    // Cache lookup
    let base_cache_key = format!(
        "{}_net_worth_over_time_{}_{}",
        auth_context.jwt_id, start_date, end_date
    );
    let cache_key = utils::cache_keys::generate_cache_key_with_account_filter(
        &base_cache_key,
        filtered_account_ids.as_ref(),
    );
    if let Ok(Some(serialized)) = state.cache_service.get_string(&cache_key).await {
        if let Ok(cached) =
            serde_json::from_str::<models::analytics::NetWorthOverTimeResponse>(&serialized)
        {
            return Ok(Json(cached));
        }
    }

    // Load depository accounts (checking/savings fall under 'depository')
    let accounts = state
        .db_repository
        .get_accounts_for_user(&user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch accounts: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let mut depository_ids: HashSet<uuid::Uuid> = HashSet::new();
    let mut balance_current_by_id: HashMap<uuid::Uuid, Decimal> = HashMap::new();
    for acc in accounts.into_iter() {
        if let Some(ref allowed_ids) = filtered_account_ids {
            if !allowed_ids.contains(&acc.id) {
                continue;
            }
        }
        if acc.account_type.to_lowercase() == "depository" {
            depository_ids.insert(acc.id);
            balance_current_by_id
                .entry(acc.id)
                .or_insert(acc.balance_current.unwrap_or(Decimal::ZERO));
        }
    }

    if depository_ids.is_empty() {
        let response = models::analytics::NetWorthOverTimeResponse {
            series: Vec::new(),
            currency: "USD".to_string(),
        };
        return Ok(Json(response));
    }

    // Determine the anchor dates
    let today = chrono::Utc::now().naive_utc().date();
    let end_anchor = std::cmp::min(end_date, today);

    // Fetch transactions from start_date..=today (inclusive) for baseline + series
    let txns = state
        .db_repository
        .get_transactions_by_date_range_for_user(&user_id, start_date, today)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch transactions for ledger: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Group flows by account and date; filter to depository account_ids
    let mut flows_by_account: HashMap<uuid::Uuid, BTreeMap<chrono::NaiveDate, Decimal>> =
        HashMap::new();
    for t in txns.into_iter() {
        if let Some(ref allowed_ids) = filtered_account_ids {
            if !allowed_ids.contains(&t.account_id) {
                continue;
            }
        }
        if !depository_ids.contains(&t.account_id) {
            continue;
        }
        flows_by_account
            .entry(t.account_id)
            .or_default()
            .entry(t.date)
            .and_modify(|v| *v += t.amount)
            .or_insert(t.amount);
    }

    // Compute baseline at start_date for each account:
    // base_start = balance_current - sum(flows in (start_date, today]]
    let mut base_start_by_account: HashMap<uuid::Uuid, Decimal> = HashMap::new();
    for acc_id in depository_ids.iter() {
        let current_balance = *balance_current_by_id.get(acc_id).unwrap_or(&Decimal::ZERO);
        let mut rollback_sum = Decimal::ZERO;
        if let Some(map) = flows_by_account.get(acc_id) {
            for (d, amt) in map.range((start_date.succ_opt().unwrap_or(start_date))..=today) {
                let _ = d; // unused binding except for range
                rollback_sum += *amt;
            }
        }
        base_start_by_account.insert(*acc_id, current_balance - rollback_sum);
    }

    // Build daily cumulative series for the requested range (carry forward past end_anchor)
    let mut series: Vec<models::analytics::NetWorthSeriesPoint> = Vec::new();
    let mut day = start_date;
    let mut per_account_cum: HashMap<uuid::Uuid, Decimal> = HashMap::new();
    while day <= end_date {
        // Update cumulative flows up to this day for each account
        if day <= end_anchor {
            for (acc_id, fmap) in flows_by_account.iter() {
                let acc_entry = per_account_cum.entry(*acc_id).or_insert(Decimal::ZERO);
                if let Some(amt) = fmap.get(&day) {
                    *acc_entry += *amt;
                }
            }
        }
        // Sum account balances for this day
        let mut total = Decimal::ZERO;
        for acc_id in depository_ids.iter() {
            let base = *base_start_by_account.get(acc_id).unwrap_or(&Decimal::ZERO);
            let delta = *per_account_cum.get(acc_id).unwrap_or(&Decimal::ZERO);
            total += base + delta;
        }
        series.push(models::analytics::NetWorthSeriesPoint {
            date: day.format("%Y-%m-%d").to_string(),
            value: total,
        });

        day = day.succ_opt().unwrap_or(day);
        if day == end_date { /* loop condition handles push next */ }
        if day > end_date {
            break;
        }
    }

    let response = models::analytics::NetWorthOverTimeResponse {
        series,
        currency: "USD".to_string(),
    };

    if let Ok(serialized) = serde_json::to_string(&response) {
        // Align cache TTL with JWT expiry
        let mut ttl_seconds: u64 = 1800; // fallback
        if let Ok(Some(jwt_token)) = state
            .cache_service
            .get_jwt_token(&auth_context.jwt_id)
            .await
        {
            if let Ok(claims) = state.auth_service.validate_token(&jwt_token) {
                let now = chrono::Utc::now().timestamp() as usize;
                if claims.exp > now {
                    ttl_seconds = (claims.exp - now) as u64;
                }
            }
        }
        let _ = state
            .cache_service
            .set_with_ttl(&cache_key, &serialized, ttl_seconds)
            .await;
    }

    Ok(Json(response))
}

#[utoipa::path(
    put,
    path = "/api/auth/change-password",
    description = "Allows an authenticated user to rotate their password and invalidate cached credentials.",
    request_body = ChangePasswordRequest,
    responses(
        (status = 200, description = "Password changed successfully", body = ChangePasswordResponse),
        (status = 401, description = "Current password is incorrect", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("bearer_auth" = [])),
    tag = "Authentication"
)]
async fn change_user_password(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<auth_models::ChangePasswordRequest>,
) -> Result<Json<auth_models::ChangePasswordResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    let user_id = auth_context.user_id;

    let user = state
        .db_repository
        .get_user_by_id(&user_id)
        .await
        .map_err(|e| {
            tracing::error!("Database error fetching user {}: {}", user_id, e);
            ApiErrorResponse::internal_server_error(
                "Authentication service temporarily unavailable",
            )
        })?
        .ok_or_else(|| {
            tracing::warn!("User {} not found during password change", user_id);
            ApiErrorResponse::internal_server_error("User account not found")
        })?;

    let is_valid = state
        .auth_service
        .verify_password(&req.current_password, &user.password_hash)
        .map_err(|e| {
            tracing::error!("Password verification failed for user {}: {}", user_id, e);
            ApiErrorResponse::internal_server_error("Authentication service error")
        })?;

    if !is_valid {
        tracing::info!("Invalid current password for user {}", user_id);
        return Err(ApiErrorResponse::unauthorized(
            "Current password is incorrect",
        ));
    }

    let new_hash = state
        .auth_service
        .hash_password(&req.new_password)
        .map_err(|e| {
            tracing::error!("Password hashing failed for user {}: {}", user_id, e);
            ApiErrorResponse::internal_server_error("Failed to process new password")
        })?;

    state
        .db_repository
        .update_user_password(&user_id, &new_hash)
        .await
        .map_err(|e| {
            tracing::error!("Failed to update password for user {}: {}", user_id, e);
            ApiErrorResponse::internal_server_error("Failed to update password")
        })?;

    if let Err(e) = state
        .cache_service
        .invalidate_pattern(&format!("{}_*", auth_context.jwt_id))
        .await
    {
        tracing::warn!(
            "Failed to invalidate JWT cache for user {} after password change: {}",
            user_id,
            e
        );
    }

    tracing::info!("User {} password changed successfully", user_id);

    Ok(Json(auth_models::ChangePasswordResponse {
        message: "Password changed successfully. Please log in again.".to_string(),
        requires_reauth: true,
    }))
}

#[utoipa::path(
    delete,
    path = "/api/auth/account",
    description = "Deletes the authenticated user's account and associated provider data.",
    responses(
        (status = 200, description = "Account deleted successfully", body = DeleteAccountResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("bearer_auth" = [])),
    tag = "Authentication"
)]
async fn delete_user_account(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<auth_models::DeleteAccountResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    let user_id = auth_context.user_id;

    let connections = state
        .db_repository
        .get_all_provider_connections_by_user(&user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get connections for user {}: {}", user_id, e);
            ApiErrorResponse::internal_server_error("Failed to retrieve user connections")
        })?;

    let mut deleted_connections = 0;
    let mut deleted_transactions = 0;
    let mut deleted_accounts = 0;

    for connection in connections {
        match state
            .connection_service
            .disconnect_connection_by_id(&connection.id, &user_id, &auth_context.jwt_id)
            .await
        {
            Ok(result) => {
                if result.success {
                    deleted_connections += 1;
                    deleted_transactions += result.data_cleared.transactions;
                    deleted_accounts += result.data_cleared.accounts;
                }
            }
            Err(e) => {
                tracing::warn!(
                    "Failed to disconnect connection {} for user {}: {}",
                    connection.id,
                    user_id,
                    e
                );
            }
        }
    }

    let budgets = state
        .db_repository
        .get_budgets_for_user(user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get budgets for user {}: {}", user_id, e);
            ApiErrorResponse::internal_server_error("Failed to retrieve user budgets")
        })?;

    let deleted_budgets = budgets.len() as i32;

    state
        .db_repository
        .delete_user(&user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete user {}: {}", user_id, e);
            ApiErrorResponse::internal_server_error("Failed to delete user account")
        })?;

    if let Err(e) = state
        .cache_service
        .invalidate_pattern(&format!("{}_*", auth_context.jwt_id))
        .await
    {
        tracing::warn!(
            "Failed to invalidate cache for deleted user {}: {}",
            user_id,
            e
        );
    }

    tracing::info!(
        "User {} account deleted. Connections: {}, Transactions: {}, Accounts: {}, Budgets: {}",
        user_id,
        deleted_connections,
        deleted_transactions,
        deleted_accounts,
        deleted_budgets
    );

    Ok(Json(auth_models::DeleteAccountResponse {
        message: "Account deleted successfully".to_string(),
        deleted_items: auth_models::DeletedItemsSummary {
            connections: deleted_connections,
            transactions: deleted_transactions,
            accounts: deleted_accounts,
            budgets: deleted_budgets,
        },
    }))
}
