use crate::connection_pool::RepositoryPool;
use crate::db;
use crate::models::{account::Account, auth::User, transaction::Transaction};
use crate::services::repository_service::{DatabaseRepository, PostgresRepository};
use crate::utils::encryption_key::parse_encryption_key_hex;
use crate::utils::tenant_context::tenant_set_config_statement;
use chrono::{NaiveDate, Utc};
use db::PgPool;
use rust_decimal_macros::dec;
use sea_orm::{DbBackend, MockDatabase, MockExecResult, Statement};
use uuid::Uuid;

fn open_repository(pool: PgPool) -> PostgresRepository {
    let raw = std::env::var("ENCRYPTION_KEY")
        .expect("ENCRYPTION_KEY must be set when DATABASE_URL is set for repository_service_tests");
    let key = parse_encryption_key_hex(&raw).expect("ENCRYPTION_KEY must be 64 hex characters");
    PostgresRepository::new(RepositoryPool::from_pg_pool(pool), key)
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
        password_hash: Some("original_hash_value".to_string()),
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
        provider_conn_id: None,
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
    assert_eq!(updated_user.password_hash, Some(new_hash));
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
        db::query_scalar("SELECT COUNT(*) FROM budgets WHERE user_id = $1")
            .bind(user.id)
            .fetch_one(&pool)
            .await
            .unwrap();

    assert_eq!(budget_count_before, 1);

    let delete_result = repo.delete_user(&user.id).await;
    assert!(delete_result.is_ok());

    let budget_count_after: i64 =
        db::query_scalar("SELECT COUNT(*) FROM budgets WHERE user_id = $1")
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
async fn given_tenant_scoped_transaction_when_wrapped_then_logs_set_config_first() {
    let user_id = Uuid::new_v4();
    let key = parse_encryption_key_hex(
        "0101010101010101010101010101010101010101010101010101010101010101",
    )
    .expect("test encryption key must be valid hex");

    let db = MockDatabase::new(DbBackend::Postgres)
        .append_exec_results([
            MockExecResult {
                rows_affected: 0,
                ..Default::default()
            },
            MockExecResult {
                rows_affected: 1,
                ..Default::default()
            },
        ])
        .into_connection();

    let repo = PostgresRepository::from_mock(db, key);
    repo.delete_user(&user_id).await.unwrap();

    let log = repo.into_mock_transaction_log();
    assert_eq!(log.len(), 1);
    let stmts = log[0].statements();
    assert!(stmts.len() >= 3);
    assert_eq!(
        stmts[0],
        Statement::from_string(DbBackend::Postgres, "BEGIN")
    );
    assert_eq!(stmts[1], tenant_set_config_statement(user_id));
    assert_eq!(
        stmts.last(),
        Some(&Statement::from_string(DbBackend::Postgres, "COMMIT"))
    );
}

#[tokio::test]
async fn given_two_users_when_cross_tenant_read_then_other_users_data_is_invisible() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = open_repository(pool.clone());
    let user_a = create_test_user(&repo).await;
    let user_b = create_test_user(&repo).await;
    let account_b = create_test_account(&repo, user_b.id).await;
    let transaction_b = create_test_transaction(
        user_b.id,
        account_b.id,
        format!("cross_tenant_{}", Uuid::new_v4()),
        -2500,
        NaiveDate::from_ymd_opt(2024, 6, 15).unwrap(),
    );

    repo.upsert_transactions_batch(std::slice::from_ref(&transaction_b), &user_b.id)
        .await
        .unwrap();

    let user_a_transactions = repo.get_transactions_for_user(&user_a.id).await.unwrap();
    assert!(user_a_transactions.is_empty());

    let user_b_transactions = repo.get_transactions_for_user(&user_b.id).await.unwrap();
    assert_eq!(user_b_transactions.len(), 1);
    assert_eq!(
        user_b_transactions[0].provider_transaction_id,
        transaction_b.provider_transaction_id
    );
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
        db::query_scalar("SELECT COUNT(*) FROM transactions WHERE user_id = $1")
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
        db::query_scalar("SELECT COUNT(*) FROM transactions WHERE user_id = $1")
            .bind(user.id)
            .fetch_one(&pool)
            .await
            .unwrap();

    let distinct_provider_transaction_count: i64 = db::query_scalar(
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
async fn given_stored_transaction_when_getting_by_id_for_user_then_returns_transaction() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = open_repository(pool.clone());
    let user = create_test_user(&repo).await;
    let account = create_test_account(&repo, user.id).await;
    let transaction = create_test_transaction(
        user.id,
        account.id,
        format!("get_by_id_{}", Uuid::new_v4()),
        -4250,
        NaiveDate::from_ymd_opt(2024, 2, 2).unwrap(),
    );

    repo.upsert_transaction(&transaction).await.unwrap();

    let stored = repo
        .get_transaction_by_id_for_user(&user.id, &transaction.id)
        .await
        .unwrap()
        .unwrap();

    assert_eq!(stored.id, transaction.id);
    assert_eq!(stored.account_id, transaction.account_id);
    assert_eq!(stored.user_id, transaction.user_id);
    assert_eq!(
        stored.provider_transaction_id,
        transaction.provider_transaction_id
    );
    assert_eq!(stored.provider_account_id, None);
    assert_eq!(stored.merchant_name, transaction.merchant_name);
    assert_eq!(stored.category_primary, transaction.category_primary);
}

#[tokio::test]
async fn given_more_than_thousand_transactions_when_fetching_counts_then_ids_and_counts_are_uncapped(
) {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = open_repository(pool.clone());
    let user = create_test_user(&repo).await;
    let account = create_test_account(&repo, user.id).await;

    let transactions: Vec<Transaction> = (0..1001)
        .map(|index| {
            create_test_transaction(
                user.id,
                account.id,
                format!("uncapped_txn_{index:04}"),
                -2000 - index as i64,
                NaiveDate::from_ymd_opt(2024, 2, 1).unwrap(),
            )
        })
        .collect();

    repo.upsert_transactions_batch(&transactions, &user.id)
        .await
        .unwrap();

    let capped_transactions = repo.get_transactions_for_user(&user.id).await.unwrap();
    let transaction_count = repo
        .count_transactions(&user.id, None, None, None, None, None)
        .await
        .unwrap();
    let provider_transaction_ids = repo
        .get_provider_transaction_ids_for_user(&user.id)
        .await
        .unwrap();

    assert_eq!(capped_transactions.len(), 1000);
    assert_eq!(transaction_count, 1001);
    assert_eq!(provider_transaction_ids.len(), 1001);
    assert_eq!(
        provider_transaction_ids.first().map(String::as_str),
        Some("uncapped_txn_0000")
    );
    assert_eq!(
        provider_transaction_ids.last().map(String::as_str),
        Some("uncapped_txn_1000")
    );
}

#[tokio::test]
async fn given_spending_only_query_when_fetching_transactions_then_excludes_non_spending_categories(
) {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = open_repository(pool.clone());
    let user = create_test_user(&repo).await;
    let account = create_test_account(&repo, user.id).await;

    let mut food = create_test_transaction(
        user.id,
        account.id,
        "spend_txn_001".to_string(),
        5000,
        NaiveDate::from_ymd_opt(2024, 2, 1).unwrap(),
    );
    food.category_primary = "FOOD_AND_DRINK".to_string();

    let mut income = create_test_transaction(
        user.id,
        account.id,
        "spend_txn_002".to_string(),
        10000,
        NaiveDate::from_ymd_opt(2024, 2, 2).unwrap(),
    );
    income.category_primary = "INCOME".to_string();

    let mut loan_payment = create_test_transaction(
        user.id,
        account.id,
        "spend_txn_003".to_string(),
        7500,
        NaiveDate::from_ymd_opt(2024, 2, 3).unwrap(),
    );
    loan_payment.category_primary = "LOAN_PAYMENTS".to_string();

    let mut transfer_out = create_test_transaction(
        user.id,
        account.id,
        "spend_txn_004".to_string(),
        2500,
        NaiveDate::from_ymd_opt(2024, 2, 4).unwrap(),
    );
    transfer_out.category_primary = "TRANSFER_OUT".to_string();

    repo.upsert_transactions_batch(
        &[
            food.clone(),
            income.clone(),
            loan_payment.clone(),
            transfer_out.clone(),
        ],
        &user.id,
    )
    .await
    .unwrap();

    let all_transactions = repo.get_transactions_for_user(&user.id).await.unwrap();
    let spending_transactions = repo
        .get_spending_transactions_for_user(&user.id)
        .await
        .unwrap();

    assert_eq!(all_transactions.len(), 4);
    assert_eq!(spending_transactions.len(), 1);
    assert_eq!(spending_transactions[0].category_primary, "FOOD_AND_DRINK");
    assert_eq!(
        spending_transactions[0].provider_transaction_id.as_deref(),
        Some("spend_txn_001")
    );
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

#[tokio::test]
async fn given_transactions_when_aggregating_insights_then_respects_filters_and_thresholds() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = open_repository(pool.clone());
    let user = create_test_user(&repo).await;
    let other_user = create_test_user(&repo).await;
    let account_one = create_test_account(&repo, user.id).await;
    let account_two = create_test_account(&repo, user.id).await;
    let other_account = create_test_account(&repo, other_user.id).await;

    let mut coffee_one = create_test_transaction(
        user.id,
        account_one.id,
        "insights_txn_001".to_string(),
        -1000,
        NaiveDate::from_ymd_opt(2024, 3, 1).unwrap(),
    );
    coffee_one.merchant_name = Some("Coffee Collective".to_string());
    coffee_one.category_primary = "FOOD_AND_DRINK".to_string();
    coffee_one.category_detailed = "Coffee Shop".to_string();

    let mut coffee_two = create_test_transaction(
        user.id,
        account_one.id,
        "insights_txn_002".to_string(),
        2000,
        NaiveDate::from_ymd_opt(2024, 3, 2).unwrap(),
    );
    coffee_two.merchant_name = Some("Coffee Collective".to_string());
    coffee_two.category_primary = "FOOD_AND_DRINK".to_string();
    coffee_two.category_detailed = "Coffee Shop".to_string();

    let mut coffee_three = create_test_transaction(
        user.id,
        account_one.id,
        "insights_txn_003".to_string(),
        -3000,
        NaiveDate::from_ymd_opt(2024, 3, 3).unwrap(),
    );
    coffee_three.merchant_name = Some("Coffee Collective".to_string());
    coffee_three.category_primary = "FOOD_AND_DRINK".to_string();
    coffee_three.category_detailed = "Coffee Shop".to_string();

    let mut gas_one = create_test_transaction(
        user.id,
        account_one.id,
        "insights_txn_004".to_string(),
        -4000,
        NaiveDate::from_ymd_opt(2024, 3, 4).unwrap(),
    );
    gas_one.merchant_name = Some("Gas Station".to_string());
    gas_one.category_primary = "TRANSPORTATION".to_string();
    gas_one.category_detailed = "Fuel".to_string();

    let mut gas_two = create_test_transaction(
        user.id,
        account_one.id,
        "insights_txn_005".to_string(),
        -5000,
        NaiveDate::from_ymd_opt(2024, 3, 5).unwrap(),
    );
    gas_two.merchant_name = Some("Gas Station".to_string());
    gas_two.category_primary = "TRANSPORTATION".to_string();
    gas_two.category_detailed = "Fuel".to_string();

    let mut bakery = create_test_transaction(
        user.id,
        account_two.id,
        "insights_txn_006".to_string(),
        -6000,
        NaiveDate::from_ymd_opt(2024, 4, 1).unwrap(),
    );
    bakery.merchant_name = Some("Bakery".to_string());
    bakery.category_primary = "SHOPPING".to_string();
    bakery.category_detailed = "Bakery".to_string();

    let mut utilities = create_test_transaction(
        user.id,
        account_two.id,
        "insights_txn_007".to_string(),
        -7000,
        NaiveDate::from_ymd_opt(2024, 4, 2).unwrap(),
    );
    utilities.merchant_name = Some("Utilities Co".to_string());
    utilities.category_primary = "HOME".to_string();
    utilities.category_detailed = "Utilities".to_string();

    let mut other_user_coffee_one = create_test_transaction(
        other_user.id,
        other_account.id,
        "insights_txn_008".to_string(),
        -8000,
        NaiveDate::from_ymd_opt(2024, 3, 1).unwrap(),
    );
    other_user_coffee_one.merchant_name = Some("Coffee Collective".to_string());
    other_user_coffee_one.category_primary = "FOOD_AND_DRINK".to_string();
    other_user_coffee_one.category_detailed = "Coffee Shop".to_string();

    let mut other_user_coffee_two = create_test_transaction(
        other_user.id,
        other_account.id,
        "insights_txn_009".to_string(),
        -9000,
        NaiveDate::from_ymd_opt(2024, 3, 2).unwrap(),
    );
    other_user_coffee_two.merchant_name = Some("Coffee Collective".to_string());
    other_user_coffee_two.category_primary = "FOOD_AND_DRINK".to_string();
    other_user_coffee_two.category_detailed = "Coffee Shop".to_string();

    repo.upsert_transactions_batch(
        &[
            coffee_one.clone(),
            coffee_two.clone(),
            coffee_three.clone(),
            gas_one.clone(),
            gas_two.clone(),
            bakery.clone(),
            utilities.clone(),
        ],
        &user.id,
    )
    .await
    .unwrap();
    repo.upsert_transactions_batch(
        &[other_user_coffee_one.clone(), other_user_coffee_two.clone()],
        &other_user.id,
    )
    .await
    .unwrap();

    let insights = repo
        .get_transactions_insights(
            &user.id,
            Some("coffee"),
            Some(&[account_one.id]),
            Some(NaiveDate::from_ymd_opt(2024, 3, 1).unwrap()),
            Some(NaiveDate::from_ymd_opt(2024, 3, 31).unwrap()),
            Some("FOOD_AND_DRINK"),
        )
        .await
        .unwrap();

    assert_eq!(insights.total_count, 3);
    assert!((insights.total_spent - 60.0).abs() < 0.0001);
    assert!((insights.average_amount - 20.0).abs() < 0.0001);
    assert_eq!(
        insights.largest,
        Some(crate::models::transaction::LargestTransaction {
            amount: 30.0,
            merchant: "Coffee Collective".to_string(),
        })
    );
    assert_eq!(insights.recurring_count, 1);
    assert_eq!(
        insights.recurring_merchants,
        vec!["Coffee Collective".to_string()]
    );
    assert_eq!(insights.top_categories, vec!["FOOD_AND_DRINK".to_string()]);
}

#[tokio::test]
async fn given_transactions_when_aggregating_insights_then_returns_largest_magnitude() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = open_repository(pool.clone());
    let user = create_test_user(&repo).await;
    let account = create_test_account(&repo, user.id).await;

    let mut debit = create_test_transaction(
        user.id,
        account.id,
        "insights_largest_debit".to_string(),
        -7500,
        NaiveDate::from_ymd_opt(2024, 3, 1).unwrap(),
    );
    debit.merchant_name = Some("Largest Debit".to_string());
    debit.category_primary = "FOOD_AND_DRINK".to_string();

    let mut credit = create_test_transaction(
        user.id,
        account.id,
        "insights_largest_credit".to_string(),
        2500,
        NaiveDate::from_ymd_opt(2024, 3, 2).unwrap(),
    );
    credit.merchant_name = Some("Small Credit".to_string());
    credit.category_primary = "FOOD_AND_DRINK".to_string();

    repo.upsert_transactions_batch(&[debit.clone(), credit.clone()], &user.id)
        .await
        .unwrap();

    let insights = repo
        .get_transactions_insights(&user.id, None, None, None, None, None)
        .await
        .unwrap();

    assert_eq!(insights.total_count, 2);
    assert!((insights.total_spent - 100.0).abs() < 0.0001);
    assert!((insights.average_amount - 50.0).abs() < 0.0001);
    assert_eq!(
        insights.largest,
        Some(crate::models::transaction::LargestTransaction {
            amount: 75.0,
            merchant: "Largest Debit".to_string(),
        })
    );
}

