#[cfg(test)]
mod tests {
    use crate::middleware::resource_authorization::provider_scoped_account_ids;
    use crate::models::account::Account;
    use crate::models::auth::User;
    use crate::models::plaid::ProviderConnection;
    use crate::services::repository_service::MockDatabaseRepository;
    use chrono::Utc;
    use rust_decimal::Decimal;
    use std::sync::Arc;
    use uuid::Uuid;

    fn user_with_provider(provider: &str) -> User {
        User {
            id: Uuid::new_v4(),
            email: "test@example.com".to_string(),
            password_hash: None,
            provider: provider.to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            onboarding_completed: true,
        }
    }

    fn connection(id: Uuid, user_id: Uuid, provider: &str) -> ProviderConnection {
        ProviderConnection {
            id,
            user_id,
            item_id: format!("{}_item", provider),
            provider: provider.to_string(),
            is_connected: true,
            last_sync_at: None,
            connected_at: None,
            disconnected_at: None,
            institution_id: None,
            institution_name: None,
            institution_logo_url: None,
            sync_cursor: None,
            transaction_count: 0,
            account_count: 1,
            created_at: None,
            updated_at: None,
        }
    }

    fn account(id: Uuid, user_id: Uuid, connection_id: Uuid) -> Account {
        Account {
            id,
            user_id: Some(user_id),
            provider_account_id: Some(format!("acct_{}", id)),
            provider_connection_id: Some(connection_id),
            name: "Test Account".to_string(),
            account_type: "depository".to_string(),
            balance_current: Some(Decimal::from(100)),
            mask: None,
            institution_name: None,
            provider_conn_id: None,
        }
    }

    #[tokio::test]
    async fn no_provider_returns_empty_set() {
        let user = user_with_provider("");
        let user_id = user.id;

        let mut mock_db = MockDatabaseRepository::new();
        mock_db
            .expect_get_user_by_id()
            .with(mockall::predicate::eq(user_id))
            .returning(move |_| {
                let u = user.clone();
                Box::pin(async move { Ok(Some(u)) })
            });

        let db: Arc<dyn crate::services::repository_service::DatabaseRepository> =
            Arc::new(mock_db);

        let result = provider_scoped_account_ids(db.as_ref(), &user_id)
            .await
            .unwrap();

        assert!(
            result.is_empty(),
            "no provider selected should yield empty set"
        );
    }

    #[tokio::test]
    async fn provider_set_returns_only_matching_provider_accounts() {
        let user = user_with_provider("plaid");
        let user_id = user.id;
        let plaid_conn_id = Uuid::new_v4();
        let simplefin_conn_id = Uuid::new_v4();
        let plaid_account_id = Uuid::new_v4();
        let simplefin_account_id = Uuid::new_v4();

        let connections = vec![
            connection(plaid_conn_id, user_id, "plaid"),
            connection(simplefin_conn_id, user_id, "simplefin"),
        ];
        let accounts = vec![
            account(plaid_account_id, user_id, plaid_conn_id),
            account(simplefin_account_id, user_id, simplefin_conn_id),
        ];

        let mut mock_db = MockDatabaseRepository::new();
        mock_db.expect_get_user_by_id().returning(move |_| {
            let u = user.clone();
            Box::pin(async move { Ok(Some(u)) })
        });
        mock_db
            .expect_get_all_provider_connections_by_user()
            .returning(move |_| {
                let c = connections.clone();
                Box::pin(async move { Ok(c) })
            });
        mock_db.expect_get_accounts_for_user().returning(move |_| {
            let a = accounts.clone();
            Box::pin(async move { Ok(a) })
        });

        let db: Arc<dyn crate::services::repository_service::DatabaseRepository> =
            Arc::new(mock_db);

        let result = provider_scoped_account_ids(db.as_ref(), &user_id)
            .await
            .unwrap();

        assert_eq!(result.len(), 1);
        assert!(result.contains(&plaid_account_id));
        assert!(!result.contains(&simplefin_account_id));
    }

    #[tokio::test]
    async fn no_connections_for_provider_returns_empty_set() {
        let user = user_with_provider("plaid");
        let user_id = user.id;
        let simplefin_conn_id = Uuid::new_v4();
        let simplefin_account_id = Uuid::new_v4();

        let connections = vec![connection(simplefin_conn_id, user_id, "simplefin")];
        let accounts = vec![account(simplefin_account_id, user_id, simplefin_conn_id)];

        let mut mock_db = MockDatabaseRepository::new();
        mock_db.expect_get_user_by_id().returning(move |_| {
            let u = user.clone();
            Box::pin(async move { Ok(Some(u)) })
        });
        mock_db
            .expect_get_all_provider_connections_by_user()
            .returning(move |_| {
                let c = connections.clone();
                Box::pin(async move { Ok(c) })
            });
        mock_db.expect_get_accounts_for_user().returning(move |_| {
            let a = accounts.clone();
            Box::pin(async move { Ok(a) })
        });

        let db: Arc<dyn crate::services::repository_service::DatabaseRepository> =
            Arc::new(mock_db);

        let result = provider_scoped_account_ids(db.as_ref(), &user_id)
            .await
            .unwrap();

        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn user_not_found_returns_error() {
        let user_id = Uuid::new_v4();

        let mut mock_db = MockDatabaseRepository::new();
        mock_db
            .expect_get_user_by_id()
            .returning(|_| Box::pin(async { Ok(None) }));

        let db: Arc<dyn crate::services::repository_service::DatabaseRepository> =
            Arc::new(mock_db);

        let result = provider_scoped_account_ids(db.as_ref(), &user_id).await;

        assert!(result.is_err());
    }
}
