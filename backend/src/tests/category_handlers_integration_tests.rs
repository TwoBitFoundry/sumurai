use crate::models::custom_category::{CategoryListResponse, CustomCategory};
use crate::models::transaction::Transaction;
use crate::models::transaction_category_override::TransactionCategoryOverride;
use crate::services::repository_service::MockDatabaseRepository;
use crate::test_fixtures::TestFixtures;
use axum::http::StatusCode;
use chrono::{NaiveDate, Utc};
use rust_decimal_macros::dec;
use serde_json::json;
use tower::ServiceExt;
use uuid::Uuid;

fn make_custom_category(user_id: Uuid, display_name: &str, lookup_key: &str) -> CustomCategory {
    CustomCategory {
        id: Uuid::new_v4(),
        user_id,
        display_name: display_name.to_string(),
        lookup_key: lookup_key.to_string(),
        created_at: Some(Utc::now()),
        updated_at: Some(Utc::now()),
    }
}

fn make_transaction(
    user_id: Uuid,
    category_primary: &str,
    merchant_name: Option<&str>,
) -> Transaction {
    Transaction {
        id: Uuid::new_v4(),
        account_id: Uuid::new_v4(),
        user_id: Some(user_id),
        provider_account_id: None,
        provider_transaction_id: Some("txn-001".to_string()),
        amount: dec!(-10.00),
        date: NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
        merchant_name: merchant_name.map(str::to_string),
        category_primary: category_primary.to_string(),
        category_detailed: category_primary.to_string(),
        category_confidence: "HIGH".to_string(),
        payment_channel: None,
        pending: false,
        created_at: None,
    }
}

fn make_override(
    user_id: Uuid,
    normalized_merchant: &str,
    category_name: &str,
    custom_category_id: Option<Uuid>,
) -> TransactionCategoryOverride {
    TransactionCategoryOverride {
        id: Uuid::new_v4(),
        user_id,
        normalized_merchant: normalized_merchant.to_string(),
        category_name: category_name.to_string(),
        custom_category_id,
        created_at: Some(Utc::now()),
        updated_at: Some(Utc::now()),
    }
}

#[tokio::test]
async fn given_authenticated_user_when_list_categories_then_returns_merged_system_and_custom() {
    let user_id = Uuid::new_v4();
    let mut repo = MockDatabaseRepository::new();

    let custom_cat = make_custom_category(user_id, "Coffee", "coffee");
    repo.expect_list_custom_categories_for_user()
        .times(1)
        .returning(move |_| {
            let cat = custom_cat.clone();
            Box::pin(async move { Ok(vec![cat]) })
        });

    let app = TestFixtures::create_test_app_with_db(repo).await.unwrap();
    let (_, token) = TestFixtures::create_authenticated_user_with_token();

    let request = TestFixtures::create_authenticated_get_request("/api/categories", &token);
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let data: CategoryListResponse = serde_json::from_slice(&body).unwrap();
    assert!(!data.system.is_empty());
    assert_eq!(data.custom.len(), 1);
    assert_eq!(data.custom[0].display_name, "Coffee");
}

#[tokio::test]
async fn given_authenticated_user_with_empty_custom_when_list_categories_then_returns_system_only()
{
    let _user_id = Uuid::new_v4();
    let mut repo = MockDatabaseRepository::new();

    repo.expect_list_custom_categories_for_user()
        .times(1)
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(repo).await.unwrap();
    let (_, token) = TestFixtures::create_authenticated_user_with_token();

    let request = TestFixtures::create_authenticated_get_request("/api/categories", &token);
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let data: CategoryListResponse = serde_json::from_slice(&body).unwrap();
    assert!(!data.system.is_empty());
    assert!(data.custom.is_empty());
}

