use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::FromRow, ToSchema)]
pub struct Budget {
    pub id: Uuid,
    pub user_id: Uuid,
    pub category: String,
    #[schema(value_type = String)]
    pub amount: Decimal,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Budget {
    pub fn new(user_id: Uuid, category: String, amount: Decimal) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            user_id,
            category,
            amount,
            created_at: now,
            updated_at: now,
        }
    }
}

#[derive(Deserialize, ToSchema)]
pub struct CreateBudgetRequest {
    pub category: String,
    #[schema(value_type = String)]
    pub amount: rust_decimal::Decimal,
}

#[derive(Deserialize, ToSchema)]
pub struct UpdateBudgetRequest {
    #[schema(value_type = String)]
    pub amount: rust_decimal::Decimal,
}
