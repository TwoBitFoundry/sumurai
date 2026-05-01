use crate::services::cache_service::MockCacheService;
use crate::services::repository_service::MockDatabaseRepository;
use crate::test_fixtures::TestFixtures;
use axum::body::{to_bytes, Body};
use axum::extract::ConnectInfo;
use axum::http::header::CONTENT_TYPE;
use axum::http::{Method, Request, StatusCode};
use serde_json::json;
use std::net::SocketAddr;
use tower::ServiceExt;

#[tokio::test]
async fn given_five_login_attempts_when_sixth_login_then_returns_429_with_retry_after() {
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_user_by_email()
        .returning(|_| Box::pin(async { Ok(None) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let addr: SocketAddr = "203.0.113.7:12345".parse().unwrap();
    let body_json = serde_json::to_string(&json!({
        "email": "nobody@example.com",
        "password": "wrong-password",
    }))
    .unwrap();

    for _ in 0..5 {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/api/auth/login")
                    .header(CONTENT_TYPE, "application/json")
                    .extension(ConnectInfo(addr))
                    .body(Body::from(body_json.clone()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_ne!(response.status(), StatusCode::TOO_MANY_REQUESTS);
    }

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/auth/login")
                .header(CONTENT_TYPE, "application/json")
                .extension(ConnectInfo(addr))
                .body(Body::from(body_json))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
    assert!(response.headers().get("retry-after").is_some());

    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(
        payload.get("error").and_then(|v| v.as_str()),
        Some("TOO_MANY_REQUESTS")
    );
}

#[tokio::test]
async fn given_five_register_attempts_when_sixth_register_then_returns_429_with_retry_after() {
    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_create_user()
        .returning(|_| Box::pin(async { Ok(()) }));

    let mut mock_cache = MockCacheService::new();
    mock_cache
        .expect_health_check()
        .returning(|| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    mock_cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_set_with_ttl()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_invalidate_pattern()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_set_session_valid()
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_set_jwt_token()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_is_auth_ip_banned()
        .times(0..)
        .returning(|_| Box::pin(async { Ok(false) }));
    mock_cache
        .expect_record_auth_rate_limit_exceeded()
        .times(0..)
        .returning(|_| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let addr: SocketAddr = "198.51.100.22:54321".parse().unwrap();

    for i in 0..5 {
        let body_json = serde_json::to_string(&json!({
            "email": format!("user{}@example.com", i),
            "password": "SecurePass123!",
        }))
        .unwrap();

        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/api/auth/register")
                    .header(CONTENT_TYPE, "application/json")
                    .extension(ConnectInfo(addr))
                    .body(Body::from(body_json))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_ne!(response.status(), StatusCode::TOO_MANY_REQUESTS);
    }

    let body_json = serde_json::to_string(&json!({
        "email": "user5@example.com",
        "password": "SecurePass123!",
    }))
    .unwrap();

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/auth/register")
                .header(CONTENT_TYPE, "application/json")
                .extension(ConnectInfo(addr))
                .body(Body::from(body_json))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
    assert!(response.headers().get("retry-after").is_some());
}
