use crate::test_fixtures::TestFixtures;
use tower::ServiceExt;

#[tokio::test]
async fn given_valid_user_when_authentication_flow_then_returns_jwt() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();

    let auth_service = crate::services::auth_service::AuthService::new(
        "test_jwt_secret_key_for_integration_testing".to_string(),
    )
    .unwrap();
    let claims = auth_service.validate_token(&token).unwrap();

    assert_eq!(claims.user_id(), user.id.to_string());
}

#[tokio::test]
async fn given_test_app_when_health_check_then_returns_ok() {
    let app = TestFixtures::create_test_app().await.unwrap();

    let request = TestFixtures::create_get_request("/health");
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn given_authenticated_user_when_get_connection_status_then_returns_status() {
    let app = TestFixtures::create_test_app().await.unwrap();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();

    let request = TestFixtures::create_authenticated_get_request("/api/plaid/status", &token);
    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn given_no_auth_token_when_protected_endpoint_then_returns_unauthorized() {
    let app = TestFixtures::create_test_app().await.unwrap();

    let request = TestFixtures::create_get_request("/api/plaid/status");
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), 401);
}
