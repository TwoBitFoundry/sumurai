use anyhow::Context;
use axum::{
    body::Body,
    extract::{DefaultBodyLimit, Request, State},
    http::{
        header::{AUTHORIZATION, CONTENT_LENGTH, CONTENT_TYPE, COOKIE},
        HeaderMap, HeaderValue, Method, StatusCode,
    },
    middleware::{from_fn, from_fn_with_state, Next},
    response::{IntoResponse, Json, Response},
    routing::{delete, get, post, put},
    Router,
};
use axum_tracing_opentelemetry::middleware::{OtelAxumLayer, OtelInResponseLayer};
use axum_tracing_opentelemetry::tracing_opentelemetry_instrumentation_sdk as otel_sdk;
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

use crate::models::api_error::ApiErrorResponse;
use crate::models::app_state::AppState;
use crate::models::auth as auth_models;
use crate::models::auth::{AuthContext, AuthMiddlewareState};

use crate::providers::{PlaidCredentialResolver, SimpleFinCredentialResolver};
use crate::utils::encryption_key::parse_encryption_key_hex;
use auth_middleware::auth_middleware;
use auth_middleware::extract_auth_cookie_token;
use config::Config;
use handlers::auth::{auth_cookie_headers, authenticated_session_response};
use middleware::auth_ip_ban::auth_ip_ban_middleware;
use middleware::passkey_enrollment::{
    passkey_enrollment_middleware, PasskeyEnrollmentMiddlewareState,
};
use middleware::telemetry_middleware::{self, request_tracing_middleware, TelemetryConfig};
use migration::MigratorTrait;
use sea_orm::{ConnectOptions, ConnectionTrait, Database, DbBackend, Statement};
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
use utils::auth_cookie::build_auth_cookie;

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
        .route(
            "/api/auth/login/password",
            post(handlers::auth::login_with_password),
        )
        .route("/api/auth/passkey/login/begin", post(begin_passkey_login))
        .route("/api/auth/passkey/login/finish", post(finish_passkey_login))
        .layer(auth_login_governor_layer())
        .layer(from_fn_with_state(state.clone(), auth_ip_ban_middleware))
        .with_state(state.clone());

    let auth_register = Router::new()
        .route("/", post(handlers::auth::register_user))
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
        .route(
            "/api/auth/refresh",
            post(handlers::auth::refresh_user_session),
        )
        .route("/api/auth/logout", post(handlers::auth::logout_user));

    let protected_routes = Router::new()
        .route(
            "/api/auth/onboarding/complete",
            put(handlers::auth::complete_user_onboarding),
        )
        .route(
            "/api/auth/onboarding/demo",
            post(handlers::auth::activate_demo_mode_onboarding),
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
        .route(
            "/api/export",
            get(handlers::export::get_authenticated_export),
        )
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
            post(handlers::auto_categorization::start_auto_categorization)
                .get(handlers::auto_categorization::get_auto_categorization_status)
                .delete(handlers::auto_categorization::cancel_auto_categorization),
        )
        .route(
            "/api/providers/info",
            get(handlers::provider::get_authenticated_provider_info),
        )
        .route(
            "/api/providers/select",
            post(handlers::provider::select_authenticated_provider),
        )
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
            post(handlers::provider::connect_authenticated_provider),
        )
        .route(
            "/api/providers/status",
            get(handlers::provider::get_authenticated_provider_status),
        )
        .route(
            "/api/providers/accounts",
            get(handlers::plaid::get_authenticated_plaid_accounts),
        )
        .route(
            "/api/plaid/link-token",
            post(handlers::plaid::create_authenticated_link_token),
        )
        .route(
            "/api/plaid/exchange-token",
            post(handlers::plaid::exchange_authenticated_public_token),
        )
        .route(
            "/api/plaid/accounts",
            get(handlers::plaid::get_authenticated_plaid_accounts),
        )
        .route(
            "/api/providers/sync-transactions",
            post(handlers::provider::sync_authenticated_provider_transactions),
        )
        .route(
            "/api/providers/disconnect",
            post(handlers::provider::disconnect_authenticated_connection),
        )
        .route(
            "/api/providers/simplefin/ignored-institutions",
            get(handlers::provider::get_authenticated_simplefin_ignored_institutions)
                .post(handlers::provider::restore_authenticated_simplefin_ignored_institution),
        )
        .route(
            "/api/plaid/clear-synced-data",
            post(handlers::plaid::clear_authenticated_synced_data),
        )
        .route(
            "/api/analytics/spending/current-month",
            get(handlers::analytics::get_authenticated_current_month_spending),
        )
        .route(
            "/api/analytics/income-expense-totals",
            get(handlers::analytics::get_authenticated_income_expense_totals),
        )
        .route(
            "/api/analytics/budget-summary",
            get(handlers::analytics::get_authenticated_budget_summary),
        )
        .route(
            "/api/analytics/spending",
            get(handlers::analytics::get_authenticated_spending_by_date_range),
        )
        .route(
            "/api/analytics/daily-spending",
            get(handlers::analytics::get_authenticated_daily_spending),
        )
        .route(
            "/api/analytics/categories",
            get(handlers::analytics::get_authenticated_category_spending),
        )
        .route(
            "/api/analytics/monthly-totals",
            get(handlers::analytics::get_authenticated_monthly_totals),
        )
        .route(
            "/api/analytics/date-bounds",
            get(handlers::analytics::get_authenticated_date_bounds),
        )
        .route(
            "/api/analytics/cash-flow",
            get(handlers::analytics::get_authenticated_cash_flow),
        )
        .route(
            "/api/analytics/sankey",
            get(handlers::analytics::get_authenticated_sankey),
        )
        .route(
            "/api/analytics/top-merchants",
            get(handlers::analytics::get_authenticated_top_merchants),
        )
        .route(
            "/api/analytics/balances/overview",
            get(handlers::analytics::get_authenticated_balances_overview),
        )
        .route(
            "/api/analytics/net-worth-over-time",
            get(handlers::analytics::get_authenticated_net_worth_over_time),
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
        .route(
            "/api/auth/account",
            delete(handlers::auth::delete_user_account),
        )
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

#[cfg(not(feature = "dev-seed"))]
pub(crate) async fn register_user_with_passkey(
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
