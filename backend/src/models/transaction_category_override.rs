#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TransactionCategoryOverride {
    pub id: Uuid,
    pub user_id: Uuid,
    pub normalized_merchant: String,
    pub category_name: String,
    pub custom_category_id: Option<Uuid>,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SetTransactionCategoryRequest {
    pub category_name: String,
    pub is_custom: bool,
}
