use anyhow::Context;
use axum::{
    body::Body,
    extract::{DefaultBodyLimit, Query, Request, State},
    http::{
        header::{AUTHORIZATION, CONTENT_LENGTH, CONTENT_TYPE, COOKIE, SET_COOKIE},
        HeaderMap, HeaderValue, Method, StatusCode,
    },
    middleware::{from_fn, from_fn_with_state, Next},
    response::{IntoResponse, Json, Response},
    routing::{delete, get, post, put},
    Router,
};
use axum_tracing_opentelemetry::middleware::{OtelAxumLayer, OtelInResponseLayer};
use axum_tracing_opentelemetry::tracing_opentelemetry_instrumentation_sdk as otel_sdk;
use chrono::NaiveDate;
use opentelemetry::trace::Status as OtelStatus;
use std::net::SocketAddr;
use std::sync::Arc;
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;
use tracing_opentelemetry::OpenTelemetrySpanExt;
use uuid::Uuid;

use serde_json::json;

mod auth_middleware;
mod config;
mod middleware;
mod models;
mod openapi;

#[path = "../connection_pool.rs"]
pub mod connection_pool;
#[cfg(test)]
#[path = "../db_compat.rs"]
mod db;
mod handlers;
pub mod providers;
mod seed;
mod services;
#[cfg(test)]
mod tests;
mod utils;
#[cfg(test)]
pub use tests::test_fixtures;

use crate::models::analytics::{
    BalancesOverviewQuery, BalancesOverviewResponse, BudgetSummary, CashFlowResponse,
    CategorySpending, DailySpending, DateBoundsResponse, IncomeExpenseTotals, MonthlySpending,
    NetWorthOverTimeResponse, SankeyResponse, TopMerchant,
};
use crate::models::app_state::AppState;
use crate::models::auth::{AuthContext, AuthMiddlewareState};
use crate::models::auto_categorization_job::AutoCategorizationJobState;
use crate::models::{
    account::AccountResponse,
    analytics::DateRangeQuery,
    auth as auth_models,
    export::{ExportFormat, ExportQuery},
    plaid::{
        ClearSyncedDataResponse, DisconnectRequest, DisconnectResult, ExchangeTokenRequest,
        ExchangeTokenResponse, LinkTokenRequest, LinkTokenResponse, ProviderConnectResponse,
        ProviderInfoResponse, ProviderSelectRequest, ProviderSelectResponse,
        ProviderStatusResponse, SyncTransactionsRequest,
    },
    provider_connect::ProviderConnectRequest,
    transaction::SyncTransactionsResponse,
};
use crate::models::{
    api_error::ApiErrorResponse,
    auth::{DeleteAccountResponse, LogoutResponse, OnboardingCompleteResponse},
};

#[utoipa::path(
    get,
    path = "/api/export",
    description = "Downloads the current user's stored accounts and transactions as CSV or OFX.",
    params(
        ("format" = ExportFormat, Query, description = "Export format"),
        ("connection_id" = Option<Uuid>, Query, description = "Optional provider connection filter")
    ),
    responses(
        (status = 200, description = "Downloaded export file", body = String),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    ),
    security(("auth_cookie" = [])),
    tag = "Transactions"
)]
pub async fn get_authenticated_export(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Query(query): Query<ExportQuery>,
) -> Result<axum::response::Response, StatusCode> {
    build_authenticated_export_response(State(state), auth_context, Query(query)).await
}

use crate::providers::{PlaidCredentialResolver, SimpleFinCredentialResolver};
use crate::utils::encryption_key::parse_encryption_key_hex;
use auth_middleware::auth_middleware;
use config::Config;
use handlers::analytics::{lenient_analytics_filter, parse_analytics_range, parse_month_param};
use handlers::export::build_authenticated_export_response;
use handlers::provider::provider_disabled_response;
use middleware::auth_ip_ban::auth_ip_ban_middleware;
use middleware::passkey_enrollment::{
    passkey_enrollment_middleware, PasskeyEnrollmentMiddlewareState,
};
use middleware::resource_authorization::{AuthorizedConnectionRequest, AuthorizedQuery};
use middleware::telemetry_middleware::{self, request_tracing_middleware, TelemetryConfig};
use migration::MigratorTrait;
use models::provider_connect::ProviderSyncRequest;
use sea_orm::{ConnectOptions, ConnectionTrait, Database, DbBackend, Statement};
use services::auto_categorization_orchestrator::AutoCategorizationOrchestrationError;
use services::categorization::category_descriptors::SYSTEM_CATEGORY_SLUGS;
use services::category_management::service::CategoryManagementService;
use services::repository_service::{DatabaseRepository, PostgresRepository};
use services::{
    otel_traces_relay::OtlpTracesRelay,
    rate_limit_service::{
        auth_login_governor_layer, auth_register_governor_layer, spawn_auth_rate_limit_cleanup,
        telemetry_public_browser_governor_layer,
    },
    AuthService, AuthorizationService, BudgetService, CacheService, CategorizationService,
    Categorizer, ConnectionService, ProviderSyncRateLimitService, RedisCache, SyncService,
};
use services::{AnalyticsService, RealPlaidClient};
use utils::auth_cookie::{build_auth_cookie, build_clearing_auth_cookie, extract_auth_cookie};

