use std::sync::Arc;

use chrono::NaiveDate;
use rust_decimal_macros::dec;
use uuid::Uuid;

use crate::models::custom_category::CustomCategory;
use crate::models::domain_error::DomainError;
use crate::models::transaction::Transaction;
use crate::models::transaction_category_override::{
    SetTransactionCategoryRequest, TransactionCategoryOverride,
};
use crate::services::cache_service::MockCacheService;
use crate::services::categorization::category_descriptors::SYSTEM_CATEGORY_SLUGS;
use crate::services::category_management::service::CategoryManagementService;
use crate::services::category_orchestrator::CategoryOrchestrator;
use crate::services::repository_service::MockDatabaseRepository;
use crate::utils::merchant_name::normalize_merchant_for_match;

fn orchestrator(
    repository: MockDatabaseRepository,
    cache: MockCacheService,
) -> CategoryOrchestrator {
    CategoryOrchestrator::new(
        Arc::new(CategoryManagementService::new(SYSTEM_CATEGORY_SLUGS)),
        Arc::new(repository),
        Arc::new(cache),
    )
}

fn make_transaction(user_id: Uuid, category_primary: &str, merchant_name: &str) -> Transaction {
    Transaction {
        id: Uuid::new_v4(),
        account_id: Uuid::new_v4(),
        user_id: Some(user_id),
        provider_account_id: None,
        provider_transaction_id: Some("txn-001".to_string()),
        amount: dec!(-10.00),
        date: NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
        merchant_name: Some(merchant_name.to_string()),
        category_primary: category_primary.to_string(),
        category_detailed: category_primary.to_string(),
        category_confidence: "HIGH".to_string(),
        payment_channel: None,
        pending: false,
        created_at: None,
        original_merchant_name: None,
        normalized_merchant: Some(normalize_merchant_for_match(merchant_name)),
        normalization_source: None,
    }
}

fn make_custom_category(user_id: Uuid, display_name: &str, lookup_key: &str) -> CustomCategory {
    CustomCategory {
        id: Uuid::new_v4(),
        user_id,
        display_name: display_name.to_string(),
        lookup_key: lookup_key.to_string(),
        created_at: None,
        updated_at: None,
    }
}

fn make_override(
    user_id: Uuid,
    normalized_merchant: &str,
    category_name: &str,
) -> TransactionCategoryOverride {
    TransactionCategoryOverride {
        id: Uuid::new_v4(),
        user_id,
        normalized_merchant: normalized_merchant.to_string(),
        category_name: category_name.to_string(),
        custom_category_id: None,
        created_at: None,
        updated_at: None,
    }
}

#[tokio::test]
async fn given_stored_categories_when_listing_transaction_categories_then_returns_them() {
    let user_id = Uuid::new_v4();
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_distinct_transaction_categories()
        .times(1)
        .returning(|_| Box::pin(async { Ok(vec!["FOOD_AND_DRINK".to_string()]) }));

    let result = orchestrator(repository, MockCacheService::new())
        .transaction_categories(user_id)
        .await;

    assert_eq!(result, Ok(vec!["FOOD_AND_DRINK".to_string()]));
}

