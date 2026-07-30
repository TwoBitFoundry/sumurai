use anyhow::Context;
use axum::{
    body::Body,
    extract::{DefaultBodyLimit, Multipart, Query, Request, State},
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
use chrono::Utc;
use csv::StringRecord;
use opentelemetry::trace::Status as OtelStatus;
use std::net::SocketAddr;
use std::sync::Arc;
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;
use tracing_opentelemetry::OpenTelemetrySpanExt;
use uuid::Uuid;

#[allow(unused_imports)]
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
use utils::seed_password_fallback::{dev_password_auth_enabled, user_has_password};
use utils::webauthn_credentials::{
    count_usable_credentials, has_usable_passkey, is_usable_credential, usable_passkeys,
};

use crate::models::analytics::{
    BalanceCategory, BalancesOverviewQuery, BalancesOverviewResponse, BudgetSummary,
    CashFlowResponse, CategorySpending, DailySpending, DateBoundsResponse, IncomeExpenseTotals,
    MonthlySpending, NetWorthOverTimeResponse, SankeyResponse, TopMerchant,
};
use crate::models::app_state::AppState;
use crate::models::auth::{AuthContext, AuthMiddlewareState};
use crate::models::auto_categorization_job::AutoCategorizationJobState;
use crate::models::{
    account::AccountResponse,
    analytics::DateRangeQuery,
    auth as auth_models,
    budget::{
        Budget, BudgetsOverviewResponse, CreateBudgetRequest, DeleteBudgetResponse,
        UpdateBudgetRequest,
    },
    export::{ExportFormat, ExportQuery},
    import::{
        CsvColumnMapping, ImportFileFormat, ImportMultipartRequest, ImportResponse,
        ValidateResponse,
    },
    plaid::{
        ClearSyncedDataResponse, DisconnectRequest, DisconnectResult, ExchangeTokenRequest,
        ExchangeTokenResponse, LinkTokenRequest, LinkTokenResponse, ProviderConnectResponse,
        ProviderConnectionStatus, ProviderInfoResponse, ProviderSelectRequest,
        ProviderSelectResponse, ProviderStatusResponse, SyncTransactionsRequest,
    },
    provider_connect::ProviderConnectRequest,
    transaction::{
        ContextualInsightsResponse, CursorTransactionsResponse, SyncTransactionsResponse,
        TransactionsInsightsResponse, TransactionsQuery,
    },
};
use crate::models::{
    api_error::ApiErrorResponse,
    auth::{DeleteAccountResponse, LogoutResponse, OnboardingCompleteResponse, User},
};

#[derive(serde::Serialize, serde::Deserialize)]
struct LoginChallengePayload {
    user_id: Uuid,
    state: serde_json::Value,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct RegistrationChallengePayload {
    user_id: Uuid,
    email: String,
    display_name: String,
    state: serde_json::Value,
    #[serde(default)]
    existing_user_recovery: bool,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct AuthenticatedEnrollmentChallengePayload {
    user_id: Uuid,
    state: serde_json::Value,
}

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
use handlers::billing::{billing_authenticated_routes, billing_webhook_routes};
use handlers::export::build_authenticated_export_response;
use middleware::auth_ip_ban::auth_ip_ban_middleware;
use middleware::entitlement::{
    require_paid_own_data_access, require_paid_own_data_access_after_demo,
};
use middleware::passkey_enrollment::{
    passkey_enrollment_middleware, PasskeyEnrollmentMiddlewareState,
};
use middleware::resource_authorization::{
    AuthorizedBudgetId, AuthorizedConnectionRequest, AuthorizedQuery,
};
use middleware::telemetry_middleware::{self, request_tracing_middleware, TelemetryConfig};
use migration::MigratorTrait;
use sea_orm::{ConnectOptions, ConnectionTrait, Database, DbBackend, Statement};
use services::auto_categorization::service::AutoCategorizationError;
use services::billing_service::BillingService;
use services::categorization::category_descriptors::SYSTEM_CATEGORY_SLUGS;
use services::category_management::service::CategoryManagementService;
use services::import_service::ImportService;
use services::repository_service::{DatabaseRepository, PostgresRepository};
use services::sync_service_dispatcher::provider_sync_error_to_response;
use services::{
    otel_traces_relay::OtlpTracesRelay,
    rate_limit_service::{
        auth_login_governor_layer, auth_register_governor_layer, spawn_auth_rate_limit_cleanup,
        telemetry_public_browser_governor_layer,
    },
    AuthService, AuthorizationService, BudgetService, CacheService, CategorizationService,
    Categorizer, ConnectionService, ExchangeTokenError, LinkTokenError, PlaidService,
    ProviderSyncRateLimitService, RedisCache, SimpleFinConnectError, SyncConnectionParams,
    SyncService, SyncServiceFactory, TellerConnectError,
};
use services::{AnalyticsService, RealPlaidClient, SpendingTransactionQuery};
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
    let enabled_financial_provider_count = config
        .enabled_financial_providers()
        .map(|providers| providers.len())
        .unwrap_or(0);
    if let Some(paddle) = config.paddle_billing() {
        tracing::info!(
            billing_mode = ?config.billing_mode(),
            enabled_financial_provider_count,
            paddle_environment = %paddle.environment,
            paddle_api_key_configured = !paddle.api_key.is_empty(),
            paddle_webhook_secret_configured = !paddle.webhook_secret.is_empty(),
            paddle_monthly_price_configured = !paddle.monthly_price_id.is_empty(),
            paddle_cardless_trial_price_configured = paddle.cardless_trial_price_id.is_some(),
            trials_enabled = paddle.trials_enabled,
            "Paddle billing enabled"
        );
    } else {
        tracing::info!(
            billing_mode = ?config.billing_mode(),
            billing_enabled = config.is_billing_enabled(),
            enabled_financial_provider_count,
            "Billing disabled"
        );
    }

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

    let plaid_service = Arc::new(PlaidService::new(plaid_client.clone()));

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

    let sync_service_factory = Arc::new(SyncServiceFactory::new(
        connection_service.clone(),
        sync_service.clone(),
    ));

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

    let paddle_client: Arc<dyn providers::PaddleHttpClient> = match config.paddle_billing() {
        Some(paddle) => Arc::new(providers::PaddleClient::new(
            &paddle.environment,
            paddle.api_key.clone(),
        )),
        None => Arc::new(providers::NoOpPaddleClient),
    };
    let billing_service = Arc::new(BillingService::new(
        config.clone(),
        db_repository.clone(),
        paddle_client,
    ));

    let state = AppState {
        plaid_service,
        plaid_client,
        billing_service,
        sync_service,
        sync_service_factory,
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
        .route("/validate", post(validate_authenticated_transaction_import))
        .route("/", post(import_authenticated_transactions))
        .layer(DefaultBodyLimit::max(10 * 1024 * 1024));

    let public_routes = Router::new()
        .route("/health", get(health_check))
        .nest("/api/v1/public", public_browser_traces)
        .merge(passkey_login)
        .merge(passkey_register_finish)
        .nest("/api/auth/register", auth_register)
        .route("/api/auth/refresh", post(refresh_user_session))
        .route("/api/auth/logout", post(logout_user));
    let billing_webhook_routes = billing_webhook_routes();

    let protected_routes = Router::new()
        .merge(billing_authenticated_routes())
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
            get(get_authenticated_transaction_categories),
        )
        .route("/api/categories", get(list_categories))
        .route("/api/categories/custom", post(create_custom_category))
        .route(
            "/api/categories/custom/{id}",
            delete(delete_custom_category),
        )
        .nest("/api/transactions/import", transaction_import_routes)
        .route("/api/export", get(get_authenticated_export))
        .route("/api/transactions", get(get_authenticated_transactions))
        .route(
            "/api/transactions/{id}/category",
            put(set_transaction_category),
        )
        .route(
            "/api/transactions/insights",
            get(get_authenticated_transactions_insights),
        )
        .route(
            "/api/transactions/contextual-insights",
            get(get_authenticated_transactions_contextual_insights),
        )
        .route(
            "/api/transactions/auto-categorize",
            post(start_auto_categorization)
                .get(get_auto_categorization_status)
                .delete(cancel_auto_categorization),
        )
        .route("/api/providers/info", get(get_authenticated_provider_info))
        .route("/api/providers/select", post(select_authenticated_provider))
        .route("/api/diy/institutions", post(create_diy_institution))
        .route(
            "/api/diy/institutions/{connection_id}",
            delete(disconnect_diy_institution),
        )
        .route(
            "/api/diy/institutions/{connection_id}/accounts",
            post(create_diy_account),
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
        .route("/api/budgets", get(get_authenticated_budgets))
        .route(
            "/api/budgets/overview",
            get(get_authenticated_budgets_overview),
        )
        .route("/api/budgets", post(create_authenticated_budget))
        .route("/api/budgets/{id}", put(update_authenticated_budget))
        .route("/api/budgets/{id}", delete(delete_authenticated_budget))
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
        .merge(billing_webhook_routes)
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

fn extract_auth_cookie_token(headers: &HeaderMap) -> Option<String> {
    let cookie_header = headers.get(COOKIE)?.to_str().ok()?;
    extract_auth_cookie(Some(cookie_header), "auth_token")
}

fn log_provider_credential_outcome(provider: &str, status: StatusCode, endpoint: &str) {
    tracing::info!(
        target: "provider_credentials",
        provider,
        status = %status,
        endpoint,
        "Provider credential endpoint completed"
    );
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
    if req.password.is_some() {
        return Err(ApiErrorResponse::bad_request(
            "Password registration is no longer supported; enroll a passkey instead",
        ));
    }

    let authenticated_user_id = extract_auth_cookie_token(&headers)
        .and_then(|token| state.auth_service.validate_token(&token).ok())
        .and_then(|claims| Uuid::parse_str(&claims.sub).ok());

    if authenticated_user_id.is_some() {
        return Err(ApiErrorResponse::bad_request(
            "Authenticated passkey enrollment must use /api/auth/passkey/enroll/finish",
        ));
    }

    let email = req.email.trim().to_lowercase();
    let display_name = req.name.trim().to_string();

    if let Ok(Some(_)) = state.db_repository.get_user_by_email(&email).await {
        return Err(ApiErrorResponse::conflict(
            "Email address is already registered",
        ));
    }

    let user_id = Uuid::new_v4();

    let (challenge, reg_state) = state
        .webauthn_service
        .begin_registration(user_id, &email, &display_name, &[])
        .map_err(|e| {
            tracing::error!("begin_registration failed for user {}: {}", user_id, e);
            ApiErrorResponse::internal_server_error("Failed to begin passkey registration")
        })?;

    let state_value = serde_json::to_value(&reg_state).map_err(|e| {
        tracing::error!("Failed to serialize registration state: {}", e);
        ApiErrorResponse::internal_server_error("Failed to serialize registration state")
    })?;

    let payload = serde_json::to_string(&RegistrationChallengePayload {
        user_id,
        email: email.clone(),
        display_name: display_name.clone(),
        state: state_value,
        existing_user_recovery: false,
    })
    .map_err(|e| {
        tracing::error!("Failed to serialize registration challenge payload: {}", e);
        ApiErrorResponse::internal_server_error("Failed to store registration challenge")
    })?;

    let session_id = Uuid::new_v4().to_string();

    state
        .cache_service
        .set_webauthn_challenge(&session_id, &payload)
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to store challenge for session {}: {}",
                session_id,
                e
            );
            ApiErrorResponse::internal_server_error("Failed to store registration challenge")
        })?;

    let challenge_json = serde_json::to_value(&challenge).map_err(|e| {
        tracing::error!("Failed to serialize challenge: {}", e);
        ApiErrorResponse::internal_server_error("Failed to serialize challenge")
    })?;

    tracing::info!("Registration challenge issued; awaiting passkey enrollment to create account");

    Ok(Json(auth_models::RegisterBeginResponse {
        user_id: user_id.to_string(),
        session_id,
        challenge: challenge_json,
    })
    .into_response())
}

#[cfg(feature = "dev-seed")]
async fn register_user_with_password(
    state: AppState,
    email: String,
    password: String,
) -> Result<(HeaderMap, Json<auth_models::AuthResponse>), (StatusCode, Json<ApiErrorResponse>)> {
    if let Ok(Some(_)) = state.db_repository.get_user_by_email(&email).await {
        return Err(ApiErrorResponse::conflict(
            "Email address is already registered",
        ));
    }

    let password_hash = state.auth_service.hash_password(&password).map_err(|e| {
        tracing::error!("Password hashing failed: {}", e);
        ApiErrorResponse::internal_server_error("Failed to process password")
    })?;

    let user_id = Uuid::new_v4();
    let user = User {
        id: user_id,
        email: email.clone(),
        password_hash: Some(password_hash),
        provider: String::new(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        onboarding_completed: false,
        demo_mode_active: true,
    };

    if let Err(e) = state.db_repository.create_user(&user).await {
        tracing::warn!(
            auth_operation = "register",
            auth_result = "failure",
            failure_reason = "user_creation_failed",
            user_id = %user_id,
            error = %e,
            "User creation failed"
        );
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
        if let Err(e) = state
            .cache_service
            .set_session_valid(&auth_token.jwt_id, ttl)
            .await
        {
            tracing::warn!("Failed to set session validity in cache: {}", e);
        }
        if let Err(e) = state
            .cache_service
            .set_jwt_token(&auth_token.jwt_id, &auth_token.token, ttl)
            .await
        {
            tracing::warn!("Failed to cache JWT token: {}", e);
        }
    }

    tracing::info!("User {} registered with password in development", user_id);

    Ok((
        auth_cookie_headers(build_auth_cookie(
            &auth_token.token,
            auth_token.expires_at,
            &state.config,
        )),
        Json(auth_models::AuthResponse {
            user_id: user_id.to_string(),
            email,
            expires_at: auth_token.expires_at.to_rfc3339(),
            onboarding_completed: false,
            demo_mode_active: true,
            requires_passkey_enrollment: false,
        }),
    ))
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

    let claims = state
        .auth_service
        .validate_token(&auth_header)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    if let Err(e) = state.cache_service.invalidate_session(&claims.jti).await {
        tracing::warn!("Failed to invalidate session during logout: {}", e);
    }

    if let Err(e) = state.cache_service.clear_jwt_scoped_data(&claims.jti).await {
        tracing::warn!("Failed to clear JWT-scoped data during logout: {}", e);
    }

    if let Err(e) = state.cache_service.clear_transactions(&claims.jti).await {
        tracing::warn!("Failed to clear transaction cache during logout: {}", e);
    }

    tracing::info!("User logged out successfully");

    Ok((
        auth_cookie_headers(build_clearing_auth_cookie(&state.config)),
        Json(LogoutResponse {
            message: "Logged out successfully".to_string(),
            cleared_session: claims.jti,
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

    let claims = state
        .auth_service
        .validate_token_for_refresh(&auth_header)
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

    tracing::info!("User session refreshed");

    Ok((
        auth_cookie_headers(build_auth_cookie(
            &auth_token.token,
            auth_token.expires_at,
            &state.config,
        )),
        Json(auth_models::AuthResponse {
            user_id: claims.user_id(),
            email: user.email.clone(),
            expires_at: auth_token.expires_at.to_rfc3339(),
            onboarding_completed: user.onboarding_completed,
            demo_mode_active: user.demo_mode_active,
            requires_passkey_enrollment: false,
        }),
    ))
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
    let user_id = auth_context.user_id;

    match state.db_repository.mark_onboarding_complete(&user_id).await {
        Ok(_) => {
            tracing::info!("User {} completed onboarding", user_id);
            Ok(Json(OnboardingCompleteResponse {
                message: "Onboarding completed successfully".to_string(),
                onboarding_completed: true,
                demo_mode_active: false,
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
    let user_id = auth_context.user_id;

    let user = state
        .db_repository
        .get_user_by_id(&user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to load user {} for demo onboarding: {}", user_id, e);
            ApiErrorResponse::internal_server_error("Failed to load user")
        })?
        .ok_or_else(|| ApiErrorResponse::internal_server_error("Failed to load user"))?;

    services::DemoModeService::activate_demo_workspace_for_user(
        &state.db_repository,
        &state.cache_service,
        &user,
        true,
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to activate demo mode for user {}: {}", user_id, e);
        ApiErrorResponse::internal_server_error("Failed to activate demo mode")
    })?;

    Ok(Json(OnboardingCompleteResponse {
        message: "Demo mode activated successfully".to_string(),
        onboarding_completed: true,
        demo_mode_active: true,
    }))
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
async fn get_authenticated_transactions(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedQuery {
        query,
        authorized_account_ids,
    }: AuthorizedQuery<TransactionsQuery>,
) -> Result<Json<CursorTransactionsResponse>, StatusCode> {
    let user_id = auth_context.user_id;

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

    let limit = limit.unwrap_or(40).clamp(1, 100);

    let search = search
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let category_primary = category_primary
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let merchant = merchant
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    let start_date = match start_date.as_deref() {
        Some(raw) => {
            Some(NaiveDate::parse_from_str(raw, "%Y-%m-%d").map_err(|_| StatusCode::BAD_REQUEST)?)
        }
        None => None,
    };
    let end_date = match end_date.as_deref() {
        Some(raw) => {
            Some(NaiveDate::parse_from_str(raw, "%Y-%m-%d").map_err(|_| StatusCode::BAD_REQUEST)?)
        }
        None => None,
    };

    if let (Some(start_date), Some(end_date)) = (start_date, end_date) {
        if end_date < start_date {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    let account_ids: Option<Vec<Uuid>> = authorized_account_ids
        .as_ref()
        .map(|ids| ids.iter().copied().collect());
    let account_ids_ref = account_ids.as_deref();

    tracing::info!(
        search = ?search,
        limit,
        has_cursor = cursor.is_some(),
        "Transactions keyset query params"
    );

    let result = state
        .db_repository
        .get_transactions_keyset(
            &user_id,
            limit,
            cursor.as_deref(),
            search,
            account_ids_ref,
            start_date,
            end_date,
            category_primary,
            merchant,
        )
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch transactions for user {}: {}", user_id, e);
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
async fn get_authenticated_transactions_insights(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedQuery {
        query,
        authorized_account_ids,
    }: AuthorizedQuery<TransactionsQuery>,
) -> Result<Json<TransactionsInsightsResponse>, StatusCode> {
    let user_id = auth_context.user_id;

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

    let search = search
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let category_primary = category_primary
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    let start_date = match start_date.as_deref() {
        Some(raw) => {
            Some(NaiveDate::parse_from_str(raw, "%Y-%m-%d").map_err(|_| StatusCode::BAD_REQUEST)?)
        }
        None => None,
    };
    let end_date = match end_date.as_deref() {
        Some(raw) => {
            Some(NaiveDate::parse_from_str(raw, "%Y-%m-%d").map_err(|_| StatusCode::BAD_REQUEST)?)
        }
        None => None,
    };

    if let (Some(start_date), Some(end_date)) = (start_date, end_date) {
        if end_date < start_date {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    let account_ids: Option<Vec<Uuid>> = authorized_account_ids
        .as_ref()
        .map(|ids| ids.iter().copied().collect());
    let account_ids_ref = account_ids.as_deref();

    let insights = state
        .db_repository
        .get_transactions_insights(
            &user_id,
            search,
            account_ids_ref,
            start_date,
            end_date,
            category_primary,
        )
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to load transaction insights for user {}: {}",
                user_id,
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(insights))
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
async fn get_authenticated_transactions_contextual_insights(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedQuery {
        query,
        authorized_account_ids,
    }: AuthorizedQuery<TransactionsQuery>,
) -> Result<Json<ContextualInsightsResponse>, StatusCode> {
    let user_id = auth_context.user_id;

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

    let search = search
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let category_primary = category_primary
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    let start_date = match start_date.as_deref() {
        Some(raw) => {
            Some(NaiveDate::parse_from_str(raw, "%Y-%m-%d").map_err(|_| StatusCode::BAD_REQUEST)?)
        }
        None => None,
    };
    let end_date = match end_date.as_deref() {
        Some(raw) => {
            Some(NaiveDate::parse_from_str(raw, "%Y-%m-%d").map_err(|_| StatusCode::BAD_REQUEST)?)
        }
        None => None,
    };

    if let (Some(start_date), Some(end_date)) = (start_date, end_date) {
        if end_date < start_date {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    let account_ids: Option<Vec<Uuid>> = authorized_account_ids
        .as_ref()
        .map(|ids| ids.iter().copied().collect());
    let account_ids_ref = account_ids.as_deref();

    let insights = state
        .db_repository
        .get_transactions_contextual_insights(
            &user_id,
            search,
            account_ids_ref,
            start_date,
            end_date,
            category_primary,
        )
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to load contextual insights for user {}: {}",
                user_id,
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(insights))
}

#[utoipa::path(
    get,
    path = "/api/transactions/categories",
    description = "Returns the user's transaction categories sorted and deduplicated.",
    responses(
        (status = 200, description = "List of categories", body = Vec<String>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Transactions"
)]
async fn get_authenticated_transaction_categories(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<Vec<String>>, StatusCode> {
    match state
        .db_repository
        .get_distinct_transaction_categories(&auth_context.user_id)
        .await
    {
        Ok(categories) => Ok(Json(categories)),
        Err(e) => {
            tracing::error!(
                "Failed to fetch transaction categories for user {}: {}",
                auth_context.user_id,
                e
            );
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[utoipa::path(
    get,
    path = "/api/categories",
    responses(
        (status = 200, description = "List of system and custom categories", body = crate::models::custom_category::CategoryListResponse),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Categories"
)]
async fn list_categories(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<crate::models::custom_category::CategoryListResponse>, StatusCode> {
    match state
        .category_management_service
        .list_categories_for_user(&*state.db_repository, &auth_context.user_id)
        .await
    {
        Ok(response) => Ok(Json(response)),
        Err(e) => {
            tracing::error!(
                "Failed to fetch categories for user {}: {}",
                auth_context.user_id,
                e
            );
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[utoipa::path(
    post,
    path = "/api/categories/custom",
    request_body = crate::models::custom_category::CreateCustomCategoryRequest,
    responses(
        (status = 200, description = "Custom category created", body = crate::models::custom_category::CustomCategory),
        (status = 400, description = "Validation error with error code"),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 402, description = "Paid access required", body = ApiErrorResponse),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Categories"
)]
async fn create_custom_category(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<crate::models::custom_category::CreateCustomCategoryRequest>,
) -> Result<
    Json<crate::models::custom_category::CustomCategory>,
    (StatusCode, Json<ApiErrorResponse>),
> {
    use crate::services::category_management::service::CategoryServiceError;

    require_paid_own_data_access_after_demo(&state, auth_context.user_id, "custom_category.create")
        .await?;

    match state
        .category_management_service
        .create_custom_category(&*state.db_repository, &auth_context.user_id, &req.name)
        .await
    {
        Ok(category) => Ok(Json(category)),
        Err(CategoryServiceError::Db(e)) => {
            tracing::error!(
                "Failed to create custom category for user {}: {}",
                auth_context.user_id,
                e
            );
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiErrorResponse::new(
                    "internal_error",
                    "internal_server_error",
                )),
            ))
        }
        Err(CategoryServiceError::Validation(e)) => {
            let (message, error_code) = match e {
                crate::models::custom_category::CustomCategoryError::NameTooLong => {
                    ("Name too long", "name_too_long")
                }
                crate::models::custom_category::CustomCategoryError::TooManyWords => {
                    ("Too many words", "too_many_words")
                }
                crate::models::custom_category::CustomCategoryError::EmptyName => {
                    ("Name is empty", "empty_name")
                }
                crate::models::custom_category::CustomCategoryError::InvalidCharacters => {
                    ("Invalid characters", "invalid_characters")
                }
                crate::models::custom_category::CustomCategoryError::CollidesWithSystemCategory => {
                    (
                        "Collides with system category",
                        "collides_with_system_category",
                    )
                }
                crate::models::custom_category::CustomCategoryError::CollidesWithExistingCustom => {
                    (
                        "Collides with existing custom category",
                        "collides_with_existing_custom",
                    )
                }
            };
            Err((
                StatusCode::BAD_REQUEST,
                Json(ApiErrorResponse::with_code(
                    "validation_error",
                    message,
                    error_code,
                )),
            ))
        }
        Err(other) => {
            tracing::error!(
                "Unexpected error creating custom category for user {}: {:?}",
                auth_context.user_id,
                other
            );
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiErrorResponse::new(
                    "internal_error",
                    "internal_server_error",
                )),
            ))
        }
    }
}

#[utoipa::path(
    delete,
    path = "/api/categories/custom/{id}",
    params(
        ("id" = Uuid, Path, description = "Custom category ID"),
    ),
    responses(
        (status = 204, description = "Custom category deleted"),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 402, description = "Paid access required", body = ApiErrorResponse),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Categories"
)]
async fn delete_custom_category(
    State(state): State<AppState>,
    auth_context: AuthContext,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<ApiErrorResponse>)> {
    require_paid_own_data_access_after_demo(&state, auth_context.user_id, "custom_category.delete")
        .await?;

    match state
        .category_management_service
        .delete_custom_category(&*state.db_repository, &auth_context.user_id, &id)
        .await
    {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!(
                "Failed to delete custom category {} for user {}: {}",
                id,
                auth_context.user_id,
                e
            );
            Err(ApiErrorResponse::internal_server_error(
                "Failed to delete custom category",
            ))
        }
    }
}

#[utoipa::path(
    put,
    path = "/api/transactions/{id}/category",
    request_body = crate::models::transaction_category_override::SetTransactionCategoryRequest,
    params(
        ("id" = Uuid, Path, description = "Transaction ID"),
    ),
    responses(
        (status = 200, description = "Category updated"),
        (status = 400, description = "Validation error"),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 402, description = "Paid access required", body = ApiErrorResponse),
        (status = 404, description = "Transaction not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Transactions"
)]
async fn set_transaction_category(
    State(state): State<AppState>,
    auth_context: AuthContext,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
    Json(req): Json<crate::models::transaction_category_override::SetTransactionCategoryRequest>,
) -> Result<StatusCode, (StatusCode, Json<ApiErrorResponse>)> {
    use crate::services::category_management::service::CategoryServiceError;

    require_paid_own_data_access_after_demo(
        &state,
        auth_context.user_id,
        "transaction_category.update",
    )
    .await?;

    match state
        .category_management_service
        .set_transaction_category(&*state.db_repository, &auth_context.user_id, &id, req)
        .await
    {
        Ok(_) => {
            if let Err(e) = state
                .cache_service
                .invalidate_pattern(&format!("{}_sankey_*", auth_context.jwt_id))
                .await
            {
                tracing::warn!(
                    "Failed to invalidate sankey cache after category update for transaction {}: {}",
                    id,
                    e
                );
            }
            Ok(StatusCode::OK)
        }
        Err(CategoryServiceError::TransactionNotFound) => Err((
            StatusCode::NOT_FOUND,
            Json(ApiErrorResponse::new("not_found", "transaction_not_found")),
        )),
        Err(CategoryServiceError::CustomCategoryNotFound) => Err((
            StatusCode::BAD_REQUEST,
            Json(ApiErrorResponse::new(
                "validation_error",
                "custom_category_not_found",
            )),
        )),
        Err(CategoryServiceError::Db(e)) => {
            tracing::error!(
                "Database error setting category for transaction {}: {}",
                id,
                e
            );
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiErrorResponse::new(
                    "internal_error",
                    "internal_server_error",
                )),
            ))
        }
        Err(CategoryServiceError::Validation(_)) => Err((
            StatusCode::BAD_REQUEST,
            Json(ApiErrorResponse::new(
                "validation_error",
                "validation_error",
            )),
        )),
    }
}

#[utoipa::path(
    post,
    path = "/api/transactions/auto-categorize",
    responses(
        (status = 200, description = "Background categorization started", body = AutoCategorizationJobState),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 402, description = "Paid access required", body = ApiErrorResponse),
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
    require_paid_own_data_access_after_demo(
        &state,
        auth_context.user_id,
        "transactions.auto_categorize",
    )
    .await?;

    match state
        .auto_categorization_service
        .start(&auth_context.user_id, &auth_context.jwt_id)
        .await
    {
        Ok(job) => Ok((StatusCode::OK, Json(job)).into_response()),
        Err(AutoCategorizationError::ActiveJobExists(job)) => {
            Ok((StatusCode::CONFLICT, Json(job)).into_response())
        }
        Err(AutoCategorizationError::NoActiveJob) => Err(ApiErrorResponse::internal_server_error(
            "Failed to start auto-categorization",
        )),
        Err(AutoCategorizationError::Storage(error)) => {
            tracing::error!(
                "Failed to start auto-categorization for user {}: {}",
                auth_context.user_id,
                error
            );
            Err(ApiErrorResponse::internal_server_error(
                "Failed to start auto-categorization",
            ))
        }
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
    match state
        .auto_categorization_service
        .get_status(&auth_context.user_id)
        .await
    {
        Ok(status) => Ok(Json(status)),
        Err(error) => {
            tracing::error!(
                "Failed to fetch auto-categorization status for user {}: {}",
                auth_context.user_id,
                error
            );
            Err(ApiErrorResponse::internal_server_error(
                "Failed to fetch auto-categorization status",
            ))
        }
    }
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
    match state
        .auto_categorization_service
        .cancel(&auth_context.user_id)
        .await
    {
        Ok(job) => Ok(Json(job)),
        Err(AutoCategorizationError::NoActiveJob) => Err((
            StatusCode::NOT_FOUND,
            Json(ApiErrorResponse::new(
                "not_found",
                "auto_categorization_job_not_found",
            )),
        )),
        Err(AutoCategorizationError::ActiveJobExists(_)) => Err(
            ApiErrorResponse::internal_server_error("Failed to cancel auto-categorization"),
        ),
        Err(AutoCategorizationError::Storage(error)) => {
            tracing::error!(
                "Failed to cancel auto-categorization for user {}: {}",
                auth_context.user_id,
                error
            );
            Err(ApiErrorResponse::internal_server_error(
                "Failed to cancel auto-categorization",
            ))
        }
    }
}

struct ParsedImportMultipart {
    file_name: String,
    file_bytes: Vec<u8>,
    account_id: Uuid,
    csv_mapping: Option<CsvColumnMapping>,
}

#[utoipa::path(
    post,
    path = "/api/transactions/import/validate",
    request_body(content = inline(ImportMultipartRequest), content_type = "multipart/form-data"),
    responses(
        (status = 200, description = "File validation result", body = ValidateResponse),
        (status = 400, description = "Missing fields, invalid multipart payload, unsupported extension, invalid UTF-8, or invalid CSV mapping"),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 403, description = "Account belongs to another user"),
        (status = 413, description = "Payload too large"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Transactions"
)]
async fn validate_authenticated_transaction_import(
    State(state): State<AppState>,
    auth_context: AuthContext,
    mut multipart: Multipart,
) -> Result<Json<ValidateResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    let import = parse_transaction_import_multipart(&mut multipart).await?;
    let ParsedImportMultipart {
        file_name,
        file_bytes,
        account_id,
        csv_mapping: _,
    } = import;

    ensure_import_account_owned(&state, &auth_context.user_id, &account_id).await?;

    let content = String::from_utf8(file_bytes)
        .map_err(|_| api_bad_request("Uploaded file must be valid UTF-8"))?;

    if crate::services::import_service::detect_import_format(&file_name).is_none() {
        return Err(api_bad_request(format!(
            "Unsupported file extension for '{}'",
            file_name
        )));
    }

    Ok(Json(ImportService::validate_file(
        &content,
        &file_name,
        &account_id,
    )))
}

#[utoipa::path(
    post,
    path = "/api/transactions/import",
    request_body(content = inline(ImportMultipartRequest), content_type = "multipart/form-data"),
    responses(
        (status = 200, description = "Transactions imported successfully", body = ImportResponse),
        (status = 400, description = "Missing fields, invalid multipart payload, unsupported extension, invalid UTF-8, invalid CSV mapping, or file with no valid transactions"),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 402, description = "Paid access required", body = ApiErrorResponse),
        (status = 403, description = "Account belongs to another user"),
        (status = 413, description = "Payload too large"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Transactions"
)]
async fn import_authenticated_transactions(
    State(state): State<AppState>,
    auth_context: AuthContext,
    mut multipart: Multipart,
) -> Result<Json<ImportResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    require_paid_own_data_access(&state, auth_context.user_id, "transactions.import").await?;

    let import = parse_transaction_import_multipart(&mut multipart).await?;
    let ParsedImportMultipart {
        file_name,
        file_bytes,
        account_id,
        csv_mapping,
    } = import;

    ensure_import_account_owned(&state, &auth_context.user_id, &account_id).await?;

    let content = String::from_utf8(file_bytes)
        .map_err(|_| api_bad_request("Uploaded file must be valid UTF-8"))?;
    let format =
        crate::services::import_service::detect_import_format(&file_name).ok_or_else(|| {
            api_bad_request(format!("Unsupported file extension for '{}'", file_name))
        })?;

    let mut parsed = match format {
        ImportFileFormat::Ofx
        | ImportFileFormat::Qfx
        | ImportFileFormat::Qbo
        | ImportFileFormat::Qbx => ImportService::parse_ofx(&content, &account_id),
        ImportFileFormat::Csv => {
            let mapping = match csv_mapping {
                Some(mapping) => mapping,
                None => detect_csv_mapping_from_content(&content)?,
            };

            let mapping_errors = csv_mapping_errors(&mapping);
            if !mapping_errors.is_empty() {
                return Err(api_bad_request(mapping_errors.join("; ")));
            }

            ImportService::parse_csv(&content, &mapping, &account_id)
        }
    };

    if parsed.transactions.is_empty() {
        let message = if parsed.errors.is_empty() {
            "No valid transactions were found in the uploaded file".to_string()
        } else {
            parsed.errors.join("; ")
        };
        return Err(api_bad_request(message));
    }

    let mut transactions = std::mem::take(&mut parsed.transactions);

    for transaction in &mut transactions {
        transaction.user_id = Some(auth_context.user_id);
    }

    let merchant_normalization_service =
        crate::services::merchant_normalization::service::MerchantNormalizationService::new(
            state.db_repository.clone(),
            state.cache_service.clone(),
        );
    merchant_normalization_service
        .normalize_batch(&mut transactions)
        .await
        .map_err(|_| api_internal_server_error("Failed to normalize imported merchants"))?;

    let transaction_counts_before = state
        .db_repository
        .get_transaction_count_by_account_for_user(&auth_context.user_id)
        .await
        .map_err(|_| api_internal_server_error("Failed to load existing transaction counts"))?;
    let before_count = transaction_counts_before
        .get(&account_id)
        .copied()
        .unwrap_or(0);

    state
        .db_repository
        .upsert_transactions_batch(&transactions, &auth_context.user_id)
        .await
        .map_err(|_| api_internal_server_error("Failed to import transactions"))?;

    if let Err(e) = state
        .cache_service
        .clear_transactions(&auth_context.jwt_id)
        .await
    {
        tracing::warn!(
            "Failed to clear transaction cache after file import for user {}: {}",
            auth_context.user_id,
            e
        );
    }

    let transaction_counts_after = state
        .db_repository
        .get_transaction_count_by_account_for_user(&auth_context.user_id)
        .await
        .map_err(|_| api_internal_server_error("Failed to refresh transaction counts"))?;
    let after_count = transaction_counts_after
        .get(&account_id)
        .copied()
        .unwrap_or(before_count);

    let imported_count = after_count.saturating_sub(before_count);
    let total_parsed = transactions.len() as i64;
    let skipped_count = total_parsed.saturating_sub(imported_count);

    Ok(Json(ImportResponse {
        imported_count,
        skipped_count,
        truncated_count: parsed.truncated_count as i64,
        total_parsed,
        errors: std::mem::take(&mut parsed.errors),
    }))
}

async fn parse_transaction_import_multipart(
    multipart: &mut Multipart,
) -> Result<ParsedImportMultipart, (StatusCode, Json<ApiErrorResponse>)> {
    let mut file_name = None;
    let mut file_bytes = None;
    let mut account_id = None;
    let mut csv_mapping = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| api_bad_request("Invalid multipart request"))?
    {
        let field_name = field.name().map(str::to_string).unwrap_or_default();
        match field_name.as_str() {
            "file" => {
                file_name = field.file_name().map(str::to_string);
                let bytes = field
                    .bytes()
                    .await
                    .map_err(|_| api_bad_request("Unable to read uploaded file"))?;
                file_bytes = Some(bytes.to_vec());
            }
            "account_id" => {
                let value = field
                    .text()
                    .await
                    .map_err(|_| api_bad_request("Unable to read account_id"))?;
                account_id = Some(
                    Uuid::parse_str(value.trim())
                        .map_err(|_| api_bad_request("account_id must be a valid UUID"))?,
                );
            }
            "csv_mapping" => {
                let value = field
                    .text()
                    .await
                    .map_err(|_| api_bad_request("Unable to read csv_mapping"))?;
                csv_mapping = Some(
                    serde_json::from_str(&value)
                        .map_err(|_| api_bad_request("csv_mapping must be valid JSON"))?,
                );
            }
            _ => {
                let _ = field
                    .bytes()
                    .await
                    .map_err(|_| api_bad_request("Unable to read multipart field"))?;
            }
        }
    }

    let file_name = file_name.ok_or_else(|| api_bad_request("file is required"))?;
    let file_bytes = file_bytes.ok_or_else(|| api_bad_request("file is required"))?;
    let account_id = account_id.ok_or_else(|| api_bad_request("account_id is required"))?;

    Ok(ParsedImportMultipart {
        file_name,
        file_bytes,
        account_id,
        csv_mapping,
    })
}

async fn ensure_import_account_owned(
    state: &AppState,
    user_id: &Uuid,
    account_id: &Uuid,
) -> Result<(), (StatusCode, Json<ApiErrorResponse>)> {
    let account_ids = vec![account_id.to_string()];
    state
        .authorization_service
        .validate_account_ownership(&account_ids, user_id, state.db_repository.as_ref())
        .await
        .map(|_| ())
        .map_err(|status| match status {
            StatusCode::FORBIDDEN => {
                api_forbidden("Account does not belong to the authenticated user")
            }
            _ => api_internal_server_error("Failed to validate account ownership"),
        })
}

#[allow(clippy::result_large_err)]
fn detect_csv_mapping_from_content(
    content: &str,
) -> Result<CsvColumnMapping, (StatusCode, Json<ApiErrorResponse>)> {
    let headers =
        crate::services::import_service::read_csv_headers(content).map_err(api_bad_request)?;
    Ok(ImportService::detect_csv_mapping(&StringRecord::from(
        headers,
    )))
}

fn csv_mapping_errors(mapping: &CsvColumnMapping) -> Vec<String> {
    let mut errors = Vec::new();

    if mapping.date_column.is_none() {
        errors.push("Unable to detect a CSV date column".to_string());
    }
    if mapping.description_column.is_none() {
        errors.push("Unable to detect a CSV description column".to_string());
    }
    if mapping.amount_column.is_none()
        && mapping.debit_column.is_none()
        && mapping.credit_column.is_none()
    {
        errors.push("Unable to detect a CSV amount, debit, or credit column".to_string());
    }

    errors
}

fn api_bad_request(message: impl Into<String>) -> (StatusCode, Json<ApiErrorResponse>) {
    ApiErrorResponse::new("BAD_REQUEST", &message.into()).into_response(StatusCode::BAD_REQUEST)
}

fn api_forbidden(message: impl Into<String>) -> (StatusCode, Json<ApiErrorResponse>) {
    ApiErrorResponse::new("FORBIDDEN", &message.into()).into_response(StatusCode::FORBIDDEN)
}

fn provider_disabled_response(provider: &str) -> (StatusCode, Json<ApiErrorResponse>) {
    ApiErrorResponse::with_code(
        "FORBIDDEN",
        &format!("Provider '{}' is disabled in this deployment", provider),
        "PROVIDER_DISABLED",
    )
    .into_response(StatusCode::FORBIDDEN)
}

fn api_internal_server_error(message: impl Into<String>) -> (StatusCode, Json<ApiErrorResponse>) {
    ApiErrorResponse::new("INTERNAL_SERVER_ERROR", &message.into())
        .into_response(StatusCode::INTERNAL_SERVER_ERROR)
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
        (status = 402, description = "Paid access required", body = ApiErrorResponse),
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

    require_paid_own_data_access(&state, auth_context.user_id, "plaid.link_token").await?;

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
            Err(api_bad_request("Unsupported provider"))
        }
        Err(LinkTokenError::ProviderRequest(e)) => {
            tracing::error!(
                "Failed to create link token for provider {} and user {}: {}",
                provider,
                auth_context.user_id,
                e
            );
            Err(ApiErrorResponse::with_code(
                "FAILED_DEPENDENCY",
                "Provider request failed",
                "PROVIDER_REQUEST_FAILED",
            )
            .into_response(StatusCode::FAILED_DEPENDENCY))
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
        (status = 402, description = "Paid access required", body = ApiErrorResponse),
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
    let user_id = auth_context.user_id;
    let provider = "plaid";
    if !state.config.is_financial_provider_enabled(provider) {
        return Err(provider_disabled_response(provider));
    }

    require_paid_own_data_access(&state, user_id, "plaid.exchange_token").await?;

    match state
        .connection_service
        .exchange_public_token(provider, &user_id, &auth_context.jwt_id, &req.public_token)
        .await
    {
        Ok(response) => {
            log_provider_credential_outcome(provider, StatusCode::OK, "plaid.exchange-token");
            Ok(Json(response))
        }
        Err(ExchangeTokenError::ProviderUnavailable(p)) => {
            log_provider_credential_outcome(&p, StatusCode::BAD_REQUEST, "plaid.exchange-token");
            tracing::error!(
                "Exchange token requested for unsupported provider '{}' by user {}",
                p,
                user_id
            );
            Err(api_bad_request("Unsupported provider"))
        }
        Err(ExchangeTokenError::ExchangeFailed(e)) => {
            log_provider_credential_outcome(
                provider,
                StatusCode::FAILED_DEPENDENCY,
                "plaid.exchange-token",
            );
            tracing::error!(
                "Failed to exchange public token for provider {} and user {}: {}",
                provider,
                user_id,
                e
            );
            Err(ApiErrorResponse::with_code(
                "FAILED_DEPENDENCY",
                "Token exchange failed with provider",
                "PROVIDER_REQUEST_FAILED",
            )
            .into_response(StatusCode::FAILED_DEPENDENCY))
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
    security(("auth_cookie" = [])),
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

    let provider_by_connection_id = state
        .db_repository
        .get_all_provider_connections_by_user(&user_id)
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to get provider connections for user {}: {}",
                user_id,
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .into_iter()
        .map(|connection| (connection.id, connection.provider))
        .collect::<std::collections::HashMap<_, _>>();

    let account_responses: Vec<AccountResponse> = db_accounts
        .into_iter()
        .map(|account| {
            let transaction_count = transaction_counts.get(&account.id).unwrap_or(&0);
            AccountResponse {
                id: account.id,
                user_id: Some(user_id),
                provider: account.provider_connection_id.and_then(|connection_id| {
                    provider_by_connection_id.get(&connection_id).cloned()
                }),
                provider_account_id: account.provider_account_id.clone(),
                provider_connection_id: account.provider_connection_id,
                name: account.name,
                account_type: account.account_type,
                balance_current: account.balance_current,
                mask: account.mask,
                transaction_count: *transaction_count,
                institution_name: account.institution_name,
            }
        })
        .collect();

    tracing::info!(
        record_count = account_responses.len(),
        provider = "unified",
        "Data access: accounts"
    );

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
        (status = 402, description = "Paid access required", body = ApiErrorResponse),
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
    let mut connection = connection;

    let provider = connection.provider.clone();
    if provider != "teller" && !state.config.is_financial_provider_enabled(&provider) {
        return Err(provider_disabled_response(&provider).into_response());
    }

    require_paid_own_data_access(&state, user_id, "provider.sync")
        .await
        .map_err(|err| err.into_response())?;

    if provider == "teller" {
        return Err(provider_sync_error_to_response(
            crate::services::connection_service::ProviderSyncError::TellerNoLongerSupported,
            user_id,
            &connection.item_id,
        ));
    }

    match state
        .provider_sync_rate_limit_service
        .try_consume_sync_quota(
            &user_id,
            &request_body.client_date,
            &request_body.client_timezone,
        )
        .await
    {
        Ok(crate::services::provider_sync_rate_limit_service::SyncQuotaDecision::Allowed { .. }) => {}
        Ok(crate::services::provider_sync_rate_limit_service::SyncQuotaDecision::Limited {
            retry_after_secs,
        }) => {
            return Err(sync_quota_rate_limited_response(retry_after_secs));
        }
        Err(crate::services::provider_sync_rate_limit_service::ProviderSyncRateLimitError::InvalidClientDate)
        | Err(crate::services::provider_sync_rate_limit_service::ProviderSyncRateLimitError::InvalidClientTimezone) => {
            return Err(StatusCode::BAD_REQUEST.into_response());
        }
        Err(crate::services::provider_sync_rate_limit_service::ProviderSyncRateLimitError::Cache(error)) => {
            tracing::error!(
                error = %error,
                user_id = %user_id,
                "Sync quota check failed"
            );
            return Err(StatusCode::INTERNAL_SERVER_ERROR.into_response());
        }
    }

    let sync_params = SyncConnectionParams {
        provider: provider.as_str(),
        user_id: &user_id,
        jwt_id: &auth_context.jwt_id,
    };

    let dispatcher = state
        .sync_service_factory
        .get_dispatcher(&provider)
        .ok_or_else(|| {
            tracing::error!(
                "Sync transactions: unsupported provider '{}' for user {}",
                connection.provider,
                user_id
            );
            StatusCode::BAD_REQUEST.into_response()
        })?;

    match dispatcher
        .sync(sync_params, &mut connection, Some(reference_date))
        .await
    {
        Ok(response) => {
            if let Err(e) = state
                .cache_service
                .clear_jwt_scoped_bank_connection_cache(&auth_context.jwt_id, connection.id)
                .await
            {
                tracing::warn!(
                    "Failed to clear connection cache after sync for user {}: {}",
                    user_id,
                    e
                );
            }

            if let Err(e) = state
                .cache_service
                .clear_transactions(&auth_context.jwt_id)
                .await
            {
                tracing::warn!(
                    "Failed to clear transaction cache after sync for user {}: {}",
                    user_id,
                    e
                );
            }

            Ok(Json(response))
        }
        Err(err) => Err(provider_sync_error_to_response(
            err,
            user_id,
            &connection.item_id,
        )),
    }
}

fn sync_quota_rate_limited_response(retry_after_secs: u64) -> Response {
    let payload = ApiErrorResponse::with_code(
        "TOO_MANY_REQUESTS",
        "Daily sync limit reached (24 per day). Try again tomorrow.",
        "RATE_LIMITED",
    );
    let body = serde_json::to_vec(&payload).unwrap_or_else(|_| b"{}".to_vec());

    Response::builder()
        .status(StatusCode::TOO_MANY_REQUESTS)
        .header(CONTENT_TYPE, "application/json")
        .header(
            axum::http::header::RETRY_AFTER,
            retry_after_secs.to_string(),
        )
        .body(axum::body::Body::from(body))
        .unwrap_or_else(|_| Response::new(axum::body::Body::empty()))
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
    let user_id = auth_context.user_id;
    let (start_date, end_date) = state.analytics_service.current_month_date_range();
    let transactions = state
        .analytics_service
        .load_spending_transactions(
            state.db_repository.as_ref(),
            &user_id,
            SpendingTransactionQuery {
                start_date: Some(start_date),
                end_date: Some(end_date),
                account_ids: None,
            },
        )
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to get spending transactions for user {}: {}",
                user_id,
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let total = state
        .analytics_service
        .calculate_current_month_spending(&transactions);
    Ok(Json(total))
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

    let (start_date, end_date) = state
        .analytics_service
        .month_date_range(year, month)
        .ok_or(StatusCode::BAD_REQUEST)?;
    let transactions = state
        .analytics_service
        .load_spending_transactions(
            state.db_repository.as_ref(),
            &user_id,
            SpendingTransactionQuery {
                start_date: Some(start_date),
                end_date: Some(end_date),
                account_ids: None,
            },
        )
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to get spending transactions for user {}: {}",
                user_id,
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let daily_spending =
        state
            .analytics_service
            .calculate_daily_spending(&transactions, year, month);
    Ok(Json(daily_spending))
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
    let user_id = auth_context.user_id;

    match state
        .cache_service
        .clear_transactions(&auth_context.jwt_id)
        .await
    {
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
    let user_id = auth_context.user_id;

    let start_date = query
        .start_date
        .as_ref()
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
    let end_date = query
        .end_date
        .as_ref()
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

    let account_ids: Option<Vec<Uuid>> = authorized_account_ids
        .as_ref()
        .map(|ids| ids.iter().copied().collect());

    let totals = state
        .analytics_service
        .get_income_expense_totals(
            state.db_repository.as_ref(),
            &user_id,
            SpendingTransactionQuery {
                start_date,
                end_date,
                account_ids: account_ids.as_deref(),
            },
        )
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to get income and expense totals for user {}: {}",
                user_id,
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(totals))
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
    let user_id = auth_context.user_id;

    let start_date = query
        .start_date
        .as_ref()
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
    let end_date = query
        .end_date
        .as_ref()
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

    let account_ids: Option<Vec<Uuid>> = authorized_account_ids
        .as_ref()
        .map(|ids| ids.iter().copied().collect());

    let summary = state
        .analytics_service
        .get_budget_summary(
            state.db_repository.as_ref(),
            &user_id,
            SpendingTransactionQuery {
                start_date,
                end_date,
                account_ids: account_ids.as_deref(),
            },
        )
        .await
        .map_err(|e| {
            tracing::error!("Failed to get budget summary for user {}: {}", user_id, e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(summary))
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
    let user_id = auth_context.user_id;

    let start = query
        .start_date
        .as_deref()
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
    let end = query
        .end_date
        .as_deref()
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

    let account_ids: Option<Vec<Uuid>> = authorized_account_ids
        .as_ref()
        .map(|ids| ids.iter().copied().collect());

    let transactions = state
        .analytics_service
        .load_spending_transactions(
            state.db_repository.as_ref(),
            &user_id,
            SpendingTransactionQuery {
                start_date: start,
                end_date: end,
                account_ids: account_ids.as_deref(),
            },
        )
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to get spending transactions for user {}: {}",
                user_id,
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let total: rust_decimal::Decimal = transactions
        .into_iter()
        .filter(|t| t.amount < rust_decimal::Decimal::ZERO)
        .map(|t| -t.amount)
        .sum();
    Ok(Json(total))
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
    let user_id = auth_context.user_id;

    let start_date = query
        .start_date
        .as_ref()
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
    let end_date = query
        .end_date
        .as_ref()
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

    let account_ids: Option<Vec<Uuid>> = authorized_account_ids
        .as_ref()
        .map(|ids| ids.iter().copied().collect());

    let categories = state
        .analytics_service
        .get_category_spending(
            state.db_repository.as_ref(),
            &user_id,
            SpendingTransactionQuery {
                start_date,
                end_date,
                account_ids: account_ids.as_deref(),
            },
        )
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to get category spending for user {}: {}",
                user_id,
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(Json(categories))
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
    let user_id = auth_context.user_id;
    let start_date = query
        .start_date
        .as_ref()
        .and_then(|value| chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d").ok())
        .ok_or(StatusCode::BAD_REQUEST)?;
    let end_date = query
        .end_date
        .as_ref()
        .and_then(|value| chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d").ok())
        .ok_or(StatusCode::BAD_REQUEST)?;

    if end_date < start_date {
        return Err(StatusCode::BAD_REQUEST);
    }

    let account_ids: Option<Vec<Uuid>> = authorized_account_ids
        .as_ref()
        .map(|ids| ids.iter().copied().collect());

    let transactions = state
        .analytics_service
        .load_spending_transactions(
            state.db_repository.as_ref(),
            &user_id,
            SpendingTransactionQuery {
                start_date: Some(start_date),
                end_date: Some(end_date),
                account_ids: account_ids.as_deref(),
            },
        )
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to get spending transactions for user {}: {}",
                user_id,
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let monthly_totals = state.analytics_service.calculate_monthly_totals(
        &transactions,
        state
            .analytics_service
            .inclusive_month_count(start_date, end_date),
    );
    Ok(Json(monthly_totals))
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
    let user_id = auth_context.user_id;
    let account_ids = authorized_account_ids
        .as_ref()
        .map(|ids| ids.iter().copied().collect::<Vec<_>>());

    let bounds = state
        .analytics_service
        .get_date_bounds(
            state.db_repository.as_ref(),
            &user_id,
            account_ids.as_deref(),
        )
        .await
        .map_err(|error| {
            tracing::error!(
                "Failed to get analytics date bounds for user {}: {}",
                user_id,
                error
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(bounds))
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
    let user_id = auth_context.user_id;
    let start_date = query
        .start_date
        .as_ref()
        .and_then(|value| chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d").ok())
        .ok_or(StatusCode::BAD_REQUEST)?;
    let end_date = query
        .end_date
        .as_ref()
        .and_then(|value| chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d").ok())
        .ok_or(StatusCode::BAD_REQUEST)?;

    if end_date < start_date {
        return Err(StatusCode::BAD_REQUEST);
    }

    let account_ids = authorized_account_ids
        .as_ref()
        .map(|ids| ids.iter().copied().collect::<Vec<_>>());

    if matches!(account_ids.as_deref(), Some([])) {
        return Ok(Json(CashFlowResponse {
            series: Vec::new(),
            currency: "USD".to_string(),
        }));
    }

    let aggregates = state
        .db_repository
        .get_monthly_cash_flow_aggregates_for_user(
            &user_id,
            start_date,
            end_date,
            account_ids.as_deref(),
        )
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to get cash flow aggregates for user {} in range [{}, {}]: {}",
                user_id,
                start_date,
                end_date,
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let currency = "USD".to_string();
    let series = state.analytics_service.cash_flow_from_monthly_aggregates(
        &aggregates,
        state
            .analytics_service
            .inclusive_month_count(start_date, end_date),
    );
    Ok(Json(CashFlowResponse { series, currency }))
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
    use rust_decimal::Decimal;
    use std::collections::HashSet;

    let user_id = auth_context.user_id;

    let start_date = query
        .start_date
        .as_ref()
        .and_then(|value| chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d").ok())
        .ok_or(StatusCode::BAD_REQUEST)?;
    let end_date = query
        .end_date
        .as_ref()
        .and_then(|value| chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d").ok())
        .ok_or(StatusCode::BAD_REQUEST)?;
    if end_date < start_date {
        return Err(StatusCode::BAD_REQUEST);
    }

    let accounts = state
        .db_repository
        .get_accounts_for_user(&user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch accounts for sankey: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let mut allowed_account_ids: HashSet<Uuid> = HashSet::new();
    for account in accounts {
        if let Some(ref filtered_ids) = authorized_account_ids {
            if !filtered_ids.contains(&account.id) {
                continue;
            }
        }

        let category =
            AnalyticsService::map_account_to_balance_category(&account.account_type, None);
        if matches!(
            category,
            BalanceCategory::Loan | BalanceCategory::Investments
        ) {
            continue;
        }

        allowed_account_ids.insert(account.id);
    }

    let response = if allowed_account_ids.is_empty() {
        state
            .analytics_service
            .build_sankey(Decimal::ZERO, Vec::new(), "USD")
    } else {
        let base_cache_key = format!("{}_sankey_{}_{}", auth_context.jwt_id, start_date, end_date);
        let cache_key = utils::cache_keys::generate_cache_key_with_account_filter(
            &base_cache_key,
            Some(&allowed_account_ids),
        );

        if let Ok(Some(serialized)) = state.cache_service.get_string(&cache_key).await {
            if let Ok(cached) =
                serde_json::from_str::<models::analytics::SankeyResponse>(&serialized)
            {
                return Ok(Json(cached));
            }
        }

        let allowed_account_ids_vec: Vec<Uuid> = allowed_account_ids.iter().copied().collect();
        let aggregates = state
            .db_repository
            .get_monthly_cash_flow_aggregates_for_user(
                &user_id,
                start_date,
                end_date,
                Some(&allowed_account_ids_vec),
            )
            .await
            .map_err(|e| {
                tracing::error!("Failed to get sankey income aggregates: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        let income: Decimal = aggregates.iter().map(|aggregate| aggregate.income).sum();

        let transactions = state
            .analytics_service
            .load_spending_transactions(
                state.db_repository.as_ref(),
                &user_id,
                SpendingTransactionQuery {
                    start_date: Some(start_date),
                    end_date: Some(end_date),
                    account_ids: Some(&allowed_account_ids_vec),
                },
            )
            .await
            .map_err(|e| {
                tracing::error!("Failed to get sankey spending transactions: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        let categories = state.analytics_service.group_by_category_with_date_range(
            &transactions,
            Some(start_date),
            Some(end_date),
        );

        let response = state
            .analytics_service
            .build_sankey(income, categories, "USD");

        if let Ok(serialized) = serde_json::to_string(&response) {
            let _ = state
                .cache_service
                .set_with_ttl(&cache_key, &serialized, 1800)
                .await;
        }

        response
    };

    Ok(Json(response))
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
    let user_id = auth_context.user_id;
    let limit = 10usize;

    let start_date = query
        .start_date
        .as_ref()
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
    let end_date = query
        .end_date
        .as_ref()
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

    let account_ids: Option<Vec<Uuid>> = authorized_account_ids
        .as_ref()
        .map(|ids| ids.iter().copied().collect());

    let transactions = state
        .analytics_service
        .load_spending_transactions(
            state.db_repository.as_ref(),
            &user_id,
            SpendingTransactionQuery {
                start_date,
                end_date,
                account_ids: account_ids.as_deref(),
            },
        )
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to get spending transactions for user {}: {}",
                user_id,
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let top_merchants = state
        .analytics_service
        .get_top_merchants(&transactions, limit);
    Ok(Json(top_merchants))
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
            item_id: Some(conn.item_id),
            provider: conn.provider,
            transaction_count: conn.transaction_count,
            account_count: conn.account_count,
            sync_in_progress: false,
        })
        .collect())
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
        (status = 402, description = "Paid access required", body = ApiErrorResponse),
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

    require_paid_own_data_access(&state, auth_context.user_id, "provider.connect").await?;

    match req.provider.as_str() {
        "teller" => match state
            .connection_service
            .connect_teller_provider(&auth_context.user_id, &auth_context.jwt_id, &req)
            .await
        {
            Ok(response) => {
                log_provider_credential_outcome("teller", StatusCode::OK, "provider.connect");
                Ok(Json(response))
            }
            Err(TellerConnectError::NoLongerSupported) => {
                log_provider_credential_outcome(
                    "teller",
                    StatusCode::BAD_REQUEST,
                    "provider.connect",
                );
                Err(ApiErrorResponse::with_code(
                    "BAD_REQUEST",
                    services::sync_service_dispatcher::TELLER_NO_LONGER_SUPPORTED_MESSAGE,
                    "TELLER_NO_LONGER_SUPPORTED",
                )
                .into_response(StatusCode::BAD_REQUEST))
            }
        },
        "simplefin" => match state
            .connection_service
            .connect_simplefin_provider(&auth_context.user_id, &auth_context.jwt_id, &req)
            .await
        {
            Ok(response) => {
                log_provider_credential_outcome("simplefin", StatusCode::OK, "provider.connect");
                Ok(Json(response))
            }
            Err(SimpleFinConnectError::InvalidProvider(_)) => {
                log_provider_credential_outcome(
                    &req.provider,
                    StatusCode::BAD_REQUEST,
                    "provider.connect",
                );
                Err(ApiErrorResponse::new("BAD_REQUEST", "Unsupported provider")
                    .into_response(StatusCode::BAD_REQUEST))
            }
            Err(SimpleFinConnectError::MissingSetupToken) => {
                log_provider_credential_outcome(
                    "simplefin",
                    StatusCode::BAD_REQUEST,
                    "provider.connect",
                );
                Err(ApiErrorResponse::new(
                    "BAD_REQUEST",
                    "Provide a SimpleFIN setup token to connect this account",
                )
                .into_response(StatusCode::BAD_REQUEST))
            }
            Err(SimpleFinConnectError::MalformedSetupToken) => {
                log_provider_credential_outcome(
                    "simplefin",
                    StatusCode::BAD_REQUEST,
                    "provider.connect",
                );
                Err(
                    ApiErrorResponse::new("BAD_REQUEST", "The SimpleFIN setup token is malformed")
                        .into_response(StatusCode::BAD_REQUEST),
                )
            }
            Err(SimpleFinConnectError::SetupTokenAlreadyClaimed) => {
                log_provider_credential_outcome(
                    "simplefin",
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "provider.connect",
                );
                Err(ApiErrorResponse::new(
                    "SETUP_TOKEN_ALREADY_CLAIMED",
                    "This SimpleFIN setup token has already been used",
                )
                .into_response(StatusCode::UNPROCESSABLE_ENTITY))
            }
            Err(SimpleFinConnectError::ClaimFailed(e)) => {
                log_provider_credential_outcome(
                    "simplefin",
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "provider.connect",
                );
                tracing::error!(
                    "Failed to claim SimpleFIN access URL for user {}: {}",
                    auth_context.user_id,
                    e
                );
                Err(ApiErrorResponse::new(
                    "SETUP_TOKEN_CLAIM_FAILED",
                    "Could not claim the SimpleFIN setup token",
                )
                .into_response(StatusCode::UNPROCESSABLE_ENTITY))
            }
            Err(SimpleFinConnectError::CredentialStorage(e)) => {
                log_provider_credential_outcome(
                    "simplefin",
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "provider.connect",
                );
                tracing::error!(
                    "Failed to store SimpleFIN credentials for user {}: {}",
                    auth_context.user_id,
                    e
                );
                Err(ApiErrorResponse::internal_server_error(
                    "Failed to store credentials",
                ))
            }
            Err(SimpleFinConnectError::SnapshotFetch(e)) => {
                log_provider_credential_outcome(
                    "simplefin",
                    StatusCode::FAILED_DEPENDENCY,
                    "provider.connect",
                );
                tracing::error!(
                    "Failed to fetch SimpleFIN account snapshot for user {}: {}",
                    auth_context.user_id,
                    e
                );
                Err(
                    ApiErrorResponse::new("FAILED_DEPENDENCY", "SimpleFIN provider request failed")
                        .into_response(StatusCode::FAILED_DEPENDENCY),
                )
            }
            Err(SimpleFinConnectError::ConnectionPersistence(e)) => {
                log_provider_credential_outcome(
                    "simplefin",
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "provider.connect",
                );
                tracing::error!(
                    "Failed to persist SimpleFIN connection for user {}: {}",
                    auth_context.user_id,
                    e
                );
                Err(ApiErrorResponse::internal_server_error(
                    "Failed to save connection",
                ))
            }
            Err(SimpleFinConnectError::NoInstitutionsOnBridge) => {
                log_provider_credential_outcome(
                    "simplefin",
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "provider.connect",
                );
                Err(ApiErrorResponse::new(
                    "NO_INSTITUTIONS",
                    "No institutions are available from your SimpleFIN bridge yet",
                )
                .into_response(StatusCode::UNPROCESSABLE_ENTITY))
            }
            Err(SimpleFinConnectError::AllInstitutionsHidden) => {
                log_provider_credential_outcome(
                    "simplefin",
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "provider.connect",
                );
                Err(ApiErrorResponse::new(
                    "ALL_INSTITUTIONS_HIDDEN",
                    "All SimpleFIN institutions are hidden in Sumurai. Restore one to start syncing.",
                )
                .into_response(StatusCode::UNPROCESSABLE_ENTITY))
            }
            Err(SimpleFinConnectError::NoInstitutionsLinked) => {
                log_provider_credential_outcome(
                    "simplefin",
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "provider.connect",
                );
                Err(ApiErrorResponse::new(
                    "NO_INSTITUTIONS",
                    "No SimpleFIN institutions could be linked. Try again or check your bridge setup.",
                )
                .into_response(StatusCode::UNPROCESSABLE_ENTITY))
            }
            Err(SimpleFinConnectError::InstitutionsRequireAuth(notices)) => {
                log_provider_credential_outcome(
                    "simplefin",
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "provider.connect",
                );
                let message = if notices.len() == 1 {
                    format!(
                        "{} needs to be re-authenticated in your SimpleFIN dashboard before it can sync.",
                        notices[0].institution_name
                    )
                } else {
                    "Some SimpleFIN institutions need to be re-authenticated in your SimpleFIN dashboard before they can sync.".to_string()
                };
                Err(ApiErrorResponse {
                    error: "SIMPLEFIN_INSTITUTIONS_REQUIRE_AUTH".to_string(),
                    message,
                    code: Some("SIMPLEFIN_AUTH_REQUIRED".to_string()),
                    details: serde_json::to_value(notices).ok(),
                    status_code: None,
                    reason: None,
                    trace_id: None,
                }
                .into_response(StatusCode::UNPROCESSABLE_ENTITY))
            }
        },
        _ => {
            log_provider_credential_outcome(
                &req.provider,
                StatusCode::BAD_REQUEST,
                "provider.connect",
            );
            Err(ApiErrorResponse::new("BAD_REQUEST", "Unsupported provider")
                .into_response(StatusCode::BAD_REQUEST))
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
    security(("auth_cookie" = [])),
    tag = "Financial Providers"
)]
async fn get_authenticated_provider_status(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<ProviderStatusResponse>, StatusCode> {
    let user_id = auth_context.user_id;

    let provider = match state.db_repository.get_user_by_id(&user_id).await {
        Ok(Some(user)) => {
            if state.provider_registry.get(&user.provider).is_some()
                && state.config.is_financial_provider_enabled(&user.provider)
            {
                user.provider
            } else {
                String::new()
            }
        }
        Ok(None) => String::new(),
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

    let institutions = state
        .connection_service
        .list_simplefin_ignored_institutions(&auth_context.user_id)
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to list SimpleFIN ignored institutions for user {}: {}",
                auth_context.user_id,
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(
        crate::models::simplefin::SimpleFinIgnoredInstitutionsResponse { institutions },
    ))
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

    let org_conn_id = req.org_conn_id.trim();
    if org_conn_id.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let restored = state
        .connection_service
        .restore_simplefin_ignored_institution(&auth_context.user_id, org_conn_id)
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to restore SimpleFIN ignored institution for user {}: {}",
                auth_context.user_id,
                e
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(
        crate::models::simplefin::SimpleFinRestoreIgnoredInstitutionResponse { restored },
    ))
}

async fn refresh_session_budget_cache(state: &AppState, jwt_id: &str, user_id: uuid::Uuid) {
    match state
        .budget_service
        .get_budgets_for_user(&*state.db_repository, user_id)
        .await
    {
        Ok(budgets) => match serde_json::to_string(&budgets) {
            Ok(serialized) => {
                if let Err(error) = state.cache_service.set_budgets(jwt_id, &serialized).await {
                    tracing::warn!(
                        jwt_id,
                        error = %error,
                        "Failed to refresh budget cache after mutation"
                    );
                }
            }
            Err(error) => {
                tracing::warn!(
                    jwt_id,
                    error = %error,
                    "Failed to serialize budgets for cache refresh"
                );
                let _ = state.cache_service.clear_budgets(jwt_id).await;
            }
        },
        Err(error) => {
            tracing::warn!(
                jwt_id,
                user_id = %user_id,
                error = %error,
                "Failed to load budgets for cache refresh; clearing budget cache"
            );
            let _ = state.cache_service.clear_budgets(jwt_id).await;
        }
    }
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
    security(("auth_cookie" = [])),
    tag = "Budgets"
)]
async fn get_authenticated_budgets(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<Vec<crate::models::budget::Budget>>, (StatusCode, Json<ApiErrorResponse>)> {
    let user_id = auth_context.user_id;

    if let Ok(Some(serialized)) = state.cache_service.get_budgets(&auth_context.jwt_id).await {
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
                    .set_budgets(&auth_context.jwt_id, &serialized)
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
    get,
    path = "/api/budgets/overview",
    description = "Returns budgets (cached when available) and live subscription summaries for the authenticated user.",
    responses(
        (status = 200, description = "Budgets and subscription overview", body = BudgetsOverviewResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Budgets"
)]
async fn get_authenticated_budgets_overview(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<BudgetsOverviewResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    let user_id = auth_context.user_id;

    let cached_budgets =
        if let Ok(Some(serialized)) = state.cache_service.get_budgets(&auth_context.jwt_id).await {
            serde_json::from_str::<Vec<Budget>>(&serialized).ok()
        } else {
            None
        };

    if let Some(budgets) = cached_budgets {
        match state
            .db_repository
            .get_fixed_expense_summary(&user_id)
            .await
        {
            Ok(fixed_expenses) => Ok(Json(BudgetsOverviewResponse {
                budgets,
                fixed_expenses,
            })),
            Err(e) => {
                tracing::error!(
                    "Failed to get fixed expense summary for user {}: {}",
                    user_id,
                    e
                );
                Err(ApiErrorResponse::internal_server_error(
                    "Failed to fetch fixed expenses",
                ))
            }
        }
    } else {
        let (budgets_result, fixed_expenses_result) = tokio::join!(
            state
                .budget_service
                .get_budgets_for_user(&*state.db_repository, user_id),
            state.db_repository.get_fixed_expense_summary(&user_id),
        );

        let budgets = match budgets_result {
            Ok(budgets) => budgets,
            Err(e) => {
                tracing::error!("Failed to get budgets for user {}: {}", user_id, e);
                return Err(ApiErrorResponse::internal_server_error(
                    "Failed to fetch budgets",
                ));
            }
        };

        let fixed_expenses = match fixed_expenses_result {
            Ok(fixed_expenses) => fixed_expenses,
            Err(e) => {
                tracing::error!(
                    "Failed to get fixed expense summary for user {}: {}",
                    user_id,
                    e
                );
                return Err(ApiErrorResponse::internal_server_error(
                    "Failed to fetch fixed expenses",
                ));
            }
        };

        if let Ok(serialized) = serde_json::to_string(&budgets) {
            let _ = state
                .cache_service
                .set_budgets(&auth_context.jwt_id, &serialized)
                .await;
        }

        Ok(Json(BudgetsOverviewResponse {
            budgets,
            fixed_expenses,
        }))
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
        (status = 402, description = "Paid access required", body = ApiErrorResponse),
        (status = 409, description = "Budget category already exists", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "Budgets"
)]
async fn create_authenticated_budget(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<CreateBudgetRequest>,
) -> Result<Json<crate::models::budget::Budget>, (StatusCode, Json<ApiErrorResponse>)> {
    let user_id = auth_context.user_id;

    require_paid_own_data_access_after_demo(&state, user_id, "budget.create").await?;

    match state
        .budget_service
        .create_budget_for_user(&*state.db_repository, user_id, req.category, req.amount)
        .await
    {
        Ok(created_budget) => {
            refresh_session_budget_cache(&state, &auth_context.jwt_id, user_id).await;
            Ok(Json(created_budget))
        }
        Err(e) => {
            tracing::error!("Failed to create budget for user {}: {}", user_id, e);
            if e.contains("greater than zero") {
                Err(
                    ApiErrorResponse::new("BAD_REQUEST", "Budget amount must be greater than zero")
                        .into_response(StatusCode::BAD_REQUEST),
                )
            } else if e.contains("income or transfer") {
                Err(ApiErrorResponse::new(
                    "BAD_REQUEST",
                    "Budgets cannot be created for income or transfer categories",
                )
                .into_response(StatusCode::BAD_REQUEST))
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
    security(("auth_cookie" = [])),
    tag = "Budgets"
)]
async fn update_authenticated_budget(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedBudgetId { budget_id }: AuthorizedBudgetId,
    Json(req): Json<UpdateBudgetRequest>,
) -> Result<Json<crate::models::budget::Budget>, (StatusCode, Json<ApiErrorResponse>)> {
    let user_id = auth_context.user_id;

    require_paid_own_data_access_after_demo(&state, user_id, "budget.update").await?;

    if req.amount <= rust_decimal::Decimal::ZERO {
        return Err(ApiErrorResponse::new(
            "BAD_REQUEST",
            "Budget amount must be greater than zero",
        )
        .into_response(StatusCode::BAD_REQUEST));
    }

    match state
        .budget_service
        .update_budget_for_user(&*state.db_repository, budget_id, user_id, req.amount)
        .await
    {
        Ok(updated_budget) => {
            refresh_session_budget_cache(&state, &auth_context.jwt_id, user_id).await;
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
    security(("auth_cookie" = [])),
    tag = "Budgets"
)]
async fn delete_authenticated_budget(
    State(state): State<AppState>,
    auth_context: AuthContext,
    AuthorizedBudgetId { budget_id }: AuthorizedBudgetId,
) -> Result<Json<DeleteBudgetResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    let user_id = auth_context.user_id;

    require_paid_own_data_access_after_demo(&state, user_id, "budget.delete").await?;

    match state
        .budget_service
        .delete_budget_for_user(&*state.db_repository, budget_id, user_id)
        .await
    {
        Ok(_) => {
            refresh_session_budget_cache(&state, &auth_context.jwt_id, user_id).await;
            Ok(Json(DeleteBudgetResponse {
                deleted: true,
                budget_id: budget_id.to_string(),
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
    let user_id = auth_context.user_id;
    let connection = req.connection;

    match state
        .connection_service
        .disconnect_owned_connection(&connection, &user_id, &auth_context.jwt_id)
        .await
    {
        Ok(result) if result.success => Ok(Json(result)),
        Ok(_) => Err(StatusCode::NOT_FOUND),
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
    post,
    path = "/api/diy/institutions",
    description = "Creates a new DIY institution (provider_connection with provider='diy') for the authenticated user.",
    request_body = crate::models::diy::CreateDiyInstitutionRequest,
    responses(
        (status = 200, description = "Institution created successfully", body = crate::models::diy::CreateDiyInstitutionResponse),
        (status = 400, description = "Invalid request body", body = ApiErrorResponse),
        (status = 401, description = "Unauthorized"),
        (status = 402, description = "Paid access required", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "DIY Provider"
)]
async fn create_diy_institution(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<crate::models::diy::CreateDiyInstitutionRequest>,
) -> Result<
    Json<crate::models::diy::CreateDiyInstitutionResponse>,
    (StatusCode, Json<ApiErrorResponse>),
> {
    let user_id = auth_context.user_id;

    if !state.config.is_financial_provider_enabled("diy") {
        return Err(provider_disabled_response("diy"));
    }

    require_paid_own_data_access(&state, user_id, "diy.institution.create").await?;

    if req.name.trim().is_empty() {
        return Err(
            ApiErrorResponse::new("BAD_REQUEST", "Institution name cannot be empty")
                .into_response(StatusCode::BAD_REQUEST),
        );
    }

    match state
        .diy_service
        .create_institution(user_id, &auth_context.jwt_id, req.name.trim())
        .await
    {
        Ok(connection) => Ok(Json(crate::models::diy::CreateDiyInstitutionResponse {
            connection_id: connection.id,
        })),
        Err(e) if e.to_string().contains("already exists") => Err(ApiErrorResponse::conflict(
            "Institution name already exists",
        )),
        Err(e) => {
            tracing::error!(
                "Failed to create DIY institution for user {}: {}",
                user_id,
                e
            );
            Err(ApiErrorResponse::internal_server_error(
                "Failed to create institution",
            ))
        }
    }
}

const DIY_VALID_ACCOUNT_TYPES: &[&str] = &["depository", "credit", "investment", "loan"];

#[utoipa::path(
    post,
    path = "/api/diy/institutions/{connection_id}/accounts",
    description = "Creates a new account under a DIY institution owned by the authenticated user.",
    params(
        ("connection_id" = Uuid, Path, description = "DIY institution connection ID")
    ),
    request_body = crate::models::diy::CreateDiyAccountRequest,
    responses(
        (status = 200, description = "Account created successfully", body = crate::models::diy::CreateDiyAccountResponse),
        (status = 400, description = "Invalid account type or empty name", body = ApiErrorResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Connection is not a DIY connection", body = ApiErrorResponse),
        (status = 404, description = "Connection not found", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "DIY Provider"
)]
async fn create_diy_account(
    State(state): State<AppState>,
    auth_context: AuthContext,
    axum::extract::Path(connection_id): axum::extract::Path<uuid::Uuid>,
    Json(req): Json<crate::models::diy::CreateDiyAccountRequest>,
) -> Result<Json<crate::models::diy::CreateDiyAccountResponse>, (StatusCode, Json<ApiErrorResponse>)>
{
    let user_id = auth_context.user_id;

    if !state.config.is_financial_provider_enabled("diy") {
        return Err(provider_disabled_response("diy"));
    }

    require_paid_own_data_access(&state, user_id, "diy.account.create").await?;

    if req.name.trim().is_empty() {
        return Err(
            ApiErrorResponse::new("BAD_REQUEST", "Account name cannot be empty")
                .into_response(StatusCode::BAD_REQUEST),
        );
    }

    if !DIY_VALID_ACCOUNT_TYPES.contains(&req.account_type.as_str()) {
        return Err(ApiErrorResponse::new(
            "BAD_REQUEST",
            &format!(
                "account_type must be one of: {}",
                DIY_VALID_ACCOUNT_TYPES.join(", ")
            ),
        )
        .into_response(StatusCode::BAD_REQUEST));
    }

    if req.balance.is_none() {
        return Err(ApiErrorResponse::new("BAD_REQUEST", "Balance is required")
            .into_response(StatusCode::BAD_REQUEST));
    }

    match state
        .diy_service
        .create_account(user_id, connection_id, &req)
        .await
    {
        Ok(account) => Ok(Json(crate::models::diy::CreateDiyAccountResponse {
            id: account.id,
            name: account.name,
            account_type: account.account_type,
        })),
        Err(e) if e.to_string().contains("not found") => {
            Err(ApiErrorResponse::new("NOT_FOUND", "Connection not found")
                .into_response(StatusCode::NOT_FOUND))
        }
        Err(e) if e.to_string().contains("not diy") => Err(ApiErrorResponse::new(
            "FORBIDDEN",
            "Connection is not a DIY connection",
        )
        .into_response(StatusCode::FORBIDDEN)),
        Err(e) if e.to_string().contains("account name already exists") => Err(
            ApiErrorResponse::conflict("Account name already exists in this institution"),
        ),
        Err(e) if e.to_string().contains("account mask already exists") => Err(
            ApiErrorResponse::conflict("Account mask already exists in this institution"),
        ),
        Err(e) => {
            tracing::error!(
                "Failed to create DIY account for user {} connection {}: {}",
                user_id,
                connection_id,
                e
            );
            Err(ApiErrorResponse::internal_server_error(
                "Failed to create account",
            ))
        }
    }
}

#[utoipa::path(
    delete,
    path = "/api/diy/institutions/{connection_id}",
    description = "Removes a DIY institution and cascades deletion of its accounts, transactions, and related cache entries.",
    params(
        ("connection_id" = Uuid, Path, description = "DIY institution connection ID")
    ),
    responses(
        (status = 200, description = "Institution removed successfully", body = crate::models::plaid::DisconnectResult),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Connection is not a DIY institution", body = ApiErrorResponse),
        (status = 404, description = "Institution not found", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse),
    ),
    security(("auth_cookie" = [])),
    tag = "DIY Provider"
)]
async fn disconnect_diy_institution(
    State(state): State<AppState>,
    auth_context: AuthContext,
    axum::extract::Path(connection_id): axum::extract::Path<uuid::Uuid>,
) -> Result<Json<crate::models::plaid::DisconnectResult>, (StatusCode, Json<ApiErrorResponse>)> {
    let user_id = auth_context.user_id;

    let connection = match state
        .diy_service
        .require_diy_institution(user_id, connection_id)
        .await
    {
        Ok(connection) => connection,
        Err(e) if e.to_string().contains("not found") => {
            return Err(ApiErrorResponse::new("NOT_FOUND", "Institution not found")
                .into_response(StatusCode::NOT_FOUND));
        }
        Err(e) if e.to_string().contains("not diy") => {
            return Err(
                ApiErrorResponse::new("FORBIDDEN", "Connection is not a DIY institution")
                    .into_response(StatusCode::FORBIDDEN),
            );
        }
        Err(e) => {
            tracing::error!(
                "Failed to resolve DIY institution {} for user {}: {}",
                connection_id,
                user_id,
                e
            );
            return Err(ApiErrorResponse::internal_server_error(
                "Failed to disconnect institution",
            ));
        }
    };

    match state
        .connection_service
        .disconnect_owned_connection(&connection, &user_id, &auth_context.jwt_id)
        .await
    {
        Ok(result) if result.success => Ok(Json(result)),
        Ok(_) => Err(ApiErrorResponse::new("NOT_FOUND", "Institution not found")
            .into_response(StatusCode::NOT_FOUND)),
        Err(e) => {
            tracing::error!(
                "Failed to disconnect DIY institution {} for user {}: {}",
                connection_id,
                user_id,
                e
            );
            Err(ApiErrorResponse::internal_server_error(
                "Failed to disconnect institution",
            ))
        }
    }
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

    let mut available_providers = Vec::new();
    for provider in ["plaid", "simplefin", "diy"] {
        if state.provider_registry.get(provider).is_none() {
            continue;
        }

        if !state.config.is_financial_provider_enabled(provider) {
            continue;
        }

        available_providers.push(provider.to_string());
    }

    let user_provider = user
        .active_provider()
        .filter(|provider| *provider != "teller")
        .filter(|provider| state.provider_registry.get(provider).is_some())
        .filter(|provider| state.config.is_financial_provider_enabled(provider))
        .map(str::to_string);

    Ok(Json(ProviderInfoResponse {
        available_providers,
        user_provider,
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
        (status = 402, description = "Paid access required", body = ApiErrorResponse),
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
    let user_id = auth_context.user_id;
    let requested_provider = req.provider;

    if requested_provider == "teller" {
        return Err(ApiErrorResponse::with_code(
            "BAD_REQUEST",
            services::sync_service_dispatcher::TELLER_NO_LONGER_SUPPORTED_MESSAGE,
            "TELLER_NO_LONGER_SUPPORTED",
        )
        .into_response(StatusCode::BAD_REQUEST));
    }

    if state.provider_registry.get(&requested_provider).is_none() {
        return Err(ApiErrorResponse::new(
            "BAD_REQUEST",
            &format!("Provider '{}' is not registered", requested_provider),
        )
        .into_response(StatusCode::BAD_REQUEST));
    }

    if !state
        .config
        .is_financial_provider_enabled(&requested_provider)
    {
        return Err(provider_disabled_response(&requested_provider));
    }

    require_paid_own_data_access(&state, user_id, "provider.select").await?;

    let _user = match state.db_repository.get_user_by_id(&user_id).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            tracing::error!("User {} not found", user_id);
            return Err(ApiErrorResponse::internal_server_error("User not found"));
        }
        Err(e) => {
            tracing::error!("Failed to get user {}: {}", user_id, e);
            return Err(ApiErrorResponse::internal_server_error(
                "Failed to fetch user",
            ));
        }
    };

    let connections = match state
        .db_repository
        .get_all_provider_connections_by_user(&user_id)
        .await
    {
        Ok(conns) => conns,
        Err(e) => {
            tracing::error!("Failed to get connections for user {}: {}", user_id, e);
            return Err(ApiErrorResponse::internal_server_error(
                "Failed to check active connections",
            ));
        }
    };

    if requested_provider != "diy" {
        if let Some(conflicting_provider) = connections.iter().find_map(|connection| {
            (connection.is_connected
                && connection.provider != requested_provider
                && connection.provider != "diy")
                .then_some(connection.provider.as_str())
        }) {
            return Err(ApiErrorResponse::new(
                "CONFLICT",
                &format!(
                    "Disconnect all {} accounts before switching",
                    conflicting_provider
                ),
            )
            .into_response(StatusCode::CONFLICT));
        }
    }

    match state
        .db_repository
        .update_user_provider(&user_id, &requested_provider)
        .await
    {
        Ok(_) => {
            tracing::info!("User {} selected provider: {}", user_id, requested_provider);
            Ok(Json(ProviderSelectResponse {
                user_provider: requested_provider,
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
    let user_id = auth_context.user_id;

    let base_cache_key = format!("{}_balances_overview", auth_context.jwt_id);
    let cache_key = utils::cache_keys::generate_cache_key_with_account_filter(
        &base_cache_key,
        authorized_account_ids.as_ref(),
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
        if let Some(ref filter_ids) = authorized_account_ids {
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
            if let Some(ref filter_ids) = authorized_account_ids {
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

    tracing::info!(
        account_count = response.banks.len(),
        "Data access: balances"
    );

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
    use rust_decimal::Decimal;
    use std::collections::{BTreeMap, HashMap, HashSet};

    let user_id = auth_context.user_id;

    // Parse and validate dates
    let (start_date, end_date) = match (&query.start_date, &query.end_date) {
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

    // Cache lookup
    let base_cache_key = format!(
        "{}_net_worth_over_time_{}_{}",
        auth_context.jwt_id, start_date, end_date
    );
    let cache_key = utils::cache_keys::generate_cache_key_with_account_filter(
        &base_cache_key,
        authorized_account_ids.as_ref(),
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
        if let Some(ref allowed_ids) = authorized_account_ids {
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
        if let Some(ref allowed_ids) = authorized_account_ids {
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
    let user_id = auth_context.user_id;

    let user = state
        .db_repository
        .get_user_by_id(&user_id)
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to load user {} for passkey enrollment: {}",
                user_id,
                e
            );
            ApiErrorResponse::internal_server_error("Failed to begin passkey enrollment")
        })?
        .ok_or_else(|| ApiErrorResponse::unauthorized("Authentication failed"))?;

    let existing = state
        .db_repository
        .list_webauthn_credentials_for_user(&user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list credentials for user {}: {}", user_id, e);
            ApiErrorResponse::internal_server_error("Failed to retrieve existing credentials")
        })?;

    let existing_ids: Vec<Vec<u8>> = existing.iter().map(|c| c.credential_id.clone()).collect();

    let (challenge, reg_state) = state
        .webauthn_service
        .begin_registration(user_id, &user.email, &user.email, &existing_ids)
        .map_err(|e| {
            tracing::error!("begin_registration failed for user {}: {}", user_id, e);
            ApiErrorResponse::internal_server_error("Failed to begin passkey enrollment")
        })?;

    let state_value = serde_json::to_value(&reg_state).map_err(|e| {
        tracing::error!("Failed to serialize registration state: {}", e);
        ApiErrorResponse::internal_server_error("Failed to serialize registration state")
    })?;

    let challenge_payload = serde_json::to_string(&AuthenticatedEnrollmentChallengePayload {
        user_id,
        state: state_value,
    })
    .map_err(|e| {
        tracing::error!("Failed to serialize enrollment challenge payload: {}", e);
        ApiErrorResponse::internal_server_error("Failed to serialize registration state")
    })?;

    let session_id = Uuid::new_v4().to_string();

    state
        .cache_service
        .set_webauthn_challenge(&session_id, &challenge_payload)
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to store challenge for session {}: {}",
                session_id,
                e
            );
            ApiErrorResponse::internal_server_error("Failed to store registration challenge")
        })?;

    let challenge_json = serde_json::to_value(&challenge).map_err(|e| {
        tracing::error!("Failed to serialize challenge: {}", e);
        ApiErrorResponse::internal_server_error("Failed to serialize challenge")
    })?;

    Ok(Json(auth_models::PasskeyRegisterBeginResponse {
        session_id,
        challenge: challenge_json,
    }))
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
    use webauthn_rs::prelude::{PasskeyRegistration, RegisterPublicKeyCredential};

    let user_id = auth_context.user_id;

    let challenge_json = state
        .cache_service
        .take_webauthn_challenge(&req.session_id)
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to retrieve challenge for session {}: {}",
                req.session_id,
                e
            );
            ApiErrorResponse::internal_server_error("Failed to retrieve challenge")
        })?
        .ok_or_else(|| ApiErrorResponse::bad_request("Challenge not found or already used"))?;

    let payload = serde_json::from_str::<AuthenticatedEnrollmentChallengePayload>(&challenge_json)
        .map_err(|e| {
            tracing::error!("Failed to deserialize enrollment challenge payload: {}", e);
            ApiErrorResponse::bad_request("Invalid enrollment challenge")
        })?;

    if payload.user_id != user_id {
        return Err(ApiErrorResponse::unauthorized(
            "Challenge does not belong to the authenticated user",
        ));
    }

    let reg_state: PasskeyRegistration = serde_json::from_value(payload.state).map_err(|e| {
        tracing::error!("Failed to deserialize registration state: {}", e);
        ApiErrorResponse::bad_request("Invalid challenge state")
    })?;

    let credential_response: RegisterPublicKeyCredential = serde_json::from_value(req.response)
        .map_err(|e| {
            tracing::error!("Failed to deserialize credential response: {}", e);
            ApiErrorResponse::bad_request("Invalid credential response")
        })?;

    let passkey = state
        .webauthn_service
        .finish_registration(&reg_state, &credential_response)
        .map_err(|e| {
            tracing::warn!("finish_registration failed for user {}: {}", user_id, e);
            ApiErrorResponse::bad_request("Passkey verification failed")
        })?;

    let credential_id = passkey.cred_id().to_vec();
    let passkey_json = serde_json::to_value(&passkey).map_err(|e| {
        tracing::error!("Failed to serialize passkey: {}", e);
        ApiErrorResponse::internal_server_error("Failed to serialize passkey")
    })?;

    let credential = state
        .db_repository
        .insert_webauthn_credential(&user_id, credential_id, passkey_json, &req.name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to insert credential for user {}: {}", user_id, e);
            ApiErrorResponse::internal_server_error("Failed to save passkey")
        })?;

    let enrolled_user = state
        .db_repository
        .get_user_by_id(&user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch user {} after enrollment: {}", user_id, e);
            ApiErrorResponse::internal_server_error("Failed to complete passkey enrollment")
        })?
        .ok_or_else(|| ApiErrorResponse::internal_server_error("User not found"))?;

    if enrolled_user.password_hash.is_some() {
        state
            .db_repository
            .clear_user_password_hash(&user_id)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to clear password hash for user {} after passkey enrollment: {}",
                    user_id,
                    e
                );
                ApiErrorResponse::internal_server_error("Failed to complete passkey enrollment")
            })?;
    }

    tracing::info!("User {} enrolled an additional passkey", user_id);

    Ok(Json(auth_models::PasskeyItem {
        id: credential.id,
        name: credential.name,
        created_at: credential.created_at,
        last_used_at: credential.last_used_at,
    }))
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
    use webauthn_rs::prelude::{PasskeyRegistration, RegisterPublicKeyCredential};

    let challenge_json = state
        .cache_service
        .take_webauthn_challenge(&req.session_id)
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to retrieve challenge for session {}: {}",
                req.session_id,
                e
            );
            ApiErrorResponse::internal_server_error("Failed to retrieve challenge")
        })?
        .ok_or_else(|| ApiErrorResponse::bad_request("Challenge not found or already used"))?;

    let authenticated_user_id = extract_auth_cookie_token(&headers)
        .and_then(|token| state.auth_service.validate_token(&token).ok())
        .and_then(|claims| Uuid::parse_str(&claims.sub).ok());

    if authenticated_user_id.is_some() {
        return Err(ApiErrorResponse::bad_request(
            "Authenticated passkey enrollment must use /api/auth/passkey/enroll/finish",
        ));
    }

    let payload =
        serde_json::from_str::<RegistrationChallengePayload>(&challenge_json).map_err(|e| {
            tracing::error!(
                "Failed to deserialize registration challenge payload: {}",
                e
            );
            ApiErrorResponse::bad_request("Invalid registration challenge")
        })?;

    let reg_state: PasskeyRegistration = serde_json::from_value(payload.state).map_err(|e| {
        tracing::error!("Failed to deserialize registration state: {}", e);
        ApiErrorResponse::bad_request("Invalid challenge state")
    })?;

    let user_id = payload.user_id;
    let recovery_signin = payload.existing_user_recovery;
    let complete_signup = !recovery_signin;
    let pending_user_info = if complete_signup {
        Some((payload.email.clone(), payload.display_name.clone()))
    } else {
        None
    };

    if !complete_signup {
        let passkeys = state
            .db_repository
            .list_webauthn_credentials_for_user(&user_id)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to list passkeys for user {} during passkey enrollment: {}",
                    user_id,
                    e
                );
                ApiErrorResponse::internal_server_error("Failed to complete passkey enrollment")
            })?;

        if has_usable_passkey(&passkeys) {
            return Err(ApiErrorResponse::bad_request(
                "Passkey sign-in is already available for this account",
            ));
        }
    }

    if recovery_signin {
        let user = state
            .db_repository
            .get_user_by_id(&user_id)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to load user {} for recovery enrollment: {}",
                    user_id,
                    e
                );
                ApiErrorResponse::internal_server_error("Failed to complete passkey enrollment")
            })?
            .ok_or_else(|| ApiErrorResponse::bad_request("Account not found"))?;

        if user
            .password_hash
            .as_ref()
            .is_some_and(|hash| !hash.is_empty())
        {
            return Err(ApiErrorResponse::bad_request(
                "Password sign-in is available for this account",
            ));
        }
    }

    let credential_response: RegisterPublicKeyCredential = serde_json::from_value(req.response)
        .map_err(|e| {
            tracing::error!("Failed to deserialize credential response: {}", e);
            ApiErrorResponse::bad_request("Invalid credential response")
        })?;

    let passkey = state
        .webauthn_service
        .finish_registration(&reg_state, &credential_response)
        .map_err(|e| {
            tracing::warn!("finish_registration failed for user {}: {}", user_id, e);
            ApiErrorResponse::bad_request("Passkey verification failed")
        })?;

    let credential_id = passkey.cred_id().to_vec();
    let passkey_json = serde_json::to_value(&passkey).map_err(|e| {
        tracing::error!("Failed to serialize passkey: {}", e);
        ApiErrorResponse::internal_server_error("Failed to serialize passkey")
    })?;

    if complete_signup {
        let (email, _display_name) = pending_user_info
            .ok_or_else(|| ApiErrorResponse::internal_server_error("Missing signup context"))?;
        let new_user = User {
            id: user_id,
            email,
            password_hash: None,
            provider: String::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            onboarding_completed: false,
            demo_mode_active: true,
        };
        if let Err(e) = state.db_repository.create_user(&new_user).await {
            tracing::warn!(
                auth_operation = "register_finish",
                auth_result = "failure",
                failure_reason = "user_creation_failed",
                user_id = %user_id,
                error = %e,
                "User creation failed during passkey finish"
            );
            return Err(ApiErrorResponse::conflict(
                "Email address is already registered",
            ));
        }
    }

    match state
        .db_repository
        .insert_webauthn_credential(&user_id, credential_id, passkey_json, &req.name)
        .await
    {
        Ok(_) => {}
        Err(e) => {
            tracing::error!("Failed to insert credential for user {}: {}", user_id, e);
            if complete_signup {
                if let Err(del_err) = state.db_repository.delete_user(&user_id).await {
                    tracing::error!(
                        "Failed to clean up user {} after credential insert failure: {}",
                        user_id,
                        del_err
                    );
                }
            }
            return Err(ApiErrorResponse::internal_server_error(
                "Failed to save passkey",
            ));
        }
    };

    let enrolled_user = state
        .db_repository
        .get_user_by_id(&user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch user {} after enrollment: {}", user_id, e);
            ApiErrorResponse::internal_server_error("Failed to complete passkey enrollment")
        })?
        .ok_or_else(|| ApiErrorResponse::internal_server_error("User not found"))?;

    if enrolled_user.password_hash.is_some() {
        state
            .db_repository
            .clear_user_password_hash(&user_id)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to clear password hash for user {} after passkey enrollment: {}",
                    user_id,
                    e
                );
                ApiErrorResponse::internal_server_error("Failed to complete passkey enrollment")
            })?;
    }

    let user = enrolled_user;

    let auth_token = state.auth_service.generate_token(user_id).map_err(|e| {
        tracing::error!("Token generation failed for user {}: {}", user_id, e);
        ApiErrorResponse::internal_server_error("Failed to generate authentication token")
    })?;

    let ttl = (auth_token.expires_at - Utc::now()).num_seconds().max(0) as u64;
    if ttl > 0 {
        if let Err(e) = state
            .cache_service
            .set_session_valid(&auth_token.jwt_id, ttl)
            .await
        {
            tracing::warn!("Failed to set session validity in cache: {}", e);
        }
        if let Err(e) = state
            .cache_service
            .set_jwt_token(&auth_token.jwt_id, &auth_token.token, ttl)
            .await
        {
            tracing::warn!("Failed to cache JWT token: {}", e);
        }
    }

    if complete_signup {
        tracing::info!("User {} completed passkey signup", user_id);
    } else {
        tracing::info!("User {} completed passkey recovery sign-in", user_id);
    }

    let mut response_headers = auth_cookie_headers(build_auth_cookie(
        &auth_token.token,
        auth_token.expires_at,
        &state.config,
    ));
    response_headers.insert(
        axum::http::header::CONTENT_TYPE,
        axum::http::HeaderValue::from_static("application/json"),
    );

    let body = serde_json::to_string(&auth_models::AuthResponse {
        user_id: user_id.to_string(),
        email: user.email.clone(),
        expires_at: auth_token.expires_at.to_rfc3339(),
        onboarding_completed: user.onboarding_completed,
        demo_mode_active: user.demo_mode_active,
        requires_passkey_enrollment: false,
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
    let user_id = auth_context.user_id;

    let credentials = state
        .db_repository
        .list_webauthn_credentials_for_user(&user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list passkeys for user {}: {}", user_id, e);
            ApiErrorResponse::internal_server_error("Failed to retrieve passkeys")
        })?;

    let items = credentials
        .into_iter()
        .filter(is_usable_credential)
        .map(|c| auth_models::PasskeyItem {
            id: c.id,
            name: c.name,
            created_at: c.created_at,
            last_used_at: c.last_used_at,
        })
        .collect();

    Ok(Json(items))
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
    let user_id = auth_context.user_id;

    let existing = state
        .db_repository
        .list_webauthn_credentials_for_user(&user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list passkeys for user {}: {}", user_id, e);
            ApiErrorResponse::internal_server_error("Failed to retrieve passkeys")
        })?;

    let target = existing
        .iter()
        .find(|credential| credential.id == id)
        .ok_or_else(|| ApiErrorResponse::not_found("Passkey not found"))?;

    if is_usable_credential(target) {
        let remaining_usable = existing
            .iter()
            .filter(|credential| credential.id != id && is_usable_credential(credential))
            .count();

        if remaining_usable == 0 {
            return Err(ApiErrorResponse::conflict(
                "Cannot remove the last enrolled passkey",
            ));
        }
    } else if count_usable_credentials(&existing) == 0 {
        return Err(ApiErrorResponse::conflict(
            "Cannot remove the last enrolled passkey",
        ));
    }

    let deleted = state
        .db_repository
        .delete_webauthn_credential(&user_id, &id)
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to delete passkey {} for user {}: {}",
                id,
                user_id,
                e
            );
            ApiErrorResponse::internal_server_error("Failed to delete passkey")
        })?;

    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(ApiErrorResponse::not_found("Passkey not found"))
    }
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
    const INVALID_CREDENTIALS: &str = "Invalid email or password";

    let user = match state.db_repository.get_user_by_email(&req.email).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            return Err(ApiErrorResponse::unauthorized(INVALID_CREDENTIALS));
        }
        Err(e) => {
            tracing::error!(
                "Failed to look up user by email during password login: {}",
                e
            );
            return Err(ApiErrorResponse::internal_server_error(
                "Authentication service error",
            ));
        }
    };

    let passkeys = state
        .db_repository
        .list_webauthn_credentials_for_user(&user.id)
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to list passkeys for user {} during password login: {}",
                user.id,
                e
            );
            ApiErrorResponse::internal_server_error("Authentication service error")
        })?;

    if has_usable_passkey(&passkeys) && !dev_password_auth_enabled() {
        return Err(ApiErrorResponse::unauthorized(INVALID_CREDENTIALS));
    }

    let password_hash = match user.password_hash.as_deref() {
        Some(hash) if !hash.is_empty() => hash,
        _ => return Err(ApiErrorResponse::unauthorized(INVALID_CREDENTIALS)),
    };

    let password_valid = state
        .auth_service
        .verify_password(&req.password, password_hash)
        .map_err(|e| {
            tracing::error!("Password verification error for user {}: {}", user.id, e);
            ApiErrorResponse::internal_server_error("Authentication service error")
        })?;

    if !password_valid {
        return Err(ApiErrorResponse::unauthorized(INVALID_CREDENTIALS));
    }

    let user_id = user.id;
    let auth_token = state.auth_service.generate_token(user_id).map_err(|e| {
        tracing::error!("Token generation failed for user {}: {}", user_id, e);
        ApiErrorResponse::internal_server_error("Failed to generate authentication token")
    })?;

    let ttl = (auth_token.expires_at - Utc::now()).num_seconds().max(0) as u64;
    if ttl > 0 {
        if let Err(e) = state
            .cache_service
            .set_session_valid(&auth_token.jwt_id, ttl)
            .await
        {
            tracing::warn!("Failed to set session validity in cache: {}", e);
        }
        if let Err(e) = state
            .cache_service
            .set_jwt_token(&auth_token.jwt_id, &auth_token.token, ttl)
            .await
        {
            tracing::warn!("Failed to cache JWT token: {}", e);
        }
    }

    tracing::info!(
        "User {} authenticated via legacy password login (migration)",
        user_id
    );

    Ok((
        auth_cookie_headers(build_auth_cookie(
            &auth_token.token,
            auth_token.expires_at,
            &state.config,
        )),
        Json(auth_models::AuthResponse {
            user_id: user_id.to_string(),
            email: user.email.clone(),
            expires_at: auth_token.expires_at.to_rfc3339(),
            onboarding_completed: user.onboarding_completed,
            demo_mode_active: user.demo_mode_active,
            requires_passkey_enrollment: !dev_password_auth_enabled(),
        }),
    ))
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
    let email = req.email.trim().to_lowercase();

    let user_lookup = match state.db_repository.get_user_by_email(&email).await {
        Ok(user) => user,
        Err(e) => {
            tracing::error!(
                "Failed to look up user by email during passkey login begin: {}",
                e
            );
            return Err(ApiErrorResponse::internal_server_error(
                "Authentication service error",
            ));
        }
    };

    let Some(user) = user_lookup else {
        return Ok(Json(auth_models::PasskeyLoginBeginResponse {
            session_id: String::new(),
            challenge: serde_json::Value::Null,
            account_exists: false,
            passkey_available: false,
            password_available: false,
        }));
    };

    let creds = state
        .db_repository
        .list_webauthn_credentials_for_user(&user.id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list credentials for user {}: {}", user.id, e);
            ApiErrorResponse::internal_server_error("Authentication service error")
        })?;

    if dev_password_auth_enabled() && user_has_password(&user) {
        return Ok(Json(auth_models::PasskeyLoginBeginResponse {
            session_id: String::new(),
            challenge: serde_json::Value::Null,
            account_exists: true,
            passkey_available: false,
            password_available: true,
        }));
    }

    let passkeys = usable_passkeys(&creds);
    let password_available = passkeys.is_empty() && user_has_password(&user);

    if passkeys.is_empty() {
        if password_available {
            return Ok(Json(auth_models::PasskeyLoginBeginResponse {
                session_id: String::new(),
                challenge: serde_json::Value::Null,
                account_exists: true,
                passkey_available: false,
                password_available: true,
            }));
        }

        let existing_ids: Vec<Vec<u8>> = creds.iter().map(|c| c.credential_id.clone()).collect();

        let (challenge, reg_state) = state
            .webauthn_service
            .begin_registration(user.id, &user.email, &user.email, &existing_ids)
            .map_err(|e| {
                tracing::error!("begin_registration failed for user {}: {}", user.id, e);
                ApiErrorResponse::internal_server_error("Failed to begin passkey registration")
            })?;

        let state_value = serde_json::to_value(&reg_state).map_err(|e| {
            tracing::error!("Failed to serialize registration state: {}", e);
            ApiErrorResponse::internal_server_error("Failed to serialize registration state")
        })?;

        let payload = serde_json::to_string(&RegistrationChallengePayload {
            user_id: user.id,
            email: user.email.clone(),
            display_name: user.email.clone(),
            state: state_value,
            existing_user_recovery: true,
        })
        .map_err(|e| {
            tracing::error!("Failed to serialize registration challenge payload: {}", e);
            ApiErrorResponse::internal_server_error("Failed to store registration challenge")
        })?;

        let session_id = Uuid::new_v4().to_string();

        state
            .cache_service
            .set_webauthn_challenge(&session_id, &payload)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to store challenge for session {}: {}",
                    session_id,
                    e
                );
                ApiErrorResponse::internal_server_error("Failed to store registration challenge")
            })?;

        let challenge_json = serde_json::to_value(&challenge).map_err(|e| {
            tracing::error!("Failed to serialize challenge: {}", e);
            ApiErrorResponse::internal_server_error("Failed to serialize challenge")
        })?;

        return Ok(Json(auth_models::PasskeyLoginBeginResponse {
            session_id,
            challenge: challenge_json,
            account_exists: true,
            passkey_available: false,
            password_available: false,
        }));
    }

    let user_id = user.id;
    let (challenge, auth_state) = state
        .webauthn_service
        .begin_authentication(&passkeys)
        .map_err(|e| {
            tracing::error!("begin_authentication failed: {}", e);
            ApiErrorResponse::internal_server_error("Failed to begin authentication")
        })?;

    let state_value = serde_json::to_value(&auth_state).map_err(|e| {
        tracing::error!("Failed to serialize auth state: {}", e);
        ApiErrorResponse::internal_server_error("Failed to serialize authentication state")
    })?;

    let payload = serde_json::to_string(&LoginChallengePayload {
        user_id,
        state: state_value,
    })
    .map_err(|e| {
        tracing::error!("Failed to serialize challenge payload: {}", e);
        ApiErrorResponse::internal_server_error("Failed to store authentication challenge")
    })?;

    let session_id = Uuid::new_v4().to_string();

    state
        .cache_service
        .set_webauthn_challenge(&session_id, &payload)
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to store challenge for session {}: {}",
                session_id,
                e
            );
            ApiErrorResponse::internal_server_error("Failed to store authentication challenge")
        })?;

    let challenge_json = serde_json::to_value(&challenge).map_err(|e| {
        tracing::error!("Failed to serialize challenge: {}", e);
        ApiErrorResponse::internal_server_error("Failed to serialize challenge")
    })?;

    Ok(Json(auth_models::PasskeyLoginBeginResponse {
        session_id,
        challenge: challenge_json,
        account_exists: true,
        passkey_available: true,
        password_available: false,
    }))
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
    use webauthn_rs::prelude::{PasskeyAuthentication, PublicKeyCredential};

    let challenge_json = state
        .cache_service
        .take_webauthn_challenge(&req.session_id)
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to retrieve challenge for session {}: {}",
                req.session_id,
                e
            );
            ApiErrorResponse::internal_server_error("Failed to retrieve challenge")
        })?
        .ok_or_else(|| ApiErrorResponse::bad_request("Challenge not found or already used"))?;

    let payload: LoginChallengePayload = serde_json::from_str(&challenge_json).map_err(|e| {
        tracing::error!("Failed to deserialize challenge payload: {}", e);
        ApiErrorResponse::bad_request("Invalid challenge state")
    })?;

    if payload.user_id == Uuid::nil() {
        return Err(ApiErrorResponse::unauthorized("Authentication failed"));
    }

    let user_id = payload.user_id;

    let auth_state: PasskeyAuthentication = serde_json::from_value(payload.state).map_err(|e| {
        tracing::error!("Failed to deserialize authentication state: {}", e);
        ApiErrorResponse::bad_request("Invalid authentication state")
    })?;

    let credential_response: PublicKeyCredential =
        serde_json::from_value(req.response).map_err(|e| {
            tracing::error!("Failed to deserialize credential response: {}", e);
            ApiErrorResponse::bad_request("Invalid credential response")
        })?;

    let auth_result = state
        .webauthn_service
        .finish_authentication(&auth_state, &credential_response)
        .map_err(|e| {
            tracing::warn!("finish_authentication failed for user {}: {}", user_id, e);
            ApiErrorResponse::unauthorized("Authentication failed")
        })?;

    let cred_id_bytes: Vec<u8> = auth_result.cred_id().to_vec();
    let new_count = auth_result.counter();

    let matching = state
        .db_repository
        .find_webauthn_credentials_by_credential_ids(&user_id, &[cred_id_bytes])
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to find matched credential for user {}: {}",
                user_id,
                e
            );
            ApiErrorResponse::internal_server_error("Authentication service error")
        })?;

    if let Some(credential) = matching.first() {
        if let Err(e) = state
            .db_repository
            .update_webauthn_credential_counter_and_last_used(&user_id, &credential.id, new_count)
            .await
        {
            tracing::warn!(
                "Failed to update sign counter for credential {}: {}",
                credential.id,
                e
            );
        }
    }

    let user = state
        .db_repository
        .get_user_by_id(&user_id)
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to fetch user {} after authentication: {}",
                user_id,
                e
            );
            ApiErrorResponse::internal_server_error("Authentication service error")
        })?
        .ok_or_else(|| ApiErrorResponse::unauthorized("Authentication failed"))?;

    let auth_token = state.auth_service.generate_token(user_id).map_err(|e| {
        tracing::error!("Token generation failed for user {}: {}", user_id, e);
        ApiErrorResponse::internal_server_error("Failed to generate authentication token")
    })?;

    let ttl = (auth_token.expires_at - Utc::now()).num_seconds().max(0) as u64;
    if ttl > 0 {
        if let Err(e) = state
            .cache_service
            .set_session_valid(&auth_token.jwt_id, ttl)
            .await
        {
            tracing::warn!("Failed to set session validity in cache: {}", e);
        }
        if let Err(e) = state
            .cache_service
            .set_jwt_token(&auth_token.jwt_id, &auth_token.token, ttl)
            .await
        {
            tracing::warn!("Failed to cache JWT token: {}", e);
        }
    }

    tracing::info!("User {} authenticated successfully via passkey", user_id);

    Ok((
        auth_cookie_headers(build_auth_cookie(
            &auth_token.token,
            auth_token.expires_at,
            &state.config,
        )),
        Json(auth_models::AuthResponse {
            user_id: user_id.to_string(),
            email: user.email.clone(),
            expires_at: auth_token.expires_at.to_rfc3339(),
            onboarding_completed: user.onboarding_completed,
            demo_mode_active: user.demo_mode_active,
            requires_passkey_enrollment: false,
        }),
    ))
}
