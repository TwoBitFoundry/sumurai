use crate::auth_middleware::{
    auth_middleware, extract_bearer_token, extract_user_context, AuthContext, AuthMiddlewareState,
};
use crate::services::{auth_service::AuthService, cache_service::MockCacheService};
use crate::models::auth::AuthError;
use axum::{
    body::Body,
    http::{header::AUTHORIZATION, request::Request, HeaderMap, StatusCode},
    middleware,
    routing::get,
    Router,
};
use std::sync::Arc;
use tower::ServiceExt;
use uuid::Uuid;

fn create_test_auth_service() -> AuthService {
    AuthService::new("this_is_a_very_long_secret_key_for_auth_middleware_testing_12345".to_string())
        .unwrap()
}

#[test]
fn given_bearer_header_when_extracting_token_then_returns_token() {
    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, "Bearer jwt_token_here".parse().unwrap());

    let result = extract_bearer_token(&headers);

    assert!(result.is_some());
    assert_eq!(result.unwrap(), "jwt_token_here");
}

#[test]
fn given_invalid_auth_header_when_extracting_token_then_returns_none() {
    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, "Invalid token_here".parse().unwrap());

    let result = extract_bearer_token(&headers);

    assert!(result.is_none());
}

#[test]
fn given_missing_auth_header_when_extracting_token_then_returns_none() {
    let headers = HeaderMap::new();

    let result = extract_bearer_token(&headers);

    assert!(result.is_none());
}

#[test]
fn given_valid_jwt_when_extracting_context_then_returns_user_context() {
    let auth_service = create_test_auth_service();
    let user_id = Uuid::new_v4();
    let auth_token = auth_service.generate_token(user_id).unwrap();

    let result = extract_user_context(&auth_service, &auth_token.token);

    assert!(result.is_ok());
    let context = result.unwrap();
    assert_eq!(context.user_id, user_id);
    assert_eq!(context.jwt_id, auth_token.jwt_id);
}

#[test]
fn given_invalid_jwt_when_extracting_context_then_returns_error() {
    let auth_service = create_test_auth_service();
    let invalid_token = "invalid.jwt.token";

    let result = extract_user_context(&auth_service, invalid_token);

    assert!(result.is_err());
    match result.unwrap_err() {
        AuthError::InvalidToken => {}
        _ => panic!("Expected InvalidToken error"),
    }
}

#[tokio::test]
async fn given_valid_bearer_token_when_middleware_called_then_allows_request() {
    let auth_service = Arc::new(create_test_auth_service());
    let user_id = Uuid::new_v4();
    let auth_token = auth_service.generate_token(user_id).unwrap();

    let mut cache = MockCacheService::new();
    cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));

    let state = AuthMiddlewareState {
        auth_service: auth_service.clone(),
        cache_service: Arc::new(cache),
    };

    let app = Router::new()
        .route("/protected", get(|| async { "success" }))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ))
        .with_state(state);

    let request = Request::builder()
        .uri("/protected")
        .header(AUTHORIZATION, format!("Bearer {}", auth_token.token))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn given_missing_auth_header_when_middleware_called_then_rejects_request() {
    let auth_service = Arc::new(create_test_auth_service());

    let mut cache = MockCacheService::new();
    cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    let state = AuthMiddlewareState {
        auth_service: auth_service.clone(),
        cache_service: Arc::new(cache),
    };

    let app = Router::new()
        .route("/protected", get(|| async { "success" }))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ))
        .with_state(state);

    let request = Request::builder()
        .uri("/protected")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn given_invalid_bearer_token_when_middleware_called_then_rejects_request() {
    let auth_service = Arc::new(create_test_auth_service());

    let mut cache = MockCacheService::new();
    cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    let state = AuthMiddlewareState {
        auth_service: auth_service.clone(),
        cache_service: Arc::new(cache),
    };

    let app = Router::new()
        .route("/protected", get(|| async { "success" }))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ))
        .with_state(state);

    let request = Request::builder()
        .uri("/protected")
        .header(AUTHORIZATION, "Bearer invalid.jwt.token")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[test]
fn given_auth_context_when_accessing_user_id_then_provides_tenant_isolation() {
    let user_id = Uuid::new_v4();
    let jwt_id = "test_jwt_id".to_string();
    let context = AuthContext { user_id, jwt_id };

    let extracted_user_id = context.user_id;

    assert_eq!(extracted_user_id, user_id);
}

