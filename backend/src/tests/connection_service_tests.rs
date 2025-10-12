use crate::models::plaid::PlaidConnection;
use crate::services::cache_service::MockCacheService;
use crate::services::connection_service::ConnectionService;
use crate::services::repository_service::MockDatabaseRepository;
use std::sync::Arc;
use uuid::Uuid;

#[tokio::test]
async fn given_connection_id_when_disconnect_then_disconnects_specific_connection() {
    let mut mock_db = MockDatabaseRepository::new();
    let mut mock_cache = MockCacheService::new();

    let user_id = Uuid::new_v4();
    let connection_id = Uuid::new_v4();

    let mut expected_conn = PlaidConnection::new(user_id, "item_123");
    expected_conn.id = connection_id;
    expected_conn.mark_connected("Chase");

    mock_db
        .expect_get_plaid_connection_by_id()
        .with(
            mockall::predicate::eq(connection_id),
            mockall::predicate::eq(user_id),
        )
        .returning(move |_, _| {
            let conn = expected_conn.clone();
            Box::pin(async move { Ok(Some(conn)) })
        });

    mock_db
        .expect_save_plaid_connection()
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_db
        .expect_delete_plaid_transactions()
        .returning(|_| Box::pin(async { Ok(10) }));

    mock_db
        .expect_delete_plaid_accounts()
        .returning(|_| Box::pin(async { Ok(2) }));

    mock_db
        .expect_delete_plaid_credentials()
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_delete_access_token()
        .returning(|_, _| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_invalidate_pattern()
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_clear_transactions()
        .returning(|| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_clear_jwt_scoped_bank_connection_cache()
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let service = ConnectionService::new(Arc::new(mock_db), Arc::new(mock_cache));

    let result = service
        .disconnect_plaid_by_id(&connection_id, &user_id, "jwt_123")
        .await;

    assert!(result.is_ok());
    let disconnect_result = result.unwrap();
    assert!(disconnect_result.success);
    assert_eq!(disconnect_result.data_cleared.transactions, 10);
    assert_eq!(disconnect_result.data_cleared.accounts, 2);
}
