use axum::{http::StatusCode, response::Json, response::Response};

use crate::models::api_error::ApiErrorResponse;
use crate::models::domain_error::{DomainError, ErrorKind};

fn body_of(error: DomainError) -> (StatusCode, ApiErrorResponse) {
    let (status, Json(body)): (StatusCode, Json<ApiErrorResponse>) = error.into();
    (status, body)
}

#[test]
fn given_each_error_kind_when_mapping_to_status_then_uses_matching_http_status() {
    let cases = [
        (DomainError::bad_request("x"), StatusCode::BAD_REQUEST),
        (DomainError::unauthorized("x"), StatusCode::UNAUTHORIZED),
        (DomainError::forbidden("x"), StatusCode::FORBIDDEN),
        (DomainError::not_found("x"), StatusCode::NOT_FOUND),
        (DomainError::conflict("x"), StatusCode::CONFLICT),
        (
            DomainError::unprocessable("x"),
            StatusCode::UNPROCESSABLE_ENTITY,
        ),
        (
            DomainError::failed_dependency("x"),
            StatusCode::FAILED_DEPENDENCY,
        ),
        (
            DomainError::internal("x"),
            StatusCode::INTERNAL_SERVER_ERROR,
        ),
    ];

    for (error, expected) in cases {
        let status: StatusCode = error.into();
        assert_eq!(status, expected);
    }
}

#[test]
fn given_not_found_error_when_mapping_to_body_then_uses_default_error_name_and_message() {
    let (status, body) = body_of(DomainError::not_found("Budget not found"));

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body, ApiErrorResponse::new("NOT_FOUND", "Budget not found"));
}

#[test]
fn given_error_with_code_and_name_override_when_mapping_to_body_then_includes_both() {
    let (status, body) = body_of(
        DomainError::unauthorized("Invalid email or password")
            .with_code("AUTH_REQUIRED")
            .with_error_name("UNAUTHORIZED"),
    );

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(
        body,
        ApiErrorResponse::with_code("UNAUTHORIZED", "Invalid email or password", "AUTH_REQUIRED")
    );
}

#[test]
fn given_internal_error_when_converting_to_response_then_status_is_500() {
    let response: Response = DomainError::internal("Failed to fetch budgets").into();

    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
}

#[test]
fn given_kind_when_asking_default_name_then_matches_api_error_vocabulary() {
    assert_eq!(
        ErrorKind::FailedDependency.default_error_name(),
        "FAILED_DEPENDENCY"
    );
    assert_eq!(
        ErrorKind::Internal.default_error_name(),
        "INTERNAL_SERVER_ERROR"
    );
}
