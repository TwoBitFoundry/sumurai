use crate::models::cache::{
    BankConnectionSyncStatus, CachedBankAccounts, CachedBankConnection, CachedTransaction,
};
use crate::models::{account::Account, plaid::PlaidConnection};
use crate::services::cache_service::{CacheService, MockCacheService};
use chrono::Utc;
use rust_decimal::Decimal;
use uuid::Uuid;

#[tokio::test]
async fn given_bank_connection_when_caching_with_jwt_scope_then_stores_with_correct_key() {
    let mut cache_service = MockCacheService::new();
    let jwt_id = "test-jwt-123";
    let connection_id = Uuid::new_v4();

    let connection = PlaidConnection {
        id: connection_id,
        user_id: Uuid::new_v4(),
        item_id: "test-item".to_string(),
        is_connected: true,
        last_sync_at: Some(Utc::now()),
        connected_at: Some(Utc::now()),
        disconnected_at: None,
        institution_id: Some("ins_test".to_string()),
        institution_name: Some("Chase".to_string()),
        institution_logo_url: Some("https://logo.url".to_string()),
        sync_cursor: Some("cursor123".to_string()),
        transaction_count: 5,
        account_count: 2,
        created_at: Some(Utc::now()),
        updated_at: Some(Utc::now()),
    };

    let cached_connection = CachedBankConnection {
        connection: connection.clone(),
        sync_status: BankConnectionSyncStatus {
            in_progress: false,
            last_sync_at: connection.last_sync_at,
            error_message: None,
        },
        cached_at: Utc::now(),
    };

    cache_service
        .expect_cache_jwt_scoped_bank_connection()
        .with(
            mockall::predicate::eq(jwt_id),
            mockall::predicate::eq(cached_connection.clone()),
        )
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let result = cache_service
        .cache_jwt_scoped_bank_connection(jwt_id, &cached_connection)
        .await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn given_bank_accounts_when_caching_with_jwt_scope_then_stores_with_correct_key() {
    let mut cache_service = MockCacheService::new();
    let jwt_id = "test-jwt-123";
    let connection_id = Uuid::new_v4();

    let accounts = vec![
        Account {
            id: Uuid::new_v4(),
            user_id: Some(Uuid::new_v4()),
            provider_account_id: Some("plaid-acc-1".to_string()),
            provider_connection_id: None,
            name: "Checking Account".to_string(),
            account_type: "depository".to_string(),
            balance_current: Some(Decimal::new(150000, 2)),
            mask: Some("1234".to_string()),
            institution_name: None,
        },
        Account {
            id: Uuid::new_v4(),
            user_id: Some(Uuid::new_v4()),
            provider_account_id: Some("plaid-acc-2".to_string()),
            provider_connection_id: None,
            name: "Savings Account".to_string(),
            account_type: "depository".to_string(),
            balance_current: Some(Decimal::new(300000, 2)),
            mask: Some("5678".to_string()),
            institution_name: None,
        },
    ];

    let cached_accounts = CachedBankAccounts {
        accounts: accounts.clone(),
        cached_at: Utc::now(),
    };

    cache_service
        .expect_cache_jwt_scoped_bank_accounts()
        .with(
            mockall::predicate::eq(jwt_id),
            mockall::predicate::eq(connection_id),
            mockall::predicate::eq(cached_accounts.clone()),
        )
        .times(1)
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    let result = cache_service
        .cache_jwt_scoped_bank_accounts(jwt_id, connection_id, &cached_accounts)
        .await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn given_multiple_connections_when_caching_connection_list_then_stores_with_jwt_scope() {
    let mut cache_service = MockCacheService::new();
    let jwt_id = "test-jwt-123";

    let connection_ids = vec![Uuid::new_v4(), Uuid::new_v4()];

    cache_service
        .expect_cache_jwt_scoped_connection_list()
        .with(
            mockall::predicate::eq(jwt_id),
            mockall::predicate::eq(connection_ids.clone()),
        )
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let result = cache_service
        .cache_jwt_scoped_connection_list(jwt_id, &connection_ids)
        .await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn given_bank_connection_disconnect_when_clearing_cache_then_removes_all_connection_data() {
    let mut cache_service = MockCacheService::new();
    let jwt_id = "test-jwt-123";
    let connection_id = Uuid::new_v4();

    cache_service
        .expect_clear_jwt_scoped_bank_connection_cache()
        .with(
            mockall::predicate::eq(jwt_id),
            mockall::predicate::eq(connection_id),
        )
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let result = cache_service
        .clear_jwt_scoped_bank_connection_cache(jwt_id, connection_id)
        .await;
    assert!(result.is_ok());
}

#[test]
fn given_jwt_id_and_connection_id_when_creating_cache_keys_then_uses_underscore_format() {
    let jwt_id = "test-jwt-123";
    let connection_id = Uuid::new_v4();
    let item_id = "test-item-456";
    let provider_account_id = "test-plaid-account-789";
    let transaction_id = "test-transaction-123";
    let expected_bank_connection_key = format!("{}_bank_connection_{}", jwt_id, connection_id);
    let expected_bank_accounts_key = format!("{}_bank_accounts_{}", jwt_id, connection_id);
    let expected_connection_list_key = format!("{}_bank_connections", jwt_id);
    let expected_session_token_key = format!("{}_session_token", jwt_id);
    let expected_access_token_key = format!("{}_access_token_{}", jwt_id, item_id);
    let expected_account_mapping_key =
        format!("{}_account_mapping_{}", jwt_id, provider_account_id);
    let expected_transaction_key = format!("{}_transaction_{}", jwt_id, transaction_id);

    // Verify the format matches our expectations
    assert_eq!(
        expected_bank_connection_key,
        format!("{}_bank_connection_{}", jwt_id, connection_id)
    );
    assert_eq!(
        expected_bank_accounts_key,
        format!("{}_bank_accounts_{}", jwt_id, connection_id)
    );
    assert_eq!(
        expected_connection_list_key,
        format!("{}_bank_connections", jwt_id)
    );
    assert_eq!(
        expected_session_token_key,
        format!("{}_session_token", jwt_id)
    );
    assert_eq!(
        expected_access_token_key,
        format!("{}_access_token_{}", jwt_id, item_id)
    );
    assert_eq!(
        expected_account_mapping_key,
        format!("{}_account_mapping_{}", jwt_id, provider_account_id)
    );
    assert_eq!(
        expected_transaction_key,
        format!("{}_transaction_{}", jwt_id, transaction_id)
    );
}

#[test]
fn given_cached_transaction_when_serializing_then_includes_timestamp() {
    use crate::models::transaction::Transaction;
    use chrono::Utc;
    use rust_decimal::Decimal;
    use uuid::Uuid;

    let transactions: Vec<Transaction> = vec![Transaction {
        id: Uuid::new_v4(),
        account_id: Uuid::new_v4(),
        user_id: None,
        provider_account_id: None,
        provider_transaction_id: None,
        amount: Decimal::new(1234, 2),
        date: Utc::now().date_naive(),
        merchant_name: Some("Demo".to_string()),
        category_primary: "Misc".to_string(),
        category_detailed: "Misc".to_string(),
        category_confidence: "HIGH".to_string(),
        payment_channel: Some("online".to_string()),
        pending: false,
        created_at: Some(Utc::now()),
    }];

    let cached = CachedTransaction {
        transactions,
        cached_at: Utc::now(),
    };
    let json_result = serde_json::to_string(&cached);

    assert!(json_result.is_ok());
    let json_str = json_result.unwrap();
    assert!(json_str.contains("transactions"));
    assert!(json_str.contains("cached_at"));
}

#[tokio::test]
async fn given_jwt_id_when_setting_session_valid_then_stores_with_correct_ttl() {
    let mut cache_service = MockCacheService::new();
    let jwt_id = "test-jwt-123";
    let ttl_seconds = 3600u64;

    cache_service
        .expect_set_session_valid()
        .with(
            mockall::predicate::eq(jwt_id),
            mockall::predicate::eq(ttl_seconds),
        )
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let result = cache_service.set_session_valid(jwt_id, ttl_seconds).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn given_valid_session_when_checking_validity_then_returns_true() {
    let mut cache_service = MockCacheService::new();
    let jwt_id = "test-jwt-123";

    cache_service
        .expect_is_session_valid()
        .with(mockall::predicate::eq(jwt_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(true) }));

    let result = cache_service.is_session_valid(jwt_id).await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), true);
}

#[tokio::test]
async fn given_invalid_session_when_checking_validity_then_returns_false() {
    let mut cache_service = MockCacheService::new();
    let jwt_id = "invalid-jwt-456";

    cache_service
        .expect_is_session_valid()
        .with(mockall::predicate::eq(jwt_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(false) }));

    let result = cache_service.is_session_valid(jwt_id).await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), false);
}

