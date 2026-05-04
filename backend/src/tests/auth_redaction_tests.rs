use crate::services::repository_service::MockDatabaseRepository;
use crate::test_fixtures::TestFixtures;
use axum::body::to_bytes;
use axum::extract::ConnectInfo;
use axum::http::{header::CONTENT_TYPE, Method, Request, StatusCode};
use serde_json::json;
use std::net::SocketAddr;
use tower::ServiceExt;

#[tokio::test]
async fn given_missing_user_when_login_then_returns_401_with_expected_message() {
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_user_by_email()
        .returning(|_| Box::pin(async { Ok(None) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();
    let addr: SocketAddr = "192.0.2.201:12345".parse().unwrap();

    let request_body = json!({
        "email": "missing@example.com",
        "password": "SecurePass123!"
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/auth/login")
        .header(CONTENT_TYPE, "application/json")
        .extension(ConnectInfo(addr))
        .body(axum::body::Body::from(
            serde_json::to_string(&request_body).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        payload.get("error").and_then(|value| value.as_str()),
        Some("UNAUTHORIZED")
    );
    assert_eq!(
        payload.get("message").and_then(|value| value.as_str()),
        Some("Invalid email or password")
    );
}

#[tokio::test]
async fn given_invalid_password_when_login_then_returns_401_with_expected_message() {
    let mut mock_db = MockDatabaseRepository::new();
    let (user, _) = TestFixtures::create_authenticated_user_with_token();
    let expected_user = user.clone();

    mock_db
        .expect_get_user_by_email()
        .withf(move |email| email == "user@example.com")
        .returning(move |_| {
            let user = expected_user.clone();
            Box::pin(async move { Ok(Some(user)) })
        });

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();
    let addr: SocketAddr = "192.0.2.202:12345".parse().unwrap();

    let request_body = json!({
        "email": "user@example.com",
        "password": "wrong-password"
    });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/auth/login")
        .header(CONTENT_TYPE, "application/json")
        .extension(ConnectInfo(addr))
        .body(axum::body::Body::from(
            serde_json::to_string(&request_body).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        payload.get("message").and_then(|value| value.as_str()),
        Some("Invalid email or password")
    );
}

#[tokio::test]
async fn given_duplicate_email_when_register_then_returns_409_with_expected_message() {
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_create_user()
        .returning(|_| Box::pin(async { Err(anyhow::anyhow!("duplicate key")) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();
    let addr: SocketAddr = "192.0.2.203:12345".parse().unwrap();

    let request_body = json!({
        "email": "existing@example.com",
        "password": "SecurePass123!"
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
