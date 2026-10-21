use axum::{
    body::to_bytes,
    http::{header::RETRY_AFTER, StatusCode},
    response::{Json, Response},
};
use serde_json::Value;

use crate::models::api_error::ApiErrorResponse;
use crate::models::domain_error::DomainError;
use crate::models::simplefin::SimpleFinInstitutionAuthRequired;
use crate::services::provider_orchestrator::{
    ProviderConnectOrchestrationError, ProviderSyncOrchestrationError,
};

fn notice(name: &str) -> SimpleFinInstitutionAuthRequired {
    SimpleFinInstitutionAuthRequired {
        institution_name: name.to_string(),
        org_conn_id: Some(format!("org-{name}")),
        message: "Re-authenticate".to_string(),
    }
}

#[tokio::test]
async fn given_quota_limited_when_rendering_sync_error_then_returns_429_with_retry_after() {
    let response: Response = ProviderSyncOrchestrationError::SyncQuotaLimited {
        retry_after_secs: 90,
    }
    .into();

    assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(response.headers().get(RETRY_AFTER).unwrap(), "90");
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["error"], "TOO_MANY_REQUESTS");
    assert_eq!(json["code"], "RATE_LIMITED");
}

#[tokio::test]
async fn given_domain_error_when_rendering_sync_error_then_returns_bare_status() {
    let response: Response =
        ProviderSyncOrchestrationError::Domain(DomainError::bad_request("Invalid client date"))
            .into();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert!(body.is_empty());
}

#[test]
fn given_single_notice_when_rendering_connect_error_then_names_institution() {
    let (status, Json(body)): (StatusCode, Json<ApiErrorResponse>) =
        ProviderConnectOrchestrationError::InstitutionsRequireAuth(vec![notice("Acme")]).into();

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body.error, "SIMPLEFIN_INSTITUTIONS_REQUIRE_AUTH");
    assert_eq!(body.code.as_deref(), Some("SIMPLEFIN_AUTH_REQUIRED"));
    assert_eq!(
        body.message,
        "Acme needs to be re-authenticated in your SimpleFIN dashboard before it can sync."
    );
    assert_eq!(body.details.unwrap().as_array().unwrap().len(), 1);
}

#[test]
fn given_multiple_notices_when_rendering_connect_error_then_uses_generic_message() {
    let (status, Json(body)): (StatusCode, Json<ApiErrorResponse>) =
        ProviderConnectOrchestrationError::InstitutionsRequireAuth(vec![
            notice("Acme"),
            notice("Globex"),
        ])
        .into();

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(
        body.message,
        "Some SimpleFIN institutions need to be re-authenticated in your SimpleFIN dashboard before they can sync."
    );
    assert_eq!(body.details.unwrap().as_array().unwrap().len(), 2);
}

#[test]
fn given_domain_error_with_error_name_when_rendering_connect_error_then_overrides_error_name() {
    let (status, Json(body)): (StatusCode, Json<ApiErrorResponse>) =
        ProviderConnectOrchestrationError::Domain(
            DomainError::unprocessable(
                "No institutions are available from your SimpleFIN bridge yet",
            )
            .with_error_name("NO_INSTITUTIONS"),
        )
        .into();

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body.error, "NO_INSTITUTIONS");
    assert_eq!(body.code, None);
}
