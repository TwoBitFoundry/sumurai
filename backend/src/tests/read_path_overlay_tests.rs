use crate::connection_pool::RepositoryPool;
use crate::db;
use crate::db::PgPool;
use crate::models::transaction::Transaction;
use crate::services::repository_service::{DatabaseRepository, PostgresRepository};
use crate::utils::encryption_key::parse_encryption_key_hex;
use chrono::NaiveDate;
use rust_decimal_macros::dec;
use uuid::Uuid;

fn open_repository(pool: PgPool) -> PostgresRepository {
    let raw = std::env::var("ENCRYPTION_KEY")
        .expect("ENCRYPTION_KEY must be set when DATABASE_URL is set");
    let key = parse_encryption_key_hex(&raw).expect("ENCRYPTION_KEY must be 64 hex characters");
    PostgresRepository::new(RepositoryPool::from_pg_pool(pool), key)
}

async fn connect_pool() -> Option<PgPool> {
    if std::env::var("DATABASE_URL").is_err() {
        eprintln!("[read_path_overlay_tests] Skipping: DATABASE_URL not set");
        return None;
    }

    let database_url = std::env::var("DATABASE_URL").unwrap();
    match PgPool::connect(&database_url).await {
        Ok(pool) => Some(pool),
        Err(err) => {
            eprintln!(
                "[read_path_overlay_tests] Skipping: cannot connect to DB: {}",
                err
            );
            None
        }
    }
}

async fn setup_test_data(
    pool: &PgPool,
    user_id: &Uuid,
) -> (Uuid, Uuid, Uuid, Transaction, Transaction) {
    let account_id = Uuid::new_v4();
    db::query("INSERT INTO accounts (id, user_id, account_type, mask) VALUES ($1, $2, $3, $4)")
        .bind(account_id)
        .bind(user_id)
        .bind("checking")
        .bind("1234")
        .execute(pool)
        .await
        .unwrap();

    let txn1_id = Uuid::new_v4();
    let txn1 = Transaction {
        id: txn1_id,
        account_id,
        user_id: Some(*user_id),
        provider_account_id: None,
        provider_transaction_id: Some("txn_001".to_string()),
        amount: dec!(-25.00),
        date: NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
        merchant_name: Some("Starbucks".to_string()),
        category_primary: "FOOD_AND_DRINK".to_string(),
        category_detailed: "Coffee".to_string(),
        category_confidence: "HIGH".to_string(),
        payment_channel: None,
        pending: false,
        created_at: None,
    };

    db::query(
        "INSERT INTO transactions (id, account_id, user_id, amount, date, merchant_name, category_primary, category_detailed, category_confidence, pending)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"
    )
    .bind(txn1.id)
    .bind(txn1.account_id)
    .bind(txn1.user_id)
    .bind(txn1.amount)
    .bind(txn1.date)
    .bind(&txn1.merchant_name)
    .bind(&txn1.category_primary)
    .bind(&txn1.category_detailed)
    .bind(&txn1.category_confidence)
    .bind(txn1.pending)
    .execute(pool)
    .await
    .unwrap();

    let txn2_id = Uuid::new_v4();
    let txn2 = Transaction {
        id: txn2_id,
        account_id,
        user_id: Some(*user_id),
        provider_account_id: None,
        provider_transaction_id: Some("txn_002".to_string()),
        amount: dec!(-30.00),
        date: NaiveDate::from_ymd_opt(2024, 1, 2).unwrap(),
        merchant_name: Some("Starbucks".to_string()),
        category_primary: "FOOD_AND_DRINK".to_string(),
        category_detailed: "Coffee".to_string(),
        category_confidence: "HIGH".to_string(),
        payment_channel: None,
        pending: false,
        created_at: None,
    };

    db::query(
        "INSERT INTO transactions (id, account_id, user_id, amount, date, merchant_name, category_primary, category_detailed, category_confidence, pending)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"
    )
    .bind(txn2.id)
    .bind(txn2.account_id)
    .bind(txn2.user_id)
    .bind(txn2.amount)
    .bind(txn2.date)
    .bind(&txn2.merchant_name)
    .bind(&txn2.category_primary)
    .bind(&txn2.category_detailed)
    .bind(&txn2.category_confidence)
    .bind(txn2.pending)
    .execute(pool)
    .await
    .unwrap();

    let custom_cat_id = Uuid::new_v4();

    (account_id, custom_cat_id, txn1_id, txn1, txn2)
}

#[tokio::test]
async fn given_override_when_listing_transactions_then_returns_effective_category() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let user_id = Uuid::new_v4();

    db::query("INSERT INTO users (id, email, password_hash, provider) VALUES ($1, $2, $3, $4)")
        .bind(user_id)
        .bind(format!("user{}@test.com", user_id))
        .bind("hash")
        .bind("plaid")
        .execute(&pool)
        .await
        .unwrap();

    let (_, _, _, _, _) = setup_test_data(&pool, &user_id).await;

    db::query(
        "INSERT INTO transaction_category_overrides (id, user_id, normalized_merchant, category_name, custom_category_id)
         VALUES ($1, $2, $3, $4, $5)"
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind("starbucks")
    .bind("Coffee")
    .bind(Option::<Uuid>::None)
    .execute(&pool)
    .await
    .unwrap();

    let repo = open_repository(pool);
    let result = repo
        .get_transactions_paginated(&user_id, 100, 0, None, None, None, None, None)
        .await
        .unwrap();

    assert_eq!(result.len(), 2);
    assert_eq!(result[0].category_primary, "Coffee");
    assert_eq!(result[1].category_primary, "Coffee");
    assert!(result.iter().all(|t| t.is_overridden));
    assert!(result.iter().all(|t| !t.is_custom));
}

