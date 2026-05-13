use crate::models::{account::Account, auth::User, transaction::Transaction};
use crate::services::repository_service::{DatabaseRepository, PostgresRepository};
use crate::utils::encryption_key::parse_encryption_key_hex;
use chrono::{NaiveDate, Utc};
use rust_decimal_macros::dec;
use sqlx::PgPool;
use uuid::Uuid;

fn open_repository(pool: PgPool) -> PostgresRepository {
    let raw = std::env::var("ENCRYPTION_KEY")
        .expect("ENCRYPTION_KEY must be set when DATABASE_URL is set for repository_service_tests");
    let key = parse_encryption_key_hex(&raw).expect("ENCRYPTION_KEY must be 64 hex characters");
    PostgresRepository::new(pool, key)
}

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

async fn create_test_account(repo: &PostgresRepository, user_id: Uuid) -> Account {
    let account = Account {
        id: Uuid::new_v4(),
        user_id: Some(user_id),
        provider_account_id: Some(format!("provider_account_{}", Uuid::new_v4())),
        provider_connection_id: None,
        name: "Test Account".to_string(),
        account_type: "checking".to_string(),
        balance_current: Some(dec!(1000.00)),
        mask: Some("1234".to_string()),
        institution_name: Some("Test Bank".to_string()),
    };

    repo.upsert_account(&account).await.unwrap();
    account
}

fn create_test_transaction(
    user_id: Uuid,
    account_id: Uuid,
    provider_transaction_id: String,
    amount: i64,
    date: NaiveDate,
) -> Transaction {
    Transaction {
        id: Uuid::new_v4(),
        account_id,
        user_id: Some(user_id),
        provider_account_id: Some("provider_account".to_string()),
        provider_transaction_id: Some(provider_transaction_id),
        amount: rust_decimal::Decimal::new(amount, 2),
        date,
        merchant_name: Some("Test Merchant".to_string()),
        category_primary: "Food".to_string(),
        category_detailed: "Restaurant".to_string(),
        category_confidence: "HIGH".to_string(),
        payment_channel: Some("in_store".to_string()),
        pending: false,
        created_at: Some(Utc::now()),
    }
}

#[tokio::test]
async fn given_valid_user_when_updating_password_then_hash_changes() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = open_repository(pool.clone());
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

    let repo = open_repository(pool.clone());
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

    let repo = open_repository(pool.clone());
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

    let repo = open_repository(pool.clone());
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

#[tokio::test]
async fn given_many_transactions_when_batch_upserting_then_writes_all_rows_without_duplicates() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = open_repository(pool.clone());
    let user = create_test_user(&repo).await;
    let account = create_test_account(&repo, user.id).await;

    let first_batch: Vec<Transaction> = (0..500)
        .map(|index| {
            create_test_transaction(
                user.id,
                account.id,
                format!("batch_txn_{index:03}"),
                -1000 - index as i64,
                NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
            )
        })
        .collect();
    let second_batch: Vec<Transaction> = (500..600)
        .map(|index| {
            create_test_transaction(
                user.id,
                account.id,
                format!("batch_txn_{index:03}"),
                -1000 - index as i64,
                NaiveDate::from_ymd_opt(2024, 1, 2).unwrap(),
            )
        })
        .collect();

    repo.upsert_transactions_batch(&first_batch, &user.id)
        .await
        .unwrap();
    repo.upsert_transactions_batch(&second_batch, &user.id)
        .await
        .unwrap();

    let transaction_count_after_first_insert: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM transactions WHERE user_id = $1")
            .bind(user.id)
            .fetch_one(&pool)
            .await
            .unwrap();

    assert_eq!(transaction_count_after_first_insert, 600);

    repo.upsert_transactions_batch(&first_batch, &user.id)
        .await
        .unwrap();
    repo.upsert_transactions_batch(&second_batch, &user.id)
        .await
        .unwrap();

    let transaction_count_after_reinsert: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM transactions WHERE user_id = $1")
            .bind(user.id)
            .fetch_one(&pool)
            .await
            .unwrap();

    let distinct_provider_transaction_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT provider_transaction_id) FROM transactions WHERE user_id = $1",
    )
    .bind(user.id)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(transaction_count_after_reinsert, 600);
    assert_eq!(distinct_provider_transaction_count, 600);
}

