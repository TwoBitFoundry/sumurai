use crate::connection_pool::RepositoryPool;
use crate::db;
use crate::models::{
    account::Account,
    auth::User,
    transaction::{InsightState, Transaction},
};
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
        original_merchant_name: None,
        normalized_merchant: None,
        normalization_source: None,
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
async fn given_transaction_with_app_supplied_normalized_fields_when_upserting_then_insert_statement_includes_them(
) {
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
    let mut transaction = create_test_transaction(
        user_id,
        Uuid::new_v4(),
        format!("txn_{}", Uuid::new_v4()),
        -1299,
        NaiveDate::from_ymd_opt(2024, 3, 1).unwrap(),
    );
    transaction.normalized_merchant = Some("netflix".to_string());
    transaction.normalization_source = Some("sumurai_engine".to_string());

    repo.upsert_transaction(&transaction).await.unwrap();

    let log = repo.into_mock_transaction_log();
    let stmts = log[0].statements();
    let insert_sql = format!("{:?}", &stmts[2]);

    assert!(insert_sql.contains("normalized_merchant"));
    assert!(insert_sql.contains("normalization_source"));
    assert!(insert_sql.contains("sumurai_engine"));
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
async fn given_app_supplied_normalized_merchant_when_batch_upserting_twice_then_persists_that_key()
{
    let Some(pool) = connect_pool().await else {
        return;
    };

    let repo = open_repository(pool.clone());
    let user = create_test_user(&repo).await;
    let account = create_test_account(&repo, user.id).await;
    let provider_transaction_id = format!("generated_norm_{}", Uuid::new_v4());

    let mut first = create_test_transaction(
        user.id,
        account.id,
        provider_transaction_id.clone(),
        -1299,
        NaiveDate::from_ymd_opt(2024, 3, 1).unwrap(),
    );
    first.merchant_name = Some("Netflix.com".to_string());
    first.original_merchant_name = Some("NETFLIX.COM 866-579-7172 CA".to_string());
    first.normalized_merchant = Some("netflix".to_string());

    let mut second = first.clone();
    second.amount = dec!(-15.49);

    repo.upsert_transactions_batch(std::slice::from_ref(&first), &user.id)
        .await
        .unwrap();
    repo.upsert_transactions_batch(std::slice::from_ref(&second), &user.id)
        .await
        .unwrap();

    let normalized_merchant: Option<String> = db::query_scalar(
        "SELECT normalized_merchant FROM transactions WHERE user_id = $1 AND provider_transaction_id = $2",
    )
    .bind(user.id)
    .bind(&provider_transaction_id)
    .fetch_one(&pool)
    .await
    .unwrap();

    let amount: rust_decimal::Decimal = db::query_scalar(
        "SELECT amount FROM transactions WHERE user_id = $1 AND provider_transaction_id = $2",
    )
    .bind(user.id)
    .bind(&provider_transaction_id)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(normalized_merchant.as_deref(), Some("netflix"));
    assert_eq!(amount, dec!(-15.49));
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

    let mut bank_fee = create_test_transaction(
        user.id,
        account.id,
        "spend_txn_005".to_string(),
        1200,
        NaiveDate::from_ymd_opt(2024, 2, 5).unwrap(),
    );
    bank_fee.category_primary = "BANK_FEES".to_string();

    repo.upsert_transactions_batch(
        &[
            food.clone(),
            income.clone(),
            loan_payment.clone(),
            transfer_out.clone(),
            bank_fee.clone(),
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

    assert_eq!(all_transactions.len(), 5);
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

#[allow(clippy::too_many_arguments)]
fn make_contextual_txn(
    user_id: Uuid,
    account_id: Uuid,
    id_suffix: &str,
    amount_cents: i64,
    date: NaiveDate,
    category: &str,
    merchant: Option<&str>,
    normalized_merchant: Option<&str>,
) -> Transaction {
    let mut t = create_test_transaction(
        user_id,
        account_id,
        format!("ctx_{}", id_suffix),
        amount_cents,
        date,
    );
    t.category_primary = category.to_string();
    t.merchant_name = merchant.map(str::to_string);
    t.normalized_merchant = normalized_merchant.map(str::to_string);
    t
}

#[tokio::test]
async fn given_no_filters_when_getting_contextual_insights_then_state_a_with_sum_and_median() {
    let Some(pool) = connect_pool().await else {
        return;
    };
    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;
    let acct = create_test_account(&repo, user.id).await;
    let date = NaiveDate::from_ymd_opt(2024, 6, 1).unwrap();

    for (suffix, cents) in [("a1", -1000_i64), ("a2", -2000), ("a3", -3000)] {
        let t = make_contextual_txn(
            user.id,
            acct.id,
            suffix,
            cents,
            date,
            "FOOD_AND_DRINK",
            None,
            None,
        );
        repo.upsert_transaction(&t).await.unwrap();
    }

    let result = repo
        .get_transactions_contextual_insights(&user.id, None, None, None, None, None)
        .await
        .unwrap();

    assert_eq!(result.state, InsightState::A);
    let spent = result.card1.value.unwrap();
    assert!((spent - 60.0).abs() < 0.01, "expected 60.0, got {}", spent);
    assert_eq!(result.card1.secondary, Some(3.0));
    let median = result.card2.value.unwrap();
    assert!(
        (median - 20.0).abs() < 0.01,
        "expected median 20.0, got {}",
        median
    );
    assert!(result.card3.is_none());
}

#[tokio::test]
async fn given_category_filter_when_getting_contextual_insights_then_state_b() {
    let Some(pool) = connect_pool().await else {
        return;
    };
    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;
    let acct = create_test_account(&repo, user.id).await;
    let date = NaiveDate::from_ymd_opt(2024, 6, 1).unwrap();

    let food = make_contextual_txn(
        user.id,
        acct.id,
        "b1",
        -1500,
        date,
        "FOOD_AND_DRINK",
        None,
        None,
    );
    let travel = make_contextual_txn(user.id, acct.id, "b2", -5000, date, "TRAVEL", None, None);
    repo.upsert_transaction(&food).await.unwrap();
    repo.upsert_transaction(&travel).await.unwrap();

    let result = repo
        .get_transactions_contextual_insights(
            &user.id,
            None,
            None,
            None,
            None,
            Some("FOOD_AND_DRINK"),
        )
        .await
        .unwrap();

    assert_eq!(result.state, InsightState::B);
    let spent = result.card1.value.unwrap();
    assert!((spent - 15.0).abs() < 0.01);
    assert_eq!(result.card1.secondary, Some(1.0));
}

#[tokio::test]
async fn given_single_account_filter_when_getting_contextual_insights_then_state_d() {
    let Some(pool) = connect_pool().await else {
        return;
    };
    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;
    let acct1 = create_test_account(&repo, user.id).await;
    let acct2 = create_test_account(&repo, user.id).await;
    let date = NaiveDate::from_ymd_opt(2024, 6, 1).unwrap();

    let t1 = make_contextual_txn(
        user.id,
        acct1.id,
        "d1",
        -2000,
        date,
        "FOOD_AND_DRINK",
        None,
        None,
    );
    let t2 = make_contextual_txn(
        user.id,
        acct2.id,
        "d2",
        -4000,
        date,
        "FOOD_AND_DRINK",
        None,
        None,
    );
    repo.upsert_transaction(&t1).await.unwrap();
    repo.upsert_transaction(&t2).await.unwrap();

    let result = repo
        .get_transactions_contextual_insights(&user.id, None, Some(&[acct1.id]), None, None, None)
        .await
        .unwrap();

    assert_eq!(result.state, InsightState::D);
    let spent = result.card1.value.unwrap();
    assert!((spent - 20.0).abs() < 0.01);
    assert_eq!(result.card1.secondary, Some(1.0));
}

#[tokio::test]
async fn given_normalized_merchant_search_when_getting_contextual_insights_then_state_c_lifetime() {
    let Some(pool) = connect_pool().await else {
        return;
    };
    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;
    let acct = create_test_account(&repo, user.id).await;

    let in_range = NaiveDate::from_ymd_opt(2024, 6, 15).unwrap();
    let before_range = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();

    let t_in = make_contextual_txn(
        user.id,
        acct.id,
        "c1",
        -1000,
        in_range,
        "FOOD_AND_DRINK",
        Some("Starbucks"),
        Some("starbucks"),
    );
    let t_before = make_contextual_txn(
        user.id,
        acct.id,
        "c2",
        -2000,
        before_range,
        "FOOD_AND_DRINK",
        Some("Starbucks"),
        Some("starbucks"),
    );
    repo.upsert_transaction(&t_in).await.unwrap();
    repo.upsert_transaction(&t_before).await.unwrap();

    let start = NaiveDate::from_ymd_opt(2024, 6, 1).unwrap();
    let end = NaiveDate::from_ymd_opt(2024, 6, 30).unwrap();

    let result = repo
        .get_transactions_contextual_insights(
            &user.id,
            Some("starbucks"),
            None,
            Some(start),
            Some(end),
            None,
        )
        .await
        .unwrap();

    assert_eq!(result.state, InsightState::C);
    let spent = result.card1.value.unwrap();
    assert!(
        (spent - 30.0).abs() < 0.01,
        "expected lifetime sum 30.0, got {}",
        spent
    );
    assert_eq!(result.card1.secondary, Some(2.0));
}

#[tokio::test]
async fn given_unresolved_search_when_getting_contextual_insights_then_state_a() {
    let Some(pool) = connect_pool().await else {
        return;
    };
    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;
    let acct = create_test_account(&repo, user.id).await;
    let date = NaiveDate::from_ymd_opt(2024, 6, 1).unwrap();

    let t = make_contextual_txn(
        user.id,
        acct.id,
        "z1",
        -1000,
        date,
        "FOOD_AND_DRINK",
        Some("Starbucks"),
        Some("starbucks"),
    );
    repo.upsert_transaction(&t).await.unwrap();

    let result = repo
        .get_transactions_contextual_insights(&user.id, Some("zzznomatch"), None, None, None, None)
        .await
        .unwrap();

    assert_eq!(result.state, InsightState::A);
}

#[tokio::test]
async fn given_excluded_category_when_getting_contextual_insights_then_excluded_from_sum() {
    let Some(pool) = connect_pool().await else {
        return;
    };
    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;
    let acct = create_test_account(&repo, user.id).await;
    let date = NaiveDate::from_ymd_opt(2024, 6, 1).unwrap();

    let spending = make_contextual_txn(
        user.id,
        acct.id,
        "ex1",
        -5000,
        date,
        "FOOD_AND_DRINK",
        None,
        None,
    );
    let income = make_contextual_txn(user.id, acct.id, "ex2", 10000, date, "INCOME", None, None);
    repo.upsert_transaction(&spending).await.unwrap();
    repo.upsert_transaction(&income).await.unwrap();

    let result = repo
        .get_transactions_contextual_insights(&user.id, None, None, None, None, None)
        .await
        .unwrap();

    assert_eq!(result.state, InsightState::A);
    let spent = result.card1.value.unwrap();
    assert!(
        (spent - 50.0).abs() < 0.01,
        "expected 50.0 (INCOME excluded), got {}",
        spent
    );
    assert_eq!(result.card1.secondary, Some(2.0));
}

#[tokio::test]
async fn given_state_a_when_getting_contextual_insights_then_card3_subscription_split() {
    let Some(pool) = connect_pool().await else {
        return;
    };
    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;
    let acct = create_test_account(&repo, user.id).await;
    let date = NaiveDate::from_ymd_opt(2024, 6, 1).unwrap();

    let sub = make_contextual_txn(
        user.id,
        acct.id,
        "s1",
        -999,
        date,
        "SUBSCRIPTION",
        None,
        None,
    );
    let t1 = make_contextual_txn(
        user.id,
        acct.id,
        "s2",
        -2000,
        date,
        "FOOD_AND_DRINK",
        None,
        None,
    );
    let t2 = make_contextual_txn(
        user.id,
        acct.id,
        "s3",
        -3000,
        date,
        "FOOD_AND_DRINK",
        None,
        None,
    );
    repo.upsert_transaction(&sub).await.unwrap();
    repo.upsert_transaction(&t1).await.unwrap();
    repo.upsert_transaction(&t2).await.unwrap();

    let result = repo
        .get_transactions_contextual_insights(&user.id, None, None, None, None, None)
        .await
        .unwrap();

    assert_eq!(result.state, InsightState::A);
    let card3 = result.card3.unwrap();
    assert_eq!(card3.value, Some(1.0), "subscription count should be 1");
    assert_eq!(
        card3.secondary,
        Some(2.0),
        "non-subscription count should be 2"
    );
    assert_eq!(
        card3.format,
        crate::models::transaction::InsightFormat::Count
    );
}

#[tokio::test]
async fn given_state_b_when_getting_contextual_insights_then_card3_ratio_and_card1_share() {
    let Some(pool) = connect_pool().await else {
        return;
    };
    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;
    let acct = create_test_account(&repo, user.id).await;
    let date = NaiveDate::from_ymd_opt(2024, 6, 1).unwrap();

    for (suffix, cents) in [("r1", -1000_i64), ("r2", -3000), ("r3", -5000)] {
        let t = make_contextual_txn(user.id, acct.id, suffix, cents, date, "TRAVEL", None, None);
        repo.upsert_transaction(&t).await.unwrap();
    }
    for (suffix, cents) in [("r4", -2000_i64), ("r5", -4000)] {
        let t = make_contextual_txn(
            user.id,
            acct.id,
            suffix,
            cents,
            date,
            "FOOD_AND_DRINK",
            None,
            None,
        );
        repo.upsert_transaction(&t).await.unwrap();
    }

    let result = repo
        .get_transactions_contextual_insights(&user.id, None, None, None, None, Some("TRAVEL"))
        .await
        .unwrap();

    assert_eq!(result.state, InsightState::B);
    let card1_share = result.card1.share.unwrap();
    assert!(
        card1_share > 0.0 && card1_share < 1.0,
        "share should be between 0 and 1"
    );

    let card3 = result.card3.unwrap();
    assert!(card3.value.is_some(), "ratio should be computed");
    assert_eq!(
        card3.format,
        crate::models::transaction::InsightFormat::Ratio
    );
    assert!(
        card3.comparison.is_some(),
        "parent median should be in comparison"
    );
}

#[tokio::test]
async fn given_state_triple_when_getting_contextual_insights_then_card3_recency_days() {
    let Some(pool) = connect_pool().await else {
        return;
    };
    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;
    let acct = create_test_account(&repo, user.id).await;

    let old_date = NaiveDate::from_ymd_opt(2024, 5, 1).unwrap();
    let recent_date = NaiveDate::from_ymd_opt(2024, 6, 10).unwrap();

    let t1 = make_contextual_txn(
        user.id,
        acct.id,
        "tr1",
        -2000,
        old_date,
        "FOOD_AND_DRINK",
        Some("Starbucks"),
        Some("starbucks"),
    );
    let t2 = make_contextual_txn(
        user.id,
        acct.id,
        "tr2",
        -1500,
        recent_date,
        "FOOD_AND_DRINK",
        Some("Starbucks"),
        Some("starbucks"),
    );
    repo.upsert_transaction(&t1).await.unwrap();
    repo.upsert_transaction(&t2).await.unwrap();

    let result = repo
        .get_transactions_contextual_insights(
            &user.id,
            Some("starbucks"),
            Some(&[acct.id]),
            None,
            None,
            Some("FOOD_AND_DRINK"),
        )
        .await
        .unwrap();

    assert_eq!(result.state, InsightState::Triple);
    let card3 = result.card3.unwrap();
    assert!(card3.value.is_some(), "recency days should be computed");
    let days = card3.value.unwrap();
    assert!(days >= 0.0, "recency should be non-negative");
    assert_eq!(
        card3.format,
        crate::models::transaction::InsightFormat::Days
    );
}

#[tokio::test]
async fn given_empty_parent_when_getting_contextual_insights_then_card3_null_not_nan() {
    let Some(pool) = connect_pool().await else {
        return;
    };
    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;
    let acct = create_test_account(&repo, user.id).await;
    let date = NaiveDate::from_ymd_opt(2024, 6, 1).unwrap();

    let t = make_contextual_txn(
        user.id,
        acct.id,
        "ep1",
        -1000,
        date,
        "RARE_CATEGORY_XYZ",
        None,
        None,
    );
    repo.upsert_transaction(&t).await.unwrap();

    let result = repo
        .get_transactions_contextual_insights(
            &user.id,
            None,
            None,
            None,
            None,
            Some("RARE_CATEGORY_XYZ"),
        )
        .await
        .unwrap();

    assert_eq!(result.state, InsightState::B);
    let card3 = result.card3.unwrap();
    assert!(
        card3.value.is_none(),
        "ratio should be null when subset < 2 rows"
    );
}

#[tokio::test]
async fn given_two_accounts_with_category_filter_when_getting_state_e_then_shares_sum_to_one() {
    let Some(pool) = connect_pool().await else {
        return;
    };
    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;
    let acct1 = create_test_account(&repo, user.id).await;
    let acct2 = create_test_account(&repo, user.id).await;
    let date = NaiveDate::from_ymd_opt(2024, 6, 1).unwrap();

    let t1 = make_contextual_txn(
        user.id,
        acct1.id,
        "e1",
        -2000,
        date,
        "FOOD_AND_DRINK",
        None,
        None,
    );
    let t2 = make_contextual_txn(
        user.id,
        acct2.id,
        "e2",
        -3000,
        date,
        "FOOD_AND_DRINK",
        None,
        None,
    );
    repo.upsert_transaction(&t1).await.unwrap();
    repo.upsert_transaction(&t2).await.unwrap();

    let result1 = repo
        .get_transactions_contextual_insights(
            &user.id,
            None,
            Some(&[acct1.id]),
            None,
            None,
            Some("FOOD_AND_DRINK"),
        )
        .await
        .unwrap();

    let result2 = repo
        .get_transactions_contextual_insights(
            &user.id,
            None,
            Some(&[acct2.id]),
            None,
            None,
            Some("FOOD_AND_DRINK"),
        )
        .await
        .unwrap();

    assert_eq!(result1.state, InsightState::E);
    assert_eq!(result2.state, InsightState::E);

    let share1 = result1.card3.unwrap().value.unwrap();
    let share2 = result2.card3.unwrap().value.unwrap();

    assert!(
        (share1 - 0.4).abs() < 0.001,
        "acct1 share should be 40%, got {}",
        share1
    );
    assert!(
        (share2 - 0.6).abs() < 0.001,
        "acct2 share should be 60%, got {}",
        share2
    );
    assert!(
        (share1 + share2 - 1.0).abs() < 0.001,
        "shares must sum to 1.0, got {}",
        share1 + share2
    );
}