#[tokio::test]
async fn given_valid_name_when_create_custom_category_then_returns_created_category() {
    let user_id = Uuid::new_v4();
    let mut repo = MockDatabaseRepository::new();

    let expected_cat = make_custom_category(user_id, "Coffee Runs", "coffee run");
    let expected_clone = expected_cat.clone();

    repo.expect_list_custom_categories_for_user()
        .times(1)
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    repo.expect_create_custom_category()
        .withf(|_, display_name, lookup_key| {
            display_name == "Coffee Runs" && lookup_key == "coffee run"
        })
        .times(1)
        .returning(move |_, _, _| {
            let cat = expected_clone.clone();
            Box::pin(async move { Ok(cat) })
        });

    let app = TestFixtures::create_test_app_with_db(repo).await.unwrap();
    let (_, token) = TestFixtures::create_authenticated_user_with_token();

    let req = TestFixtures::create_authenticated_post_request(
        "/api/categories/custom",
        &token,
        json!({ "name": "Coffee Runs" }),
    );
    let response = app.oneshot(req).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let data: CustomCategory = serde_json::from_slice(&body).unwrap();
    assert_eq!(data.display_name, "Coffee Runs");
    assert_eq!(data.lookup_key, "coffee run");
}

#[tokio::test]
async fn given_empty_name_when_create_custom_category_then_returns_400_with_error_code() {
    let _user_id = Uuid::new_v4();
    let mut repo = MockDatabaseRepository::new();

    repo.expect_list_custom_categories_for_user().times(0);

    let app = TestFixtures::create_test_app_with_db(repo).await.unwrap();
    let (_, token) = TestFixtures::create_authenticated_user_with_token();

    let request = TestFixtures::create_authenticated_post_request(
        "/api/categories/custom",
        &token,
        json!({ "name": "   " }),
    );
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let data: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        data.get("code").and_then(|v| v.as_str()),
        Some("empty_name")
    );
}

#[tokio::test]
async fn given_name_with_digits_when_create_custom_category_then_returns_400_with_error_code() {
    let _user_id = Uuid::new_v4();
    let mut repo = MockDatabaseRepository::new();

    repo.expect_list_custom_categories_for_user().times(0);

    let app = TestFixtures::create_test_app_with_db(repo).await.unwrap();
    let (_, token) = TestFixtures::create_authenticated_user_with_token();

    let request = TestFixtures::create_authenticated_post_request(
        "/api/categories/custom",
        &token,
        json!({ "name": "Coffee 1" }),
    );
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let data: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        data.get("code").and_then(|v| v.as_str()),
        Some("invalid_characters")
    );
}

#[tokio::test]
async fn given_four_word_name_when_create_custom_category_then_returns_400_with_error_code() {
    let _user_id = Uuid::new_v4();
    let mut repo = MockDatabaseRepository::new();

    repo.expect_list_custom_categories_for_user().times(0);

    let app = TestFixtures::create_test_app_with_db(repo).await.unwrap();
    let (_, token) = TestFixtures::create_authenticated_user_with_token();

    let request = TestFixtures::create_authenticated_post_request(
        "/api/categories/custom",
        &token,
        json!({ "name": "one two three four" }),
    );
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let data: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        data.get("code").and_then(|v| v.as_str()),
        Some("too_many_words")
    );
}

#[tokio::test]
async fn given_repository_failure_when_create_custom_category_then_returns_500() {
    let _user_id = Uuid::new_v4();
    let mut repo = MockDatabaseRepository::new();

    repo.expect_list_custom_categories_for_user()
        .times(1)
        .returning(|_| Box::pin(async { Err(anyhow::anyhow!("db unavailable")) }));

    let app = TestFixtures::create_test_app_with_db(repo).await.unwrap();
    let (_, token) = TestFixtures::create_authenticated_user_with_token();

    let request = TestFixtures::create_authenticated_post_request(
        "/api/categories/custom",
        &token,
        json!({ "name": "Coffee" }),
    );
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
}

#[tokio::test]
async fn given_name_colliding_with_system_when_create_custom_category_then_returns_400_with_error_code(
) {
    let _user_id = Uuid::new_v4();
    let mut repo = MockDatabaseRepository::new();

    repo.expect_list_custom_categories_for_user().times(0);

    let app = TestFixtures::create_test_app_with_db(repo).await.unwrap();
    let (_, token) = TestFixtures::create_authenticated_user_with_token();

    let request = TestFixtures::create_authenticated_post_request(
        "/api/categories/custom",
        &token,
        json!({ "name": "Food and Drink" }),
    );
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let data: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        data.get("code").and_then(|v| v.as_str()),
        Some("collides_with_system_category")
    );
}

