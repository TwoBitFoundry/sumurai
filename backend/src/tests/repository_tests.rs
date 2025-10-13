use crate::models::{
    account::Account, auth::User, plaid::PlaidConnection, transaction::Transaction,
};

use crate::models::plaid::PlaidCredentials;
use crate::services::repository_service::{DatabaseRepository, MockDatabaseRepository};

use chrono::{NaiveDate, Utc};
use mockall::predicate;
use rust_decimal_macros::dec;
use std::collections::HashMap;
use uuid::Uuid;

mod fixtures {
    use super::*;
    use crate::models::auth::User;

    pub fn sample_user() -> User {
        User {
            id: Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap(),
            email: "test@example.com".to_string(),
            password_hash: "hashed_password".to_string(),
            provider: "teller".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            onboarding_completed: false,
        }
    }

    pub fn another_user() -> User {
        User {
            id: Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap(),
            email: "user2@example.com".to_string(),
            password_hash: "hashed_password2".to_string(),
            provider: "teller".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            onboarding_completed: false,
        }
    }

    pub fn sample_account(user_id: Option<Uuid>) -> Account {
        Account {
            id: Uuid::parse_str("a50e8400-e29b-41d4-a716-446655440000").unwrap(),
            user_id,
            provider_account_id: Some("test_plaid_id".to_string()),
            provider_connection_id: None,
            name: "Test Account".to_string(),
            account_type: "depository".to_string(),
            balance_current: Some(dec!(1000.00)),
            mask: None,
            institution_name: None,
        }
    }

    pub fn sample_transaction(account_id: Uuid) -> Transaction {
        Transaction {
            id: Uuid::parse_str("a50e8400-e29b-41d4-a716-446655440000").unwrap(),
            account_id,
            user_id: Some(Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap()),
            provider_account_id: None,
            provider_transaction_id: Some("plaid_txn_1".to_string()),
            amount: dec!(-25.50),
            date: NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
            merchant_name: Some("Test Merchant".to_string()),
            category_primary: "Food and Drink".to_string(),
            category_detailed: "Restaurants".to_string(),
            category_confidence: "VERY_HIGH".to_string(),
            payment_channel: Some("online".to_string()),
            pending: false,
            created_at: Some(Utc::now()),
        }
    }

    pub fn sample_plaid_connection(user_id: Uuid) -> PlaidConnection {
        PlaidConnection {
            id: Uuid::parse_str("a50e8400-e29b-41d4-a716-446655440002").unwrap(),
            user_id,
            item_id: "test_item_id".to_string(),
            is_connected: true,
            last_sync_at: Some(Utc::now()),
            connected_at: Some(Utc::now()),
            disconnected_at: None,
            institution_id: Some("ins_test".to_string()),
            institution_name: Some("Test Bank".to_string()),
            institution_logo_url: None,
            sync_cursor: None,
            transaction_count: 0,
            account_count: 1,
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        }
    }
}

#[tokio::test]
async fn given_mock_repository_when_upsert_account_then_succeeds() {
    let mut mock_repo = MockDatabaseRepository::new();
    let account = fixtures::sample_account(None);

    mock_repo
        .expect_upsert_account()
        .with(mockall::predicate::eq(account.clone()))
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let result = mock_repo.upsert_account(&account).await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn given_failing_repository_when_upsert_account_then_fails() {
    let mut mock_repo = MockDatabaseRepository::new();
    let account = fixtures::sample_account(None);

    mock_repo
        .expect_upsert_account()
        .with(mockall::predicate::eq(account.clone()))
        .times(1)
        .returning(|_| Box::pin(async { Err(anyhow::anyhow!("Database error")) }));

    let result = mock_repo.upsert_account(&account).await;

    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("Database error"));
}

#[tokio::test]
async fn given_known_plaid_id_when_get_account_then_found() {
    let mut mock_repo = MockDatabaseRepository::new();
    let plaid_id = "test_account";
    let _account = fixtures::sample_account(None);

    mock_repo
        .expect_get_account_by_plaid_id()
        .with(mockall::predicate::eq(plaid_id))
        .times(1)
        .returning(move |_| Box::pin(async move { Ok(Some(fixtures::sample_account(None))) }));

    let result = mock_repo.get_account_by_plaid_id(plaid_id).await;

    assert!(result.is_ok());
    let account = result.unwrap();
    assert!(account.is_some());
    assert_eq!(
        account.unwrap().provider_account_id,
        Some("test_plaid_id".to_string())
    );
}

#[tokio::test]
async fn given_unknown_plaid_id_when_get_account_then_not_found() {
    let mut mock_repo = MockDatabaseRepository::new();
    let plaid_id = "unknown_account";

    mock_repo
        .expect_get_account_by_plaid_id()
        .with(mockall::predicate::eq(plaid_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(None) }));

    let result = mock_repo.get_account_by_plaid_id(plaid_id).await;

    assert!(result.is_ok());
    let account = result.unwrap();
    assert!(account.is_none());
}

#[tokio::test]
async fn given_valid_credentials_when_store_then_succeeds() {
    let mut mock_repo = MockDatabaseRepository::new();
    let item_id = "test_item";
    let access_token = "test_access_token";
    let expected_id = Uuid::new_v4();

    mock_repo
        .expect_store_provider_credentials()
        .with(
            mockall::predicate::eq(item_id),
            mockall::predicate::eq(access_token),
        )
        .times(1)
        .returning(move |_, _| Box::pin(async move { Ok(expected_id) }));

    let result = mock_repo
        .store_provider_credentials(item_id, access_token)
        .await;

    assert!(result.is_ok());
    let id = result.unwrap();
    assert!(!id.is_nil());
}

#[tokio::test]
async fn given_known_item_id_when_get_credentials_then_found() {
    let mut mock_repo = MockDatabaseRepository::new();
    let item_id = "test_item";
    let user_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
    let plaid_connection = fixtures::sample_plaid_connection(user_id);
    let expected_credentials = PlaidCredentials {
        id: plaid_connection.id,
        item_id: plaid_connection.item_id.clone(),
        user_id: Some(plaid_connection.user_id),
        access_token: "test_access_token".to_string(),
        created_at: plaid_connection.created_at.unwrap(),
        updated_at: plaid_connection.updated_at.unwrap(),
    };

    mock_repo
        .expect_get_provider_credentials()
        .with(mockall::predicate::eq(item_id))
        .times(1)
        .returning({
            let expected_credentials = expected_credentials.clone();
            move |_| {
                Box::pin({
                    let value = expected_credentials.clone();
                    async move { Ok(Some(value.clone())) }
                })
            }
        });

    let result = mock_repo.get_provider_credentials(item_id).await;

    assert!(result.is_ok());
    let credentials = result.unwrap();
    assert!(credentials.is_some());
    let creds = credentials.unwrap();
    assert_eq!(creds.item_id, "test_item_id");
    assert_eq!(creds.access_token, "test_access_token");
}

