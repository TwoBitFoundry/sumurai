use serde::Deserialize;

#[derive(Deserialize)]
pub struct DailySpendingQuery {
    pub month: Option<String>, // Format: YYYY-MM
}
