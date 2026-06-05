#[cfg(test)]
mod tests {
    use crate::models::account::Account;
    use crate::models::plaid::ProviderConnection;
    use crate::models::transaction::Transaction;
    use crate::providers::ProviderRegistry;
    use crate::seed::SUMURAI_DEMO_ORG_CONN_ID;
    use crate::services::cache_service::MockCacheService;
    use crate::services::connection_service::SyncConnectionParams;
    use crate::services::repository_service::MockDatabaseRepository;
    use crate::services::simplefin_connection_service::SimpleFinConnectionService;
    use crate::services::simplefin_org_service::SimpleFinOrganizationService;
    use crate::services::sync_service::SyncService;
    use crate::utils::merchant_name::normalize_merchant_for_match;
    use chrono::{NaiveDate, Utc};
    use rust_decimal::Decimal;
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};
    use uuid::Uuid;

    fn demo_item_id(user_id: &Uuid) -> String {
        format!("simplefin_{}_sumurai_demo", user_id)
    }

    fn demo_account(id: Uuid, connection_id: Uuid, user_id: Uuid) -> Account {
        Account {
            id,
            user_id: Some(user_id),
            provider_account_id: Some(format!("sumurai_demo_acct_{}", id)),
            provider_connection_id: Some(connection_id),
            name: "Sumurai Checking".to_string(),
            account_type: "depository".to_string(),
            balance_current: Some(Decimal::from(1000)),
            mask: None,
            institution_name: None,
            provider_conn_id: None,
        }
    }

    fn raw_transaction(
        account_id: Uuid,
        user_id: Uuid,
        raw_desc: &str,
        stale_merchant_name: &str,
    ) -> Transaction {
        Transaction {
            id: Uuid::new_v4(),
            account_id,
            user_id: Some(user_id),
            provider_account_id: None,
            provider_transaction_id: Some(format!("sumurai_demo_txn_{}", Uuid::new_v4())),
            amount: Decimal::from(10),
            date: NaiveDate::from_ymd_opt(2026, 6, 1).unwrap(),
            merchant_name: Some(stale_merchant_name.to_string()),
            category_primary: "OTHER".to_string(),
            category_detailed: "OTHER".to_string(),
            category_confidence: String::new(),
            payment_channel: None,
            pending: false,
            created_at: Some(Utc::now()),
            original_merchant_name: Some(raw_desc.to_string()),
            normalized_merchant: None,
        }
    }

    struct DemoSyncHarness {
        service: SimpleFinConnectionService,
        sync_service: Arc<SyncService>,
        user_id: Uuid,
        connection: ProviderConnection,
        captured_transactions: Arc<Mutex<Vec<Transaction>>>,
    }

    fn build_demo_sync_harness(
        user_id: Uuid,
        connection_id: Uuid,
        demo_accounts: Vec<Account>,
        demo_transactions: Vec<Transaction>,
    ) -> DemoSyncHarness {
        let item_id = demo_item_id(&user_id);

        let mut connection = ProviderConnection::new(user_id, &item_id);
        connection.id = connection_id;
        connection.institution_id = Some(SUMURAI_DEMO_ORG_CONN_ID.to_string());

        let captured = Arc::new(Mutex::new(Vec::<Transaction>::new()));

        let mut mock_db = MockDatabaseRepository::new();

        mock_db
            .expect_list_simplefin_hidden_orgs()
            .returning(|_| Box::pin(async { Ok(Default::default()) }));

        mock_db.expect_get_accounts_for_user().returning(move |_| {
            let accounts = demo_accounts.clone();
            Box::pin(async move { Ok(accounts) })
        });

        mock_db
            .expect_get_transactions_for_user()
            .returning(move |_| {
                let txns = demo_transactions.clone();
                Box::pin(async move { Ok(txns) })
            });

        mock_db
            .expect_get_active_merchant_aliases()
            .returning(|| Box::pin(async { Ok(vec![]) }));

        let captured_clone = Arc::clone(&captured);
        mock_db
            .expect_upsert_transactions_batch()
            .returning(move |batch, _| {
                *captured_clone.lock().unwrap() = batch.to_vec();
                Box::pin(async { Ok(()) })
            });

        let mut mock_cache = MockCacheService::new();

        mock_cache
            .expect_get_string()
            .returning(|_| Box::pin(async { Ok(None) }));

        mock_cache
            .expect_set_with_ttl()
            .returning(|_, _, _| Box::pin(async { Ok(()) }));

        mock_cache
            .expect_add_transaction()
            .returning(|_, _| Box::pin(async { Ok(()) }));

        let db_repository: Arc<dyn crate::services::repository_service::DatabaseRepository> =
            Arc::new(mock_db);
        let cache_service: Arc<dyn crate::services::cache_service::CacheService> =
            Arc::new(mock_cache);

        let org_service = Arc::new(SimpleFinOrganizationService::new(
            Arc::clone(&db_repository),
            Arc::clone(&cache_service),
        ));

        let provider_registry = Arc::new(ProviderRegistry::new());

        let service = SimpleFinConnectionService::new(
            Arc::clone(&db_repository),
            Arc::clone(&cache_service),
            provider_registry.clone(),
            HashMap::new(),
            org_service,
        );

        let sync_service = Arc::new(SyncService::new(provider_registry));

        DemoSyncHarness {
            service,
            sync_service,
            user_id,
            connection,
            captured_transactions: captured,
        }
    }

    #[tokio::test]
    async fn demo_sync_intercepts_without_provider_credentials() {
        let user_id = Uuid::new_v4();
        let connection_id = Uuid::new_v4();
        let account_id = Uuid::new_v4();

        let accounts = vec![demo_account(account_id, connection_id, user_id)];
        let transactions = (0..19)
            .map(|i| {
                raw_transaction(
                    account_id,
                    user_id,
                    &format!("RAW DESC {}", i),
                    &format!("RAW DESC {}", i),
                )
            })
            .collect::<Vec<_>>();

        let mut harness = build_demo_sync_harness(user_id, connection_id, accounts, transactions);

        let params = SyncConnectionParams {
            provider: "simplefin",
            user_id: &harness.user_id,
            jwt_id: "jwt_demo",
        };

        let result = harness
            .service
            .sync(
                params,
                harness.sync_service.as_ref(),
                &mut harness.connection,
                None,
            )
            .await;

        assert!(
            result.is_ok(),
            "Demo sync should succeed without credentials"
        );
        let response = result.unwrap();
        assert_eq!(response.transactions.len(), 19);
    }

    #[tokio::test]
    async fn demo_sync_resets_merchant_name_to_original_before_normalizing() {
        let user_id = Uuid::new_v4();
        let connection_id = Uuid::new_v4();
        let account_id = Uuid::new_v4();

        let accounts = vec![demo_account(account_id, connection_id, user_id)];
        let txn = raw_transaction(
            account_id,
            user_id,
            "POS DEBIT STARBUCKS #12345 SEATTLE WA 06/03",
            "STALE NORMALIZED NAME",
        );
        let transactions = vec![txn];

        let mut harness = build_demo_sync_harness(user_id, connection_id, accounts, transactions);

        let params = SyncConnectionParams {
            provider: "simplefin",
            user_id: &harness.user_id,
            jwt_id: "jwt_demo",
        };

        harness
            .service
            .sync(
                params,
                harness.sync_service.as_ref(),
                &mut harness.connection,
                None,
            )
            .await
            .unwrap();

        let captured = harness.captured_transactions.lock().unwrap();
        assert_eq!(captured.len(), 1);
        let merchant = captured[0].merchant_name.as_deref().unwrap_or("");
        assert_ne!(
            merchant, "STALE NORMALIZED NAME",
            "merchant_name must be reset from original, not left as stale value"
        );
        assert_eq!(
            captured[0].original_merchant_name.as_deref(),
            Some("POS DEBIT STARBUCKS #12345 SEATTLE WA 06/03"),
            "original_merchant_name must be preserved"
        );
        assert_eq!(
            captured[0].normalized_merchant.as_deref(),
            captured[0]
                .merchant_name
                .as_deref()
                .map(normalize_merchant_for_match)
                .as_deref()
        );
    }

    #[tokio::test]
    async fn demo_sync_only_processes_accounts_for_this_connection() {
        let user_id = Uuid::new_v4();
        let demo_connection_id = Uuid::new_v4();
        let other_connection_id = Uuid::new_v4();
        let demo_account_id = Uuid::new_v4();
        let other_account_id = Uuid::new_v4();

        let accounts = vec![
            demo_account(demo_account_id, demo_connection_id, user_id),
            demo_account(other_account_id, other_connection_id, user_id),
        ];
        let demo_txn = raw_transaction(demo_account_id, user_id, "DEMO TXN", "DEMO TXN");
        let other_txn = raw_transaction(other_account_id, user_id, "OTHER TXN", "OTHER TXN");
        let transactions = vec![demo_txn, other_txn];

        let mut harness =
            build_demo_sync_harness(user_id, demo_connection_id, accounts, transactions);

        let params = SyncConnectionParams {
            provider: "simplefin",
            user_id: &harness.user_id,
            jwt_id: "jwt_demo",
        };

        let result = harness
            .service
            .sync(
                params,
                harness.sync_service.as_ref(),
                &mut harness.connection,
                None,
            )
            .await
            .unwrap();

        assert_eq!(
            result.transactions.len(),
            1,
            "only demo account's transactions should be returned"
        );
    }
}