#[tokio::test]
async fn given_transactions_when_aggregating_insights_for_empty_set_then_returns_zero_values() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = open_repository(pool.clone());
    let user = create_test_user(&repo).await;
    let account = create_test_account(&repo, user.id).await;

    let transaction = create_test_transaction(
        user.id,
        account.id,
        "insights_empty_txn_001".to_string(),
        -1000,
        NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
    );

    repo.upsert_transactions_batch(&[transaction], &user.id)
        .await
        .unwrap();

    let insights = repo
        .get_transactions_insights(
            &user.id,
            None,
            None,
            Some(NaiveDate::from_ymd_opt(2025, 1, 1).unwrap()),
            Some(NaiveDate::from_ymd_opt(2025, 1, 31).unwrap()),
            None,
        )
        .await
        .unwrap();

    assert_eq!(insights.total_count, 0);
    assert_eq!(insights.total_spent, 0.0);
    assert_eq!(insights.average_amount, 0.0);
    assert_eq!(insights.largest, None);
    assert_eq!(insights.recurring_count, 0);
    assert!(insights.recurring_merchants.is_empty());
    assert!(insights.top_categories.is_empty());
}

#[tokio::test]
async fn given_fresh_user_when_list_simplefin_hidden_orgs_then_returns_empty_set() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;

    let hidden = repo.list_simplefin_hidden_orgs(&user.id).await.unwrap();

    assert!(hidden.is_empty());
}