pub(crate) fn build_provider_registry(
    plaid_provider: Option<Arc<dyn providers::FinancialDataProvider>>,
    simplefin_provider: Arc<dyn providers::FinancialDataProvider>,
) -> providers::ProviderRegistry {
    let mut provider_registry = providers::ProviderRegistry::new();

    if let Some(plaid_provider) = plaid_provider {
        provider_registry.register("plaid", plaid_provider);
    } else {
        tracing::warn!("Plaid provider not configured; skipping Plaid initialization");
    }

    provider_registry.register("simplefin", simplefin_provider);
    provider_registry.register(
        "diy",
        Arc::new(providers::DiyProvider) as Arc<dyn providers::FinancialDataProvider>,
    );

    provider_registry
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let telemetry_config = TelemetryConfig::from_env()?;
    let telemetry = telemetry_middleware::init(&telemetry_config)?;

    let config = Config::from_env()?;
    let plaid_client_id = std::env::var("PLAID_CLIENT_ID").ok();
    let plaid_secret = std::env::var("PLAID_SECRET").ok();
    let plaid_env = std::env::var("PLAID_ENV").ok();

    let plaid_configured = plaid_client_id
        .as_ref()
        .is_some_and(|v| !v.trim().is_empty())
        && plaid_secret.as_ref().is_some_and(|v| !v.trim().is_empty())
        && plaid_env.as_ref().is_some_and(|v| !v.trim().is_empty());

    let plaid_client = if plaid_configured {
        Arc::new(RealPlaidClient::new(
            plaid_client_id.clone().unwrap(),
            plaid_secret.clone().unwrap(),
            plaid_env.clone().unwrap(),
        ))
    } else {
        Arc::new(RealPlaidClient::new(
            "test_client_id".to_string(),
            "test_secret".to_string(),
            "sandbox".to_string(),
        ))
    };

    let plaid_provider = if plaid_configured {
        Some(
            Arc::new(providers::PlaidProvider::new(plaid_client.clone()))
                as Arc<dyn providers::FinancialDataProvider>,
        )
    } else {
        None
    };

    let simplefin_provider: Arc<dyn providers::FinancialDataProvider> =
        Arc::new(providers::SimpleFinProvider::new_with_real_client().await?);

    let provider_registry = Arc::new(build_provider_registry(plaid_provider, simplefin_provider));

    let sync_service = Arc::new(SyncService::new(provider_registry.clone()));

    let analytics_service = Arc::new(AnalyticsService::new());
    let budget_service = Arc::new(BudgetService::new());
    let authorization_service = Arc::new(AuthorizationService::new());

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:password@localhost:5432/accounting".to_string());

    let encryption_key_raw = std::env::var("ENCRYPTION_KEY").context(
        "ENCRYPTION_KEY environment variable is required. Generate one with `openssl rand -hex 32`.",
    )?;
    let encryption_key = parse_encryption_key_hex(&encryption_key_raw)?;

    let mut connect_options = ConnectOptions::new(&database_url);
    connect_options.max_connections(10).min_connections(0);
    let db = Database::connect(connect_options).await?;

    db.execute(Statement::from_string(
        DbBackend::Postgres,
        "SELECT pg_advisory_lock(7329481923)",
    ))
    .await?;
    let migration_result = migration::Migrator::up(&db, None).await;
    let _ = db
        .execute(Statement::from_string(
            DbBackend::Postgres,
            "SELECT pg_advisory_unlock(7329481923)",
        ))
        .await;
    migration_result?;
    tracing::info!("Database migrations applied");

    tracing::info!("ENCRYPTION_KEY loaded and validated for token encryption");
    let db_repository: Arc<dyn DatabaseRepository> =
        Arc::new(PostgresRepository::from_database(&db, encryption_key));

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

    if config.should_clear_sessions_on_boot() {
        if let Err(e) = cache_service.invalidate_pattern("*_session_valid").await {
            tracing::warn!("Failed to clear cached sessions on startup: {}", e);
        } else {
            tracing::info!("Cleared all cached sessions on app startup");
        }

        if let Err(e) = cache_service.invalidate_pattern("*_session_token").await {
            tracing::warn!("Failed to clear JWT tokens on startup: {}", e);
        } else {
            tracing::info!("Cleared all JWT tokens on app startup");
        }
    }

    let jwt_secret = std::env::var("JWT_SECRET").context(
        "JWT_SECRET environment variable is required. Generate one with `openssl rand -hex 32`.",
    )?;

    let auth_service = Arc::new(AuthService::new(jwt_secret)?);

    seed::maybe_seed_demo_user(&db_repository, &auth_service).await?;
    seed::maybe_seed_demo_dev_workspace(&db_repository, &cache_service).await?;

    let model_dir = CategorizationService::model_dir();
    tracing::info!(
        model_dir = %model_dir.display(),
        "loading transaction categorization model"
    );
    let categorizer: Arc<dyn Categorizer> = match CategorizationService::new(&model_dir).await {
        Ok(service) => Arc::new(service),
        Err(err) => {
            tracing::error!(
                error = %err,
                model_dir = %model_dir.display(),
                "failed to initialize transaction categorization"
            );
            return Err(err);
        }
    };

    let mut credential_resolvers = std::collections::HashMap::new();
    credential_resolvers.insert(
        "simplefin".to_string(),
        Arc::new(SimpleFinCredentialResolver::new(db_repository.clone()))
            as Arc<dyn crate::providers::ProviderCredentialResolver>,
    );
    credential_resolvers.insert(
        "plaid".to_string(),
        Arc::new(PlaidCredentialResolver::new(db_repository.clone()))
            as Arc<dyn crate::providers::ProviderCredentialResolver>,
    );

    let simplefin_org_service = Arc::new(
        crate::services::simplefin_org_service::SimpleFinOrganizationService::new(
            db_repository.clone(),
            cache_service.clone(),
            Arc::new(
                crate::services::merchant_normalization::service::MerchantNormalizationService::new(
                    db_repository.clone(),
                    cache_service.clone(),
                ),
            ),
        ),
    );

    let provider_sync_rate_limit_service =
        Arc::new(ProviderSyncRateLimitService::new(cache_service.clone()));

    let simplefin_connection_service = Arc::new(
        crate::services::simplefin_connection_service::SimpleFinConnectionService::new(
            db_repository.clone(),
            cache_service.clone(),
            provider_registry.clone(),
            credential_resolvers.clone(),
            simplefin_org_service,
        ),
    );

    let connection_service = Arc::new(
        ConnectionService::new(
            db_repository.clone(),
            cache_service.clone(),
            provider_registry.clone(),
            categorizer.clone(),
            credential_resolvers,
        )
        .with_simplefin_connection_service(simplefin_connection_service),
    );

    let otlp_traces_relay = Arc::new(OtlpTracesRelay::from_config(&telemetry_config)?);

    let category_management_service =
        Arc::new(CategoryManagementService::new(SYSTEM_CATEGORY_SLUGS));

    let auto_categorization_service = Arc::new(
        crate::services::auto_categorization::AutoCategorizationService::new(
            db_repository.clone(),
            cache_service.clone(),
            categorizer.clone(),
        ),
    );

    let webauthn_service = {
        let origins: Vec<url::Url> = config
            .app_origins()
            .iter()
            .map(|origin| {
                url::Url::parse(origin)
                    .map_err(|e| anyhow::anyhow!("Invalid origin '{}': {}", origin, e))
            })
            .collect::<Result<Vec<_>, _>>()?;

        let rp_id = origins
            .first()
            .and_then(|origin| origin.host_str())
            .ok_or_else(|| anyhow::anyhow!("Configured app origins have no host"))?
            .to_string();

        for origin in origins.iter().skip(1) {
            if origin.host_str() != Some(rp_id.as_str()) {
                return Err(anyhow::anyhow!(
                    "All configured app origins must share the same host (rp_id)"
                ));
            }
        }

        Arc::new(
            crate::services::webauthn_service::WebAuthnService::new(&rp_id, &origins)
                .map_err(|e| anyhow::anyhow!("Failed to build WebAuthnService: {}", e))?,
        )
    };

    let diy_service = Arc::new(crate::services::diy_service::DiyService::new(
        db_repository.clone(),
        connection_service.clone(),
    ));

    let state = AppState {
        plaid_client,
        sync_service,
        analytics_service,
        budget_service,
        authorization_service,
        config,
        db_repository,
        cache_service,
        provider_sync_rate_limit_service,
        categorizer,
        connection_service,
        auth_service,
        provider_registry,
        otlp_traces_relay,
        category_management_service,
        auto_categorization_service,
        webauthn_service,
        diy_service,
    };

    let app = create_app(state);

    spawn_auth_rate_limit_cleanup();

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    tracing::info!("Server running on http://0.0.0.0:3000");
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    telemetry.shutdown()?;

    Ok(())
}

