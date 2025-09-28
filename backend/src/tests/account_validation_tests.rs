use crate::models::account::Account;
use crate::services::repository_service::{DatabaseRepository, MockDatabaseRepository};
use crate::utils::account_validation::validate_account_ownership;
use axum::http::StatusCode;
use std::sync::Arc;
use uuid::Uuid;

#[tokio::test]
async fn given_valid_owned_accounts_when_validate_then_returns_uuids() {
    let mut mock_db = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();
    let account_id_1 = Uuid::new_v4();
    let account_id_2 = Uuid::new_v4();

    let accounts = vec![
        Account {
            id: account_id_1,
            user_id: Some(user_id),
            plaid_account_id: Some("acc1".to_string()),
            plaid_connection_id: Some(Uuid::new_v4()),
            name: "Account 1".to_string(),
            account_type: "checking".to_string(),
            balance_current: Some(rust_decimal_macros::dec!(1000.00)),
            mask: Some("0001".to_string()),
            institution_name: None,
        },
        Account {
            id: account_id_2,
            user_id: Some(user_id),
            plaid_account_id: Some("acc2".to_string()),
            plaid_connection_id: Some(Uuid::new_v4()),
            name: "Account 2".to_string(),
            account_type: "savings".to_string(),
            balance_current: Some(rust_decimal_macros::dec!(5000.00)),
            mask: Some("0002".to_string()),
            institution_name: None,
        },
    ];

    mock_db.expect_get_accounts_for_user().returning(move |_| {
        let accounts_clone = accounts.clone();
        Box::pin(async { Ok(accounts_clone) })
    });

    let db_repository: Arc<dyn DatabaseRepository> = Arc::new(mock_db);
    let account_strings = vec![account_id_1.to_string(), account_id_2.to_string()];

    let result = validate_account_ownership(&account_strings, &user_id, &db_repository).await;

    assert!(result.is_ok());
    let validated_ids = result.unwrap();
    assert_eq!(validated_ids.len(), 2);
    assert!(validated_ids.contains(&account_id_1));
    assert!(validated_ids.contains(&account_id_2));
}

#[tokio::test]
async fn given_foreign_account_when_validate_then_returns_forbidden() {
    let mut mock_db = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();
    let foreign_account_id = Uuid::new_v4();

    mock_db
        .expect_get_accounts_for_user()
        .returning(move |_| Box::pin(async { Ok(vec![]) }));

    let db_repository: Arc<dyn DatabaseRepository> = Arc::new(mock_db);
    let account_strings = vec![foreign_account_id.to_string()];

    let result = validate_account_ownership(&account_strings, &user_id, &db_repository).await;

    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn given_invalid_uuid_when_validate_then_returns_bad_request() {
    let mut mock_db = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();

    let db_repository: Arc<dyn DatabaseRepository> = Arc::new(mock_db);
    let account_strings = vec!["not-a-uuid".to_string()];

    let result = validate_account_ownership(&account_strings, &user_id, &db_repository).await;

    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), StatusCode::BAD_REQUEST);
}