#[tokio::test]
async fn given_hidden_org_when_insert_twice_then_is_idempotent() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;

    repo.insert_simplefin_hidden_org(&user.id, "conn-abc", Some("Test Bank"))
        .await
        .unwrap();
    repo.insert_simplefin_hidden_org(&user.id, "conn-abc", None)
        .await
        .unwrap();

    let hidden = repo.list_simplefin_hidden_orgs(&user.id).await.unwrap();

    assert_eq!(hidden.len(), 1);
    assert!(hidden.contains("conn-abc"));
}

#[tokio::test]
async fn given_two_users_when_user_a_hides_org_then_user_b_cannot_see_it() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = open_repository(pool);
    let user_a = create_test_user(&repo).await;
    let user_b = create_test_user(&repo).await;

    repo.insert_simplefin_hidden_org(&user_a.id, "conn-private", Some("Private Bank"))
        .await
        .unwrap();

    let hidden_a = repo.list_simplefin_hidden_orgs(&user_a.id).await.unwrap();
    let hidden_b = repo.list_simplefin_hidden_orgs(&user_b.id).await.unwrap();

    assert!(hidden_a.contains("conn-private"));
    assert!(!hidden_b.contains("conn-private"));
}

#[tokio::test]
async fn given_user_when_store_and_get_simplefin_root_credential_then_round_trips() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;
    let access_url = "https://user:pass@beta-bridge.simplefin.org/simplefin";

    repo.store_simplefin_root_credential(&user.id, access_url)
        .await
        .unwrap();

    let stored = repo
        .get_simplefin_root_credential(&user.id)
        .await
        .unwrap()
        .expect("root credential should exist");

    assert_eq!(stored, access_url);
}