#[tokio::test]
async fn given_transactions_when_querying_paginated_then_returns_correct_pages_and_total() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = open_repository(pool.clone());
    let user = create_test_user(&repo).await;
    let account = create_test_account(&repo, user.id).await;

    let transactions: Vec<Transaction> = (0..20)
        .map(|index| {
            let mut transaction = create_test_transaction(
                user.id,
                account.id,
                format!("page_txn_{index:03}"),
                -500 - index as i64,
                NaiveDate::from_ymd_opt(2024, 1, 1)
                    .unwrap()
                    .checked_add_days(chrono::Days::new(index as u64))
                    .unwrap(),
            );
            transaction.merchant_name = if index % 2 == 0 {
                Some("Coffee House".to_string())
            } else {
                Some("Gas Station".to_string())
            };
            transaction.category_primary = if index % 2 == 0 {
                "FOOD_AND_DRINK".to_string()
            } else {
                "TRANSPORTATION".to_string()
            };
            transaction.category_detailed = transaction.category_primary.clone();
            transaction.created_at = Some(Utc::now() + chrono::Duration::seconds(index as i64));
            transaction
        })
        .collect();

    repo.upsert_transactions_batch(&transactions, &user.id)
        .await
        .unwrap();

    let page_one = repo
        .get_transactions_paginated(&user.id, 10, 0, None, None, None, None, None)
        .await
        .unwrap();
    let page_two = repo
        .get_transactions_paginated(&user.id, 10, 10, None, None, None, None, None)
        .await
        .unwrap();
    let total = repo
        .count_transactions(&user.id, None, None, None, None, None)
        .await
        .unwrap();

    assert_eq!(total, 20);
    assert_eq!(page_one.len(), 10);
    assert_eq!(page_two.len(), 10);
    assert_eq!(
        page_one[0].provider_transaction_id.as_deref(),
        Some("page_txn_019")
    );
    assert_eq!(
        page_one[9].provider_transaction_id.as_deref(),
        Some("page_txn_010")
    );
    assert_eq!(
        page_two[0].provider_transaction_id.as_deref(),
        Some("page_txn_009")
    );
    assert_eq!(
        page_two[9].provider_transaction_id.as_deref(),
        Some("page_txn_000")
    );
}

#[tokio::test]
async fn given_transactions_when_filtering_server_side_then_filters_categories_and_search_terms() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = open_repository(pool.clone());
    let user = create_test_user(&repo).await;
    let account = create_test_account(&repo, user.id).await;

    let transactions: Vec<Transaction> = (0..20)
        .map(|index| {
            let mut transaction = create_test_transaction(
                user.id,
                account.id,
                format!("filter_txn_{index:03}"),
                -700 - index as i64,
                NaiveDate::from_ymd_opt(2024, 2, 1)
                    .unwrap()
                    .checked_add_days(chrono::Days::new(index as u64))
                    .unwrap(),
            );
            transaction.merchant_name = if index % 2 == 0 {
                Some("Coffee House".to_string())
            } else {
                Some("Gas Station".to_string())
            };
            transaction.category_primary = if index % 2 == 0 {
                "FOOD_AND_DRINK".to_string()
            } else {
                "TRANSPORTATION".to_string()
            };
            transaction.category_detailed = if index % 2 == 0 {
                "Coffee Shop".to_string()
            } else {
                "Fuel".to_string()
            };
            transaction.created_at = Some(Utc::now() + chrono::Duration::seconds(index as i64));
            transaction
        })
        .collect();

    repo.upsert_transactions_batch(&transactions, &user.id)
        .await
        .unwrap();

    let search_results = repo
        .get_transactions_paginated(&user.id, 50, 0, Some("coffee"), None, None, None, None)
        .await
        .unwrap();
    let search_count = repo
        .count_transactions(&user.id, Some("coffee"), None, None, None, None)
        .await
        .unwrap();
    let category_results = repo
        .get_transactions_paginated(
            &user.id,
            50,
            0,
            None,
            None,
            None,
            None,
            Some("TRANSPORTATION"),
        )
        .await
        .unwrap();
    let category_count = repo
        .count_transactions(&user.id, None, None, None, None, Some("TRANSPORTATION"))
        .await
        .unwrap();
    let categories = repo
        .get_distinct_transaction_categories(&user.id)
        .await
        .unwrap();

    assert_eq!(search_results.len(), 10);
    assert_eq!(search_count, 10);
    assert_eq!(category_results.len(), 10);
    assert_eq!(category_count, 10);
    assert_eq!(
        categories,
        vec!["FOOD_AND_DRINK".to_string(), "TRANSPORTATION".to_string()]
    );
}
