#![allow(dead_code)]

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[allow(unused_imports)]
use serde_json::json;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AutoCategorizationJobStatus {
    Running,
    Cancelling,
    Completed,
    Cancelled,
    Failed,
}

impl AutoCategorizationJobStatus {
    pub fn is_active(self) -> bool {
        matches!(self, Self::Running | Self::Cancelling)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[schema(example = json!({
    "job_id": "11111111-2222-3333-4444-555555555555",
    "status": "running",
    "total": 42,
    "processed": 10,
    "updated": 7,
    "skipped": 3,
    "started_at": "2024-01-01T12:00:00Z",
    "finished_at": null,
    "error_message": null
}))]
pub struct AutoCategorizationJobState {
    pub job_id: Uuid,
    pub status: AutoCategorizationJobStatus,
    pub total: i64,
    pub processed: i64,
    pub updated: i64,
    pub skipped: i64,
    pub started_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TransactionCategoryUpdate {
    pub transaction_id: Uuid,
    pub category_primary: String,
    pub category_detailed: String,
    pub category_confidence: String,
}
