pub mod schemas;
pub mod tags;

use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Sumurai Financial API",
        description = "Multi-tenant financial aggregation platform with unified Plaid and Teller integration",
        version = "1.0.0",
        contact(
            name = "Sumurai Support",
            url = "https://github.com/two-bit-foundry/sumurai"
        ),
        license(
            name = "MIT",
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
            crate::models::auth::LoginRequest,
            crate::models::auth::AuthResponse,
            crate::models::auth::ChangePasswordRequest,
            crate::models::auth::ChangePasswordResponse,
            crate::models::auth::DeleteAccountResponse,
            crate::models::auth::LogoutResponse,
            crate::models::auth::OnboardingCompleteResponse,
            crate::models::transaction::TransactionWithAccount,
            crate::models::analytics::MonthlySpending,
            crate::models::analytics::CategorySpending,
            crate::models::analytics::DailySpending,
            crate::models::analytics::TopMerchant,
            crate::models::analytics::BalancesOverviewResponse,
            crate::models::analytics::NetWorthOverTimeResponse,
            crate::models::budget::Budget,
            crate::models::budget::DeleteBudgetResponse,
            crate::models::plaid::LinkTokenRequest,
            crate::models::plaid::LinkTokenResponse,
            crate::models::plaid::ExchangeTokenRequest,
            crate::models::plaid::ProviderConnectRequest,
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
            crate::models::account::AccountResponse,
            crate::models::api_error::ApiErrorResponse,
            schemas::SuccessResponse,
            schemas::ErrorResponse,
            schemas::HealthCheckResponse,
            schemas::DateRangeQueryParams,
            schemas::MonthlyTotalsQueryParams,
            schemas::DailySpendingQueryParams,
            schemas::TransactionsQueryParams,
        )
    ),
    security(
        ("bearer_auth" = [])
    ),
    paths(
        crate::register_user,
        crate::login_user,
        crate::refresh_user_session,
        crate::logout_user,
        crate::change_user_password,
        crate::delete_user_account,
        crate::complete_user_onboarding,
        crate::health_check,
        crate::get_authenticated_transactions,
        crate::get_authenticated_budgets,
        crate::create_authenticated_budget,
        crate::update_authenticated_budget,
        crate::delete_authenticated_budget,
        crate::get_authenticated_current_month_spending,
        crate::get_authenticated_daily_spending,
        crate::get_authenticated_spending_by_date_range,
        crate::get_authenticated_category_spending,
        crate::get_authenticated_monthly_totals,
        crate::get_authenticated_top_merchants,
        crate::get_authenticated_balances_overview,
        crate::get_authenticated_net_worth_over_time,
        crate::get_authenticated_provider_info,
        crate::select_authenticated_provider,
        crate::connect_authenticated_provider,
        crate::get_authenticated_provider_status,
        crate::sync_authenticated_provider_transactions,
        crate::disconnect_authenticated_connection,
        crate::create_authenticated_link_token,
        crate::exchange_authenticated_public_token,
        crate::get_authenticated_plaid_accounts,
        crate::clear_authenticated_synced_data,
    )
)]
pub struct ApiDoc;

pub fn init_openapi() -> utoipa::openapi::OpenApi {
    let mut openapi = ApiDoc::openapi();
    tags::add_tags(&mut openapi);
    add_security_scheme(&mut openapi);
    openapi
}

fn add_security_scheme(openapi: &mut utoipa::openapi::OpenApi) {
    use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};

    let components = openapi
        .components
        .get_or_insert_with(utoipa::openapi::Components::new);

    if !components.security_schemes.contains_key("bearer_auth") {
        let bearer = SecurityScheme::Http(
            HttpBuilder::new()
                .scheme(HttpAuthScheme::Bearer)
                .bearer_format("JWT")
                .description(Some(
                    "Paste a valid JWT issued by the authentication endpoints.".to_string(),
                ))
                .build(),
        );
        components.add_security_scheme("bearer_auth", bearer);
    }
}
