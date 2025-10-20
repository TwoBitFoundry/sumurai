pub mod schemas;
pub mod tags;

use utoipa::OpenApi;
use crate::models::auth::{RegisterRequest, LoginRequest, AuthResponse, ChangePasswordRequest, ChangePasswordResponse, DeleteAccountResponse};
use crate::models::transaction::TransactionWithAccount;
use crate::models::analytics::{MonthlySpending, CategorySpending, DailySpending, TopMerchant, BalancesOverviewResponse, NetWorthOverTimeResponse};
use crate::models::budget::Budget;
use crate::models::plaid::{ProviderConnectionStatus, ProviderStatusResponse, ProviderConnectResponse, ExchangeTokenResponse, DisconnectResult};
use crate::models::account::AccountResponse;
use crate::models::api_error::ApiErrorResponse;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Sumaura Financial API",
        description = "Multi-tenant financial aggregation platform with unified Plaid and Teller integration",
        version = "1.0.0",
        contact(
            name = "Sumaura Support",
            url = "https://github.com/two-bit-foundry/sumaura"
        ),
        license(
            name = "MIT",
            url = "https://github.com/two-bit-foundry/sumaura/blob/main/LICENSE"
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
            RegisterRequest,
            LoginRequest,
            AuthResponse,
            ChangePasswordRequest,
            ChangePasswordResponse,
            DeleteAccountResponse,
            TransactionWithAccount,
            MonthlySpending,
            CategorySpending,
            DailySpending,
            TopMerchant,
            BalancesOverviewResponse,
            NetWorthOverTimeResponse,
            Budget,
            ProviderConnectionStatus,
            ProviderStatusResponse,
            ProviderConnectResponse,
            ExchangeTokenResponse,
            DisconnectResult,
            AccountResponse,
            ApiErrorResponse,
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
    openapi
}