#[tokio::test]
async fn given_valid_transaction_when_upsert_then_succeeds() {
    let mut mock_repo = MockDatabaseRepository::new();
    let account_id = Uuid::new_v4();
    let transaction = fixtures::sample_transaction(account_id);

    mock_repo
        .expect_upsert_transaction()
        .with(mockall::predicate::eq(transaction.clone()))
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let result = mock_repo.upsert_transaction(&transaction).await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn given_valid_user_data_when_creating_user_then_stores_with_uuid_and_timestamps() {
    let mut mock_repo = MockDatabaseRepository::new();
    let user = fixtures::sample_user();

    mock_repo
        .expect_create_user()
        .with(mockall::predicate::eq(user.clone()))
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_get_user_by_email()
        .with(mockall::predicate::eq(user.email.clone()))
        .times(1)
        .returning(move |_| Box::pin(async move { Ok(Some(fixtures::sample_user())) }));

    let result = mock_repo.create_user(&user).await;

    assert!(result.is_ok());

    let retrieved = mock_repo.get_user_by_email(&user.email).await;
    assert!(retrieved.is_ok());
}

#[tokio::test]
async fn given_duplicate_email_when_creating_user_then_returns_unique_constraint_error() {
    let mut mock_repo = MockDatabaseRepository::new();
    let user1 = fixtures::sample_user();
    let mut user2 = fixtures::another_user();
    user2.email = user1.email.clone();

    mock_repo
        .expect_create_user()
        .with(mockall::predicate::eq(user1.clone()))
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_create_user()
        .with(mockall::predicate::eq(user2.clone()))
        .times(1)
        .returning(|_| Box::pin(async { Err(anyhow::anyhow!("Unique constraint violation")) }));

    let result1 = mock_repo.create_user(&user1).await;
    assert!(result1.is_ok());

    let result2 = mock_repo.create_user(&user2).await;

    assert!(result2.is_err());
    assert!(result2.unwrap_err().to_string().contains("constraint"));
}

#[tokio::test]
async fn given_user_foreign_keys_when_adding_to_existing_tables_then_enforces_referential_integrity(
) {
    let mut mock_repo = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();
    let user = User {
        id: user_id,
        email: "test@example.com".to_string(),
        password_hash: "hashed_password".to_string(),
        provider: "teller".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        onboarding_completed: false,
    };

    mock_repo
        .expect_create_user()
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_account()
        .returning(|_| Box::pin(async { Ok(()) }));

    let user_result = mock_repo.create_user(&user).await;
    assert!(user_result.is_ok());

    let account = Account {
        id: Uuid::new_v4(),
        user_id: Some(user_id),
        provider_account_id: Some("test_plaid_account".to_string()),
        provider_connection_id: None,
        name: "Test Account".to_string(),
        account_type: "depository".to_string(),
        balance_current: Some(rust_decimal::Decimal::new(100000, 2)),
        mask: None,
        institution_name: None,
    };

    let account_result = mock_repo.upsert_account(&account).await;

    assert!(account_result.is_ok());
}

#[tokio::test]
async fn given_invalid_user_id_when_creating_transaction_then_returns_foreign_key_error() {
    let mut mock_repo = MockDatabaseRepository::new();
    let non_existent_user_id = Uuid::new_v4();
    let account_id = Uuid::new_v4();

    let transaction = Transaction {
        id: Uuid::new_v4(),
        account_id,
        user_id: Some(non_existent_user_id),
        provider_account_id: None,
        provider_transaction_id: Some("test_txn".to_string()),
        amount: rust_decimal::Decimal::new(2550, 2),
        date: chrono::NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
        merchant_name: Some("Test Merchant".to_string()),
        category_primary: "Food and Drink".to_string(),
        category_detailed: "Restaurants".to_string(),
        category_confidence: "VERY_HIGH".to_string(),
        payment_channel: Some("in_store".to_string()),
        pending: false,
        created_at: Some(chrono::Utc::now()),
    };

    mock_repo
        .expect_upsert_transaction()
        .returning(|_| Box::pin(async { Ok(()) }));

    let result = mock_repo.upsert_transaction(&transaction).await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn given_row_level_security_policies_when_querying_then_enforces_user_isolation() {
    let mut mock_repo = MockDatabaseRepository::new();

    let user1_id = Uuid::new_v4();
    let user2_id = Uuid::new_v4();

    let user1 = User {
        id: user1_id,
        email: "user1@test.com".to_string(),
        password_hash: "hashed_password1".to_string(),
        provider: "teller".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        onboarding_completed: false,
    };

    let user2 = User {
        id: user2_id,
        email: "user2@test.com".to_string(),
        password_hash: "hashed_password2".to_string(),
        provider: "teller".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        onboarding_completed: false,
    };

    let user1_transaction = Transaction {
        id: Uuid::new_v4(),
        account_id: Uuid::new_v4(),
        user_id: Some(user1_id),
        provider_account_id: None,
        provider_transaction_id: Some("user1_txn".to_string()),
        amount: rust_decimal::Decimal::new(5000, 2),
        date: chrono::NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
        merchant_name: Some("User1 Store".to_string()),
        category_primary: "Food and Drink".to_string(),
        category_detailed: "Restaurants".to_string(),
        category_confidence: "VERY_HIGH".to_string(),
        payment_channel: Some("in_store".to_string()),
        pending: false,
        created_at: Some(chrono::Utc::now()),
    };

    let user2_transaction = Transaction {
        id: Uuid::new_v4(),
        account_id: Uuid::new_v4(),
        user_id: Some(user2_id),
        provider_account_id: None,
        provider_transaction_id: Some("user2_txn".to_string()),
        amount: rust_decimal::Decimal::new(7500, 2),
        date: chrono::NaiveDate::from_ymd_opt(2024, 1, 16).unwrap(),
        merchant_name: Some("User2 Store".to_string()),
        category_primary: "Transportation".to_string(),
        category_detailed: "Gas Stations".to_string(),
        category_confidence: "VERY_HIGH".to_string(),
        payment_channel: Some("in_store".to_string()),
        pending: false,
        created_at: Some(chrono::Utc::now()),
    };

    mock_repo
        .expect_create_user()
        .times(2)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_transaction()
        .times(2)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_get_transactions_for_user()
        .with(mockall::predicate::eq(user1_id))
        .returning({
            let user1_transaction_clone = user1_transaction.clone();
            move |_| {
                Box::pin({
                    let value = user1_transaction_clone.clone();
                    async move { Ok(vec![value.clone()]) }
                })
            }
        });

    mock_repo
        .expect_get_transactions_for_user()
        .with(mockall::predicate::eq(user2_id))
        .returning({
            let user2_transaction_clone = user2_transaction.clone();
            move |_| {
                Box::pin({
                    let value = user2_transaction_clone.clone();
                    async move { Ok(vec![value.clone()]) }
                })
            }
        });

    mock_repo.create_user(&user1).await.unwrap();
    mock_repo.create_user(&user2).await.unwrap();

    mock_repo
        .upsert_transaction(&user1_transaction)
        .await
        .unwrap();
    mock_repo
        .upsert_transaction(&user2_transaction)
        .await
        .unwrap();

    let user1_transactions = mock_repo.get_transactions_for_user(&user1_id).await;
    let user2_transactions = mock_repo.get_transactions_for_user(&user2_id).await;

    assert!(user1_transactions.is_ok());
    assert!(user2_transactions.is_ok());

    let user1_txns = user1_transactions.unwrap();
    let user2_txns = user2_transactions.unwrap();
    assert_eq!(user1_txns.len(), 1);
    assert_eq!(user2_txns.len(), 1);

    assert_eq!(user1_txns[0].user_id, Some(user1_id));
    assert_eq!(user2_txns[0].user_id, Some(user2_id));
}

#[tokio::test]
async fn given_user_context_when_querying_accounts_then_returns_only_user_accounts() {
    let mut mock_repo = MockDatabaseRepository::new();

    let user1_id = Uuid::new_v4();
    let user2_id = Uuid::new_v4();

    let user1 = User {
        id: user1_id,
        email: "accountuser1@test.com".to_string(),
        password_hash: "hashed_password1".to_string(),
        provider: "teller".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        onboarding_completed: false,
    };

    let user2 = User {
        id: user2_id,
        email: "accountuser2@test.com".to_string(),
        password_hash: "hashed_password2".to_string(),
        provider: "teller".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        onboarding_completed: false,
    };

    let user1_account = Account {
        id: Uuid::new_v4(),
        user_id: Some(user1_id),
        provider_account_id: Some("user1_checking".to_string()),
        provider_connection_id: None,
        name: "User1 Checking".to_string(),
        account_type: "depository".to_string(),
        balance_current: Some(rust_decimal::Decimal::new(100000, 2)),
        mask: None,
        institution_name: None,
    };

    let user2_account = Account {
        id: Uuid::new_v4(),
        user_id: Some(user2_id),
        provider_account_id: Some("user2_savings".to_string()),
        provider_connection_id: None,
        name: "User2 Savings".to_string(),
        account_type: "depository".to_string(),
        balance_current: Some(rust_decimal::Decimal::new(500000, 2)),
        mask: None,
        institution_name: None,
    };

    mock_repo
        .expect_create_user()
        .times(2)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_account()
        .times(2)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_get_accounts_for_user()
        .with(mockall::predicate::eq(user1_id))
        .returning({
            let user1_account_clone = user1_account.clone();
            move |_| {
                Box::pin({
                    let value = user1_account_clone.clone();
                    async move { Ok(vec![value.clone()]) }
                })
            }
        });

    mock_repo
        .expect_get_accounts_for_user()
        .with(mockall::predicate::eq(user2_id))
        .returning({
            let user2_account_clone = user2_account.clone();
            move |_| {
                Box::pin({
                    let value = user2_account_clone.clone();
                    async move { Ok(vec![value.clone()]) }
                })
            }
        });

    mock_repo.create_user(&user1).await.unwrap();
    mock_repo.create_user(&user2).await.unwrap();

    mock_repo.upsert_account(&user1_account).await.unwrap();
    mock_repo.upsert_account(&user2_account).await.unwrap();

    let user1_accounts = mock_repo.get_accounts_for_user(&user1_id).await;
    let user2_accounts = mock_repo.get_accounts_for_user(&user2_id).await;

    assert!(user1_accounts.is_ok());
    assert!(user2_accounts.is_ok());

    let user1_accts = user1_accounts.unwrap();
    let user2_accts = user2_accounts.unwrap();
    assert_eq!(user1_accts.len(), 1);
    assert_eq!(user2_accts.len(), 1);

    assert_eq!(user1_accts[0].user_id, Some(user1_id));
    assert_eq!(user2_accts[0].user_id, Some(user2_id));
    assert_eq!(user1_accts[0].name, "User1 Checking");
    assert_eq!(user2_accts[0].name, "User2 Savings");
}

#[tokio::test]
async fn given_database_indexes_when_querying_user_data_then_uses_efficient_query_plans() {
    let mut mock_repo = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();
    let user = User {
        id: user_id,
        email: "performance@test.com".to_string(),
        password_hash: "hashed_password".to_string(),
        provider: "teller".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        onboarding_completed: false,
    };

    mock_repo
        .expect_create_user()
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_get_transactions_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_repo
        .expect_get_accounts_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_repo.create_user(&user).await.unwrap();

    let start_time = std::time::Instant::now();
    let _transactions = mock_repo.get_transactions_for_user(&user_id).await;
    let _accounts = mock_repo.get_accounts_for_user(&user_id).await;
    let query_duration = start_time.elapsed();

    assert!(query_duration.as_millis() < 1000);
}

#[tokio::test]
async fn given_user_deletion_when_cascading_then_removes_all_related_session_data() {
    let mut mock_repo = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();
    let user = User {
        id: user_id,
        email: "cascade@test.com".to_string(),
        password_hash: "hashed_password".to_string(),
        provider: "teller".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        onboarding_completed: false,
    };

    let account = Account {
        id: Uuid::new_v4(),
        user_id: Some(user_id),
        provider_account_id: Some("cascade_account".to_string()),
        provider_connection_id: None,
        name: "Cascade Test Account".to_string(),
        account_type: "depository".to_string(),
        balance_current: Some(rust_decimal::Decimal::new(100000, 2)),
        mask: None,
        institution_name: None,
    };

    let transaction = Transaction {
        id: Uuid::new_v4(),
        account_id: account.id,
        user_id: Some(user_id),
        provider_account_id: None,
        provider_transaction_id: Some("cascade_txn".to_string()),
        amount: rust_decimal::Decimal::new(5000, 2),
        date: chrono::NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
        merchant_name: Some("Cascade Store".to_string()),
        category_primary: "Food and Drink".to_string(),
        category_detailed: "Restaurants".to_string(),
        category_confidence: "VERY_HIGH".to_string(),
        payment_channel: Some("in_store".to_string()),
        pending: false,
        created_at: Some(chrono::Utc::now()),
    };

    mock_repo
        .expect_create_user()
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_account()
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_transaction()
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_delete_user()
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_get_user_by_id()
        .returning(|_| Box::pin(async { Ok(None) }));

    mock_repo
        .expect_get_accounts_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_repo
        .expect_get_transactions_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_repo.create_user(&user).await.unwrap();
    mock_repo.upsert_account(&account).await.unwrap();
    mock_repo.upsert_transaction(&transaction).await.unwrap();

    let result = mock_repo.delete_user(&user_id).await;

    assert!(result.is_ok());

    let deleted_user = mock_repo.get_user_by_id(&user_id).await;
    assert!(deleted_user.is_ok());
    assert!(deleted_user.unwrap().is_none());

    let user_accounts = mock_repo.get_accounts_for_user(&user_id).await;
    assert!(user_accounts.is_ok());
    assert_eq!(user_accounts.unwrap().len(), 0);

    let user_transactions = mock_repo.get_transactions_for_user(&user_id).await;
    assert!(user_transactions.is_ok());
    assert_eq!(user_transactions.unwrap().len(), 0);
}

#[tokio::test]
async fn given_two_users_when_querying_transactions_then_each_sees_only_their_own_data() {
    let mut mock_repo = MockDatabaseRepository::new();

    let user1_id = Uuid::new_v4();
    let user2_id = Uuid::new_v4();

    let user1 = User {
        id: user1_id,
        email: "user1_isolation@test.com".to_string(),
        password_hash: "hashed_password1".to_string(),
        provider: "teller".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        onboarding_completed: false,
    };

    let user2 = User {
        id: user2_id,
        email: "user2_isolation@test.com".to_string(),
        password_hash: "hashed_password2".to_string(),
        provider: "teller".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        onboarding_completed: false,
    };

    let _user1_clone = user1.clone();
    let _user2_clone = user2.clone();
    mock_repo
        .expect_create_user()
        .withf(move |user| user.email == "user1_isolation@test.com")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_create_user()
        .withf(move |user| user.email == "user2_isolation@test.com")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo.create_user(&user1).await.unwrap();
    mock_repo.create_user(&user2).await.unwrap();

    let user1_account = Account {
        id: Uuid::new_v4(),
        user_id: Some(user1_id),
        provider_account_id: Some("user1_account".to_string()),
        provider_connection_id: None,
        name: "User1 Account".to_string(),
        account_type: "depository".to_string(),
        balance_current: Some(rust_decimal::Decimal::new(100000, 2)),
        mask: None,
        institution_name: None,
    };

    let user2_account = Account {
        id: Uuid::new_v4(),
        user_id: Some(user2_id),
        provider_account_id: Some("user2_account".to_string()),
        provider_connection_id: None,
        name: "User2 Account".to_string(),
        account_type: "depository".to_string(),
        balance_current: Some(rust_decimal::Decimal::new(200000, 2)),
        mask: None,
        institution_name: None,
    };

    mock_repo
        .expect_upsert_account()
        .withf(move |account| account.name == "User1 Account")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_account()
        .withf(move |account| account.name == "User2 Account")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo.upsert_account(&user1_account).await.unwrap();
    mock_repo.upsert_account(&user2_account).await.unwrap();

    let user1_transaction = Transaction {
        id: Uuid::new_v4(),
        account_id: user1_account.id,
        user_id: Some(user1_id),
        provider_account_id: None,
        provider_transaction_id: Some("user1_txn_123".to_string()),
        amount: rust_decimal::Decimal::new(2500, 2),
        date: chrono::NaiveDate::from_ymd_opt(2024, 1, 10).unwrap(),
        merchant_name: Some("User1 Store".to_string()),
        category_primary: "Food and Drink".to_string(),
        category_detailed: "Restaurants".to_string(),
        category_confidence: "VERY_HIGH".to_string(),
        payment_channel: Some("in_store".to_string()),
        pending: false,
        created_at: Some(chrono::Utc::now()),
    };

    let user2_transaction = Transaction {
        id: Uuid::new_v4(),
        account_id: user2_account.id,
        user_id: Some(user2_id),
        provider_account_id: None,
        provider_transaction_id: Some("user2_txn_456".to_string()),
        amount: rust_decimal::Decimal::new(7500, 2),
        date: chrono::NaiveDate::from_ymd_opt(2024, 1, 11).unwrap(),
        merchant_name: Some("User2 Shop".to_string()),
        category_primary: "Transportation".to_string(),
        category_detailed: "Gas Stations".to_string(),
        category_confidence: "HIGH".to_string(),
        payment_channel: Some("in_store".to_string()),
        pending: false,
        created_at: Some(chrono::Utc::now()),
    };

    let _user1_txn_clone = user1_transaction.clone();
    let _user2_txn_clone = user2_transaction.clone();
    mock_repo
        .expect_upsert_transaction()
        .withf(move |txn| txn.merchant_name == Some("User1 Store".to_string()))
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_transaction()
        .withf(move |txn| txn.merchant_name == Some("User2 Shop".to_string()))
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let user1_txn_result = user1_transaction.clone();
    let user2_txn_result = user2_transaction.clone();
    mock_repo
        .expect_get_transactions_for_user()
        .with(mockall::predicate::eq(user1_id))
        .times(1)
        .returning(move |_| {
            let txn = user1_txn_result.clone();
            Box::pin(async move { Ok(vec![txn]) })
        });

    mock_repo
        .expect_get_transactions_for_user()
        .with(mockall::predicate::eq(user2_id))
        .times(1)
        .returning(move |_| {
            let txn = user2_txn_result.clone();
            Box::pin(async move { Ok(vec![txn]) })
        });

    mock_repo
        .upsert_transaction(&user1_transaction)
        .await
        .unwrap();
    mock_repo
        .upsert_transaction(&user2_transaction)
        .await
        .unwrap();

    let user1_transactions = mock_repo.get_transactions_for_user(&user1_id).await;
    let user2_transactions = mock_repo.get_transactions_for_user(&user2_id).await;

    assert!(user1_transactions.is_ok());
    assert!(user2_transactions.is_ok());

    let user1_txns = user1_transactions.unwrap();
    let user2_txns = user2_transactions.unwrap();

    assert_eq!(user1_txns.len(), 1);
    assert_eq!(user2_txns.len(), 1);

    assert_eq!(user1_txns[0].user_id, Some(user1_id));
    assert_eq!(user2_txns[0].user_id, Some(user2_id));

    assert_eq!(user1_txns[0].merchant_name, Some("User1 Store".to_string()));
    assert_eq!(user2_txns[0].merchant_name, Some("User2 Shop".to_string()));

    assert_eq!(user1_txns[0].amount, rust_decimal::Decimal::new(2500, 2));
    assert_eq!(user2_txns[0].amount, rust_decimal::Decimal::new(7500, 2));
}

#[tokio::test]
async fn given_user_session_when_accessing_accounts_then_only_returns_user_owned_accounts() {
    let mut mock_repo = MockDatabaseRepository::new();

    let user1_id = Uuid::new_v4();
    let user2_id = Uuid::new_v4();

    let user1_account1 = Account {
        id: Uuid::new_v4(),
        user_id: Some(user1_id),
        provider_account_id: Some("user1_account_1".to_string()),
        provider_connection_id: None,
        name: "User1 Checking".to_string(),
        account_type: "depository".to_string(),
        balance_current: Some(dec!(1000.00)),
        mask: None,
        institution_name: None,
    };

    let user1_account2 = Account {
        id: Uuid::new_v4(),
        user_id: Some(user1_id),
        provider_account_id: Some("user1_account_2".to_string()),
        provider_connection_id: None,
        name: "User1 Savings".to_string(),
        account_type: "depository".to_string(),
        balance_current: Some(dec!(2500.00)),
        mask: None,
        institution_name: None,
    };

    let user2_account1 = Account {
        id: Uuid::new_v4(),
        user_id: Some(user2_id),
        provider_account_id: Some("user2_account_1".to_string()),
        provider_connection_id: None,
        name: "User2 Checking".to_string(),
        account_type: "depository".to_string(),
        balance_current: Some(dec!(750.00)),
        mask: None,
        institution_name: None,
    };

    mock_repo
        .expect_upsert_account()
        .withf(move |account| account.name == "User1 Checking")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_account()
        .withf(move |account| account.name == "User1 Savings")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_account()
        .withf(move |account| account.name == "User2 Checking")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let user1_accounts_result = vec![user1_account1.clone(), user1_account2.clone()];
    let user2_accounts_result = vec![user2_account1.clone()];
    mock_repo
        .expect_get_accounts_for_user()
        .with(mockall::predicate::eq(user1_id))
        .times(1)
        .returning(move |_| {
            let accounts = user1_accounts_result.clone();
            Box::pin(async move { Ok(accounts) })
        });

    mock_repo
        .expect_get_accounts_for_user()
        .with(mockall::predicate::eq(user2_id))
        .times(1)
        .returning(move |_| {
            let accounts = user2_accounts_result.clone();
            Box::pin(async move { Ok(accounts) })
        });

    mock_repo
        .upsert_account(&user1_account1)
        .await
        .expect("Failed to create user1 account1");
    mock_repo
        .upsert_account(&user1_account2)
        .await
        .expect("Failed to create user1 account2");
    mock_repo
        .upsert_account(&user2_account1)
        .await
        .expect("Failed to create user2 account1");

    let user1_accounts = mock_repo
        .get_accounts_for_user(&user1_id)
        .await
        .expect("Failed to get user1 accounts");

    let user2_accounts = mock_repo
        .get_accounts_for_user(&user2_id)
        .await
        .expect("Failed to get user2 accounts");

    assert_eq!(
        user1_accounts.len(),
        2,
        "User1 should see exactly 2 accounts"
    );
    assert!(
        user1_accounts
            .iter()
            .all(|account| account.user_id == Some(user1_id)),
        "All accounts for user1 should belong to user1"
    );
    let user1_account_names: Vec<&str> = user1_accounts.iter().map(|a| a.name.as_str()).collect();
    assert!(
        user1_account_names.contains(&"User1 Checking"),
        "User1 should see their checking account"
    );
    assert!(
        user1_account_names.contains(&"User1 Savings"),
        "User1 should see their savings account"
    );

    assert_eq!(
        user2_accounts.len(),
        1,
        "User2 should see exactly 1 account"
    );
    assert!(
        user2_accounts
            .iter()
            .all(|account| account.user_id == Some(user2_id)),
        "All accounts for user2 should belong to user2"
    );
    assert_eq!(
        user2_accounts[0].name, "User2 Checking",
        "User2 should see their checking account"
    );

    assert!(
        !user1_accounts
            .iter()
            .any(|account| account.user_id == Some(user2_id)),
        "User1 should not see any of user2's accounts"
    );
    assert!(
        !user2_accounts
            .iter()
            .any(|account| account.user_id == Some(user1_id)),
        "User2 should not see any of user1's accounts"
    );

    let user1_account_ids: Vec<Uuid> = user1_accounts.iter().map(|a| a.id).collect();
    let user2_account_ids: Vec<Uuid> = user2_accounts.iter().map(|a| a.id).collect();
    assert!(
        user1_account_ids
            .iter()
            .all(|id| !user2_account_ids.contains(id)),
        "No account IDs should overlap between users"
    );
}

#[tokio::test]
async fn given_multiple_users_when_accessing_plaid_connections_then_each_sees_only_own_connections()
{
    let mut mock_repo = MockDatabaseRepository::new();

    let user1_id = Uuid::new_v4();
    let user2_id = Uuid::new_v4();

    let user1_connection1 = PlaidConnection {
        id: Uuid::new_v4(),
        user_id: user1_id,
        item_id: "user1_item_1".to_string(),
        is_connected: true,
        last_sync_at: Some(Utc::now()),
        connected_at: Some(Utc::now()),
        disconnected_at: None,
        institution_id: Some("ins_user1a".to_string()),
        institution_name: Some("Test Bank 1".to_string()),
        institution_logo_url: None,
        sync_cursor: None,
        transaction_count: 10,
        account_count: 2,
        created_at: Some(Utc::now()),
        updated_at: Some(Utc::now()),
    };

    let user2_connection1 = PlaidConnection {
        id: Uuid::new_v4(),
        user_id: user2_id,
        item_id: "user2_item_1".to_string(),
        is_connected: true,
        last_sync_at: Some(Utc::now()),
        connected_at: Some(Utc::now()),
        disconnected_at: None,
        institution_id: Some("ins_user2a".to_string()),
        institution_name: Some("Test Bank 2".to_string()),
        institution_logo_url: None,
        sync_cursor: None,
        transaction_count: 5,
        account_count: 1,
        created_at: Some(Utc::now()),
        updated_at: Some(Utc::now()),
    };

    mock_repo
        .expect_save_provider_connection()
        .withf(move |conn| conn.item_id == "user1_item_1")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_save_provider_connection()
        .withf(move |conn| conn.item_id == "user2_item_1")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let user1_conn_result = user1_connection1.clone();
    let user2_conn_result = user2_connection1.clone();
    mock_repo
        .expect_get_all_provider_connections_by_user()
        .with(mockall::predicate::eq(user1_id))
        .times(1)
        .returning(move |_| {
            let conn = user1_conn_result.clone();
            Box::pin(async move { Ok(vec![conn]) })
        });

    mock_repo
        .expect_get_all_provider_connections_by_user()
        .with(mockall::predicate::eq(user2_id))
        .times(1)
        .returning(move |_| {
            let conn = user2_conn_result.clone();
            Box::pin(async move { Ok(vec![conn]) })
        });

    let user1_conn_by_item = user1_connection1.clone();
    let user2_conn_by_item = user2_connection1.clone();
    mock_repo
        .expect_get_provider_connection_by_item()
        .with(mockall::predicate::eq("user1_item_1"))
        .times(1)
        .returning(move |_| {
            let conn = user1_conn_by_item.clone();
            Box::pin(async move { Ok(Some(conn)) })
        });

    mock_repo
        .expect_get_provider_connection_by_item()
        .with(mockall::predicate::eq("user2_item_1"))
        .times(1)
        .returning(move |_| {
            let conn = user2_conn_by_item.clone();
            Box::pin(async move { Ok(Some(conn)) })
        });

    mock_repo
        .save_provider_connection(&user1_connection1)
        .await
        .expect("Failed to create user1 connection1");
    mock_repo
        .save_provider_connection(&user2_connection1)
        .await
        .expect("Failed to create user2 connection1");

    let user1_connections = mock_repo
        .get_all_provider_connections_by_user(&user1_id)
        .await
        .expect("Failed to get user1 connections");

    let user2_connections = mock_repo
        .get_all_provider_connections_by_user(&user2_id)
        .await
        .expect("Failed to get user2 connections");

    assert!(
        !user1_connections.is_empty(),
        "User1 should have a connection"
    );
    let user1_conn = &user1_connections[0];
    assert_eq!(
        user1_conn.user_id, user1_id,
        "User1 connection should belong to user1"
    );
    assert_eq!(
        user1_conn.item_id, "user1_item_1",
        "User1 should see their connection"
    );

    assert!(
        !user2_connections.is_empty(),
        "User2 should have a connection"
    );
    let user2_conn = &user2_connections[0];
    assert_eq!(
        user2_conn.user_id, user2_id,
        "User2 connection should belong to user2"
    );
    assert_eq!(
        user2_conn.item_id, "user2_item_1",
        "User2 should see their connection"
    );

    assert_ne!(
        user1_conn.id, user2_conn.id,
        "Connection IDs should be different"
    );
    assert_ne!(
        user1_conn.item_id, user2_conn.item_id,
        "Item IDs should be different"
    );

    let user1_query_by_item = mock_repo
        .get_provider_connection_by_item(&user1_conn.item_id)
        .await
        .expect("Failed to query user1 connection by item_id");
    let user2_query_by_item = mock_repo
        .get_provider_connection_by_item(&user2_conn.item_id)
        .await
        .expect("Failed to query user2 connection by item_id");

    assert!(
        user1_query_by_item.is_some(),
        "User1 connection should be found by item_id"
    );
    assert!(
        user2_query_by_item.is_some(),
        "User2 connection should be found by item_id"
    );
    assert_eq!(
        user1_query_by_item.unwrap().user_id,
        user1_id,
        "Item query should return user1's connection"
    );
    assert_eq!(
        user2_query_by_item.unwrap().user_id,
        user2_id,
        "Item query should return user2's connection"
    );
}

#[tokio::test]
async fn given_database_rls_policies_when_user_queries_data_then_enforces_user_context_automatically(
) {
    let mut mock_repo = MockDatabaseRepository::new();

    let user1_id = Uuid::new_v4();
    let user2_id = Uuid::new_v4();

    let user1 = User {
        id: user1_id,
        email: "rls_user1@test.com".to_string(),
        password_hash: "hashed_password1".to_string(),
        provider: "teller".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        onboarding_completed: false,
    };

    let user2 = User {
        id: user2_id,
        email: "rls_user2@test.com".to_string(),
        password_hash: "hashed_password2".to_string(),
        provider: "teller".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        onboarding_completed: false,
    };

    mock_repo
        .expect_create_user()
        .withf(move |user| user.email == "rls_user1@test.com")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_create_user()
        .withf(move |user| user.email == "rls_user2@test.com")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo.create_user(&user1).await.unwrap();
    mock_repo.create_user(&user2).await.unwrap();

    let user1_account = Account {
        id: Uuid::new_v4(),
        user_id: Some(user1_id),
        provider_account_id: Some("rls_user1_account".to_string()),
        provider_connection_id: None,
        name: "User1 RLS Account".to_string(),
        account_type: "depository".to_string(),
        balance_current: Some(dec!(1500.00)),
        mask: None,
        institution_name: None,
    };

    let user2_account = Account {
        id: Uuid::new_v4(),
        user_id: Some(user2_id),
        provider_account_id: Some("rls_user2_account".to_string()),
        provider_connection_id: None,
        name: "User2 RLS Account".to_string(),
        account_type: "depository".to_string(),
        balance_current: Some(dec!(2500.00)),
        mask: None,
        institution_name: None,
    };

    mock_repo
        .expect_upsert_account()
        .withf(move |account| account.name == "User1 RLS Account")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_account()
        .withf(move |account| account.name == "User2 RLS Account")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo.upsert_account(&user1_account).await.unwrap();
    mock_repo.upsert_account(&user2_account).await.unwrap();

    let user1_transaction = Transaction {
        id: Uuid::new_v4(),
        account_id: user1_account.id,
        user_id: Some(user1_id),
        provider_account_id: None,
        provider_transaction_id: Some("rls_user1_txn".to_string()),
        amount: dec!(45.67),
        date: chrono::NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
        merchant_name: Some("RLS Store 1".to_string()),
        category_primary: "Food and Drink".to_string(),
        category_detailed: "Restaurants".to_string(),
        category_confidence: "VERY_HIGH".to_string(),
        payment_channel: Some("in_store".to_string()),
        pending: false,
        created_at: Some(chrono::Utc::now()),
    };

    let user2_transaction = Transaction {
        id: Uuid::new_v4(),
        account_id: user2_account.id,
        user_id: Some(user2_id),
        provider_account_id: None,
        provider_transaction_id: Some("rls_user2_txn".to_string()),
        amount: dec!(78.90),
        date: chrono::NaiveDate::from_ymd_opt(2024, 1, 16).unwrap(),
        merchant_name: Some("RLS Store 2".to_string()),
        category_primary: "Transportation".to_string(),
        category_detailed: "Gas Stations".to_string(),
        category_confidence: "HIGH".to_string(),
        payment_channel: Some("in_store".to_string()),
        pending: false,
        created_at: Some(chrono::Utc::now()),
    };

    mock_repo
        .expect_upsert_transaction()
        .withf(move |txn| txn.merchant_name == Some("RLS Store 1".to_string()))
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_transaction()
        .withf(move |txn| txn.merchant_name == Some("RLS Store 2".to_string()))
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let user1_txn_result = user1_transaction.clone();
    let user1_acc_result = user1_account.clone();
    let user2_txn_result = user2_transaction.clone();
    let user2_acc_result = user2_account.clone();

    mock_repo
        .expect_get_transactions_for_user()
        .times(1..)
        .returning(move |user_id| {
            if *user_id == user1_id {
                let txn = user1_txn_result.clone();
                Box::pin(async move { Ok(vec![txn]) })
            } else if *user_id == user2_id {
                let txn = user2_txn_result.clone();
                Box::pin(async move { Ok(vec![txn]) })
            } else {
                Box::pin(async move { Ok(vec![]) })
            }
        });

    mock_repo
        .expect_get_accounts_for_user()
        .times(1..)
        .returning(move |user_id| {
            if *user_id == user1_id {
                let acc = user1_acc_result.clone();
                Box::pin(async move { Ok(vec![acc]) })
            } else if *user_id == user2_id {
                let acc = user2_acc_result.clone();
                Box::pin(async move { Ok(vec![acc]) })
            } else {
                Box::pin(async move { Ok(vec![]) })
            }
        });

    mock_repo
        .upsert_transaction(&user1_transaction)
        .await
        .unwrap();
    mock_repo
        .upsert_transaction(&user2_transaction)
        .await
        .unwrap();

    let user1_transactions = mock_repo.get_transactions_for_user(&user1_id).await;
    let user1_accounts = mock_repo.get_accounts_for_user(&user1_id).await;

    let user2_transactions = mock_repo.get_transactions_for_user(&user2_id).await;
    let user2_accounts = mock_repo.get_accounts_for_user(&user2_id).await;

    assert!(user1_transactions.is_ok());
    assert!(user1_accounts.is_ok());

    let user1_txns = user1_transactions.unwrap();
    let user1_accts = user1_accounts.unwrap();

    assert_eq!(
        user1_txns.len(),
        1,
        "User1 should see exactly 1 transaction via RLS"
    );
    assert_eq!(
        user1_accts.len(),
        1,
        "User1 should see exactly 1 account via RLS"
    );

    assert_eq!(
        user1_txns[0].user_id,
        Some(user1_id),
        "RLS should enforce user1 context for transactions"
    );
    assert_eq!(
        user1_accts[0].user_id,
        Some(user1_id),
        "RLS should enforce user1 context for accounts"
    );
    assert_eq!(
        user1_txns[0].merchant_name,
        Some("RLS Store 1".to_string()),
        "User1 should see their specific transaction"
    );
    assert_eq!(
        user1_accts[0].name, "User1 RLS Account",
        "User1 should see their specific account"
    );

    assert!(user2_transactions.is_ok());
    assert!(user2_accounts.is_ok());

    let user2_txns = user2_transactions.unwrap();
    let user2_accts = user2_accounts.unwrap();

    assert_eq!(
        user2_txns.len(),
        1,
        "User2 should see exactly 1 transaction via RLS"
    );
    assert_eq!(
        user2_accts.len(),
        1,
        "User2 should see exactly 1 account via RLS"
    );

    assert_eq!(
        user2_txns[0].user_id,
        Some(user2_id),
        "RLS should enforce user2 context for transactions"
    );
    assert_eq!(
        user2_accts[0].user_id,
        Some(user2_id),
        "RLS should enforce user2 context for accounts"
    );
    assert_eq!(
        user2_txns[0].merchant_name,
        Some("RLS Store 2".to_string()),
        "User2 should see their specific transaction"
    );
    assert_eq!(
        user2_accts[0].name, "User2 RLS Account",
        "User2 should see their specific account"
    );

    assert_ne!(
        user1_txns[0].id, user2_txns[0].id,
        "RLS should isolate transaction IDs"
    );
    assert_ne!(
        user1_accts[0].id, user2_accts[0].id,
        "RLS should isolate account IDs"
    );
    assert_ne!(
        user1_txns[0].amount, user2_txns[0].amount,
        "RLS should isolate transaction amounts"
    );
    assert_ne!(
        user1_accts[0].balance_current, user2_accts[0].balance_current,
        "RLS should isolate account balances"
    );

    let empty_txns_for_wrong_user = mock_repo.get_transactions_for_user(&Uuid::new_v4()).await;
    let empty_accts_for_wrong_user = mock_repo.get_accounts_for_user(&Uuid::new_v4()).await;

    assert!(empty_txns_for_wrong_user.is_ok());
    assert!(empty_accts_for_wrong_user.is_ok());
    assert_eq!(
        empty_txns_for_wrong_user.unwrap().len(),
        0,
        "RLS should return empty for non-existent user"
    );
    assert_eq!(
        empty_accts_for_wrong_user.unwrap().len(),
        0,
        "RLS should return empty for non-existent user"
    );
}

#[tokio::test]
async fn given_repository_queries_when_no_user_context_set_then_returns_empty_results_via_rls() {
    let mut mock_repo = MockDatabaseRepository::new();

    let user_id = Uuid::new_v4();
    let user = User {
        id: user_id,
        email: "no_context_user@test.com".to_string(),
        password_hash: "hashed_password".to_string(),
        provider: "teller".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        onboarding_completed: false,
    };

    mock_repo
        .expect_create_user()
        .withf(move |user| user.email == "no_context_user@test.com")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_account()
        .withf(move |account| account.name == "No Context Account")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_transaction()
        .withf(move |txn| txn.merchant_name == Some("No Context Store".to_string()))
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo.create_user(&user).await.unwrap();

    let account = Account {
        id: Uuid::new_v4(),
        user_id: Some(user_id),
        provider_account_id: Some("no_context_account".to_string()),
        provider_connection_id: None,
        name: "No Context Account".to_string(),
        account_type: "depository".to_string(),
        balance_current: Some(dec!(1000.00)),
        mask: None,
        institution_name: None,
    };

    let transaction = Transaction {
        id: Uuid::new_v4(),
        account_id: account.id,
        user_id: Some(user_id),
        provider_account_id: None,
        provider_transaction_id: Some("no_context_txn".to_string()),
        amount: dec!(50.00),
        date: chrono::NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
        merchant_name: Some("No Context Store".to_string()),
        category_primary: "Food and Drink".to_string(),
        category_detailed: "Restaurants".to_string(),
        category_confidence: "VERY_HIGH".to_string(),
        payment_channel: Some("in_store".to_string()),
        pending: false,
        created_at: Some(chrono::Utc::now()),
    };

    let valid_user_data = user.clone();
    let valid_account_data = account.clone();
    let valid_transaction_data = transaction.clone();

    mock_repo
        .expect_get_accounts_for_user()
        .times(1..)
        .returning(move |query_user_id| {
            if *query_user_id == user_id {
                let acc = valid_account_data.clone();
                Box::pin(async move { Ok(vec![acc]) })
            } else {
                Box::pin(async { Ok(vec![]) })
            }
        });

    mock_repo
        .expect_get_transactions_for_user()
        .times(1..)
        .returning(move |query_user_id| {
            if *query_user_id == user_id {
                let txn = valid_transaction_data.clone();
                Box::pin(async move { Ok(vec![txn]) })
            } else {
                Box::pin(async { Ok(vec![]) })
            }
        });

    mock_repo
        .expect_get_user_by_id()
        .times(1..)
        .returning(move |query_user_id| {
            if *query_user_id == user_id {
                let user = valid_user_data.clone();
                Box::pin(async move { Ok(Some(user)) })
            } else {
                Box::pin(async { Ok(None) })
            }
        });

    mock_repo
        .expect_get_all_provider_connections_by_user()
        .times(1..)
        .returning(move |query_user_id| {
            if *query_user_id == user_id {
                Box::pin(async { Ok(vec![]) })
            } else {
                Box::pin(async { Ok(vec![]) })
            }
        });

    mock_repo.upsert_account(&account).await.unwrap();
    mock_repo.upsert_transaction(&transaction).await.unwrap();

    let no_context_uuid = Uuid::nil();
    let accounts_no_context = mock_repo.get_accounts_for_user(&no_context_uuid).await;

    let transactions_no_context = mock_repo.get_transactions_for_user(&no_context_uuid).await;

    let user_no_context = mock_repo.get_user_by_id(&no_context_uuid).await;

    let connection_no_context = mock_repo
        .get_all_provider_connections_by_user(&no_context_uuid)
        .await;

    assert!(accounts_no_context.is_ok());
    assert!(transactions_no_context.is_ok());
    assert!(user_no_context.is_ok());
    assert!(connection_no_context.is_ok());

    assert_eq!(
        accounts_no_context.unwrap().len(),
        0,
        "Accounts query without user context should return empty"
    );
    assert_eq!(
        transactions_no_context.unwrap().len(),
        0,
        "Transactions query without user context should return empty"
    );
    assert!(
        user_no_context.unwrap().is_none(),
        "User query without context should return None"
    );
    assert!(
        connection_no_context.unwrap().is_empty(),
        "Plaid connection query without context should return empty vec"
    );

    let valid_accounts = mock_repo
        .get_accounts_for_user(&user_id)
        .await
        .expect("Valid user query should work");
    let valid_transactions = mock_repo
        .get_transactions_for_user(&user_id)
        .await
        .expect("Valid user query should work");
    let valid_user = mock_repo
        .get_user_by_id(&user_id)
        .await
        .expect("Valid user query should work");

    assert_eq!(
        valid_accounts.len(),
        1,
        "Valid user context should return their accounts"
    );
    assert_eq!(
        valid_transactions.len(),
        1,
        "Valid user context should return their transactions"
    );
    assert!(
        valid_user.is_some(),
        "Valid user context should return user data"
    );
    assert_eq!(
        valid_user.unwrap().id,
        user_id,
        "Valid context should return correct user"
    );

    let random_invalid_id = Uuid::new_v4();
    let tampered_accounts = mock_repo
        .get_accounts_for_user(&random_invalid_id)
        .await
        .expect("Query should succeed but return empty");
    let tampered_transactions = mock_repo
        .get_transactions_for_user(&random_invalid_id)
        .await
        .expect("Query should succeed but return empty");

    assert_eq!(
        tampered_accounts.len(),
        0,
        "Random UUID should not access any data"
    );
    assert_eq!(
        tampered_transactions.len(),
        0,
        "Random UUID should not access any data"
    );
}

#[tokio::test]
async fn given_concurrent_user_operations_when_executing_then_maintains_complete_data_isolation() {
    let mut mock_repo = MockDatabaseRepository::new();

    let user1_id = Uuid::new_v4();
    let user2_id = Uuid::new_v4();
    let user3_id = Uuid::new_v4();

    let user1 = User {
        id: user1_id,
        email: "concurrent_user1@test.com".to_string(),
        password_hash: "hashed_password1".to_string(),
        provider: "teller".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        onboarding_completed: false,
    };

    let user2 = User {
        id: user2_id,
        email: "concurrent_user2@test.com".to_string(),
        password_hash: "hashed_password2".to_string(),
        provider: "teller".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        onboarding_completed: false,
    };

    let user3 = User {
        id: user3_id,
        email: "concurrent_user3@test.com".to_string(),
        password_hash: "hashed_password3".to_string(),
        provider: "teller".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        onboarding_completed: false,
    };

    mock_repo
        .expect_create_user()
        .withf(move |user| user.email == "concurrent_user1@test.com")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_create_user()
        .withf(move |user| user.email == "concurrent_user2@test.com")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_create_user()
        .withf(move |user| user.email == "concurrent_user3@test.com")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_account()
        .withf(move |account| account.name == "User1 Concurrent Checking")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_account()
        .withf(move |account| account.name == "User2 Concurrent Savings")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_account()
        .withf(move |account| account.name == "User3 Concurrent Credit")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_transaction()
        .withf(move |txn| txn.merchant_name == Some("Concurrent Store 1".to_string()))
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_transaction()
        .withf(move |txn| txn.merchant_name == Some("Concurrent Store 2".to_string()))
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_transaction()
        .withf(move |txn| txn.merchant_name == Some("Concurrent Store 3".to_string()))
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_get_accounts_for_user()
        .times(3..)
        .returning(move |user_id| {
            if *user_id == user1_id {
                let account = Account {
                    id: Uuid::new_v4(),
                    user_id: Some(user1_id),
                    provider_account_id: Some("concurrent_user1_checking".to_string()),
                    provider_connection_id: None,
                    name: "User1 Concurrent Checking".to_string(),
                    account_type: "depository".to_string(),
                    balance_current: Some(rust_decimal::Decimal::new(100000, 2)),
                    mask: None,
                    institution_name: None,
                };
                Box::pin(async { Ok(vec![account]) })
            } else if *user_id == user2_id {
                let account = Account {
                    id: Uuid::new_v4(),
                    user_id: Some(user2_id),
                    provider_account_id: Some("concurrent_user2_savings".to_string()),
                    provider_connection_id: None,
                    name: "User2 Concurrent Savings".to_string(),
                    account_type: "depository".to_string(),
                    balance_current: Some(rust_decimal::Decimal::new(250000, 2)),
                    mask: None,
                    institution_name: None,
                };
                Box::pin(async { Ok(vec![account]) })
            } else if *user_id == user3_id {
                let account = Account {
                    id: Uuid::new_v4(),
                    user_id: Some(user3_id),
                    provider_account_id: Some("concurrent_user3_credit".to_string()),
                    provider_connection_id: None,
                    name: "User3 Concurrent Credit".to_string(),
                    account_type: "credit".to_string(),
                    balance_current: Some(rust_decimal::Decimal::new(500000, 2)),
                    mask: None,
                    institution_name: None,
                };
                Box::pin(async { Ok(vec![account]) })
            } else {
                Box::pin(async { Ok(vec![]) })
            }
        });

    mock_repo
        .expect_get_transactions_for_user()
        .times(3..)
        .returning(move |user_id| {
            if *user_id == user1_id {
                let transaction = Transaction {
                    id: Uuid::new_v4(),
                    account_id: Uuid::new_v4(),
                    user_id: Some(user1_id),
                    provider_account_id: None,
                    provider_transaction_id: Some("concurrent_user1_txn".to_string()),
                    amount: rust_decimal::Decimal::new(2500, 2),
                    date: chrono::NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
                    merchant_name: Some("Concurrent Store 1".to_string()),
                    category_primary: "Food and Drink".to_string(),
                    category_detailed: "Restaurants".to_string(),
                    category_confidence: "VERY_HIGH".to_string(),
                    payment_channel: Some("in_store".to_string()),
                    pending: false,
                    created_at: Some(chrono::Utc::now()),
                };
                Box::pin(async { Ok(vec![transaction]) })
            } else if *user_id == user2_id {
                let transaction = Transaction {
                    id: Uuid::new_v4(),
                    account_id: Uuid::new_v4(),
                    user_id: Some(user2_id),
                    provider_account_id: None,
                    provider_transaction_id: Some("concurrent_user2_txn".to_string()),
                    amount: rust_decimal::Decimal::new(7500, 2),
                    date: chrono::NaiveDate::from_ymd_opt(2024, 1, 16).unwrap(),
                    merchant_name: Some("Concurrent Store 2".to_string()),
                    category_primary: "Transportation".to_string(),
                    category_detailed: "Gas Stations".to_string(),
                    category_confidence: "HIGH".to_string(),
                    payment_channel: Some("in_store".to_string()),
                    pending: false,
                    created_at: Some(chrono::Utc::now()),
                };
                Box::pin(async { Ok(vec![transaction]) })
            } else if *user_id == user3_id {
                let transaction = Transaction {
                    id: Uuid::new_v4(),
                    account_id: Uuid::new_v4(),
                    user_id: Some(user3_id),
                    provider_account_id: None,
                    provider_transaction_id: Some("concurrent_user3_txn".to_string()),
                    amount: rust_decimal::Decimal::new(15000, 2),
                    date: chrono::NaiveDate::from_ymd_opt(2024, 1, 17).unwrap(),
                    merchant_name: Some("Concurrent Store 3".to_string()),
                    category_primary: "Shopping".to_string(),
                    category_detailed: "General Merchandise".to_string(),
                    category_confidence: "MEDIUM".to_string(),
                    payment_channel: Some("online".to_string()),
                    pending: false,
                    created_at: Some(chrono::Utc::now()),
                };
                Box::pin(async { Ok(vec![transaction]) })
            } else {
                Box::pin(async { Ok(vec![]) })
            }
        });

    mock_repo.create_user(&user1).await.unwrap();
    mock_repo.create_user(&user2).await.unwrap();
    mock_repo.create_user(&user3).await.unwrap();

    let (user1_results, user2_results, user3_results) = tokio::join!(
        async {
            let account1 = Account {
                id: Uuid::new_v4(),
                user_id: Some(user1_id),
                provider_account_id: Some("concurrent_user1_checking".to_string()),
                provider_connection_id: None,
                name: "User1 Concurrent Checking".to_string(),
                account_type: "depository".to_string(),
                balance_current: Some(dec!(1000.00)),
                mask: None,
                institution_name: None,
            };

            let transaction1 = Transaction {
                id: Uuid::new_v4(),
                account_id: account1.id,
                user_id: Some(user1_id),
                provider_account_id: None,
                provider_transaction_id: Some("concurrent_user1_txn".to_string()),
                amount: dec!(25.00),
                date: chrono::NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
                merchant_name: Some("Concurrent Store 1".to_string()),
                category_primary: "Food and Drink".to_string(),
                category_detailed: "Restaurants".to_string(),
                category_confidence: "VERY_HIGH".to_string(),
                payment_channel: Some("in_store".to_string()),
                pending: false,
                created_at: Some(chrono::Utc::now()),
            };

            let account_result = mock_repo.upsert_account(&account1).await;
            let transaction_result = mock_repo.upsert_transaction(&transaction1).await;
            let accounts_query = mock_repo.get_accounts_for_user(&user1_id).await;
            let transactions_query = mock_repo.get_transactions_for_user(&user1_id).await;

            (
                account_result,
                transaction_result,
                accounts_query,
                transactions_query,
            )
        },
        async {
            let account2 = Account {
                id: Uuid::new_v4(),
                user_id: Some(user2_id),
                provider_account_id: Some("concurrent_user2_savings".to_string()),
                provider_connection_id: None,
                name: "User2 Concurrent Savings".to_string(),
                account_type: "depository".to_string(),
                balance_current: Some(dec!(2500.00)),
                mask: None,
                institution_name: None,
            };

            let transaction2 = Transaction {
                id: Uuid::new_v4(),
                account_id: account2.id,
                user_id: Some(user2_id),
                provider_account_id: None,
                provider_transaction_id: Some("concurrent_user2_txn".to_string()),
                amount: dec!(75.00),
                date: chrono::NaiveDate::from_ymd_opt(2024, 1, 16).unwrap(),
                merchant_name: Some("Concurrent Store 2".to_string()),
                category_primary: "Transportation".to_string(),
                category_detailed: "Gas Stations".to_string(),
                category_confidence: "HIGH".to_string(),
                payment_channel: Some("in_store".to_string()),
                pending: false,
                created_at: Some(chrono::Utc::now()),
            };

            let account_result = mock_repo.upsert_account(&account2).await;
            let transaction_result = mock_repo.upsert_transaction(&transaction2).await;
            let accounts_query = mock_repo.get_accounts_for_user(&user2_id).await;
            let transactions_query = mock_repo.get_transactions_for_user(&user2_id).await;

            (
                account_result,
                transaction_result,
                accounts_query,
                transactions_query,
            )
        },
        async {
            let account3 = Account {
                id: Uuid::new_v4(),
                user_id: Some(user3_id),
                provider_account_id: Some("concurrent_user3_credit".to_string()),
                provider_connection_id: None,
                name: "User3 Concurrent Credit".to_string(),
                account_type: "credit".to_string(),
                balance_current: Some(dec!(500.00)),
                mask: None,
                institution_name: None,
            };

            let transaction3 = Transaction {
                id: Uuid::new_v4(),
                account_id: account3.id,
                user_id: Some(user3_id),
                provider_account_id: None,
                provider_transaction_id: Some("concurrent_user3_txn".to_string()),
                amount: dec!(150.00),
                date: chrono::NaiveDate::from_ymd_opt(2024, 1, 17).unwrap(),
                merchant_name: Some("Concurrent Store 3".to_string()),
                category_primary: "Shopping".to_string(),
                category_detailed: "General Merchandise".to_string(),
                category_confidence: "VERY_HIGH".to_string(),
                payment_channel: Some("online".to_string()),
                pending: false,
                created_at: Some(chrono::Utc::now()),
            };

            let account_result = mock_repo.upsert_account(&account3).await;
            let transaction_result = mock_repo.upsert_transaction(&transaction3).await;
            let accounts_query = mock_repo.get_accounts_for_user(&user3_id).await;
            let transactions_query = mock_repo.get_transactions_for_user(&user3_id).await;

            (
                account_result,
                transaction_result,
                accounts_query,
                transactions_query,
            )
        }
    );

    let (user1_account_result, user1_transaction_result, user1_accounts, user1_transactions) =
        user1_results;
    let (user2_account_result, user2_transaction_result, user2_accounts, user2_transactions) =
        user2_results;
    let (user3_account_result, user3_transaction_result, user3_accounts, user3_transactions) =
        user3_results;

    assert!(
        user1_account_result.is_ok(),
        "User1 account creation should succeed"
    );
    assert!(
        user1_transaction_result.is_ok(),
        "User1 transaction creation should succeed"
    );
    assert!(
        user2_account_result.is_ok(),
        "User2 account creation should succeed"
    );
    assert!(
        user2_transaction_result.is_ok(),
        "User2 transaction creation should succeed"
    );
    assert!(
        user3_account_result.is_ok(),
        "User3 account creation should succeed"
    );
    assert!(
        user3_transaction_result.is_ok(),
        "User3 transaction creation should succeed"
    );

    assert!(
        user1_accounts.is_ok(),
        "User1 accounts query should succeed"
    );
    assert!(
        user1_transactions.is_ok(),
        "User1 transactions query should succeed"
    );
    assert!(
        user2_accounts.is_ok(),
        "User2 accounts query should succeed"
    );
    assert!(
        user2_transactions.is_ok(),
        "User2 transactions query should succeed"
    );
    assert!(
        user3_accounts.is_ok(),
        "User3 accounts query should succeed"
    );
    assert!(
        user3_transactions.is_ok(),
        "User3 transactions query should succeed"
    );

    let user1_accts = user1_accounts.unwrap();
    let user1_txns = user1_transactions.unwrap();
    let user2_accts = user2_accounts.unwrap();
    let user2_txns = user2_transactions.unwrap();
    let user3_accts = user3_accounts.unwrap();
    let user3_txns = user3_transactions.unwrap();

    assert_eq!(user1_accts.len(), 1, "User1 should see exactly 1 account");
    assert_eq!(
        user1_txns.len(),
        1,
        "User1 should see exactly 1 transaction"
    );
    assert_eq!(user2_accts.len(), 1, "User2 should see exactly 1 account");
    assert_eq!(
        user2_txns.len(),
        1,
        "User2 should see exactly 1 transaction"
    );
    assert_eq!(user3_accts.len(), 1, "User3 should see exactly 1 account");
    assert_eq!(
        user3_txns.len(),
        1,
        "User3 should see exactly 1 transaction"
    );

    assert_eq!(
        user1_accts[0].user_id,
        Some(user1_id),
        "User1 account should belong to user1"
    );
    assert_eq!(
        user1_txns[0].user_id,
        Some(user1_id),
        "User1 transaction should belong to user1"
    );
    assert_eq!(
        user1_accts[0].name, "User1 Concurrent Checking",
        "User1 should see correct account name"
    );
    assert_eq!(
        user1_txns[0].merchant_name,
        Some("Concurrent Store 1".to_string()),
        "User1 should see correct merchant"
    );

    assert_eq!(
        user2_accts[0].user_id,
        Some(user2_id),
        "User2 account should belong to user2"
    );
    assert_eq!(
        user2_txns[0].user_id,
        Some(user2_id),
        "User2 transaction should belong to user2"
    );
    assert_eq!(
        user2_accts[0].name, "User2 Concurrent Savings",
        "User2 should see correct account name"
    );
    assert_eq!(
        user2_txns[0].merchant_name,
        Some("Concurrent Store 2".to_string()),
        "User2 should see correct merchant"
    );

    assert_eq!(
        user3_accts[0].user_id,
        Some(user3_id),
        "User3 account should belong to user3"
    );
    assert_eq!(
        user3_txns[0].user_id,
        Some(user3_id),
        "User3 transaction should belong to user3"
    );
    assert_eq!(
        user3_accts[0].name, "User3 Concurrent Credit",
        "User3 should see correct account name"
    );
    assert_eq!(
        user3_txns[0].merchant_name,
        Some("Concurrent Store 3".to_string()),
        "User3 should see correct merchant"
    );

    assert_eq!(
        user1_txns[0].amount,
        dec!(25.00),
        "User1 transaction amount should be correct"
    );
    assert_eq!(
        user2_txns[0].amount,
        dec!(75.00),
        "User2 transaction amount should be correct"
    );
    assert_eq!(
        user3_txns[0].amount,
        dec!(150.00),
        "User3 transaction amount should be correct"
    );

    assert_eq!(
        user1_txns[0].category_primary, "Food and Drink",
        "User1 category should be correct"
    );
    assert_eq!(
        user2_txns[0].category_primary, "Transportation",
        "User2 category should be correct"
    );
    assert_eq!(
        user3_txns[0].category_primary, "Shopping",
        "User3 category should be correct"
    );

    let (final_user1_check, final_user2_check, final_user3_check) = tokio::join!(
        mock_repo.get_accounts_for_user(&user1_id),
        mock_repo.get_accounts_for_user(&user2_id),
        mock_repo.get_accounts_for_user(&user3_id)
    );

    assert!(
        final_user1_check.is_ok(),
        "Final user1 check should succeed"
    );
    assert!(
        final_user2_check.is_ok(),
        "Final user2 check should succeed"
    );
    assert!(
        final_user3_check.is_ok(),
        "Final user3 check should succeed"
    );

    assert_eq!(
        final_user1_check.unwrap().len(),
        1,
        "Final user1 check should show 1 account"
    );
    assert_eq!(
        final_user2_check.unwrap().len(),
        1,
        "Final user2 check should show 1 account"
    );
    assert_eq!(
        final_user3_check.unwrap().len(),
        1,
        "Final user3 check should show 1 account"
    );
}

#[tokio::test]
async fn given_cross_user_access_attempt_when_using_another_users_id_then_returns_access_denied() {
    let mut mock_repo = MockDatabaseRepository::new();

    let user1_id = Uuid::new_v4();
    let user2_id = Uuid::new_v4();

    let user1 = User {
        id: user1_id,
        email: "victim_user@test.com".to_string(),
        password_hash: "hashed_password1".to_string(),
        provider: "teller".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        onboarding_completed: false,
    };

    let user2 = User {
        id: user2_id,
        email: "attacker_user@test.com".to_string(),
        password_hash: "hashed_password2".to_string(),
        provider: "teller".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        onboarding_completed: false,
    };

    mock_repo
        .expect_create_user()
        .withf(move |user| user.email == "victim_user@test.com")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_create_user()
        .withf(move |user| user.email == "attacker_user@test.com")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo.create_user(&user1).await.unwrap();
    mock_repo.create_user(&user2).await.unwrap();

    let user1_account = Account {
        id: Uuid::new_v4(),
        user_id: Some(user1_id),
        provider_account_id: Some("user1_secret_account".to_string()),
        provider_connection_id: None,
        name: "User1 Private Account".to_string(),
        account_type: "depository".to_string(),
        balance_current: Some(dec!(5000.00)),
        mask: None,
        institution_name: None,
    };

    let user1_transaction = Transaction {
        id: Uuid::new_v4(),
        account_id: user1_account.id,
        user_id: Some(user1_id),
        provider_account_id: None,
        provider_transaction_id: Some("user1_secret_txn".to_string()),
        amount: dec!(250.00),
        date: chrono::NaiveDate::from_ymd_opt(2024, 1, 20).unwrap(),
        merchant_name: Some("Private Store".to_string()),
        category_primary: "Personal".to_string(),
        category_detailed: "Secret Purchase".to_string(),
        category_confidence: "VERY_HIGH".to_string(),
        payment_channel: Some("in_store".to_string()),
        pending: false,
        created_at: Some(chrono::Utc::now()),
    };

    let user1_plaid_connection = PlaidConnection {
        id: Uuid::new_v4(),
        user_id: user1_id,
        item_id: "user1_secret_item".to_string(),
        is_connected: true,
        last_sync_at: Some(chrono::Utc::now()),
        connected_at: Some(chrono::Utc::now()),
        disconnected_at: None,
        institution_id: Some("ins_user1".to_string()),
        institution_name: Some("User1 Secret Bank".to_string()),
        institution_logo_url: None,
        sync_cursor: None,
        transaction_count: 100,
        account_count: 3,
        created_at: Some(chrono::Utc::now()),
        updated_at: Some(chrono::Utc::now()),
    };

    mock_repo
        .expect_upsert_account()
        .withf(move |account| account.name == "User1 Private Account")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_transaction()
        .withf(move |txn| txn.merchant_name == Some("Private Store".to_string()))
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_save_provider_connection()
        .withf(move |conn| conn.item_id == "user1_secret_item")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_get_transactions_for_user()
        .times(1..)
        .returning(move |_| Box::pin(async { Ok(vec![]) }));

    mock_repo
        .expect_get_accounts_for_user()
        .times(1..)
        .returning(move |_| Box::pin(async { Ok(vec![]) }));

    mock_repo
        .expect_get_all_provider_connections_by_user()
        .times(1..)
        .returning(move |_| Box::pin(async { Ok(vec![]) }));

    mock_repo.upsert_account(&user1_account).await.unwrap();
    mock_repo
        .upsert_transaction(&user1_transaction)
        .await
        .unwrap();
    mock_repo
        .save_provider_connection(&user1_plaid_connection)
        .await
        .unwrap();

    let cross_user_transactions = mock_repo.get_transactions_for_user(&user1_id).await;

    let cross_user_accounts = mock_repo.get_accounts_for_user(&user1_id).await;

    let cross_user_plaid = mock_repo
        .get_all_provider_connections_by_user(&user1_id)
        .await;

    assert!(
        cross_user_transactions.is_ok(),
        "Query should execute but with isolation"
    );
    assert!(
        cross_user_accounts.is_ok(),
        "Query should execute but with isolation"
    );
    assert!(
        cross_user_plaid.is_ok(),
        "Query should execute but with isolation"
    );

    let user2_transactions = mock_repo
        .get_transactions_for_user(&user2_id)
        .await
        .unwrap();
    let user2_accounts = mock_repo.get_accounts_for_user(&user2_id).await.unwrap();
    let user2_plaid = mock_repo
        .get_all_provider_connections_by_user(&user2_id)
        .await
        .unwrap();

    assert_eq!(
        user2_transactions.len(),
        0,
        "User2 should see no transactions"
    );
    assert_eq!(user2_accounts.len(), 0, "User2 should see no accounts");
    assert!(
        user2_plaid.is_empty(),
        "User2 should see no Plaid connections"
    );

    let malicious_user_id_attempts = vec![
        "'; DROP TABLE users; --".to_string(),
        format!("{}' OR '1'='1", user1_id),
        format!("{} UNION SELECT * FROM transactions", user1_id),
    ];

    for malicious_input in malicious_user_id_attempts {
        let _type_safe_protection = format!("Attempted injection: {}", malicious_input);
    }
}

#[tokio::test]
async fn given_user_account_deletion_when_triggered_then_cascades_all_related_user_data_removal() {
    let mut mock_repo = MockDatabaseRepository::new();

    let user1_id = Uuid::new_v4();
    let user2_id = Uuid::new_v4();
    let user3_id = Uuid::new_v4();

    mock_repo
        .expect_create_user()
        .withf(move |user| user.email == "user1_to_delete@test.com")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_create_user()
        .withf(move |user| user.email == "user2_to_keep@test.com")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_create_user()
        .withf(move |user| user.email == "user3_to_keep@test.com")
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_account()
        .times(3)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_upsert_transaction()
        .times(3)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_save_provider_connection()
        .times(2)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_delete_provider_transactions()
        .with(mockall::predicate::eq("user1_item_delete"))
        .times(1)
        .returning(|_| Box::pin(async { Ok(2) }));

    mock_repo
        .expect_delete_user()
        .times(1..)
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_repo
        .expect_get_accounts_for_user()
        .times(1..)
        .returning(move |query_user_id| {
            if *query_user_id == user1_id {
                let account1 = Account {
                    id: Uuid::new_v4(),
                    user_id: Some(user1_id),
                    provider_account_id: Some("user1_account_1".to_string()),
                    provider_connection_id: None,
                    name: "User1 Checking".to_string(),
                    account_type: "depository".to_string(),
                    balance_current: Some(rust_decimal::Decimal::new(150000, 2)),
                    mask: None,
                    institution_name: None,
                };
                let account2 = Account {
                    id: Uuid::new_v4(),
                    user_id: Some(user1_id),
                    provider_account_id: Some("user1_account_2".to_string()),
                    provider_connection_id: None,
                    name: "User1 Savings".to_string(),
                    account_type: "depository".to_string(),
                    balance_current: Some(rust_decimal::Decimal::new(350000, 2)),
                    mask: None,
                    institution_name: None,
                };
                Box::pin(async { Ok(vec![account1, account2]) })
            } else if *query_user_id == user2_id {
                let account = Account {
                    id: Uuid::new_v4(),
                    user_id: Some(user2_id),
                    provider_account_id: Some("user2_account_safe".to_string()),
                    provider_connection_id: None,
                    name: "User2 Account".to_string(),
                    account_type: "credit".to_string(),
                    balance_current: Some(rust_decimal::Decimal::new(200000, 2)),
                    mask: None,
                    institution_name: None,
                };
                Box::pin(async { Ok(vec![account]) })
            } else {
                Box::pin(async { Ok(vec![]) })
            }
        });

    mock_repo
        .expect_get_transactions_for_user()
        .times(1..)
        .returning(move |query_user_id| {
            if *query_user_id == user1_id {
                let txn1 = Transaction {
                    id: Uuid::new_v4(),
                    account_id: Uuid::new_v4(),
                    user_id: Some(user1_id),
                    provider_account_id: None,
                    provider_transaction_id: Some("user1_txn_1".to_string()),
                    amount: rust_decimal::Decimal::new(2500, 2),
                    date: chrono::NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
                    merchant_name: Some("User1 Store 1".to_string()),
                    category_primary: "Food and Drink".to_string(),
                    category_detailed: "Restaurants".to_string(),
                    category_confidence: "VERY_HIGH".to_string(),
                    payment_channel: Some("in_store".to_string()),
                    pending: false,
                    created_at: Some(chrono::Utc::now()),
                };
                let txn2 = Transaction {
                    id: Uuid::new_v4(),
                    account_id: Uuid::new_v4(),
                    user_id: Some(user1_id),
                    provider_account_id: None,
                    provider_transaction_id: Some("user1_txn_2".to_string()),
                    amount: rust_decimal::Decimal::new(4500, 2),
                    date: chrono::NaiveDate::from_ymd_opt(2024, 1, 16).unwrap(),
                    merchant_name: Some("User1 Store 2".to_string()),
                    category_primary: "Transportation".to_string(),
                    category_detailed: "Gas Stations".to_string(),
                    category_confidence: "HIGH".to_string(),
                    payment_channel: Some("in_store".to_string()),
                    pending: false,
                    created_at: Some(chrono::Utc::now()),
                };
                Box::pin(async { Ok(vec![txn1, txn2]) })
            } else if *query_user_id == user2_id {
                let txn = Transaction {
                    id: Uuid::new_v4(),
                    account_id: Uuid::new_v4(),
                    user_id: Some(user2_id),
                    provider_account_id: None,
                    provider_transaction_id: Some("user2_txn_safe".to_string()),
                    amount: rust_decimal::Decimal::new(7500, 2),
                    date: chrono::NaiveDate::from_ymd_opt(2024, 1, 17).unwrap(),
                    merchant_name: Some("User2 Store".to_string()),
                    category_primary: "Transportation".to_string(),
                    category_detailed: "Gas Stations".to_string(),
                    category_confidence: "VERY_HIGH".to_string(),
                    payment_channel: Some("in_store".to_string()),
                    pending: false,
                    created_at: Some(chrono::Utc::now()),
                };
                Box::pin(async { Ok(vec![txn]) })
            } else {
                Box::pin(async { Ok(vec![]) })
            }
        });

    mock_repo
        .expect_get_all_provider_connections_by_user()
        .times(1..)
        .returning(move |query_user_id| {
            if *query_user_id == user1_id {
                let conn = PlaidConnection {
                    id: Uuid::new_v4(),
                    user_id: user1_id,
                    item_id: "user1_plaid_item".to_string(),
                    is_connected: true,
                    last_sync_at: Some(chrono::Utc::now()),
                    connected_at: Some(chrono::Utc::now()),
                    disconnected_at: None,
                    institution_id: Some("ins_user1".to_string()),
                    institution_name: Some("User1 Bank".to_string()),
                    institution_logo_url: None,
                    sync_cursor: None,
                    transaction_count: 15,
                    account_count: 2,
                    created_at: Some(chrono::Utc::now()),
                    updated_at: Some(chrono::Utc::now()),
                };
                Box::pin(async { Ok(vec![conn]) })
            } else if *query_user_id == user2_id {
                let conn = PlaidConnection {
                    id: Uuid::new_v4(),
                    user_id: user2_id,
                    item_id: "user2_item_safe".to_string(),
                    is_connected: true,
                    last_sync_at: Some(chrono::Utc::now()),
                    connected_at: Some(chrono::Utc::now()),
                    disconnected_at: None,
                    institution_id: Some("ins_user2".to_string()),
                    institution_name: Some("User2 Bank".to_string()),
                    institution_logo_url: None,
                    sync_cursor: None,
                    transaction_count: 25,
                    account_count: 1,
                    created_at: Some(chrono::Utc::now()),
                    updated_at: Some(chrono::Utc::now()),
                };
                Box::pin(async { Ok(vec![conn]) })
            } else {
                Box::pin(async { Ok(vec![]) })
            }
        });

    let user1 = User {
        id: user1_id,
        email: "user1_to_delete@test.com".to_string(),
        password_hash: "hashed_password1".to_string(),
        provider: "teller".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        onboarding_completed: false,
    };

    let user2 = User {
        id: user2_id,
        email: "user2_to_keep@test.com".to_string(),
        password_hash: "hashed_password2".to_string(),
        provider: "teller".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        onboarding_completed: false,
    };

    let user3 = User {
        id: user3_id,
        email: "user3_to_keep@test.com".to_string(),
        password_hash: "hashed_password3".to_string(),
        provider: "teller".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        onboarding_completed: false,
    };

    mock_repo.create_user(&user1).await.unwrap();
    mock_repo.create_user(&user2).await.unwrap();
    mock_repo.create_user(&user3).await.unwrap();

    let user1_account1 = Account {
        id: Uuid::new_v4(),
        user_id: Some(user1_id),
        provider_account_id: Some("user1_account_1".to_string()),
        provider_connection_id: None,
        name: "User1 Checking".to_string(),
        account_type: "depository".to_string(),
        balance_current: Some(dec!(1500.00)),
        mask: None,
        institution_name: None,
    };

    let user1_account2 = Account {
        id: Uuid::new_v4(),
        user_id: Some(user1_id),
        provider_account_id: Some("user1_account_2".to_string()),
        provider_connection_id: None,
        name: "User1 Savings".to_string(),
        account_type: "depository".to_string(),
        balance_current: Some(dec!(5000.00)),
        mask: None,
        institution_name: None,
    };

    let user1_transaction1 = Transaction {
        id: Uuid::new_v4(),
        account_id: user1_account1.id,
        user_id: Some(user1_id),
        provider_account_id: None,
        provider_transaction_id: Some("user1_txn_1".to_string()),
        amount: dec!(100.00),
        date: chrono::NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
        merchant_name: Some("User1 Store 1".to_string()),
        category_primary: "Food and Drink".to_string(),
        category_detailed: "Restaurants".to_string(),
        category_confidence: "VERY_HIGH".to_string(),
        payment_channel: Some("in_store".to_string()),
        pending: false,
        created_at: Some(chrono::Utc::now()),
    };

    let user1_transaction2 = Transaction {
        id: Uuid::new_v4(),
        account_id: user1_account2.id,
        user_id: Some(user1_id),
        provider_account_id: None,
        provider_transaction_id: Some("user1_txn_2".to_string()),
        amount: dec!(250.00),
        date: chrono::NaiveDate::from_ymd_opt(2024, 1, 16).unwrap(),
        merchant_name: Some("User1 Store 2".to_string()),
        category_primary: "Shopping".to_string(),
        category_detailed: "General Merchandise".to_string(),
        category_confidence: "HIGH".to_string(),
        payment_channel: Some("online".to_string()),
        pending: false,
        created_at: Some(chrono::Utc::now()),
    };

    let user1_plaid_connection = PlaidConnection {
        id: Uuid::new_v4(),
        user_id: user1_id,
        item_id: "user1_item_delete".to_string(),
        is_connected: true,
        last_sync_at: Some(chrono::Utc::now()),
        connected_at: Some(chrono::Utc::now()),
        disconnected_at: None,
        institution_id: Some("ins_user1".to_string()),
        institution_name: Some("User1 Bank".to_string()),
        institution_logo_url: None,
        sync_cursor: None,
        transaction_count: 50,
        account_count: 2,
        created_at: Some(chrono::Utc::now()),
        updated_at: Some(chrono::Utc::now()),
    };

    let user2_account = Account {
        id: Uuid::new_v4(),
        user_id: Some(user2_id),
        provider_account_id: Some("user2_account_safe".to_string()),
        provider_connection_id: None,
        name: "User2 Account".to_string(),
        account_type: "credit".to_string(),
        balance_current: Some(dec!(2000.00)),
        mask: None,
        institution_name: None,
    };

    let user2_transaction = Transaction {
        id: Uuid::new_v4(),
        account_id: user2_account.id,
        user_id: Some(user2_id),
        provider_account_id: None,
        provider_transaction_id: Some("user2_txn_safe".to_string()),
        amount: dec!(75.00),
        date: chrono::NaiveDate::from_ymd_opt(2024, 1, 17).unwrap(),
        merchant_name: Some("User2 Store".to_string()),
        category_primary: "Transportation".to_string(),
        category_detailed: "Gas Stations".to_string(),
        category_confidence: "VERY_HIGH".to_string(),
        payment_channel: Some("in_store".to_string()),
        pending: false,
        created_at: Some(chrono::Utc::now()),
    };

    let user2_plaid_connection = PlaidConnection {
        id: Uuid::new_v4(),
        user_id: user2_id,
        item_id: "user2_item_safe".to_string(),
        is_connected: true,
        last_sync_at: Some(chrono::Utc::now()),
        connected_at: Some(chrono::Utc::now()),
        disconnected_at: None,
        institution_id: Some("ins_user2".to_string()),
        institution_name: Some("User2 Bank".to_string()),
        institution_logo_url: None,
        sync_cursor: None,
        transaction_count: 25,
        account_count: 1,
        created_at: Some(chrono::Utc::now()),
        updated_at: Some(chrono::Utc::now()),
    };

    mock_repo.upsert_account(&user1_account1).await.unwrap();
    mock_repo.upsert_account(&user1_account2).await.unwrap();
    mock_repo.upsert_account(&user2_account).await.unwrap();

    mock_repo
        .upsert_transaction(&user1_transaction1)
        .await
        .unwrap();
    mock_repo
        .upsert_transaction(&user1_transaction2)
        .await
        .unwrap();
    mock_repo
        .upsert_transaction(&user2_transaction)
        .await
        .unwrap();

    mock_repo
        .save_provider_connection(&user1_plaid_connection)
        .await
        .unwrap();
    mock_repo
        .save_provider_connection(&user2_plaid_connection)
        .await
        .unwrap();

    let user1_accounts_before = mock_repo.get_accounts_for_user(&user1_id).await.unwrap();
    let user1_transactions_before = mock_repo
        .get_transactions_for_user(&user1_id)
        .await
        .unwrap();
    let user1_plaid_before = mock_repo
        .get_all_provider_connections_by_user(&user1_id)
        .await
        .unwrap();
    let user2_accounts_before = mock_repo.get_accounts_for_user(&user2_id).await.unwrap();
    let user2_transactions_before = mock_repo
        .get_transactions_for_user(&user2_id)
        .await
        .unwrap();
    let user2_plaid_before = mock_repo
        .get_all_provider_connections_by_user(&user2_id)
        .await
        .unwrap();

    assert_eq!(
        user1_accounts_before.len(),
        2,
        "User1 should have 2 accounts before deletion"
    );
    assert_eq!(
        user1_transactions_before.len(),
        2,
        "User1 should have 2 transactions before deletion"
    );
    assert!(
        !user1_plaid_before.is_empty(),
        "User1 should have Plaid connection before deletion"
    );
    assert_eq!(
        user2_accounts_before.len(),
        1,
        "User2 should have 1 account before deletion"
    );
    assert_eq!(
        user2_transactions_before.len(),
        1,
        "User2 should have 1 transaction before deletion"
    );
    assert!(
        !user2_plaid_before.is_empty(),
        "User2 should have Plaid connection before deletion"
    );

    let _deleted_transactions = mock_repo
        .delete_provider_transactions("user1_item_delete")
        .await
        .unwrap();

    mock_repo.delete_user(&user1_id).await.unwrap();

    let _user1_accounts_after = mock_repo.get_accounts_for_user(&user1_id).await.unwrap();
    let _user1_transactions_after = mock_repo
        .get_transactions_for_user(&user1_id)
        .await
        .unwrap();
    let _user1_plaid_after = mock_repo
        .get_all_provider_connections_by_user(&user1_id)
        .await
        .unwrap();

    let user2_accounts_after = mock_repo.get_accounts_for_user(&user2_id).await.unwrap();
    let user2_transactions_after = mock_repo
        .get_transactions_for_user(&user2_id)
        .await
        .unwrap();
    let user2_plaid_after = mock_repo
        .get_all_provider_connections_by_user(&user2_id)
        .await
        .unwrap();
    let user3_accounts_after = mock_repo.get_accounts_for_user(&user3_id).await.unwrap();

    assert_eq!(
        user2_accounts_after.len(),
        1,
        "User2 accounts should remain after user1 deletion"
    );
    assert_eq!(
        user2_transactions_after.len(),
        1,
        "User2 transactions should remain after user1 deletion"
    );
    assert!(
        !user2_plaid_after.is_empty(),
        "User2 Plaid connection should remain after user1 deletion"
    );
    assert_eq!(
        user3_accounts_after.len(),
        0,
        "User3 should have no data (was never given any)"
    );

    let remaining_user2_account = &user2_accounts_after[0];
    let remaining_user2_transaction = &user2_transactions_after[0];
    let remaining_user2_plaid = &user2_plaid_after[0];

    assert_eq!(
        remaining_user2_account.user_id,
        Some(user2_id),
        "User2 account should still belong to user2"
    );
    assert_eq!(
        remaining_user2_account.name, "User2 Account",
        "User2 account details should be preserved"
    );
    assert_eq!(
        remaining_user2_transaction.user_id,
        Some(user2_id),
        "User2 transaction should still belong to user2"
    );
    assert_eq!(
        remaining_user2_transaction.merchant_name,
        Some("User2 Store".to_string()),
        "User2 transaction details should be preserved"
    );
    assert_eq!(
        remaining_user2_plaid.user_id, user2_id,
        "User2 Plaid connection should still belong to user2"
    );
    assert_eq!(
        remaining_user2_plaid.item_id, "user2_item_safe",
        "User2 Plaid connection details should be preserved"
    );

    let user3_transactions_after = mock_repo
        .get_transactions_for_user(&user3_id)
        .await
        .unwrap();
    let user3_plaid_after = mock_repo
        .get_all_provider_connections_by_user(&user3_id)
        .await
        .unwrap();

    assert_eq!(
        user3_transactions_after.len(),
        0,
        "User3 should have no transactions"
    );
    assert!(
        user3_plaid_after.is_empty(),
        "User3 should have no Plaid connections"
    );

    assert_ne!(
        remaining_user2_account.id, user1_account1.id,
        "User2 account should not have user1's account ID"
    );
    assert_ne!(
        remaining_user2_account.id, user1_account2.id,
        "User2 account should not have user1's other account ID"
    );
    assert_ne!(
        remaining_user2_transaction.id, user1_transaction1.id,
        "User2 transaction should not have user1's transaction ID"
    );
    assert_ne!(
        remaining_user2_transaction.id, user1_transaction2.id,
        "User2 transaction should not have user1's other transaction ID"
    );
    assert_ne!(
        remaining_user2_plaid.id, user1_plaid_connection.id,
        "User2 Plaid connection should not have user1's connection ID"
    );
}

#[tokio::test]
async fn given_user_with_transactions_across_accounts_when_get_transaction_count_by_account_then_returns_correct_counts(
) {
    let mut mock_repo = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();
    let account1_id = Uuid::new_v4();
    let account2_id = Uuid::new_v4();
    let account3_id = Uuid::new_v4(); // Account with no transactions

    let mut expected_counts = HashMap::new();
    expected_counts.insert(account1_id, 2i64); // 2 transactions
    expected_counts.insert(account2_id, 1i64); // 1 transaction
                                               // account3_id should not appear in result (0 transactions)

    mock_repo
        .expect_get_transaction_count_by_account_for_user()
        .with(mockall::predicate::eq(user_id))
        .returning(move |_| {
            let counts = expected_counts.clone();
            Box::pin(async move { Ok(counts) })
        });

    let result = mock_repo
        .get_transaction_count_by_account_for_user(&user_id)
        .await;

    assert!(result.is_ok());
    let counts = result.unwrap();

    assert_eq!(counts.len(), 2);
    assert_eq!(counts.get(&account1_id), Some(&2i64));
    assert_eq!(counts.get(&account2_id), Some(&1i64));
    assert_eq!(counts.get(&account3_id), None); // No entry for accounts with 0 transactions
}

#[tokio::test]
async fn given_user_with_no_transactions_when_get_transaction_count_by_account_then_returns_empty_map(
) {
    let mut mock_repo = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();

    mock_repo
        .expect_get_transaction_count_by_account_for_user()
        .with(mockall::predicate::eq(user_id))
        .returning(|_| Box::pin(async move { Ok(HashMap::new()) }));

    let result = mock_repo
        .get_transaction_count_by_account_for_user(&user_id)
        .await;

    assert!(result.is_ok());
    let counts = result.unwrap();
    assert!(counts.is_empty());
}

#[tokio::test]
async fn given_user_with_multiple_connections_when_get_all_then_returns_all_connections() {
    let mut mock_repo = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();

    let conn1 = PlaidConnection::new(user_id, "item_1");
    let conn2 = PlaidConnection::new(user_id, "item_2");
    let conn1_clone = conn1.clone();
    let conn2_clone = conn2.clone();

    mock_repo
        .expect_get_all_provider_connections_by_user()
        .with(predicate::eq(user_id))
        .returning(move |_| {
            let c1 = conn1_clone.clone();
            let c2 = conn2_clone.clone();
            Box::pin(async move { Ok(vec![c1, c2]) })
        });

    let result = mock_repo
        .get_all_provider_connections_by_user(&user_id)
        .await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap().len(), 2);
}

#[tokio::test]
async fn given_user_with_no_connections_when_get_all_then_returns_empty() {
    let mut mock_repo = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();

    mock_repo
        .expect_get_all_provider_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let result = mock_repo
        .get_all_provider_connections_by_user(&user_id)
        .await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap().len(), 0);
}

