use utoipa::openapi::OpenApi;

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
        utoipa::openapi::Tag::new(AUTH_TAG),
        utoipa::openapi::Tag::new(TRANSACTIONS_TAG),
        utoipa::openapi::Tag::new(PROVIDERS_TAG),
        utoipa::openapi::Tag::new(PLAID_TAG),
        utoipa::openapi::Tag::new(TELLER_TAG),
        utoipa::openapi::Tag::new(ANALYTICS_TAG),
        utoipa::openapi::Tag::new(BUDGETS_TAG),
        utoipa::openapi::Tag::new(HEALTH_TAG),
    ]);
}
