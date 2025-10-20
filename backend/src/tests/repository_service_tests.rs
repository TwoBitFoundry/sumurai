use crate::models::auth::User;
use crate::services::repository_service::{DatabaseRepository, PostgresRepository};
use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

async fn connect_pool() -> Option<PgPool> {
    if std::env::var("DATABASE_URL").is_err() {
        eprintln!(
            "[repository_service_tests] Skipping: DATABASE_URL not set for integration tests"
        );
        return None;
    }

    let database_url = std::env::var("DATABASE_URL").unwrap();
    match PgPool::connect(&database_url).await {
        Ok(pool) => Some(pool),
        Err(err) => {
            eprintln!(
                "[repository_service_tests] Skipping: cannot connect to DB: {}",
                err
            );
            None
        }
    }
}

async fn create_test_user(repo: &PostgresRepository) -> User {
    let user = User {
        id: Uuid::new_v4(),
        email: format!("test_{}@example.com", Uuid::new_v4()),
        password_hash: "original_hash_value".to_string(),
        provider: "teller".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        onboarding_completed: false,
    };
    repo.create_user(&user).await.unwrap();
    user
}

#[tokio::test]
async fn given_valid_user_when_updating_password_then_hash_changes() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = PostgresRepository::new(pool.clone()).unwrap();
    let user = create_test_user(&repo).await;

    let original_hash = user.password_hash.clone();
    let new_hash = "new_hash_value_argon2id$v=19$m=19456,t=2,p=1$abc123$def456".to_string();

    let result = repo.update_user_password(&user.id, &new_hash).await;

    assert!(result.is_ok());

    let updated_user = repo.get_user_by_id(&user.id).await.unwrap().unwrap();
    assert_eq!(updated_user.password_hash, new_hash);
    assert_ne!(updated_user.password_hash, original_hash);
}

#[tokio::test]
async fn given_user_with_budgets_when_deleting_then_budgets_cascade() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = PostgresRepository::new(pool.clone()).unwrap();
    let user = create_test_user(&repo).await;

    let budget = crate::models::budget::Budget {
        id: Uuid::new_v4(),
        user_id: user.id,
        category: "Food".to_string(),
        amount: rust_decimal_macros::dec!(500.00),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    repo.create_budget_for_user(budget.clone()).await.unwrap();

    let budget_count_before: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM budgets WHERE user_id = $1")
            .bind(user.id)
            .fetch_one(&pool)
            .await
            .unwrap();

    assert_eq!(budget_count_before, 1);

    let delete_result = repo.delete_user(&user.id).await;
    assert!(delete_result.is_ok());

    let budget_count_after: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM budgets WHERE user_id = $1")
            .bind(user.id)
            .fetch_one(&pool)
            .await
            .unwrap();

    assert_eq!(budget_count_after, 0);

    let deleted_user = repo.get_user_by_id(&user.id).await.unwrap();
    assert!(deleted_user.is_none());
}

#[tokio::test]
async fn given_delete_user_when_rls_context_set_then_deletion_succeeds() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = PostgresRepository::new(pool.clone()).unwrap();
    let user = create_test_user(&repo).await;

    let result = repo.delete_user(&user.id).await;

    assert!(result.is_ok());

    let deleted_user = repo.get_user_by_id(&user.id).await.unwrap();
    assert!(deleted_user.is_none());
}

#[tokio::test]
async fn given_update_password_when_executed_then_updated_at_changes() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = PostgresRepository::new(pool.clone()).unwrap();
    let user = create_test_user(&repo).await;

    let original_updated_at = user.updated_at;
    let new_hash = "new_updated_hash_value".to_string();

    tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

    repo.update_user_password(&user.id, &new_hash)
        .await
        .unwrap();

    let updated_user = repo.get_user_by_id(&user.id).await.unwrap().unwrap();

    assert!(updated_user.updated_at > original_updated_at);
}
