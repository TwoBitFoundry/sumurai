use std::sync::Arc;

use rust_decimal_macros::dec;
use uuid::Uuid;

use crate::models::budget::Budget;
use crate::services::budget_orchestrator::{BudgetOrchestrationError, BudgetOrchestrator};
use crate::services::cache_service::MockCacheService;
use crate::services::repository_service::MockDatabaseRepository;
use crate::services::BudgetService;

fn orchestrator(repository: MockDatabaseRepository, cache: MockCacheService) -> BudgetOrchestrator {
    BudgetOrchestrator::new(
        Arc::new(BudgetService::new()),
        Arc::new(repository),
        Arc::new(cache),
    )
}

#[tokio::test]
async fn given_cached_budgets_when_listing_then_skips_repository() {
    let user_id = Uuid::new_v4();
    let cached = vec![Budget::new(
        user_id,
        "FOOD_AND_DRINK".to_string(),
        dec!(100),
    )];
    let serialized = serde_json::to_string(&cached).unwrap();

    let repository = MockDatabaseRepository::new();
    let mut cache = MockCacheService::new();
    cache.expect_get_budgets().times(1).returning(move |_| {
        let serialized = serialized.clone();
        Box::pin(async move { Ok(Some(serialized)) })
    });

    let result = orchestrator(repository, cache)
        .list(user_id, "jwt")
        .await
        .unwrap();

    assert_eq!(result, cached);
}

#[tokio::test]
async fn given_cache_miss_when_listing_then_loads_and_caches_budgets() {
    let user_id = Uuid::new_v4();
    let stored = vec![Budget::new(user_id, "TRAVEL".to_string(), dec!(75))];
    let expected = stored.clone();

    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_budgets_for_user()
        .times(1)
        .returning(move |_| {
            let stored = stored.clone();
            Box::pin(async move { Ok(stored) })
        });
    let mut cache = MockCacheService::new();
    cache
        .expect_get_budgets()
        .returning(|_| Box::pin(async { Ok(None) }));
    cache
        .expect_set_budgets()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let result = orchestrator(repository, cache)
        .list(user_id, "jwt")
        .await
        .unwrap();

    assert_eq!(result, expected);
}

#[tokio::test]
async fn given_non_positive_amount_when_updating_then_rejects_before_repository() {
    let result = orchestrator(MockDatabaseRepository::new(), MockCacheService::new())
        .update(Uuid::new_v4(), "jwt", Uuid::new_v4(), dec!(0))
        .await;

    assert_eq!(result, Err(BudgetOrchestrationError::InvalidAmount));
}

#[tokio::test]
async fn given_duplicate_category_when_creating_then_reports_already_exists() {
    let user_id = Uuid::new_v4();
    let existing = vec![Budget::new(
        user_id,
        "FOOD_AND_DRINK".to_string(),
        dec!(100),
    )];

    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_budgets_for_user()
        .returning(move |_| {
            let existing = existing.clone();
            Box::pin(async move { Ok(existing) })
        });

    let result = orchestrator(repository, MockCacheService::new())
        .create(user_id, "jwt", "food_and_drink".to_string(), dec!(50))
        .await;

    assert_eq!(result, Err(BudgetOrchestrationError::AlreadyExists));
}

#[tokio::test]
async fn given_income_category_when_creating_then_reports_ineligible() {
    let result = orchestrator(MockDatabaseRepository::new(), MockCacheService::new())
        .create(Uuid::new_v4(), "jwt", "INCOME".to_string(), dec!(50))
        .await;

    assert_eq!(result, Err(BudgetOrchestrationError::IneligibleCategory));
}

#[tokio::test]
async fn given_deleted_budget_when_deleting_then_refreshes_cache() {
    let user_id = Uuid::new_v4();

    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_delete_budget_for_user()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));
    repository
        .expect_get_budgets_for_user()
        .times(1)
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    let mut cache = MockCacheService::new();
    cache
        .expect_set_budgets()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let result = orchestrator(repository, cache)
        .delete(user_id, "jwt", Uuid::new_v4())
        .await;

    assert_eq!(result, Ok(()));
}
