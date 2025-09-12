use crate::models::budget::Budget;
use crate::services::budget_service::BudgetService;
use crate::services::repository_service::MockDatabaseRepository;
use rust_decimal_macros::dec;
use uuid::Uuid;

#[tokio::test]
async fn given_valid_budget_data_when_creating_budget_then_succeeds_with_user_isolation() {
    let user_id = Uuid::new_v4();
    let mut repository = MockDatabaseRepository::new();
    let service = BudgetService::new();

    repository
        .expect_get_budgets_for_user()
        .times(1)
        .returning(move |_| Box::pin(async move { Ok(vec![]) }));

    repository
        .expect_create_budget_for_user()
        .withf(move |budget| {
            budget.user_id == user_id
                && budget.category == "FOOD_AND_DRINK"
                && budget.amount == dec!(250.00)
        })
        .times(1)
        .returning(move |budget| Box::pin(async move { Ok(budget.clone()) }));

    let result = service
        .create_budget_for_user(
            &repository,
            user_id,
            "FOOD_AND_DRINK".to_string(),
            dec!(250.00),
        )
        .await;

    assert!(result.is_ok());
    let budget = result.unwrap();
    assert_eq!(budget.user_id, user_id);
    assert_eq!(budget.category, "FOOD_AND_DRINK");
    assert_eq!(budget.amount, dec!(250.00));
}

#[tokio::test]
async fn given_invalid_budget_amount_when_creating_budget_then_fails() {
    let user_id = Uuid::new_v4();
    let repository = MockDatabaseRepository::new();
    let service = BudgetService::new();

    let result = service
        .create_budget_for_user(
            &repository,
            user_id,
            "FOOD_AND_DRINK".to_string(),
            dec!(0.00),
        )
        .await;

    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .contains("Budget amount must be greater than zero"));
}

