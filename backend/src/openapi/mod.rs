pub mod schemas;
pub mod tags;

use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Sumurai Financial API",
        description = "Multi-tenant financial aggregation platform with Plaid, SimpleFIN, and DIY integration",
        version = "1.0.0",
        contact(
            name = "Sumurai Support",
            url = "https://github.com/two-bit-foundry/sumurai"
        ),
        license(
            name = "Sustainable Use License v1.0",
            url = "https://github.com/two-bit-foundry/sumurai/blob/main/LICENSE"
        )
    ),
    servers(
        (
            url = "http://localhost:3000",
            description = "Local development"
        ),
        (
            url = "http://localhost:8080/api",
            description = "Local via Nginx proxy"
        ),
        (
            url = "/api",
            description = "Relative API path (use in production)"
        )
    ),
    components(
        schemas(
            crate::models::auth::RegisterRequest,
            crate::models::auth::RegisterBeginResponse,
            crate::models::auth::AuthResponse,
            crate::models::auth::DeleteAccountResponse,
            crate::models::auth::LogoutResponse,
            crate::models::auth::OnboardingCompleteResponse,
            crate::models::auth::PasskeyRegisterBeginResponse,
            crate::models::auth::PasskeyRegisterFinishRequest,
            crate::models::auth::PasskeyItem,
            crate::models::auth::PasswordLoginRequest,
            crate::models::auth::PasskeyLoginBeginRequest,
            crate::models::auth::PasskeyLoginBeginResponse,
            crate::models::auth::PasskeyLoginFinishRequest,
            crate::models::import::ImportMultipartRequest,
            crate::models::import::ImportFileFormat,
            crate::models::import::CsvColumnMapping,
            crate::models::import::ImportDateRange,
            crate::models::import::PreviewTransaction,
            crate::models::import::ValidateResponse,
            crate::models::import::ImportResponse,
            crate::models::export::ExportFormat,
            crate::models::export::ExportQuery,
            crate::models::transaction::TransactionWithAccount,
            crate::models::transaction::CursorTransactionsResponse,
            crate::models::transaction::LargestTransaction,
            crate::models::transaction::TransactionsInsightsResponse,
            crate::models::transaction::InsightFormat,
            crate::models::transaction::InsightMetric,
            crate::models::transaction::InsightState,
            crate::models::transaction::ContextualInsightsResponse,
            crate::models::analytics::MonthlySpending,
            crate::models::analytics::IncomeExpenseTotals,
            crate::models::analytics::BudgetSummary,
            crate::models::analytics::CategorySpending,
            crate::models::analytics::DailySpending,
            crate::models::analytics::TopMerchant,
            crate::models::analytics::BalancesOverviewResponse,
            crate::models::analytics::DateBoundsResponse,
            crate::models::analytics::NetWorthOverTimeResponse,
            crate::models::analytics::CashFlowPoint,
            crate::models::analytics::CashFlowResponse,
            crate::models::analytics::SankeyNodeKind,
            crate::models::analytics::SankeyNode,
            crate::models::analytics::SankeyLink,
            crate::models::analytics::SankeySummary,
            crate::models::analytics::SankeyResponse,
            crate::models::budget::Budget,
            crate::models::budget::BudgetsOverviewResponse,
            crate::models::budget::DeleteBudgetResponse,
            crate::models::plaid::LinkTokenRequest,
            crate::models::plaid::LinkTokenResponse,
            crate::models::plaid::ExchangeTokenRequest,
            crate::models::provider_connect::ProviderConnectRequest,
            crate::models::plaid::SyncTransactionsRequest,
            crate::models::transaction::SyncTransactionsResponse,
            crate::models::transaction::SyncMetadata,
            crate::models::plaid::DisconnectRequest,
            crate::models::plaid::ProviderConnectionStatus,
            crate::models::plaid::ProviderStatusResponse,
            crate::models::plaid::ProviderConnectResponse,
            crate::models::plaid::ExchangeTokenResponse,
            crate::models::plaid::DisconnectResult,
            crate::models::plaid::ProviderSelectRequest,
            crate::models::plaid::ProviderSelectResponse,
            crate::models::plaid::ProviderInfoResponse,
            crate::models::plaid::ClearSyncedDataResponse,
            crate::models::simplefin::SimpleFinIgnoredInstitution,
            crate::models::simplefin::SimpleFinIgnoredInstitutionsResponse,
            crate::models::simplefin::SimpleFinInstitutionAuthRequired,
            crate::models::simplefin::SimpleFinRestoreIgnoredInstitutionRequest,
            crate::models::simplefin::SimpleFinRestoreIgnoredInstitutionResponse,
            crate::models::account::AccountResponse,
            crate::models::custom_category::CustomCategory,
            crate::models::custom_category::CategoryListResponse,
            crate::models::custom_category::CreateCustomCategoryRequest,
            crate::models::transaction_category_override::SetTransactionCategoryRequest,
            crate::models::auto_categorization_job::AutoCategorizationJobState,
            crate::models::auto_categorization_job::AutoCategorizationJobStatus,
            crate::models::subscription::FixedExpenseSummary,
            crate::models::api_error::ApiErrorResponse,
            crate::models::diy::CreateDiyInstitutionRequest,
            crate::models::diy::CreateDiyInstitutionResponse,
            crate::models::diy::CreateDiyAccountRequest,
            crate::models::diy::CreateDiyAccountResponse,
            schemas::SuccessResponse,
            schemas::ErrorResponse,
            schemas::HealthCheckResponse,
            schemas::DateRangeQueryParams,
            schemas::DailySpendingQueryParams,
            schemas::TransactionsQueryParams,
        )
    ),
    security(
        ("auth_cookie" = [])
    ),
    paths(
        crate::handlers::auth::register_user,
        crate::handlers::auth::refresh_user_session,
        crate::handlers::auth::logout_user,
        crate::handlers::auth::delete_user_account,
        crate::handlers::auth::complete_user_onboarding,
        crate::handlers::auth::activate_demo_mode_onboarding,
        crate::health_check,
        crate::handlers::category::list_categories,
        crate::handlers::category::create_custom_category,
        crate::handlers::category::delete_custom_category,
        crate::handlers::export::get_authenticated_export,
        crate::handlers::transaction::get_authenticated_transactions,
        crate::handlers::transaction::get_authenticated_transactions_insights,
        crate::handlers::transaction::get_authenticated_transactions_contextual_insights,
        crate::handlers::category::set_transaction_category,
        crate::handlers::auto_categorization::start_auto_categorization,
        crate::handlers::auto_categorization::get_auto_categorization_status,
        crate::handlers::auto_categorization::cancel_auto_categorization,
        crate::handlers::import::validate_authenticated_transaction_import,
        crate::handlers::import::import_authenticated_transactions,
        crate::handlers::budget::get_authenticated_budgets,
        crate::handlers::budget::get_authenticated_budgets_overview,
        crate::handlers::budget::create_authenticated_budget,
        crate::handlers::budget::update_authenticated_budget,
        crate::handlers::budget::delete_authenticated_budget,
        crate::handlers::analytics::get_authenticated_current_month_spending,
        crate::handlers::analytics::get_authenticated_income_expense_totals,
        crate::handlers::analytics::get_authenticated_budget_summary,
        crate::handlers::analytics::get_authenticated_daily_spending,
        crate::handlers::analytics::get_authenticated_spending_by_date_range,
        crate::handlers::analytics::get_authenticated_category_spending,
        crate::handlers::analytics::get_authenticated_monthly_totals,
        crate::handlers::analytics::get_authenticated_date_bounds,
        crate::handlers::analytics::get_authenticated_cash_flow,
        crate::handlers::analytics::get_authenticated_top_merchants,
        crate::handlers::analytics::get_authenticated_sankey,
        crate::handlers::analytics::get_authenticated_balances_overview,
        crate::handlers::analytics::get_authenticated_net_worth_over_time,
        crate::handlers::provider::get_authenticated_provider_info,
        crate::handlers::provider::select_authenticated_provider,
        crate::handlers::diy::create_diy_institution,
        crate::handlers::diy::create_diy_account,
        crate::handlers::diy::disconnect_diy_institution,
        crate::handlers::provider::connect_authenticated_provider,
        crate::handlers::provider::get_authenticated_provider_status,
        crate::handlers::provider::get_authenticated_simplefin_ignored_institutions,
        crate::handlers::provider::restore_authenticated_simplefin_ignored_institution,
        crate::handlers::provider::sync_authenticated_provider_transactions,
        crate::handlers::provider::disconnect_authenticated_connection,
        crate::handlers::plaid::create_authenticated_link_token,
        crate::handlers::plaid::exchange_authenticated_public_token,
        crate::handlers::plaid::get_authenticated_plaid_accounts,
        crate::handlers::plaid::clear_authenticated_synced_data,
        crate::handlers::passkey::begin_passkey_enroll,
        crate::handlers::passkey::finish_passkey_enroll,
        crate::handlers::passkey::finish_passkey_registration,
        crate::handlers::passkey::list_user_passkeys,
        crate::handlers::passkey::delete_user_passkey,
        crate::handlers::auth::login_with_password,
        crate::handlers::passkey::begin_passkey_login,
        crate::handlers::passkey::finish_passkey_login,
    )
)]
pub struct ApiDoc;

pub fn init_openapi() -> utoipa::openapi::OpenApi {
    let _ = crate::models::provider_connect::provider_connect_request_example();
    let _ = crate::models::simplefin::simplefin_connect_request_example();
    let mut openapi = ApiDoc::openapi();
    tags::add_tags(&mut openapi);
    add_security_scheme(&mut openapi);
    openapi
}

fn add_security_scheme(openapi: &mut utoipa::openapi::OpenApi) {
    use utoipa::openapi::security::{ApiKey, ApiKeyValue, SecurityScheme};

    let components = openapi
        .components
        .get_or_insert_with(utoipa::openapi::Components::new);

    if !components.security_schemes.contains_key("auth_cookie") {
        let auth_cookie = SecurityScheme::ApiKey(ApiKey::Cookie(ApiKeyValue::with_description(
            "auth_token",
            "HttpOnly auth cookie issued by the authentication endpoints.",
        )));
        components.add_security_scheme("auth_cookie", auth_cookie);
    }
}