pub fn create_app(state: AppState) -> Router {
    let passkey_login = Router::new()
        .route("/api/auth/login/password", post(login_with_password))
        .route("/api/auth/passkey/login/begin", post(begin_passkey_login))
        .route("/api/auth/passkey/login/finish", post(finish_passkey_login))
        .layer(auth_login_governor_layer())
        .layer(from_fn_with_state(state.clone(), auth_ip_ban_middleware))
        .with_state(state.clone());

    let auth_register = Router::new()
        .route("/", post(register_user))
        .layer(auth_register_governor_layer())
        .layer(from_fn_with_state(state.clone(), auth_ip_ban_middleware))
        .with_state(state.clone());

    let passkey_register_finish = Router::new()
        .route(
            "/api/auth/passkey/register/finish",
            post(finish_passkey_registration),
        )
        .layer(auth_register_governor_layer())
        .layer(from_fn_with_state(state.clone(), auth_ip_ban_middleware))
        .with_state(state.clone());

    let public_browser_traces = Router::new()
        .route(
            "/telemetry",
            post(handlers::otel_browser::post_browser_traces),
        )
        .layer(DefaultBodyLimit::max(10 * 1024 * 1024))
        .layer(telemetry_public_browser_governor_layer());

    let protected_browser_traces = Router::new()
        .route(
            "/telemetry",
            post(handlers::otel_browser::post_browser_traces),
        )
        .layer(DefaultBodyLimit::max(10 * 1024 * 1024));

    let transaction_import_routes = Router::new()
        .route(
            "/validate",
            post(handlers::import::validate_authenticated_transaction_import),
        )
        .route(
            "/",
            post(handlers::import::import_authenticated_transactions),
        )
        .layer(DefaultBodyLimit::max(10 * 1024 * 1024));

    let public_routes = Router::new()
        .route("/health", get(health_check))
        .nest("/api/v1/public", public_browser_traces)
        .merge(passkey_login)
        .merge(passkey_register_finish)
        .nest("/api/auth/register", auth_register)
        .route("/api/auth/refresh", post(refresh_user_session))
        .route("/api/auth/logout", post(logout_user));

    let protected_routes = Router::new()
        .route(
            "/api/auth/onboarding/complete",
            put(complete_user_onboarding),
        )
        .route(
            "/api/auth/onboarding/demo",
            post(activate_demo_mode_onboarding),
        )
        .route(
            "/api/transactions/categories",
            get(handlers::category::get_authenticated_transaction_categories),
        )
        .route("/api/categories", get(handlers::category::list_categories))
        .route(
            "/api/categories/custom",
            post(handlers::category::create_custom_category),
        )
        .route(
            "/api/categories/custom/{id}",
            delete(handlers::category::delete_custom_category),
        )
        .nest("/api/transactions/import", transaction_import_routes)
        .route("/api/export", get(get_authenticated_export))
        .route(
            "/api/transactions",
            get(handlers::transaction::get_authenticated_transactions),
        )
        .route(
            "/api/transactions/{id}/category",
            put(handlers::category::set_transaction_category),
        )
        .route(
            "/api/transactions/insights",
            get(handlers::transaction::get_authenticated_transactions_insights),
        )
        .route(
            "/api/transactions/contextual-insights",
            get(handlers::transaction::get_authenticated_transactions_contextual_insights),
        )
        .route(
            "/api/transactions/auto-categorize",
            post(start_auto_categorization)
                .get(get_auto_categorization_status)
                .delete(cancel_auto_categorization),
        )
        .route("/api/providers/info", get(get_authenticated_provider_info))
        .route("/api/providers/select", post(select_authenticated_provider))
        .route(
            "/api/diy/institutions",
            post(handlers::diy::create_diy_institution),
        )
        .route(
            "/api/diy/institutions/{connection_id}",
            delete(handlers::diy::disconnect_diy_institution),
        )
        .route(
            "/api/diy/institutions/{connection_id}/accounts",
            post(handlers::diy::create_diy_account),
        )
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
            "/api/providers/simplefin/ignored-institutions",
            get(get_authenticated_simplefin_ignored_institutions)
                .post(restore_authenticated_simplefin_ignored_institution),
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
            "/api/analytics/income-expense-totals",
            get(get_authenticated_income_expense_totals),
        )
        .route(
            "/api/analytics/budget-summary",
            get(get_authenticated_budget_summary),
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
            "/api/analytics/date-bounds",
            get(get_authenticated_date_bounds),
        )
        .route("/api/analytics/cash-flow", get(get_authenticated_cash_flow))
        .route("/api/analytics/sankey", get(get_authenticated_sankey))
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
        .route(
            "/api/budgets",
            get(handlers::budget::get_authenticated_budgets),
        )
        .route(
            "/api/budgets/overview",
            get(handlers::budget::get_authenticated_budgets_overview),
        )
        .route(
            "/api/budgets",
            post(handlers::budget::create_authenticated_budget),
        )
        .route(
            "/api/budgets/{id}",
            put(handlers::budget::update_authenticated_budget),
        )
        .route(
            "/api/budgets/{id}",
            delete(handlers::budget::delete_authenticated_budget),
        )
        .route("/api/auth/account", delete(delete_user_account))
        .route("/api/auth/passkey/enroll/begin", post(begin_passkey_enroll))
        .route(
            "/api/auth/passkey/enroll/finish",
            post(finish_passkey_enroll),
        )
        .route("/api/auth/passkey", get(list_user_passkeys))
        .route("/api/auth/passkey/{id}", delete(delete_user_passkey))
        .nest("/api/v1/private", protected_browser_traces)
        .layer(axum::middleware::from_fn_with_state(
            PasskeyEnrollmentMiddlewareState {
                db_repository: state.db_repository.clone(),
            },
            passkey_enrollment_middleware,
        ))
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

    let mut allowed_origins: Vec<HeaderValue> = std::env::var("CORS_ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:8080".to_string())
        .split(',')
        .filter_map(|origin| HeaderValue::from_str(origin.trim()).ok())
        .collect();

    if allowed_origins.is_empty() {
        allowed_origins.push(HeaderValue::from_static("http://localhost:8080"));
    }

    let cors_layer = CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([AUTHORIZATION, CONTENT_TYPE, COOKIE])
        .allow_credentials(true);

    let middleware_stack = ServiceBuilder::new()
        .layer(cors_layer)
        .layer(OtelAxumLayer::default().try_extract_client_ip(true))
        .layer(OtelInResponseLayer)
        .layer(from_fn(request_tracing_middleware))
        .layer(from_fn(error_handling_middleware))
        .into_inner();

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .merge(docs_routes)
        .layer(middleware_stack)
        .with_state(state)
}

