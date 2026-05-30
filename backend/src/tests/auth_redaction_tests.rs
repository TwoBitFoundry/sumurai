use crate::services::repository_service::MockDatabaseRepository;
use crate::test_fixtures::TestFixtures;
use axum::body::to_bytes;
use axum::extract::ConnectInfo;
use axum::http::{header::CONTENT_TYPE, Method, Request, StatusCode};
use serde_json::json;
use std::net::SocketAddr;
use tower::ServiceExt;

#[tokio::test]
async fn given_duplicate_email_when_register_then_returns_409_with_expected_message() {
    use crate::models::auth::User;
    use chrono::Utc;
    let mut mock_db = MockDatabaseRepository::new();
    mock_db.expect_get_user_by_email().returning(|email| {
        let existing = User {
            id: uuid::Uuid::new_v4(),
            email: email.to_string(),
            password_hash: None,
            provider: String::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            onboarding_completed: false,
        };
        Box::pin(async move { Ok(Some(existing)) })
    });

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();
    let addr: SocketAddr = "192.0.2.203:12345".parse().unwrap();

    let request_body = json!({
        "email": "existing@example.com",
        "name": "Existing User"
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/auth/register")
        .header(CONTENT_TYPE, "application/json")
        .extension(ConnectInfo(addr))
        .body(axum::body::Body::from(
            serde_json::to_string(&request_body).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::CONFLICT);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        payload.get("message").and_then(|value| value.as_str()),
        Some("Email address is already registered")
    );
}