#[tokio::test]
async fn given_stored_root_when_delete_simplefin_root_credential_then_returns_true() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;

    repo.store_simplefin_root_credential(&user.id, "https://example.com/simplefin")
        .await
        .unwrap();

    let deleted = repo
        .delete_simplefin_root_credential(&user.id)
        .await
        .unwrap();
    assert!(deleted);

    let missing = repo.get_simplefin_root_credential(&user.id).await.unwrap();
    assert!(missing.is_none());
}

#[tokio::test]
async fn given_two_users_when_user_a_stores_root_then_user_b_cannot_read_it() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = open_repository(pool);
    let user_a = create_test_user(&repo).await;
    let user_b = create_test_user(&repo).await;

    repo.store_simplefin_root_credential(&user_a.id, "https://a.example/simplefin")
        .await
        .unwrap();

    let for_b = repo
        .get_simplefin_root_credential(&user_b.id)
        .await
        .unwrap();
    assert!(for_b.is_none());
}

#[tokio::test]
async fn given_other_transactions_when_fetching_eligible_auto_categorize_then_returns_rows() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;
    let account = create_test_account(&repo, user.id).await;

    let mut transaction = create_test_transaction(
        user.id,
        account.id,
        format!("eligible-{}", Uuid::new_v4()),
        -1250,
        NaiveDate::from_ymd_opt(2024, 6, 15).unwrap(),
    );
    transaction.category_primary = "OTHER".to_string();
    transaction.category_detailed = "OTHER".to_string();
    transaction.category_confidence = String::new();
    transaction.merchant_name = Some("Eligible Merchant".to_string());

    repo.upsert_transaction(&transaction).await.unwrap();

    let count = repo
        .count_eligible_auto_categorize_transactions(&user.id)
        .await
        .unwrap();
    assert!(count >= 1);

    let eligible = repo
        .fetch_eligible_auto_categorize_transactions(&user.id, 10, None, None)
        .await
        .unwrap();

    assert!(
        eligible
            .iter()
            .any(|row| row.id == transaction.id && row.category_primary == "OTHER"),
        "expected eligible OTHER transaction in fetch results"
    );
    assert!(eligible
        .iter()
        .find(|row| row.id == transaction.id)
        .is_some_and(|row| row.provider_account_id.is_none()));
}