#[tokio::test]
async fn given_budgets_and_user_isolation_when_updating_then_respects_access_control() {
    let user1_id = Uuid::new_v4();
    let user2_id = Uuid::new_v4();
    let mut repository = MockDatabaseRepository::new();
    let service = BudgetService::new();

    repository
        .expect_get_budgets_for_user()
        .times(1)
        .returning(move |_| Box::pin(async move { Ok(vec![]) }));

    repository
        .expect_create_budget_for_user()
        .times(1)
        .returning(move |budget| Box::pin(async move { Ok(budget.clone()) }));

    repository
        .expect_update_budget_for_user()
        .times(1)
        .returning(|_, _, _| {
            Box::pin(async { Err(anyhow::anyhow!("Budget not found or access denied")) })
        });

    let budget = service
        .create_budget_for_user(
            &repository,
            user1_id,
            "FOOD_AND_DRINK".to_string(),
            dec!(250.00),
        )
        .await
        .unwrap();

    let result = service
        .update_budget_for_user(&repository, budget.id, user2_id, dec!(300.00))
        .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn given_existing_budget_when_deleting_then_succeeds_with_user_isolation() {
    let user_id = Uuid::new_v4();
    let mut repository = MockDatabaseRepository::new();
    let service = BudgetService::new();

    let _budget = Budget::new(user_id, "FOOD_AND_DRINK".to_string(), dec!(250.00));

    repository
        .expect_get_budgets_for_user()
        .times(1)
        .returning(move |_| Box::pin(async move { Ok(vec![]) }));

    repository
        .expect_create_budget_for_user()
        .times(1)
        .returning(move |budget| Box::pin(async move { Ok(budget.clone()) }));

    repository
        .expect_delete_budget_for_user()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let budget = service
        .create_budget_for_user(
            &repository,
            user_id,
            "FOOD_AND_DRINK".to_string(),
            dec!(250.00),
        )
        .await
        .unwrap();

    let result = service
        .delete_budget_for_user(&repository, budget.id, user_id)
        .await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn given_budget_from_different_user_when_deleting_then_fails() {
    let user1_id = Uuid::new_v4();
    let user2_id = Uuid::new_v4();
    let mut repository = MockDatabaseRepository::new();
    let service = BudgetService::new();

    let _budget = Budget::new(user1_id, "FOOD_AND_DRINK".to_string(), dec!(250.00));

    repository
        .expect_get_budgets_for_user()
        .times(1)
        .returning(move |_| Box::pin(async move { Ok(vec![]) }));

    repository
        .expect_create_budget_for_user()
        .times(1)
        .returning(move |budget| Box::pin(async move { Ok(budget.clone()) }));

    repository
        .expect_delete_budget_for_user()
        .times(1)
        .returning(|_, _| {
            Box::pin(async { Err(anyhow::anyhow!("Budget not found or access denied")) })
        });

    let budget = service
        .create_budget_for_user(
            &repository,
            user1_id,
            "FOOD_AND_DRINK".to_string(),
            dec!(250.00),
        )
        .await
        .unwrap();

    let result = service
        .delete_budget_for_user(&repository, budget.id, user2_id)
        .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn given_user_with_budgets_when_getting_budgets_then_returns_only_user_budgets() {
    let user1_id = Uuid::new_v4();
    let user2_id = Uuid::new_v4();
    let mut repository = MockDatabaseRepository::new();
    let service = BudgetService::new();

    let budget1 = Budget::new(user1_id, "FOOD_AND_DRINK".to_string(), dec!(250.00));
    let budget2 = Budget::new(user1_id, "TRANSPORTATION".to_string(), dec!(150.00));
    let _budget3 = Budget::new(user2_id, "FOOD_AND_DRINK".to_string(), dec!(300.00));

    // First three creations: pre-checks see no duplicates
    repository
        .expect_get_budgets_for_user()
        .times(3)
        .returning(move |_| Box::pin(async move { Ok(vec![]) }));

    repository
        .expect_create_budget_for_user()
        .times(3)
        .returning(move |budget| Box::pin(async move { Ok(budget.clone()) }));

    let user1_budgets = vec![budget1.clone(), budget2.clone()];
    repository
        .expect_get_budgets_for_user()
        .times(1)
        .returning({
            let user1_budgets = user1_budgets.clone();
            move |_| {
                let user1_budgets = user1_budgets.clone();
                Box::pin(async move { Ok(user1_budgets) })
            }
        });

    let _budget1 = service
        .create_budget_for_user(
            &repository,
            user1_id,
            "FOOD_AND_DRINK".to_string(),
            dec!(250.00),
        )
        .await
        .unwrap();

    let _budget2 = service
        .create_budget_for_user(
            &repository,
            user1_id,
            "TRANSPORTATION".to_string(),
            dec!(150.00),
        )
        .await
        .unwrap();

    let _budget3 = service
        .create_budget_for_user(
            &repository,
            user2_id,
            "FOOD_AND_DRINK".to_string(),
            dec!(300.00),
        )
        .await
        .unwrap();

    let result = service.get_budgets_for_user(&repository, user1_id).await;

    assert!(result.is_ok());
    let budgets = result.unwrap();
    assert_eq!(budgets.len(), 2);
    for budget in budgets {
        assert_eq!(budget.user_id, user1_id);
    }
}

#[tokio::test]
async fn given_existing_category_when_creating_budget_then_returns_conflict_error() {
    let user_id = Uuid::new_v4();
    let mut repository = MockDatabaseRepository::new();
    let service = BudgetService::new();

    let existing = Budget::new(user_id, "FOOD_AND_DRINK".to_string(), dec!(200.00));

    repository
        .expect_get_budgets_for_user()
        .times(1)
        .returning(move |_| {
            let existing_clone = existing.clone();
            Box::pin(async move { Ok(vec![existing_clone]) })
        });

    let result = service
        .create_budget_for_user(
            &repository,
            user_id,
            "FOOD_AND_DRINK".to_string(),
            dec!(250.00),
        )
        .await;

    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .to_lowercase()
        .contains("category already exists"));
}

#[tokio::test]
async fn given_unique_constraint_violation_when_creating_budget_then_returns_conflict_error() {
    let user_id = Uuid::new_v4();
    let mut repository = MockDatabaseRepository::new();
    let service = BudgetService::new();

    repository
        .expect_get_budgets_for_user()
        .times(1)
        .returning(move |_| Box::pin(async move { Ok(vec![]) }));

    repository
        .expect_create_budget_for_user()
        .times(1)
        .returning(|_budget| {
            Box::pin(async { Err(anyhow::anyhow!("Budget category already exists")) })
        });

    let result = service
        .create_budget_for_user(
            &repository,
            user_id,
            "TRANSPORTATION".to_string(),
            dec!(100.00),
        )
        .await;

    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .to_lowercase()
        .contains("category already exists"));
}
