use axum::body::to_bytes;
use serde_json::json;
use tower::ServiceExt;
use uuid::Uuid;

use crate::models::plaid::ProviderConnection;
use crate::test_fixtures::TestFixtures;

#[tokio::test]
async fn given_authenticated_user_when_creating_diy_institution_then_persists_and_returns_connection_id(
) {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let mut mock_db = crate::services::repository_service::MockDatabaseRepository::new();

    crate::test_fixtures::apply_passkey_enrollment_mock_defaults(&mut mock_db);

    mock_db
        .expect_get_user_by_id()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let u = user.clone();
            Box::pin(async move { Ok(Some(u)) })
        });

    mock_db
        .expect_save_provider_connection()
        .returning(|_| Box::pin(async { Ok(Uuid::new_v4()) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/diy/institutions")
        .header("Cookie", format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({"name": "My Cash"})).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(
        payload["connection_id"].as_str().is_some(),
        "response should include connection_id"
    );
}

#[tokio::test]
async fn given_diy_connection_when_creating_account_then_persists_and_returns_account_id() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let connection_id = Uuid::new_v4();
    let mut mock_db = crate::services::repository_service::MockDatabaseRepository::new();

    crate::test_fixtures::apply_passkey_enrollment_mock_defaults(&mut mock_db);

    mock_db
        .expect_get_user_by_id()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let u = user.clone();
            Box::pin(async move { Ok(Some(u)) })
        });

    let mut diy_conn = ProviderConnection::new(user_id, &format!("diy_{}", Uuid::new_v4()));
    diy_conn.id = connection_id;
    diy_conn.provider = "diy".to_string();
    diy_conn.mark_connected("My Cash");

    mock_db
        .expect_get_provider_connection_by_id()
        .with(
            mockall::predicate::eq(connection_id),
            mockall::predicate::eq(user_id),
        )
        .returning(move |_, _| {
            let conn = diy_conn.clone();
            Box::pin(async move { Ok(Some(conn)) })
        });

    mock_db
        .expect_upsert_account()
        .returning(|_| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri(format!("/api/diy/institutions/{}/accounts", connection_id))
        .header("Cookie", format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({
                "name": "My Checking",
                "account_type": "checking"
            }))
            .unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(
        payload["id"].as_str().is_some(),
        "response should include id"
    );
    assert_eq!(payload["account_type"], json!("checking"));
}

#[tokio::test]
async fn given_non_diy_connection_when_creating_account_then_returns_forbidden() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let connection_id = Uuid::new_v4();
    let mut mock_db = crate::services::repository_service::MockDatabaseRepository::new();

    crate::test_fixtures::apply_passkey_enrollment_mock_defaults(&mut mock_db);

    mock_db
        .expect_get_user_by_id()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let u = user.clone();
            Box::pin(async move { Ok(Some(u)) })
        });

    let mut plaid_conn = ProviderConnection::new(user_id, "plaid_item_1");
    plaid_conn.id = connection_id;
    plaid_conn.provider = "plaid".to_string();
    plaid_conn.mark_connected("My Bank");

    mock_db
        .expect_get_provider_connection_by_id()
        .with(
            mockall::predicate::eq(connection_id),
            mockall::predicate::eq(user_id),
        )
        .returning(move |_, _| {
            let conn = plaid_conn.clone();
            Box::pin(async move { Ok(Some(conn)) })
        });

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri(format!("/api/diy/institutions/{}/accounts", connection_id))
        .header("Cookie", format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({
                "name": "My Checking",
                "account_type": "checking"
            }))
            .unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 403);
}

#[tokio::test]
async fn given_nonexistent_connection_when_creating_account_then_returns_not_found() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let connection_id = Uuid::new_v4();
    let mut mock_db = crate::services::repository_service::MockDatabaseRepository::new();

    crate::test_fixtures::apply_passkey_enrollment_mock_defaults(&mut mock_db);

    mock_db
        .expect_get_user_by_id()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let u = user.clone();
            Box::pin(async move { Ok(Some(u)) })
        });

    mock_db
        .expect_get_provider_connection_by_id()
        .with(
            mockall::predicate::eq(connection_id),
            mockall::predicate::eq(user_id),
        )
        .returning(|_, _| Box::pin(async { Ok(None) }));

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri(format!("/api/diy/institutions/{}/accounts", connection_id))
        .header("Cookie", format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({
                "name": "My Checking",
                "account_type": "checking"
            }))
            .unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 404);
}

#[tokio::test]
async fn given_authenticated_user_when_creating_institution_with_empty_name_then_returns_bad_request(
) {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let mut mock_db = crate::services::repository_service::MockDatabaseRepository::new();

    crate::test_fixtures::apply_passkey_enrollment_mock_defaults(&mut mock_db);

    mock_db
        .expect_get_user_by_id()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let u = user.clone();
            Box::pin(async move { Ok(Some(u)) })
        });

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/diy/institutions")
        .header("Cookie", format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({"name": ""})).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 400);
}

#[tokio::test]
async fn given_diy_connection_when_creating_account_with_invalid_type_then_returns_bad_request() {
    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let connection_id = Uuid::new_v4();
    let mut mock_db = crate::services::repository_service::MockDatabaseRepository::new();

    crate::test_fixtures::apply_passkey_enrollment_mock_defaults(&mut mock_db);

    mock_db
        .expect_get_user_by_id()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let u = user.clone();
            Box::pin(async move { Ok(Some(u)) })
        });

    let mut diy_conn = ProviderConnection::new(user_id, &format!("diy_{}", Uuid::new_v4()));
    diy_conn.id = connection_id;
    diy_conn.provider = "diy".to_string();
    diy_conn.mark_connected("My Cash");

    mock_db
        .expect_get_provider_connection_by_id()
        .with(
            mockall::predicate::eq(connection_id),
            mockall::predicate::eq(user_id),
        )
        .returning(move |_, _| {
            let conn = diy_conn.clone();
            Box::pin(async move { Ok(Some(conn)) })
        });

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri(format!("/api/diy/institutions/{}/accounts", connection_id))
        .header("Cookie", format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({
                "name": "My Account",
                "account_type": "investment"
            }))
            .unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 400);
}

#[tokio::test]
async fn given_unauthenticated_when_creating_institution_then_returns_unauthorized() {
    let mut mock_db = crate::services::repository_service::MockDatabaseRepository::new();
    crate::test_fixtures::apply_passkey_enrollment_mock_defaults(&mut mock_db);

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/api/diy/institutions")
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({"name": "My Cash"})).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 401);
}