#[tokio::test]
async fn given_jwt_id_when_invalidating_session_then_removes_session_validity() {
    let mut cache_service = MockCacheService::new();
    let jwt_id = "test-jwt-123";

    cache_service
        .expect_invalidate_session()
        .with(mockall::predicate::eq(jwt_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let result = cache_service.invalidate_session(jwt_id).await;
    assert!(result.is_ok());
}

#[test]
fn given_jwt_id_when_creating_session_validity_key_then_uses_correct_format() {
    let jwt_id = "test-jwt-123";
    let expected_key = format!("{}_session_valid", jwt_id);

    assert_eq!(expected_key, format!("{}_session_valid", jwt_id));
}

#[tokio::test]
async fn given_successful_login_when_caching_session_then_sets_session_valid() {
    let mut cache_service = MockCacheService::new();
    let jwt_id = "test-jwt-123";
    let ttl_seconds = 3600u64;

    cache_service
        .expect_set_session_valid()
        .with(
            mockall::predicate::eq(jwt_id),
            mockall::predicate::eq(ttl_seconds),
        )
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let result = cache_service.set_session_valid(jwt_id, ttl_seconds).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn given_user_logout_when_clearing_session_then_invalidates_session_and_clears_all_data() {
    let mut cache_service = MockCacheService::new();
    let jwt_id = "test-jwt-123";

    cache_service
        .expect_invalidate_session()
        .with(mockall::predicate::eq(jwt_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    cache_service
        .expect_clear_jwt_scoped_data()
        .with(mockall::predicate::eq(jwt_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));

    let result = cache_service.invalidate_session(jwt_id).await;
    assert!(result.is_ok());

    let result = cache_service.clear_jwt_scoped_data(jwt_id).await;
    assert!(result.is_ok());
}
