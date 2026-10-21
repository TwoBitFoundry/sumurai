use axum::{
    http::StatusCode,
    response::{IntoResponse, Json, Response},
};

use crate::models::api_error::ApiErrorResponse;
use crate::models::domain_error::{DomainError, ErrorKind};

pub fn status_for(kind: ErrorKind) -> StatusCode {
    match kind {
        ErrorKind::BadRequest => StatusCode::BAD_REQUEST,
        ErrorKind::Unauthorized => StatusCode::UNAUTHORIZED,
        ErrorKind::Forbidden => StatusCode::FORBIDDEN,
        ErrorKind::NotFound => StatusCode::NOT_FOUND,
        ErrorKind::Conflict => StatusCode::CONFLICT,
        ErrorKind::UnprocessableEntity => StatusCode::UNPROCESSABLE_ENTITY,
        ErrorKind::FailedDependency => StatusCode::FAILED_DEPENDENCY,
        ErrorKind::Internal => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

impl From<DomainError> for StatusCode {
    fn from(error: DomainError) -> Self {
        status_for(error.kind)
    }
}

impl From<DomainError> for (StatusCode, Json<ApiErrorResponse>) {
    fn from(error: DomainError) -> Self {
        let status = status_for(error.kind);
        let body = match error.code {
            Some(code) => ApiErrorResponse::with_code(error.error_name(), &error.message, code),
            None => ApiErrorResponse::new(error.error_name(), &error.message),
        };
        body.into_response(status)
    }
}

impl From<DomainError> for Response {
    fn from(error: DomainError) -> Self {
        let tuple: (StatusCode, Json<ApiErrorResponse>) = error.into();
        tuple.into_response()
    }
}
