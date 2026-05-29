#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CustomCategory {
    pub id: Uuid,
    pub user_id: Uuid,
    pub display_name: String,
    pub lookup_key: String,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CategoryListResponse {
    pub system: Vec<String>,
    pub custom: Vec<CustomCategory>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateCustomCategoryRequest {
    pub name: String,
}

#[derive(Debug, PartialEq)]
pub enum CustomCategoryError {
    NameTooLong,
    TooManyWords,
    EmptyName,
    InvalidCharacters,
    CollidesWithSystemCategory,
    CollidesWithExistingCustom,
}