#[tokio::test]
async fn given_repository_failure_when_listing_transaction_categories_then_reports_load_failed() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_distinct_transaction_categories()
        .returning(|_| Box::pin(async { Err(anyhow::anyhow!("db unavailable")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .transaction_categories(Uuid::new_v4())
        .await;

    assert_eq!(
        result,
        Err(DomainError::internal("Failed to fetch categories"))
    );
}

#[tokio::test]
async fn given_name_with_digits_when_creating_custom_category_then_rejects_before_repository() {
    let result = orchestrator(MockDatabaseRepository::new(), MockCacheService::new())
        .create_custom(Uuid::new_v4(), "Coffee 2")
        .await;

    assert_eq!(
        result.unwrap_err(),
        DomainError::bad_request("Invalid characters")
            .with_code("invalid_characters")
            .with_error_name("validation_error")
    );
}

#[tokio::test]
async fn given_system_category_name_when_creating_custom_category_then_reports_collision() {
    let result = orchestrator(MockDatabaseRepository::new(), MockCacheService::new())
        .create_custom(Uuid::new_v4(), "Food and Drink")
        .await;

    assert_eq!(
        result.unwrap_err(),
        DomainError::bad_request("Collides with system category")
            .with_code("collides_with_system_category")
            .with_error_name("validation_error")
    );
}

#[tokio::test]
async fn given_valid_name_when_creating_custom_category_then_persists_and_returns_it() {
    let user_id = Uuid::new_v4();
    let expected = make_custom_category(user_id, "Coffee Runs", "coffee run");
    let returned = expected.clone();

    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_list_custom_categories_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    repository
        .expect_create_custom_category()
        .withf(|_, display_name, lookup_key| {
            display_name == "Coffee Runs" && lookup_key == "coffee run"
        })
        .times(1)
        .returning(move |_, _, _| {
            let category = returned.clone();
            Box::pin(async move { Ok(category) })
        });

    let result = orchestrator(repository, MockCacheService::new())
        .create_custom(user_id, "coffee runs")
        .await;

    assert_eq!(result.unwrap().id, expected.id);
}

#[tokio::test]
async fn given_repository_failure_when_deleting_custom_category_then_reports_delete_failed() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_delete_custom_category()
        .times(1)
        .returning(|_, _| Box::pin(async { Err(anyhow::anyhow!("db unavailable")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .delete_custom(Uuid::new_v4(), Uuid::new_v4())
        .await;

    assert_eq!(
        result,
        Err(DomainError::internal("Failed to delete custom category"))
    );
}

#[tokio::test]
async fn given_foreign_transaction_when_setting_category_then_reports_not_found() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_transaction_by_id_for_user()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(None) }));

    let result = orchestrator(repository, MockCacheService::new())
        .set_transaction_category(
            Uuid::new_v4(),
            "jwt",
            Uuid::new_v4(),
            SetTransactionCategoryRequest {
                category_name: "ENTERTAINMENT".to_string(),
                is_custom: false,
            },
        )
        .await;

    assert_eq!(
        result,
        Err(DomainError::not_found("transaction_not_found").with_error_name("not_found"))
    );
}

#[tokio::test]
async fn given_unknown_custom_category_when_setting_category_then_reports_custom_not_found() {
    let user_id = Uuid::new_v4();
    let transaction = make_transaction(user_id, "FOOD_AND_DRINK", "Starbucks #123");

    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_transaction_by_id_for_user()
        .returning(move |_, _| {
            let transaction = transaction.clone();
            Box::pin(async move { Ok(Some(transaction)) })
        });
    repository
        .expect_list_custom_categories_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let result = orchestrator(repository, MockCacheService::new())
        .set_transaction_category(
            user_id,
            "jwt",
            Uuid::new_v4(),
            SetTransactionCategoryRequest {
                category_name: "Coffee".to_string(),
                is_custom: true,
            },
        )
        .await;

    assert_eq!(
        result,
        Err(DomainError::bad_request("custom_category_not_found")
            .with_error_name("validation_error"))
    );
}

#[tokio::test]
async fn given_repository_failure_when_setting_category_then_reports_set_failed() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_transaction_by_id_for_user()
        .returning(|_, _| Box::pin(async { Err(anyhow::anyhow!("db unavailable")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .set_transaction_category(
            Uuid::new_v4(),
            "jwt",
            Uuid::new_v4(),
            SetTransactionCategoryRequest {
                category_name: "ENTERTAINMENT".to_string(),
                is_custom: false,
            },
        )
        .await;

    assert_eq!(
        result,
        Err(DomainError::internal("internal_server_error").with_error_name("internal_error"))
    );
}

#[tokio::test]
async fn given_changed_category_when_setting_category_then_invalidates_sankey_cache_for_jwt() {
    let user_id = Uuid::new_v4();
    let transaction = make_transaction(user_id, "FOOD_AND_DRINK", "Netflix.Com");
    let override_row = make_override(user_id, "netflix", "ENTERTAINMENT");

    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_transaction_by_id_for_user()
        .returning(move |_, _| {
            let transaction = transaction.clone();
            Box::pin(async move { Ok(Some(transaction)) })
        });
    repository
        .expect_upsert_transaction_category_override()
        .times(1)
        .returning(move |_, _, _, _| {
            let override_row = override_row.clone();
            Box::pin(async move { Ok(override_row) })
        });
    let mut cache = MockCacheService::new();
    cache
        .expect_invalidate_pattern()
        .withf(|pattern| pattern == "jwt_sankey_*")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let result = orchestrator(repository, cache)
        .set_transaction_category(
            user_id,
            "jwt",
            Uuid::new_v4(),
            SetTransactionCategoryRequest {
                category_name: "ENTERTAINMENT".to_string(),
                is_custom: false,
            },
        )
        .await;

    assert_eq!(result, Ok(()));
}

#[tokio::test]
async fn given_cache_invalidation_failure_when_setting_category_then_still_succeeds() {
    let user_id = Uuid::new_v4();
    let transaction = make_transaction(user_id, "FOOD_AND_DRINK", "Netflix.Com");
    let override_row = make_override(user_id, "netflix", "ENTERTAINMENT");

    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_transaction_by_id_for_user()
        .returning(move |_, _| {
            let transaction = transaction.clone();
            Box::pin(async move { Ok(Some(transaction)) })
        });
    repository
        .expect_upsert_transaction_category_override()
        .returning(move |_, _, _, _| {
            let override_row = override_row.clone();
            Box::pin(async move { Ok(override_row) })
        });
    let mut cache = MockCacheService::new();
    cache
        .expect_invalidate_pattern()
        .times(1)
        .returning(|_| Box::pin(async { Err(anyhow::anyhow!("redis unavailable")) }));

    let result = orchestrator(repository, cache)
        .set_transaction_category(
            user_id,
            "jwt",
            Uuid::new_v4(),
            SetTransactionCategoryRequest {
                category_name: "ENTERTAINMENT".to_string(),
                is_custom: false,
            },
        )
        .await;

    assert_eq!(result, Ok(()));
}

#[tokio::test]
async fn given_repository_failure_when_creating_custom_category_then_reports_internal_error() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_list_custom_categories_for_user()
        .returning(|_| Box::pin(async { Err(anyhow::anyhow!("db unavailable")) }));

    let result = orchestrator(repository, MockCacheService::new())
        .create_custom(Uuid::new_v4(), "Coffee Runs")
        .await;

    assert_eq!(
        result.unwrap_err(),
        DomainError::internal("internal_server_error").with_error_name("internal_error")
    );
}