fn auth_cookie_headers(cookie: String) -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(
        SET_COOKIE,
        HeaderValue::from_str(&cookie).expect("valid auth cookie header"),
    );
    headers
}

fn authenticated_session_response(
    config: &Config,
    session: models::auth::AuthenticatedSession,
) -> (HeaderMap, Json<auth_models::AuthResponse>) {
    (
        auth_cookie_headers(build_auth_cookie(
            &session.auth_token.token,
            session.auth_token.expires_at,
            config,
        )),
        Json(auth_models::AuthResponse {
            user_id: session.user_id,
            email: session.email,
            expires_at: session.auth_token.expires_at.to_rfc3339(),
            onboarding_completed: session.onboarding_completed,
            demo_mode_active: session.demo_mode_active,
            requires_passkey_enrollment: session.requires_passkey_enrollment,
        }),
    )
}

fn extract_auth_cookie_token(headers: &HeaderMap) -> Option<String> {
    let cookie_header = headers.get(COOKIE)?.to_str().ok()?;
    extract_auth_cookie(Some(cookie_header), "auth_token")
}

async fn error_handling_middleware(request: Request<Body>, next: Next) -> Response {
    let method = request.method().clone();
    let uri = request.uri().clone();
    let path = uri.path().to_string();

    let span_trace_id = otel_sdk::find_current_trace_id();
    let response = next.run(request).await;
    let status = response.status();
    let has_json_content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|content_type| content_type.starts_with("application/json"))
        .unwrap_or(false);
    let trace_id = span_trace_id
        .clone()
        .or_else(otel_sdk::find_current_trace_id);
    if status.is_client_error() || status.is_server_error() {
        let stack_trace = std::backtrace::Backtrace::capture();
        let error_type = if status.is_server_error() {
            "server_error"
        } else {
            "client_error"
        };
        tracing::Span::current().record("error.type", error_type);
        tracing::Span::current().record(
            "error.message",
            status.canonical_reason().unwrap_or("HTTP request failed"),
        );
        tracing::Span::current().record("error.reason", status.as_str());
        tracing::Span::current().record(
            "error.stack_trace",
            crate::services::external_http::truncate_telemetry_text(format!("{stack_trace:?}")),
        );
        tracing::Span::current().set_status(OtelStatus::error(status.to_string()));
        tracing::error!(
            event_name = "http.error",
            status_code = status.as_u16(),
            method = %method,
            path = %path,
            trace_id = trace_id.as_deref().unwrap_or(""),
            error.type = error_type,
            error.message = status.canonical_reason().unwrap_or("HTTP request failed"),
            error.reason = status.as_str(),
            error.stack_trace = %crate::services::external_http::truncate_telemetry_text(format!("{stack_trace:?}")),
            "endpoint request failed"
        );
    }

    if status.is_server_error() {
        match trace_id.as_deref() {
            Some(trace_id) => {
                tracing::error!(
                    event_name = "http.server_error",
                    status_code = status.as_u16(),
                    %trace_id,
                    method = %method,
                    %path,
                    error_type = "server_error",
                    error_message = "request resulted in server error",
                    "request resulted in server error"
                )
            }
            None => {
                tracing::error!(
                    event_name = "http.server_error",
                    status_code = status.as_u16(),
                    method = %method,
                    %path,
                    error_type = "server_error",
                    error_message = "request resulted in server error",
                    "request resulted in server error"
                )
            }
        };
        if !has_json_content_type {
            let mut error = ApiErrorResponse::new(
                "INTERNAL_SERVER_ERROR",
                "An unexpected server error occurred",
            );
            error.status_code = Some(status.as_u16());
            error.reason = Some("server_error".to_string());
            error.trace_id = trace_id.clone();
            error.details = trace_id.clone().map(|id| json!({ "trace_id": id }));
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(error)).into_response();
        }
    } else if status.is_client_error() {
        let error_category = match status.as_u16() {
            400 => "validation_error",
            401 => "authentication_error",
            403 => "authorization_error",
            404 => "not_found",
            409 => "conflict",
            422 => "unprocessable_entity",
            429 => "rate_limited",
            _ => "client_error",
        };

        let log_level = match status.as_u16() {
            401 | 403 => tracing::Level::WARN,
            _ => tracing::Level::DEBUG,
        };

        match trace_id.as_deref() {
            Some(trace_id) => match log_level {
                tracing::Level::WARN => {
                    tracing::warn!(
                        event_name = "http.client_error",
                        status_code = status.as_u16(),
                        %trace_id,
                        method = %method,
                        %path,
                        error_category = %error_category,
                        error_message = "request resulted in client error",
                        "request resulted in client error"
                    )
                }
                _ => {
                    tracing::debug!(
                        event_name = "http.client_error",
                        status_code = status.as_u16(),
                        %trace_id,
                        method = %method,
                        %path,
                        error_category = %error_category,
                        error_message = "request resulted in client error",
                        "request resulted in client error"
                    )
                }
            },
            None => match log_level {
                tracing::Level::WARN => {
                    tracing::warn!(
                        event_name = "http.client_error",
                        status_code = status.as_u16(),
                        method = %method,
                        %path,
                        error_category = %error_category,
                        error_message = "request resulted in client error",
                        "request resulted in client error"
                    )
                }
                _ => {
                    tracing::debug!(
                        event_name = "http.client_error",
                        status_code = status.as_u16(),
                        method = %method,
                        %path,
                        error_category = %error_category,
                        error_message = "request resulted in client error",
                        "request resulted in client error"
                    )
                }
            },
        }
    }

    if !has_json_content_type || !(status.is_client_error() || status.is_server_error()) {
        return response;
    }

    let (mut parts, body) = response.into_parts();
    let Ok(bytes) = axum::body::to_bytes(body, 1024 * 1024).await else {
        return Response::from_parts(parts, Body::empty());
    };
    let Ok(mut error) = serde_json::from_slice::<ApiErrorResponse>(&bytes) else {
        return Response::from_parts(parts, Body::from(bytes));
    };
    error.status_code = Some(status.as_u16());
    error.reason = Some(
        error
            .reason
            .or_else(|| error.code.clone())
            .unwrap_or_else(|| error.error.clone()),
    );
    error.trace_id = trace_id;
    let Ok(body) = serde_json::to_vec(&error) else {
        return Response::from_parts(parts, Body::from(bytes));
    };
    parts.headers.remove(CONTENT_LENGTH);
    Response::from_parts(parts, Body::from(body))
}