#[tokio::test]
async fn given_more_than_one_thousand_transactions_when_get_monthly_cash_flow_aggregates_then_sums_all(
) {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;
    let account = create_test_account(&repo, user.id).await;
    let month_date = NaiveDate::from_ymd_opt(2024, 6, 15).unwrap();
    let start_date = NaiveDate::from_ymd_opt(2024, 6, 1).unwrap();
    let end_date = NaiveDate::from_ymd_opt(2024, 6, 30).unwrap();

    let transactions = (0..1001)
        .map(|index| {
            let mut transaction = create_test_transaction(
                user.id,
                account.id,
                format!("cash-flow-{index}"),
                100,
                month_date,
            );
            transaction.category_primary = "INCOME".to_string();
            transaction
        })
        .collect::<Vec<_>>();

    for chunk in transactions.chunks(500) {
        repo.upsert_transactions_batch(chunk, &user.id)
            .await
            .unwrap();
    }

    let capped = repo
        .get_transactions_by_date_range_for_user(&user.id, start_date, end_date)
        .await
        .unwrap();
    assert_eq!(capped.len(), 1000);

    let aggregates = repo
        .get_monthly_cash_flow_aggregates_for_user(&user.id, start_date, end_date, None)
        .await
        .unwrap();

    let june = aggregates
        .iter()
        .find(|row| row.month == "2024-06")
        .expect("expected June aggregate");
    assert_eq!(june.income, dec!(1001.00));
    assert_eq!(june.expenses, dec!(0.00));
}