#[tokio::test]
async fn given_no_override_when_listing_transactions_then_returns_stored_category() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let user_id = Uuid::new_v4();

    db::query("INSERT INTO users (id, email, password_hash, provider) VALUES ($1, $2, $3, $4)")
        .bind(user_id)
        .bind(format!("user{}@test.com", user_id))
        .bind("hash")
        .bind("plaid")
        .execute(&pool)
        .await
        .unwrap();

    let (_, _, _, txn1, txn2) = setup_test_data(&pool, &user_id).await;

    let repo = open_repository(pool);
    let result = repo
        .get_transactions_paginated(&user_id, 100, 0, None, None, None, None, None)
        .await
        .unwrap();

    assert_eq!(result.len(), 2);
    assert_eq!(result[0].category_primary, txn2.category_primary);
    assert_eq!(result[1].category_primary, txn1.category_primary);
    assert!(result.iter().all(|t| !t.is_overridden));
    assert!(result.iter().all(|t| !t.is_custom));
}

#[tokio::test]
async fn given_custom_category_override_when_listing_transactions_then_marks_is_custom() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let user_id = Uuid::new_v4();

    db::query("INSERT INTO users (id, email, password_hash, provider) VALUES ($1, $2, $3, $4)")
        .bind(user_id)
        .bind(format!("user{}@test.com", user_id))
        .bind("hash")
        .bind("plaid")
        .execute(&pool)
        .await
        .unwrap();

    let (_, custom_cat_id, txn1_id, _, _) = setup_test_data(&pool, &user_id).await;

    db::query(
        "INSERT INTO user_custom_categories (id, user_id, display_name, lookup_key)
         VALUES ($1, $2, $3, $4)",
    )
    .bind(custom_cat_id)
    .bind(user_id)
    .bind("Coffee")
    .bind("coffee")
    .execute(&pool)
    .await
    .unwrap();

    db::query(
        "INSERT INTO transaction_category_overrides (id, user_id, normalized_merchant, category_name, custom_category_id)
         SELECT $1, $2, t.normalized_merchant, $3, $4
         FROM transactions t
         WHERE t.id = $5",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind("Coffee")
    .bind(custom_cat_id)
    .bind(txn1_id)
    .execute(&pool)
    .await
    .unwrap();

    let repo = open_repository(pool);
    let result = repo
        .get_transactions_paginated(&user_id, 100, 0, None, None, None, None, None)
        .await
        .unwrap();

    let overridden = result
        .iter()
        .find(|t| t.id == txn1_id)
        .expect("transaction with override");
    assert_eq!(overridden.category_primary, "Coffee");
    assert!(overridden.is_overridden);
    assert!(overridden.is_custom);
}

#[tokio::test]
async fn given_filter_by_overridden_category_when_listing_then_returns_matching_rows() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let user_id = Uuid::new_v4();

    db::query("INSERT INTO users (id, email, password_hash, provider) VALUES ($1, $2, $3, $4)")
        .bind(user_id)
        .bind(format!("user{}@test.com", user_id))
        .bind("hash")
        .bind("plaid")
        .execute(&pool)
        .await
        .unwrap();

    let (_, _, _, _, _) = setup_test_data(&pool, &user_id).await;

    db::query(
        "INSERT INTO transaction_category_overrides (id, user_id, normalized_merchant, category_name, custom_category_id)
         VALUES ($1, $2, $3, $4, $5)"
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind("starbucks")
    .bind("Coffee")
    .bind(Option::<Uuid>::None)
    .execute(&pool)
    .await
    .unwrap();

    let repo = open_repository(pool);
    let result = repo
        .get_transactions_paginated(&user_id, 100, 0, None, None, None, None, Some("Coffee"))
        .await
        .unwrap();

    assert_eq!(result.len(), 2);
    assert!(result.iter().all(|t| t.category_primary == "Coffee"));
}

#[tokio::test]
async fn given_insights_when_override_exists_then_aggregates_by_effective_category() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let user_id = Uuid::new_v4();

    db::query("INSERT INTO users (id, email, password_hash, provider) VALUES ($1, $2, $3, $4)")
        .bind(user_id)
        .bind(format!("user{}@test.com", user_id))
        .bind("hash")
        .bind("plaid")
        .execute(&pool)
        .await
        .unwrap();

    let (_, _, _, _, _) = setup_test_data(&pool, &user_id).await;

    db::query(
        "INSERT INTO transaction_category_overrides (id, user_id, normalized_merchant, category_name, custom_category_id)
         VALUES ($1, $2, $3, $4, $5)"
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind("starbucks")
    .bind("Coffee")
    .bind(Option::<Uuid>::None)
    .execute(&pool)
    .await
    .unwrap();

    let repo = open_repository(pool);
    let insights = repo
        .get_transactions_insights(&user_id, None, None, None, None, None)
        .await
        .unwrap();

    assert_eq!(insights.total_count, 2);
    assert!(insights
        .top_categories
        .iter()
        .any(|c| c == &"Coffee".to_string()));
}