#[utoipa::path(
    post,
    path = "/api/auth/register",
    description = "Creates a new user and begins passkey enrollment. No auth cookie is issued until passkey registration completes.",
    request_body = auth_models::RegisterRequest,
    responses(
        (status = 200, description = "Registration challenge issued", body = auth_models::RegisterBeginResponse),
        (status = 400, description = "Invalid request body", body = ApiErrorResponse),
        (status = 409, description = "Email already registered", body = ApiErrorResponse),
        (status = 429, description = "Too many requests", body = ApiErrorResponse),
        (status = 403, description = "IP temporarily banned after repeated abuse", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    tag = "Authentication"
)]
async fn register_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<auth_models::RegisterRequest>,
) -> Result<Response, (StatusCode, Json<ApiErrorResponse>)> {
    #[cfg(feature = "dev-seed")]
    {
        let _ = headers;
        let password = req
            .password
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                ApiErrorResponse::bad_request("Password is required to register in development")
            })?;
        let email = req.email.trim().to_lowercase();
        return Ok(
            register_user_with_password(state, email, password.to_string())
                .await?
                .into_response(),
        );
    }

    #[cfg(not(feature = "dev-seed"))]
    {
        register_user_with_passkey(state, headers, req).await
    }
}

#[cfg(not(feature = "dev-seed"))]
async fn register_user_with_passkey(
    state: AppState,
    headers: HeaderMap,
    req: auth_models::RegisterRequest,
) -> Result<Response, (StatusCode, Json<ApiErrorResponse>)> {
    let session_token = extract_auth_cookie_token(&headers);

    let response = state
        .passkeys()
        .begin_registration(&req, session_token.as_deref())
        .await?;

    Ok(Json(response).into_response())
}

#[cfg(feature = "dev-seed")]
async fn register_user_with_password(
    state: AppState,
    email: String,
    password: String,
) -> Result<(HeaderMap, Json<auth_models::AuthResponse>), (StatusCode, Json<ApiErrorResponse>)> {
    let session = state.auth().register_with_password(email, password).await?;

    Ok(authenticated_session_response(&state.config, session))
}

