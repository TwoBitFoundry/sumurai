use crate::models::custom_category::{CustomCategory, CustomCategoryError};
use crate::models::transaction::Transaction;
use crate::models::transaction_category_override::TransactionCategoryOverride;
use crate::services::categorization::category_descriptors::SYSTEM_CATEGORY_SLUGS;
use crate::services::category_management::service::{
    CategoryManagementService, CategoryServiceError,
};
use crate::services::repository_service::MockDatabaseRepository;
use chrono::NaiveDate;
use rust_decimal_macros::dec;
use uuid::Uuid;

fn make_service() -> CategoryManagementService {
    CategoryManagementService::new(SYSTEM_CATEGORY_SLUGS)
}

fn validation_error(result: Result<CustomCategory, CategoryServiceError>) -> CustomCategoryError {
    match result {
        Err(CategoryServiceError::Validation(e)) => e,
        other => panic!("expected validation error, got {:?}", other),
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

fn make_transaction(
    user_id: Uuid,
    category_primary: &str,
    merchant_name: Option<&str>,
) -> Transaction {
    Transaction {
        id: Uuid::new_v4(),
        account_id: Uuid::new_v4(),
        user_id: Some(user_id),
        provider_account_id: None,
        provider_transaction_id: Some("txn-001".to_string()),
        amount: dec!(-10.00),
        date: NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
        merchant_name: merchant_name.map(str::to_string),
        category_primary: category_primary.to_string(),
        category_detailed: category_primary.to_string(),
        category_confidence: "HIGH".to_string(),
        payment_channel: None,
        pending: false,
        created_at: None,
    }
}

fn make_override(
    user_id: Uuid,
    normalized_merchant: &str,
    category_name: &str,
    custom_category_id: Option<Uuid>,
) -> TransactionCategoryOverride {
    TransactionCategoryOverride {
        id: Uuid::new_v4(),
        user_id,
        normalized_merchant: normalized_merchant.to_string(),
        category_name: category_name.to_string(),
        custom_category_id,
        created_at: None,
        updated_at: None,
    }
}

#[tokio::test]
async fn given_empty_name_when_create_category_then_rejects_with_empty_name_error() {
    let service = make_service();
    let mut repo = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();

    repo.expect_list_custom_categories_for_user().times(0);

    let result = service.create_custom_category(&repo, &user_id, "   ").await;
    assert_eq!(validation_error(result), CustomCategoryError::EmptyName);
}

#[tokio::test]
async fn given_name_with_digits_when_create_category_then_rejects_invalid_characters() {
    let service = make_service();
    let mut repo = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();

    repo.expect_list_custom_categories_for_user().times(0);

    let result = service
        .create_custom_category(&repo, &user_id, "Coffee 1")
        .await;
    assert_eq!(
        validation_error(result),
        CustomCategoryError::InvalidCharacters
    );
}

#[tokio::test]
async fn given_name_with_hyphen_when_create_category_then_rejects_invalid_characters() {
    let service = make_service();
    let mut repo = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();

    repo.expect_list_custom_categories_for_user().times(0);

    let result = service
        .create_custom_category(&repo, &user_id, "Co-ffee")
        .await;
    assert_eq!(
        validation_error(result),
        CustomCategoryError::InvalidCharacters
    );
}

#[tokio::test]
async fn given_name_with_underscore_when_create_category_then_rejects_invalid_characters() {
    let service = make_service();
    let mut repo = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();

    repo.expect_list_custom_categories_for_user().times(0);

    let result = service
        .create_custom_category(&repo, &user_id, "FOOD_AND_DRINK")
        .await;
    assert_eq!(
        validation_error(result),
        CustomCategoryError::InvalidCharacters
    );
}

#[tokio::test]
async fn given_four_word_name_when_create_category_then_rejects_too_many_words() {
    let service = make_service();
    let mut repo = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();

    repo.expect_list_custom_categories_for_user().times(0);

    let result = service
        .create_custom_category(&repo, &user_id, "one two three four")
        .await;
    assert_eq!(validation_error(result), CustomCategoryError::TooManyWords);
}

#[tokio::test]
async fn given_name_over_thirty_chars_when_create_category_then_rejects_too_long() {
    let service = make_service();
    let mut repo = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();

    repo.expect_list_custom_categories_for_user().times(0);

    let result = service
        .create_custom_category(&repo, &user_id, "Averylongcategorynamethatisoverthelimit")
        .await;
    assert_eq!(validation_error(result), CustomCategoryError::NameTooLong);
}

#[tokio::test]
async fn given_name_colliding_with_system_slug_when_create_category_then_rejects() {
    let service = make_service();
    let mut repo = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();

    repo.expect_list_custom_categories_for_user().times(0);

    let result = service
        .create_custom_category(&repo, &user_id, "Food and Drink")
        .await;
    assert_eq!(
        validation_error(result),
        CustomCategoryError::CollidesWithSystemCategory
    );
}

#[tokio::test]
async fn given_name_colliding_with_system_display_alias_when_create_category_then_rejects() {
    let service = make_service();
    let mut repo = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();

    repo.expect_list_custom_categories_for_user().times(0);

    let result = service
        .create_custom_category(&repo, &user_id, "Bills")
        .await;
    assert_eq!(
        validation_error(result),
        CustomCategoryError::CollidesWithSystemCategory
    );
}

#[tokio::test]
async fn given_plural_of_existing_custom_when_create_category_then_rejects_collision() {
    let service = make_service();
    let user_id = Uuid::new_v4();
    let mut repo = MockDatabaseRepository::new();

    let existing = vec![make_custom_category(user_id, "Food", "food")];

    repo.expect_list_custom_categories_for_user()
        .times(1)
        .returning(move |_| {
            let e = existing.clone();
            Box::pin(async move { Ok(e) })
        });

    let result = service
        .create_custom_category(&repo, &user_id, "Foods")
        .await;
    assert_eq!(
        validation_error(result),
        CustomCategoryError::CollidesWithExistingCustom
    );
}

#[tokio::test]
async fn given_list_categories_db_failure_when_create_category_then_returns_db_error() {
    let service = make_service();
    let mut repo = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();

    repo.expect_list_custom_categories_for_user()
        .times(1)
        .returning(|_| Box::pin(async { Err(anyhow::anyhow!("db unavailable")) }));

    repo.expect_create_custom_category().times(0);

    let result = service
        .create_custom_category(&repo, &user_id, "Coffee")
        .await;

    assert!(matches!(result.unwrap_err(), CategoryServiceError::Db(_)));
}

#[tokio::test]
async fn given_create_category_db_failure_when_create_category_then_returns_db_error() {
    let service = make_service();
    let mut repo = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();

    repo.expect_list_custom_categories_for_user()
        .times(1)
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    repo.expect_create_custom_category()
        .times(1)
        .returning(|_, _, _| Box::pin(async { Err(anyhow::anyhow!("db unavailable")) }));

    let result = service
        .create_custom_category(&repo, &user_id, "Coffee")
        .await;

    assert!(matches!(result.unwrap_err(), CategoryServiceError::Db(_)));
}

#[tokio::test]
async fn given_whitespace_padded_valid_name_when_create_category_then_persists_correctly() {
    let service = make_service();
    let user_id = Uuid::new_v4();
    let mut repo = MockDatabaseRepository::new();

    let expected = make_custom_category(user_id, "Coffee Runs", "coffee run");

    repo.expect_list_custom_categories_for_user()
        .times(1)
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    repo.expect_create_custom_category()
        .withf(|_, display_name, lookup_key| {
            display_name == "Coffee Runs" && lookup_key == "coffee run"
        })
        .times(1)
        .returning(move |_, _, _| {
            let cat = expected.clone();
            Box::pin(async move { Ok(cat) })
        });

    let result = service
        .create_custom_category(&repo, &user_id, "  coffee   runs  ")
        .await;

    let cat = result.unwrap();
    assert_eq!(cat.display_name, "Coffee Runs");
    assert_eq!(cat.lookup_key, "coffee run");
}

#[tokio::test]
async fn given_system_category_reversion_when_set_transaction_category_then_deletes_override() {
    let service = make_service();
    let user_id = Uuid::new_v4();
    let mut repo = MockDatabaseRepository::new();
    let txn_id = Uuid::new_v4();

    let txn = make_transaction(user_id, "FOOD_AND_DRINK", Some("Starbucks #123"));

    repo.expect_get_transaction_by_id_for_user()
        .withf(move |uid, tid| *uid == user_id && *tid == txn_id)
        .times(1)
        .returning(move |_, _| {
            let t = txn.clone();
            Box::pin(async move { Ok(Some(t)) })
        });

    repo.expect_delete_transaction_category_override_by_norm()
        .withf(|_, norm| norm == "starbucks")
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    use crate::models::transaction_category_override::SetTransactionCategoryRequest;
    let request = SetTransactionCategoryRequest {
        category_name: "FOOD_AND_DRINK".to_string(),
        is_custom: false,
    };

    let result = service
        .set_transaction_category(&repo, &user_id, &txn_id, request)
        .await;

    assert!(result.is_ok());
    assert!(result.unwrap().is_none());
}

#[tokio::test]
async fn given_unknown_custom_when_set_transaction_category_then_returns_not_found() {
    let service = make_service();
    let user_id = Uuid::new_v4();
    let mut repo = MockDatabaseRepository::new();
    let txn_id = Uuid::new_v4();

    let txn = make_transaction(user_id, "FOOD_AND_DRINK", Some("Starbucks #123"));

    repo.expect_get_transaction_by_id_for_user()
        .times(1)
        .returning(move |_, _| {
            let t = txn.clone();
            Box::pin(async move { Ok(Some(t)) })
        });

    repo.expect_list_custom_categories_for_user()
        .times(1)
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    repo.expect_upsert_transaction_category_override().times(0);

    use crate::models::transaction_category_override::SetTransactionCategoryRequest;
    let request = SetTransactionCategoryRequest {
        category_name: "Coffee".to_string(),
        is_custom: true,
    };

    let result = service
        .set_transaction_category(&repo, &user_id, &txn_id, request)
        .await;

    assert!(matches!(
        result.unwrap_err(),
        CategoryServiceError::CustomCategoryNotFound
    ));
}

#[tokio::test]
async fn given_different_category_when_set_transaction_category_then_upserts_override() {
    let service = make_service();
    let user_id = Uuid::new_v4();
    let mut repo = MockDatabaseRepository::new();
    let txn_id = Uuid::new_v4();

    let txn = make_transaction(user_id, "FOOD_AND_DRINK", Some("Netflix.Com"));

    repo.expect_get_transaction_by_id_for_user()
        .times(1)
        .returning(move |_, _| {
            let t = txn.clone();
            Box::pin(async move { Ok(Some(t)) })
        });

    let override_row = make_override(user_id, "netflixcom", "ENTERTAINMENT", None);
    let override_clone = override_row.clone();

    repo.expect_upsert_transaction_category_override()
        .withf(|_, norm, cat, cid| norm == "netflixcom" && cat == "ENTERTAINMENT" && cid.is_none())
        .times(1)
        .returning(move |_, _, _, _| {
            let o = override_clone.clone();
            Box::pin(async move { Ok(o) })
        });

    use crate::models::transaction_category_override::SetTransactionCategoryRequest;
    let request = SetTransactionCategoryRequest {
        category_name: "ENTERTAINMENT".to_string(),
        is_custom: false,
    };

    let result = service
        .set_transaction_category(&repo, &user_id, &txn_id, request)
        .await;

    let o = result.unwrap().unwrap();
    assert_eq!(o.category_name, "ENTERTAINMENT");
}

#[tokio::test]
async fn given_foreign_transaction_when_set_transaction_category_then_returns_not_found() {
    let service = make_service();
    let user_id = Uuid::new_v4();
    let mut repo = MockDatabaseRepository::new();
    let txn_id = Uuid::new_v4();

    repo.expect_get_transaction_by_id_for_user()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(None) }));

    use crate::models::transaction_category_override::SetTransactionCategoryRequest;
    let request = SetTransactionCategoryRequest {
        category_name: "ENTERTAINMENT".to_string(),
        is_custom: false,
    };

    let result = service
        .set_transaction_category(&repo, &user_id, &txn_id, request)
        .await;

    assert!(matches!(
        result.unwrap_err(),
        CategoryServiceError::TransactionNotFound
    ));
}
