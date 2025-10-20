use axum::{http::StatusCode, response::Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[allow(unused_imports)]
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[schema(example = json!({"error": "UNAUTHORIZED", "message": "Authentication required.", "code": "AUTH_REQUIRED", "details": null}))]
pub struct ApiErrorResponse {
    pub error: String,
    pub message: String,
    pub code: Option<String>,
    pub details: Option<serde_json::Value>,
}

impl ApiErrorResponse {
    pub fn new(error: &str, message: &str) -> Self {
        Self {
            error: error.to_string(),
            message: message.to_string(),
            code: None,
            details: None,
        }
    }

    pub fn with_code(error: &str, message: &str, code: &str) -> Self {
        Self {
            error: error.to_string(),
            message: message.to_string(),
            code: Some(code.to_string()),
            details: None,
        }
    }

    pub fn into_response(self, status: StatusCode) -> (StatusCode, Json<Self>) {
        (status, Json(self))
    }

    pub fn internal_server_error(message: &str) -> (StatusCode, Json<Self>) {
        Self::new("INTERNAL_SERVER_ERROR", message).into_response(StatusCode::INTERNAL_SERVER_ERROR)
    }

    pub fn unauthorized(message: &str) -> (StatusCode, Json<Self>) {
        Self::with_code("UNAUTHORIZED", message, "AUTH_REQUIRED")
            .into_response(StatusCode::UNAUTHORIZED)
    }

    pub fn conflict(message: &str) -> (StatusCode, Json<Self>) {
        Self::new("CONFLICT", message).into_response(StatusCode::CONFLICT)
    }
}