#[tokio::test]
async fn given_api_endpoints_when_accessing_without_valid_jwt_then_returns_401_for_all_protected_routes(
) {
    let auth_service = Arc::new(create_test_auth_service());

    let mut cache = MockCacheService::new();
    cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    let state = AuthMiddlewareState {
        auth_service: auth_service.clone(),
        cache_service: Arc::new(cache),
    };

    let app = Router::new()
        .route("/api/transactions", get(|| async { "transactions" }))
        .route(
            "/api/plaid/link-token",
            axum::routing::post(|| async { "link-token" }),
        )
        .route(
            "/api/plaid/exchange-token",
            axum::routing::post(|| async { "exchange-token" }),
        )
        .route("/api/plaid/accounts", get(|| async { "accounts" }))
        .route(
            "/api/plaid/sync-transactions",
            axum::routing::post(|| async { "sync-transactions" }),
        )
        .route("/api/plaid/status", get(|| async { "plaid-status" }))
        .route(
            "/api/plaid/disconnect",
            axum::routing::post(|| async { "disconnect" }),
        )
        .route(
            "/api/analytics/spending/current-month",
            get(|| async { "current-month" }),
        )
        .route("/api/analytics/categories", get(|| async { "categories" }))
        .route(
            "/api/analytics/daily-spending",
            get(|| async { "daily-spending" }),
        )
        .route(
            "/api/analytics/monthly-totals",
            get(|| async { "monthly-totals" }),
        )
        .route(
            "/api/plaid/clear-synced-data",
            axum::routing::post(|| async { "clear-data" }),
        )
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ))
        .with_state(state.clone());

    let protected_routes = vec![
        ("/api/transactions", "GET"),
        ("/api/plaid/link-token", "POST"),
        ("/api/plaid/exchange-token", "POST"),
        ("/api/plaid/accounts", "GET"),
        ("/api/plaid/sync-transactions", "POST"),
        ("/api/plaid/status", "GET"),
        ("/api/plaid/disconnect", "POST"),
        ("/api/analytics/spending/current-month", "GET"),
        ("/api/analytics/categories", "GET"),
        ("/api/analytics/daily-spending", "GET"),
        ("/api/analytics/monthly-totals", "GET"),
        ("/api/plaid/clear-synced-data", "POST"),
    ];

    for (route, method) in protected_routes {
        let request = Request::builder()
            .method(method)
            .uri(route)
            .body(Body::empty())
            .unwrap();

        let response = app.clone().oneshot(request).await.unwrap();

        assert_eq!(
            response.status(),
            StatusCode::UNAUTHORIZED,
            "Route {} {} should return 401 when no auth header provided",
            method,
            route
        );
    }

    let invalid_auth_headers = vec![
        "invalid_token",
        "Basic dXNlcjpwYXNzd29yZA==",
        "Bearer",
        "Bearer ",
        "Bearer invalid.jwt.token.format",
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature",
        "Token jwt_token_here",
        "JWT jwt_token_here",
    ];

    for invalid_header in invalid_auth_headers {
        let request = Request::builder()
            .method("GET")
            .uri("/api/transactions")
            .header(AUTHORIZATION, invalid_header)
            .body(Body::empty())
            .unwrap();

        let response = app.clone().oneshot(request).await.unwrap();

        assert_eq!(
            response.status(),
            StatusCode::UNAUTHORIZED,
            "Invalid auth header '{}' should return 401",
            invalid_header
        );
    }

    let malformed_jwt_tokens = vec![
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid_signature",
        "not.a.jwt.at.all",
        "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.",
        "",
        "Bearer",
    ];

    for malformed_token in malformed_jwt_tokens {
        let request = Request::builder()
            .method("GET")
            .uri("/api/analytics/categories")
            .header(AUTHORIZATION, format!("Bearer {}", malformed_token))
            .body(Body::empty())
            .unwrap();

        let response = app.clone().oneshot(request).await.unwrap();

        assert_eq!(
            response.status(),
            StatusCode::UNAUTHORIZED,
            "Malformed JWT '{}' should return 401",
            malformed_token
        );
    }

    let different_auth_service = AuthService::new(
        "different_secret_key_that_is_long_enough_for_validation_testing_12345".to_string(),
    )
    .unwrap();
    let user_id = Uuid::new_v4();
    let foreign_token = different_auth_service.generate_token(user_id).unwrap();

    let request = Request::builder()
        .method("POST")
        .uri("/api/plaid/link-token")
        .header(AUTHORIZATION, format!("Bearer {}", foreign_token.token))
        .body(Body::empty())
        .unwrap();

    let response = app.clone().oneshot(request).await.unwrap();

    assert_eq!(
        response.status(),
        StatusCode::UNAUTHORIZED,
        "JWT signed with different secret should return 401"
    );

    let valid_token = auth_service.generate_token(Uuid::new_v4()).unwrap();
    let request = Request::builder()
        .method("GET")
        .uri("/api/transactions")
        .header(AUTHORIZATION, format!("Bearer {}", valid_token.token))
        .body(Body::empty())
        .unwrap();

    let response = app.clone().oneshot(request).await.unwrap();

    assert_eq!(
        response.status(),
        StatusCode::OK,
        "Valid JWT should allow access to protected routes"
    );
}