#[tokio::test]
async fn given_foreign_custom_category_when_delete_then_returns_204() {
    let _user_id = Uuid::new_v4();
    let foreign_id = Uuid::new_v4();
    let mut repo = MockDatabaseRepository::new();

    repo.expect_delete_custom_category()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db(repo).await.unwrap();
    let (_, token) = TestFixtures::create_authenticated_user_with_token();

    let request = TestFixtures::create_authenticated_request(
        axum::http::Method::DELETE,
        &format!("/api/categories/custom/{}", foreign_id),
        &token,
    );
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn given_different_category_when_set_transaction_category_then_returns_override() {
    let user_id = Uuid::new_v4();
    let txn_id = Uuid::new_v4();
    let mut repo = MockDatabaseRepository::new();

    let txn = make_transaction(user_id, "FOOD_AND_DRINK", Some("Netflix.Com"));

    repo.expect_get_transaction_by_id_for_user()
        .times(1)
        .returning(move |_, _| {
            let t = txn.clone();
            Box::pin(async move { Ok(Some(t)) })
        });

    let override_row = make_override(user_id, "netflixcom", "ENTERTAINMENT", None);
    let override_clone = override_row.clone();

    repo.expect_upsert_transaction_category_override()
        .withf(|_, norm, cat, cid| norm == "netflixcom" && cat == "ENTERTAINMENT" && cid.is_none())
        .times(1)
        .returning(move |_, _, _, _| {
            let o = override_clone.clone();
            Box::pin(async move { Ok(o) })
        });

    let app = TestFixtures::create_test_app_with_db(repo).await.unwrap();
    let (_, token) = TestFixtures::create_authenticated_user_with_token();

    let req = axum::http::Request::builder()
        .method(axum::http::Method::PUT)
        .uri(format!("/api/transactions/{}/category", txn_id))
        .header("Cookie", &format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            json!({
                "category_name": "ENTERTAINMENT",
                "is_custom": false
            })
            .to_string(),
        ))
        .unwrap();

    let response = app.oneshot(req).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn given_revert_to_primary_when_set_transaction_category_then_returns_no_override() {
    let user_id = Uuid::new_v4();
    let txn_id = Uuid::new_v4();
    let mut repo = MockDatabaseRepository::new();

    let txn = make_transaction(user_id, "FOOD_AND_DRINK", Some("Starbucks #123"));

    repo.expect_get_transaction_by_id_for_user()
        .times(1)
        .returning(move |_, _| {
            let t = txn.clone();
            Box::pin(async move { Ok(Some(t)) })
        });

    repo.expect_delete_transaction_category_override_by_norm()
        .withf(|_, norm| norm == "starbucks")
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let app = TestFixtures::create_test_app_with_db(repo).await.unwrap();
    let (_, token) = TestFixtures::create_authenticated_user_with_token();

    let req = axum::http::Request::builder()
        .method(axum::http::Method::PUT)
        .uri(format!("/api/transactions/{}/category", txn_id))
        .header("Cookie", &format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            json!({
                "category_name": "FOOD_AND_DRINK",
                "is_custom": false
            })
            .to_string(),
        ))
        .unwrap();

    let response = app.oneshot(req).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn given_foreign_transaction_when_set_transaction_category_then_returns_404() {
    let _user_id = Uuid::new_v4();
    let txn_id = Uuid::new_v4();
    let mut repo = MockDatabaseRepository::new();

    repo.expect_get_transaction_by_id_for_user()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(None) }));

    let app = TestFixtures::create_test_app_with_db(repo).await.unwrap();
    let (_, token) = TestFixtures::create_authenticated_user_with_token();

    let req = axum::http::Request::builder()
        .method(axum::http::Method::PUT)
        .uri(format!("/api/transactions/{}/category", txn_id))
        .header("Cookie", &format!("auth_token={}", token))
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            json!({
                "category_name": "ENTERTAINMENT",
                "is_custom": false
            })
            .to_string(),
        ))
        .unwrap();

    let response = app.oneshot(req).await.unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}
