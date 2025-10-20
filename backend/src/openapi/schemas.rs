use utoipa::ToSchema;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, ToSchema, Clone)]
#[schema(example = json!({"error": "Unauthorized", "message": "Invalid credentials", "status_code": 401}))]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
    pub status_code: u16,
}

#[derive(Serialize, Deserialize, ToSchema)]
#[schema(example = json!({"message": "Operation completed successfully"}))]
pub struct SuccessResponse {
    pub message: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct HealthCheckResponse {
    pub status: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct DateRangeQueryParams {
    #[schema(value_type = Option<String>, example = "2024-01-01")]
    pub start_date: Option<String>,
    #[schema(value_type = Option<String>, example = "2024-12-31")]
    pub end_date: Option<String>,
    #[schema(value_type = Option<Vec<String>>)]
    pub account_ids: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct MonthlyTotalsQueryParams {
    #[schema(value_type = Option<u32>, example = 6)]
    pub months: Option<u32>,
    #[schema(value_type = Option<Vec<String>>)]
    pub account_ids: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct DailySpendingQueryParams {
    #[schema(value_type = Option<String>, example = "2024-01")]
    pub month: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct TransactionsQueryParams {
    #[schema(value_type = Option<String>, example = "coffee")]
    pub search: Option<String>,
    #[schema(value_type = Option<Vec<String>>)]
    pub account_ids: Option<Vec<String>>,
}
