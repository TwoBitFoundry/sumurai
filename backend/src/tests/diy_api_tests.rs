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
        .expect_get_all_provider_connections_by_user()
        .with(mockall::predicate::eq(user_id))
        .returning(|_| Box::pin(async { Ok(vec![]) }));

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
async fn given_existing_institution_name_when_creating_diy_institution_then_returns_conflict() {
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

    let mut existing_conn = ProviderConnection::new(user_id, &format!("diy_{}", Uuid::new_v4()));
    existing_conn.provider = "diy".to_string();
    existing_conn.mark_connected("My Cash");

    mock_db
        .expect_get_all_provider_connections_by_user()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let conn = existing_conn.clone();
            Box::pin(async move { Ok(vec![conn]) })
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
            serde_json::to_string(&json!({"name": "my cash"})).unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 409);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload["error"], json!("CONFLICT"));
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
        .expect_get_accounts_for_user()
        .with(mockall::predicate::eq(user_id))
        .returning(|_| Box::pin(async { Ok(vec![]) }));

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
                "account_type": "checking",
                "balance": "1000.00"
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
async fn given_existing_account_name_when_creating_diy_account_then_returns_conflict() {
    use crate::models::account::Account;

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

    let existing_account = Account {
        id: Uuid::new_v4(),
        user_id: Some(user_id),
        provider_account_id: Some("diy_existing".to_string()),
        provider_connection_id: Some(connection_id),
        name: "My Checking".to_string(),
        account_type: "checking".to_string(),
        balance_current: None,
        mask: Some("1234".to_string()),
        institution_name: Some("My Cash".to_string()),
        provider_conn_id: None,
    };

    mock_db
        .expect_get_accounts_for_user()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let account = existing_account.clone();
            Box::pin(async move { Ok(vec![account]) })
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
                "name": "my checking",
                "account_type": "checking",
                "mask": "5678",
                "balance": "1000.00"
            }))
            .unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 409);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload["error"], json!("CONFLICT"));
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
                "account_type": "checking",
                "balance": "1000.00"
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
                "account_type": "checking",
                "balance": "1000.00"
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
async fn given_diy_connection_when_creating_account_without_balance_then_returns_bad_request() {
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
                "name": "My Checking",
                "account_type": "checking"
            }))
            .unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 400);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload["error"], json!("BAD_REQUEST"));
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
                "account_type": "investment",
                "balance": "1000.00"
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

#[tokio::test]
async fn given_diy_institution_when_disconnecting_then_cascades_records_and_clears_cache() {
    use crate::services::cache_service::MockCacheService;
    use crate::services::repository_service::MockDatabaseRepository;

    let (user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = user.id;
    let connection_id = Uuid::new_v4();
    let mut mock_db = MockDatabaseRepository::new();
    let mut mock_cache = MockCacheService::new();

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
        .times(1)
        .returning(move |_, _| {
            let conn = diy_conn.clone();
            Box::pin(async move { Ok(Some(conn)) })
        });

    mock_db
        .expect_disconnect_provider_connection_cascade()
        .with(
            mockall::predicate::eq(user_id),
            mockall::predicate::function(|item_id: &str| item_id.starts_with("diy_")),
        )
        .times(1)
        .returning(|_, _| Box::pin(async { Ok((3, 2)) }));

    mock_db
        .expect_get_all_provider_connections_by_user()
        .with(mockall::predicate::eq(user_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_update_user_provider()
        .with(mockall::predicate::eq(user_id), mockall::predicate::eq(""))
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_health_check()
        .returning(|| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    mock_cache
        .expect_delete_access_token()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_invalidate_pattern()
        .times(2)
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_clear_jwt_scoped_bank_connection_cache()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db_and_cache(mock_db, mock_cache)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(axum::http::Method::DELETE)
        .uri(format!("/api/diy/institutions/{}", connection_id))
        .header("Cookie", format!("auth_token={}", token))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload["success"], json!(true));
    assert_eq!(payload["data_cleared"]["transactions"], json!(3));
    assert_eq!(payload["data_cleared"]["accounts"], json!(2));
}

#[tokio::test]
async fn given_plaid_connection_when_disconnecting_diy_endpoint_then_returns_forbidden() {
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

    let mut plaid_conn = ProviderConnection::new(user_id, "item_plaid");
    plaid_conn.id = connection_id;
    plaid_conn.provider = "plaid".to_string();
    plaid_conn.mark_connected("Chase");

    mock_db
        .expect_get_provider_connection_by_id()
        .with(
            mockall::predicate::eq(connection_id),
            mockall::predicate::eq(user_id),
        )
        .times(1)
        .returning(move |_, _| {
            let conn = plaid_conn.clone();
            Box::pin(async move { Ok(Some(conn)) })
        });

    let app = TestFixtures::create_test_app_with_db(mock_db)
        .await
        .unwrap();

    let request = axum::http::Request::builder()
        .method(axum::http::Method::DELETE)
        .uri(format!("/api/diy/institutions/{}", connection_id))
        .header("Cookie", format!("auth_token={}", token))
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 403);
}