#[utoipa::path(
    post,
    path = "/api/auth/logout",
    description = "Invalidates the active JWT and clears cached session state.",
    responses(
        (status = 200, description = "Logout successful", body = LogoutResponse),
        (status = 401, description = "Unauthorized")
    ),
    security(("auth_cookie" = [])),
    tag = "Authentication"
)]
async fn logout_user(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<(HeaderMap, Json<LogoutResponse>), StatusCode> {
    let auth_header = extract_auth_cookie_token(&headers).ok_or(StatusCode::UNAUTHORIZED)?;

    let cleared_session = state.auth().logout(&auth_header).await?;

    Ok((
        auth_cookie_headers(build_clearing_auth_cookie(&state.config)),
        Json(LogoutResponse {
            message: "Logged out successfully".to_string(),
            cleared_session,
        }),
    ))
}

#[utoipa::path(
    post,
    path = "/api/auth/refresh",
    description = "Refreshes the auth_token HttpOnly cookie.",
    responses(
        (status = 200, description = "Session refreshed successfully", body = auth_models::AuthResponse),
        (status = 401, description = "Unauthorized or session expired"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Authentication"
)]
async fn refresh_user_session(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<(HeaderMap, Json<auth_models::AuthResponse>), StatusCode> {
    let auth_header = extract_auth_cookie_token(&headers).ok_or(StatusCode::UNAUTHORIZED)?;

    let session = state.auth().refresh_session(&auth_header).await?;

    Ok(authenticated_session_response(&state.config, session))
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
    security(("auth_cookie" = [])),
    tag = "Authentication"
)]
async fn complete_user_onboarding(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<OnboardingCompleteResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .auth()
        .complete_onboarding(auth_context.user_id)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/auth/onboarding/demo",
    description = "Seeds the shared demo workspace for the authenticated user and marks onboarding complete.",
    responses(
        (status = 200, description = "Demo mode activated", body = OnboardingCompleteResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Authentication"
)]
async fn activate_demo_mode_onboarding(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<OnboardingCompleteResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .auth()
        .activate_demo_mode(auth_context.user_id)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/transactions/auto-categorize",
    responses(
        (status = 200, description = "Background categorization started", body = AutoCategorizationJobState),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 409, description = "Active job already exists", body = AutoCategorizationJobState),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Transactions"
)]
async fn start_auto_categorization(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Response, (StatusCode, Json<ApiErrorResponse>)> {
    match state
        .auto_categorization()
        .start(auth_context.user_id, &auth_context.jwt_id)
        .await
    {
        Ok(job) => Ok((StatusCode::OK, Json(job)).into_response()),
        Err(AutoCategorizationOrchestrationError::ActiveJobExists(job)) => {
            Ok((StatusCode::CONFLICT, Json(job)).into_response())
        }
        Err(error) => Err(error.into()),
    }
}

#[utoipa::path(
    get,
    path = "/api/transactions/auto-categorize",
    responses(
        (status = 200, description = "Latest auto-categorization job status", body = AutoCategorizationJobState),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Transactions"
)]
async fn get_auto_categorization_status(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<Option<AutoCategorizationJobState>>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .auto_categorization()
        .status(auth_context.user_id)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    delete,
    path = "/api/transactions/auto-categorize",
    responses(
        (status = 200, description = "Cancellation requested for active job", body = AutoCategorizationJobState),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 404, description = "No active job to cancel", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Transactions"
)]
async fn cancel_auto_categorization(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<AutoCategorizationJobState>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .auto_categorization()
        .cancel(auth_context.user_id)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/plaid/link-token",
    description = "Generates a provider-specific link token for Plaid flows.",
    request_body = LinkTokenRequest,
    responses(
        (status = 200, description = "Link token created successfully", body = LinkTokenResponse),
        (status = 400, description = "Unsupported provider"),
        (status = 401, description = "Unauthorized"),
        (status = 424, description = "Provider request failed", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Plaid"
)]
async fn create_authenticated_link_token(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(_req): Json<LinkTokenRequest>,
) -> Result<Json<LinkTokenResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    let provider = "plaid";
    if !state.config.is_financial_provider_enabled(provider) {
        return Err(provider_disabled_response(provider));
    }

    state
        .plaid()
        .create_link_token(auth_context.user_id)
        .await
        .map(|link_token| Json(LinkTokenResponse { link_token }))
        .map_err(Into::into)
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
        (status = 424, description = "Token exchange failed with provider"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Plaid"
)]
async fn exchange_authenticated_public_token(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<ExchangeTokenRequest>,
) -> Result<Json<ExchangeTokenResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    let provider = "plaid";
    if !state.config.is_financial_provider_enabled(provider) {
        return Err(provider_disabled_response(provider));
    }

    state
        .plaid()
        .exchange_public_token(
            auth_context.user_id,
            &auth_context.jwt_id,
            &req.public_token,
        )
        .await
        .map(Json)
        .map_err(Into::into)
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
    security(("auth_cookie" = [])),
    tag = "Plaid"
)]
async fn get_authenticated_plaid_accounts(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<Vec<AccountResponse>>, StatusCode> {
    state
        .plaid()
        .list_accounts(auth_context.user_id)
        .await
        .map(Json)
        .map_err(Into::into)
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
        (status = 415, description = "Unsupported media type"),
        (status = 404, description = "Connection not found or credentials missing"),
        (status = 424, description = "Provider request failed"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Financial Providers"
)]
async fn sync_authenticated_provider_transactions(
    State(state): State<AppState>,
    auth_context: AuthContext,
    req: AuthorizedConnectionRequest<SyncTransactionsRequest>,
) -> Result<Json<SyncTransactionsResponse>, Response> {
    let user_id = auth_context.user_id;
    let AuthorizedConnectionRequest {
        _body: request_body,
        connection,
    } = req;

    tracing::info!(
        user_id = %user_id,
        connection_id = %connection.id,
        item_id = %connection.item_id,
        "Sync transactions requested"
    );

    let reference_date = NaiveDate::parse_from_str(&request_body.client_date, "%Y-%m-%d")
        .map_err(|_| StatusCode::BAD_REQUEST.into_response())?;

    let provider = connection.provider.clone();
    if !state.config.is_financial_provider_enabled(&provider) {
        return Err(provider_disabled_response(&provider).into_response());
    }

    state
        .providers()
        .sync_transactions(
            user_id,
            &auth_context.jwt_id,
            connection,
            ProviderSyncRequest {
                client_date: request_body.client_date,
                client_timezone: request_body.client_timezone,
                reference_date,
            },
        )
        .await
        .map(Json)
        .map_err(Into::into)
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
async fn get_authenticated_current_month_spending(
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
async fn get_authenticated_daily_spending(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Query(params): Query<models::query::DailySpendingQuery>,
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
    post,
    path = "/api/plaid/clear-synced-data",
    description = "Clears cached transactions for the calling user's session.",
    responses(
        (status = 200, description = "Synced data cleared successfully", body = ClearSyncedDataResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Plaid"
)]
async fn clear_authenticated_synced_data(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<ClearSyncedDataResponse>, StatusCode> {
    state
        .plaid()
        .clear_synced_data(auth_context.user_id, &auth_context.jwt_id)
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
async fn get_authenticated_income_expense_totals(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedQuery {
        query,
        authorized_account_ids,
    }: AuthorizedQuery<DateRangeQuery>,
) -> Result<Json<models::analytics::IncomeExpenseTotals>, StatusCode> {
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
async fn get_authenticated_budget_summary(
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
async fn get_authenticated_spending_by_date_range(
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
async fn get_authenticated_category_spending(
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
async fn get_authenticated_monthly_totals(
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
async fn get_authenticated_date_bounds(
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
async fn get_authenticated_cash_flow(
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
async fn get_authenticated_sankey(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedQuery {
        query,
        authorized_account_ids,
    }: AuthorizedQuery<DateRangeQuery>,
) -> Result<Json<models::analytics::SankeyResponse>, StatusCode> {
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
async fn get_authenticated_top_merchants(
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
    post,
    path = "/api/providers/connect",
    description = "Completes provider connect enrollment and stores provider credentials for the user.",
    request_body = ProviderConnectRequest,
    responses(
        (status = 200, description = "Provider connected successfully", body = ProviderConnectResponse),
        (status = 400, description = "Unsupported provider"),
        (status = 401, description = "Unauthorized"),
        (status = 424, description = "Provider request failed", body = ApiErrorResponse),
        (status = 500, description = "Failed to connect provider", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Financial Providers"
)]
async fn connect_authenticated_provider(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<ProviderConnectRequest>,
) -> Result<Json<ProviderConnectResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    if state.provider_registry.get(&req.provider).is_some()
        && !state.config.is_financial_provider_enabled(&req.provider)
    {
        return Err(provider_disabled_response(&req.provider));
    }

    state
        .providers()
        .connect(auth_context.user_id, &auth_context.jwt_id, &req)
        .await
        .map(Json)
        .map_err(Into::into)
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
    security(("auth_cookie" = [])),
    tag = "Financial Providers"
)]
async fn get_authenticated_provider_status(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<ProviderStatusResponse>, StatusCode> {
    state
        .providers()
        .status(auth_context.user_id)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    get,
    path = "/api/providers/simplefin/ignored-institutions",
    description = "Lists SimpleFIN bridge institutions the user has hidden in Sumurai.",
    responses(
        (status = 200, description = "Ignored institutions", body = crate::models::simplefin::SimpleFinIgnoredInstitutionsResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Financial Providers"
)]
async fn get_authenticated_simplefin_ignored_institutions(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<crate::models::simplefin::SimpleFinIgnoredInstitutionsResponse>, StatusCode> {
    if !state.config.is_financial_provider_enabled("simplefin") {
        return Err(StatusCode::FORBIDDEN);
    }

    state
        .providers()
        .list_simplefin_ignored_institutions(auth_context.user_id)
        .await
        .map(|institutions| {
            Json(crate::models::simplefin::SimpleFinIgnoredInstitutionsResponse { institutions })
        })
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/providers/simplefin/ignored-institutions",
    description = "Removes a SimpleFIN institution from the ignore list so connect/sync can import it again. Idempotent: returns 200 even if the institution was not on the ignore list.",
    request_body = crate::models::simplefin::SimpleFinRestoreIgnoredInstitutionRequest,
    responses(
        (status = 200, description = "Institution restored (or was already not ignored)", body = crate::models::simplefin::SimpleFinRestoreIgnoredInstitutionResponse),
        (status = 400, description = "Invalid request"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Financial Providers"
)]
async fn restore_authenticated_simplefin_ignored_institution(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<crate::models::simplefin::SimpleFinRestoreIgnoredInstitutionRequest>,
) -> Result<Json<crate::models::simplefin::SimpleFinRestoreIgnoredInstitutionResponse>, StatusCode>
{
    if !state.config.is_financial_provider_enabled("simplefin") {
        return Err(StatusCode::FORBIDDEN);
    }

    state
        .providers()
        .restore_simplefin_ignored_institution(auth_context.user_id, &req.org_conn_id)
        .await
        .map(|restored| {
            Json(crate::models::simplefin::SimpleFinRestoreIgnoredInstitutionResponse { restored })
        })
        .map_err(Into::into)
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
        (status = 415, description = "Unsupported media type"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Financial Providers"
)]
async fn disconnect_authenticated_connection(
    State(state): State<AppState>,
    auth_context: AuthContext,
    req: AuthorizedConnectionRequest<DisconnectRequest>,
) -> Result<Json<DisconnectResult>, StatusCode> {
    state
        .providers()
        .disconnect(auth_context.user_id, &auth_context.jwt_id, &req.connection)
        .await
        .map(Json)
        .map_err(Into::into)
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
    security(("auth_cookie" = [])),
    tag = "Financial Providers"
)]
async fn get_authenticated_provider_info(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<ProviderInfoResponse>, StatusCode> {
    state
        .providers()
        .info(auth_context.user_id)
        .await
        .map(Json)
        .map_err(Into::into)
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
        (status = 409, description = "Cannot switch while active connections exist", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Financial Providers"
)]
async fn select_authenticated_provider(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<ProviderSelectRequest>,
) -> Result<Json<ProviderSelectResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .providers()
        .select(auth_context.user_id, req.provider)
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
async fn get_authenticated_balances_overview(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedQuery {
        query: _,
        authorized_account_ids,
    }: AuthorizedQuery<BalancesOverviewQuery>,
) -> Result<Json<models::analytics::BalancesOverviewResponse>, StatusCode> {
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
async fn get_authenticated_net_worth_over_time(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedQuery {
        query,
        authorized_account_ids,
    }: AuthorizedQuery<models::analytics::DateRangeQuery>,
) -> Result<Json<models::analytics::NetWorthOverTimeResponse>, StatusCode> {
    let range = parse_analytics_range(&query, authorized_account_ids)?;

    state
        .analytics()
        .net_worth_over_time(auth_context.user_id, &auth_context.jwt_id, range)
        .await
        .map(Json)
        .map_err(Into::into)
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
    security(("auth_cookie" = [])),
    tag = "Authentication"
)]
async fn delete_user_account(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<auth_models::DeleteAccountResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .auth()
        .delete_account(auth_context.user_id, &auth_context.jwt_id)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/auth/passkey/enroll/begin",
    description = "Begin passkey enrollment for the authenticated user (settings or migration). Requires an auth_token cookie; complete with enroll/finish.",
    responses(
        (status = 200, description = "Registration challenge", body = auth_models::PasskeyRegisterBeginResponse),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    tag = "Authentication"
)]
async fn begin_passkey_enroll(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<auth_models::PasskeyRegisterBeginResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .passkeys()
        .begin_enrollment(auth_context.user_id)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/auth/passkey/enroll/finish",
    description = "Complete authenticated passkey enrollment and return the enrolled passkey.",
    request_body = auth_models::PasskeyRegisterFinishRequest,
    responses(
        (status = 200, description = "Passkey enrolled", body = auth_models::PasskeyItem),
        (status = 400, description = "Invalid response or expired challenge", body = ApiErrorResponse),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    tag = "Authentication"
)]
async fn finish_passkey_enroll(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<auth_models::PasskeyRegisterFinishRequest>,
) -> Result<Json<auth_models::PasskeyItem>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .passkeys()
        .finish_enrollment(
            auth_context.user_id,
            &req.session_id,
            req.response,
            &req.name,
        )
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/auth/passkey/register/finish",
    description = "Complete passkey signup or recovery enrollment without an auth cookie. Returns an auth_token cookie on success. Authenticated enrollment uses enroll/finish instead.",
    request_body = auth_models::PasskeyRegisterFinishRequest,
    responses(
        (status = 200, description = "Signup or recovery completed", body = auth_models::AuthResponse),
        (status = 400, description = "Invalid response or expired challenge", body = ApiErrorResponse),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    tag = "Authentication"
)]
async fn finish_passkey_registration(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<auth_models::PasskeyRegisterFinishRequest>,
) -> Result<axum::response::Response, (StatusCode, Json<ApiErrorResponse>)> {
    use axum::response::IntoResponse;

    let session_token = extract_auth_cookie_token(&headers);

    let session = state
        .passkeys()
        .finish_registration(
            &req.session_id,
            req.response,
            &req.name,
            session_token.as_deref(),
        )
        .await?;

    let mut response_headers = auth_cookie_headers(build_auth_cookie(
        &session.auth_token.token,
        session.auth_token.expires_at,
        &state.config,
    ));
    response_headers.insert(
        axum::http::header::CONTENT_TYPE,
        axum::http::HeaderValue::from_static("application/json"),
    );

    let body = serde_json::to_string(&auth_models::AuthResponse {
        user_id: session.user_id,
        email: session.email,
        expires_at: session.auth_token.expires_at.to_rfc3339(),
        onboarding_completed: session.onboarding_completed,
        demo_mode_active: session.demo_mode_active,
        requires_passkey_enrollment: session.requires_passkey_enrollment,
    })
    .map_err(|e| {
        tracing::error!("Failed to serialize auth response: {}", e);
        ApiErrorResponse::internal_server_error("Failed to serialize response")
    })?;

    Ok((
        StatusCode::OK,
        response_headers,
        axum::body::Body::from(body),
    )
        .into_response())
}

#[utoipa::path(
    get,
    path = "/api/auth/passkey",
    description = "List all enrolled passkeys for the authenticated user.",
    responses(
        (status = 200, description = "List of passkeys", body = Vec<auth_models::PasskeyItem>),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    tag = "Authentication"
)]
async fn list_user_passkeys(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<Vec<auth_models::PasskeyItem>>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .passkeys()
        .list_passkeys(auth_context.user_id)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    delete,
    path = "/api/auth/passkey/{id}",
    description = "Remove an enrolled passkey. Returns 409 if it is the last credential.",
    params(("id" = Uuid, Path, description = "Passkey ID")),
    responses(
        (status = 204, description = "Passkey removed"),
        (status = 404, description = "Passkey not found", body = ApiErrorResponse),
        (status = 409, description = "Cannot remove last passkey", body = ApiErrorResponse),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    tag = "Authentication"
)]
async fn delete_user_passkey(
    State(state): State<AppState>,
    auth_context: AuthContext,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .passkeys()
        .delete_passkey(auth_context.user_id, id)
        .await
        .map(|()| StatusCode::NO_CONTENT)
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/auth/login/password",
    description = "Sign in with email and password when the account has no enrolled passkey. Returns the same auth_token cookie as passkey login. Rejected when a passkey exists or the password does not match.",
    request_body = auth_models::PasswordLoginRequest,
    responses(
        (status = 200, description = "Authentication successful", body = auth_models::AuthResponse),
        (status = 401, description = "Invalid credentials", body = ApiErrorResponse),
        (status = 429, description = "Too many requests", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    tag = "Authentication"
)]
async fn login_with_password(
    State(state): State<AppState>,
    Json(req): Json<auth_models::PasswordLoginRequest>,
) -> Result<(HeaderMap, Json<auth_models::AuthResponse>), (StatusCode, Json<ApiErrorResponse>)> {
    let session = state
        .auth()
        .login_with_password(&req.email, &req.password)
        .await?;

    Ok(authenticated_session_response(&state.config, session))
}

#[utoipa::path(
    post,
    path = "/api/auth/passkey/login/begin",
    description = "Begin passkey authentication. Returns a challenge for any email; response shape is identical for unknown emails to prevent user enumeration.",
    request_body = auth_models::PasskeyLoginBeginRequest,
    responses(
        (status = 200, description = "Authentication challenge", body = auth_models::PasskeyLoginBeginResponse),
        (status = 429, description = "Too many requests", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    tag = "Authentication"
)]
async fn begin_passkey_login(
    State(state): State<AppState>,
    Json(req): Json<auth_models::PasskeyLoginBeginRequest>,
) -> Result<Json<auth_models::PasskeyLoginBeginResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .passkeys()
        .begin_login(&req.email)
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/auth/passkey/login/finish",
    description = "Complete passkey authentication and receive an auth_token cookie.",
    request_body = auth_models::PasskeyLoginFinishRequest,
    responses(
        (status = 200, description = "Authentication successful", body = auth_models::AuthResponse),
        (status = 400, description = "Challenge not found, expired, or invalid response", body = ApiErrorResponse),
        (status = 401, description = "Authentication failed", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    tag = "Authentication"
)]
async fn finish_passkey_login(
    State(state): State<AppState>,
    Json(req): Json<auth_models::PasskeyLoginFinishRequest>,
) -> Result<(HeaderMap, Json<auth_models::AuthResponse>), (StatusCode, Json<ApiErrorResponse>)> {
    let session = state
        .passkeys()
        .finish_login(&req.session_id, req.response)
        .await?;

    Ok(authenticated_session_response(&state.config, session))
}