#[tokio::test]
async fn given_multiple_accounts_when_get_monthly_cash_flow_aggregates_with_account_filter_then_limits_to_selected_accounts(
) {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;
    let checking = create_test_account(&repo, user.id).await;
    let savings = create_test_account(&repo, user.id).await;
    let month_date = NaiveDate::from_ymd_opt(2024, 7, 10).unwrap();
    let start_date = NaiveDate::from_ymd_opt(2024, 7, 1).unwrap();
    let end_date = NaiveDate::from_ymd_opt(2024, 7, 31).unwrap();

    let mut checking_income = create_test_transaction(
        user.id,
        checking.id,
        "checking-income".to_string(),
        10_000,
        month_date,
    );
    checking_income.category_primary = "INCOME".to_string();

    let mut savings_income = create_test_transaction(
        user.id,
        savings.id,
        "savings-income".to_string(),
        20_000,
        month_date,
    );
    savings_income.category_primary = "INCOME".to_string();

    repo.upsert_transaction(&checking_income).await.unwrap();
    repo.upsert_transaction(&savings_income).await.unwrap();

    let include_checking = repo
        .get_monthly_cash_flow_aggregates_for_user(
            &user.id,
            start_date,
            end_date,
            Some(&[checking.id]),
        )
        .await
        .unwrap();
    let checking_only = include_checking
        .iter()
        .find(|row| row.month == "2024-07")
        .expect("expected July aggregate for checking");
    assert_eq!(checking_only.income, dec!(100.00));

    let all_accounts = repo
        .get_monthly_cash_flow_aggregates_for_user(&user.id, start_date, end_date, None)
        .await
        .unwrap();
    let combined = all_accounts
        .iter()
        .find(|row| row.month == "2024-07")
        .expect("expected July aggregate for all accounts");
    assert_eq!(combined.income, dec!(300.00));

    let none_selected = repo
        .get_monthly_cash_flow_aggregates_for_user(&user.id, start_date, end_date, Some(&[]))
        .await
        .unwrap();
    assert!(none_selected.is_empty());
}