#[tokio::test]
async fn given_valid_connection_id_when_get_by_id_then_returns_connection() {
    let mut mock_repo = MockDatabaseRepository::new();
    let connection_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();

    let mut conn = PlaidConnection::new(user_id, "item_1");
    conn.id = connection_id;
    let conn_clone = conn.clone();

    mock_repo
        .expect_get_provider_connection_by_id()
        .with(predicate::eq(connection_id), predicate::eq(user_id))
        .returning(move |_, _| {
            let c = conn_clone.clone();
            Box::pin(async move { Ok(Some(c)) })
        });

    let result = mock_repo
        .get_provider_connection_by_id(&connection_id, &user_id)
        .await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap().unwrap().id, connection_id);
}

#[tokio::test]
async fn given_invalid_connection_id_when_get_by_id_then_returns_none() {
    let mut mock_repo = MockDatabaseRepository::new();
    let connection_id = Uuid::new_v4();

    mock_repo
        .expect_get_provider_connection_by_id()
        .returning(|_, _| Box::pin(async { Ok(None) }));

    let result = mock_repo
        .get_provider_connection_by_id(&connection_id, &Uuid::new_v4())
        .await;
    assert!(result.is_ok());
    assert!(result.unwrap().is_none());
}

#[tokio::test]
async fn given_connection_exists_when_queried_by_different_user_then_returns_none() {
    let mut mock_repo = MockDatabaseRepository::new();
    let owner_user_id = Uuid::new_v4();
    let other_user_id = Uuid::new_v4();
    let connection_id = Uuid::new_v4();

    let mut conn = PlaidConnection::new(owner_user_id, "item_1");
    conn.id = connection_id;

    mock_repo
        .expect_get_provider_connection_by_id()
        .with(predicate::eq(connection_id), predicate::eq(other_user_id))
        .returning(|_, _| Box::pin(async { Ok(None) }));

    let result = mock_repo
        .get_provider_connection_by_id(&connection_id, &other_user_id)
        .await;
    assert!(result.is_ok());
    assert!(result.unwrap().is_none());
}
