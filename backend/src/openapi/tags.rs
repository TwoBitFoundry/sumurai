use utoipa::openapi::{self, OpenApi};

pub const AUTH_TAG: &str = "Authentication";
pub const TRANSACTIONS_TAG: &str = "Transactions";
pub const PROVIDERS_TAG: &str = "Financial Providers";
pub const PLAID_TAG: &str = "Plaid";
pub const TELLER_TAG: &str = "Teller";
pub const ANALYTICS_TAG: &str = "Analytics";
pub const BUDGETS_TAG: &str = "Budgets";
pub const HEALTH_TAG: &str = "Health";

pub fn add_tags(openapi: &mut OpenApi) {
    openapi.tags = Some(vec![
        openapi::tag::TagBuilder::new()
            .name(AUTH_TAG)
            .description(Some("Session lifecycle endpoints covering registration, login, refresh, and logout flows."))
            .build(),
        openapi::tag::TagBuilder::new()
            .name(TRANSACTIONS_TAG)
            .description(Some("Transaction APIs that power search, filtering, and sync of user financial activity."))
            .build(),
        openapi::tag::TagBuilder::new()
            .name(PROVIDERS_TAG)
            .description(Some("Provider-agnostic endpoints for selecting, connecting, and managing financial data sources."))
            .build(),
        openapi::tag::TagBuilder::new()
            .name(PLAID_TAG)
            .description(Some("Plaid-specific endpoints for link token creation, token exchange, and account retrieval."))
            .build(),
        openapi::tag::TagBuilder::new()
            .name(TELLER_TAG)
            .description(Some("Reserved for Teller Connect operations when expanded beyond provider selection flows."))
            .build(),
        openapi::tag::TagBuilder::new()
            .name(ANALYTICS_TAG)
            .description(Some("Analytics endpoints delivering spend breakdowns, trends, balances, and net worth insights."))
            .build(),
        openapi::tag::TagBuilder::new()
            .name(BUDGETS_TAG)
            .description(Some("Budget management APIs for CRUD operations tied to user-defined spending targets."))
            .build(),
        openapi::tag::TagBuilder::new()
            .name(HEALTH_TAG)
            .description(Some("Service health diagnostics for readiness and uptime monitoring."))
            .build(),
    ]);
}
