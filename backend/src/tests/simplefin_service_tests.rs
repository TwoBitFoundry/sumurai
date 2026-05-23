use crate::models::account::Account;
use crate::models::plaid::{ProviderConnectRequest, ProviderConnectResponse, ProviderConnection};
use crate::models::simplefin::SimpleFinTransaction;
use crate::models::simplefin::{SimpleFinAccount, SimpleFinAccountsResponse, SimpleFinConnection};
use crate::models::transaction::Transaction;
use crate::providers::simplefin_provider::{MockSimpleFinHttpClient, SimpleFinProvider};
use crate::providers::{FinancialDataProvider, ProviderRegistry};
use crate::providers::{
    PlaidCredentialResolver, SimpleFinCredentialResolver, TellerCredentialResolver,
};
use crate::services::cache_service::MockCacheService;
use crate::services::connection_service::{
    ConnectionService, ProviderSyncError, SimpleFinConnectError, SyncConnectionParams,
};
use crate::services::repository_service::MockDatabaseRepository;
use crate::services::sync_service::SyncService;
use crate::test_fixtures::{noop_categorizer, TestFixtures};
use axum::body::to_bytes;
use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use tower::ServiceExt;
use uuid::Uuid;

const ACCESS_URL: &str = "https://demo:pass@beta-bridge.simplefin.org/simplefin";
const SETUP_TOKEN: &str = "dGVzdC1zaW1wbGVmaW4tc2V0dXAtdG9rZW4=";

fn simplefin_org_item_id(user_id: &Uuid, org_conn_id: &str) -> String {
    format!("simplefin_{user_id}_{org_conn_id}")
}

type SimpleFinSyncHarness = (
    ConnectionService,
    Arc<SyncService>,
    Arc<dyn FinancialDataProvider>,
    Arc<Mutex<usize>>,
    Arc<Mutex<usize>>,
);

fn three_org_snapshot() -> SimpleFinAccountsResponse {
    SimpleFinAccountsResponse {
        errors: vec![],
        connections: vec![
            SimpleFinConnection {
                conn_id: "org-1".to_string(),
                name: "Bank A".to_string(),
                org_id: "inst-1".to_string(),
                org_url: None,
                sfin_url: None,
            },
            SimpleFinConnection {
                conn_id: "org-2".to_string(),
                name: "Bank B".to_string(),
                org_id: "inst-2".to_string(),
                org_url: None,
                sfin_url: None,
            },
            SimpleFinConnection {
                conn_id: "org-3".to_string(),
                name: "Bank C".to_string(),
                org_id: "inst-3".to_string(),
                org_url: None,
                sfin_url: None,
            },
        ],
        accounts: vec![
            SimpleFinAccount {
                id: "acct-1".to_string(),
                name: "Checking A".to_string(),
                conn_id: Some("org-1".to_string()),
                org: None,
                currency: Some("USD".to_string()),
                balance: Some("100.00".to_string()),
                available_balance: None,
                balance_date: None,
                holdings: vec![],
                transactions: vec![],
            },
            SimpleFinAccount {
                id: "acct-2".to_string(),
                name: "Checking B".to_string(),
                conn_id: Some("org-2".to_string()),
                org: None,
                currency: Some("USD".to_string()),
                balance: Some("200.00".to_string()),
                available_balance: None,
                balance_date: None,
                holdings: vec![],
                transactions: vec![],
            },
            SimpleFinAccount {
                id: "acct-3".to_string(),
                name: "Checking C".to_string(),
                conn_id: Some("org-3".to_string()),
                org: None,
                currency: Some("USD".to_string()),
                balance: Some("300.00".to_string()),
                available_balance: None,
                balance_date: None,
                holdings: vec![],
                transactions: vec![],
            },
        ],
    }
}

fn simplefin_connect_request() -> ProviderConnectRequest {
    ProviderConnectRequest {
        provider: "simplefin".to_string(),
        access_token: SETUP_TOKEN.to_string(),
        enrollment_id: String::new(),
        institution_name: None,
    }
}

fn build_credential_resolvers(
    db_repository: Arc<dyn crate::services::repository_service::DatabaseRepository>,
    setup_token: Option<String>,
) -> std::collections::HashMap<String, Arc<dyn crate::providers::ProviderCredentialResolver>> {
    let mut resolvers = std::collections::HashMap::new();
    resolvers.insert(
        "simplefin".to_string(),
        Arc::new(SimpleFinCredentialResolver::new(
            Arc::clone(&db_repository),
            setup_token,
        )) as Arc<dyn crate::providers::ProviderCredentialResolver>,
    );
    resolvers.insert(
        "plaid".to_string(),
        Arc::new(PlaidCredentialResolver::new(Arc::clone(&db_repository)))
            as Arc<dyn crate::providers::ProviderCredentialResolver>,
    );
    resolvers.insert(
        "teller".to_string(),
        Arc::new(TellerCredentialResolver::new(Arc::clone(&db_repository)))
            as Arc<dyn crate::providers::ProviderCredentialResolver>,
    );
    resolvers
}

type SimpleFinConnectHarness = (
    ConnectionService,
    Arc<Mutex<HashSet<String>>>,
    Arc<Mutex<HashSet<String>>>,
);

fn build_simplefin_connection_service(
    snapshot: SimpleFinAccountsResponse,
    hidden_orgs: HashSet<String>,
    simplefin_setup_token: Option<String>,
    simplefin_access_url: Option<String>,
) -> SimpleFinConnectHarness {
    let snapshot_for_accounts = snapshot;

    let mut mock_client = MockSimpleFinHttpClient::new();
    if simplefin_access_url.is_none() && simplefin_setup_token.is_some() {
        mock_client
            .expect_claim()
            .returning(|_| Ok(ACCESS_URL.to_string()));
    }
    mock_client
        .expect_get_accounts()
        .returning(move |_, _| Ok(snapshot_for_accounts.clone()));

    let simplefin_provider: Arc<dyn FinancialDataProvider> =
        Arc::new(SimpleFinProvider::new(Arc::new(mock_client)));
    let provider_registry = Arc::new(ProviderRegistry::from_providers([(
        "simplefin",
        simplefin_provider,
    )]));

    let saved_item_ids = Arc::new(Mutex::new(HashSet::new()));
    let upserted_account_ids = Arc::new(Mutex::new(HashSet::new()));

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_simplefin_root_credential()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_db
        .expect_store_simplefin_root_credential()
        .returning(|_, _| Box::pin(async { Ok(()) }));

    mock_db
        .expect_list_simplefin_hidden_orgs()
        .returning(move |_| {
            let hidden = hidden_orgs.clone();
            Box::pin(async move { Ok(hidden) })
        });

    let saved_item_ids_clone = Arc::clone(&saved_item_ids);
    mock_db
        .expect_save_provider_connection()
        .returning(move |connection| {
            saved_item_ids_clone
                .lock()
                .unwrap()
                .insert(connection.item_id.clone());
            Box::pin(async { Ok(()) })
        });

    let upserted_account_ids_clone = Arc::clone(&upserted_account_ids);
    mock_db.expect_upsert_account().returning(move |account| {
        if let Some(provider_account_id) = account.provider_account_id.clone() {
            upserted_account_ids_clone
                .lock()
                .unwrap()
                .insert(provider_account_id);
        }
        Box::pin(async { Ok(()) })
    });

    let mut mock_cache = MockCacheService::new();
    mock_cache
        .expect_invalidate_pattern()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_clear_transactions()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_clear_budgets()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_cache_jwt_scoped_bank_connection()
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_cache_jwt_scoped_bank_accounts()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    let db_repository: Arc<dyn crate::services::repository_service::DatabaseRepository> =
        Arc::new(mock_db);
    let credential_resolvers =
        build_credential_resolvers(Arc::clone(&db_repository), simplefin_setup_token);

    let connection_service = ConnectionService::new(
        db_repository,
        Arc::new(mock_cache),
        provider_registry,
        noop_categorizer(),
        credential_resolvers,
    );

    (connection_service, saved_item_ids, upserted_account_ids)
}

#[tokio::test]
async fn given_three_org_snapshot_when_connect_simplefin_then_writes_three_connections_and_accounts(
) {
    let user_id = Uuid::new_v4();
    let jwt_id = "jwt_simplefin";
    let (connection_service, saved_item_ids, upserted_account_ids) =
        build_simplefin_connection_service(
            three_org_snapshot(),
            HashSet::new(),
            Some(SETUP_TOKEN.to_string()),
            None,
        );

    let response = connection_service
        .connect_simplefin_provider(&user_id, jwt_id, &simplefin_connect_request())
        .await
        .unwrap();

    assert_eq!(
        response.institution_name,
        "SimpleFIN (3 institutions)".to_string()
    );
    let saved = saved_item_ids.lock().unwrap().clone();
    assert_eq!(saved.len(), 3);
    assert!(saved.contains(&simplefin_org_item_id(&user_id, "org-1")));
    assert!(saved.contains(&simplefin_org_item_id(&user_id, "org-2")));
    assert!(saved.contains(&simplefin_org_item_id(&user_id, "org-3")));

    let accounts = upserted_account_ids.lock().unwrap().clone();
    assert_eq!(accounts.len(), 3);
    assert!(accounts.contains("acct-1"));
    assert!(accounts.contains("acct-2"));
    assert!(accounts.contains("acct-3"));
}

#[tokio::test]
async fn given_missing_setup_token_when_connect_simplefin_then_returns_not_configured() {
    let user_id = Uuid::new_v4();
    let jwt_id = "jwt_simplefin";
    let (connection_service, _, _) =
        build_simplefin_connection_service(three_org_snapshot(), HashSet::new(), None, None);

    let error = connection_service
        .connect_simplefin_provider(&user_id, jwt_id, &simplefin_connect_request())
        .await
        .unwrap_err();

    assert!(matches!(error, SimpleFinConnectError::CredentialStorage(_)));
}

#[tokio::test]
async fn given_reclaim_when_connect_simplefin_twice_then_does_not_duplicate_connection_rows() {
    let user_id = Uuid::new_v4();
    let jwt_id = "jwt_simplefin";
    let (connection_service, saved_item_ids, _) = build_simplefin_connection_service(
        three_org_snapshot(),
        HashSet::new(),
        Some(SETUP_TOKEN.to_string()),
        None,
    );

    connection_service
        .connect_simplefin_provider(&user_id, jwt_id, &simplefin_connect_request())
        .await
        .unwrap();
    connection_service
        .connect_simplefin_provider(&user_id, jwt_id, &simplefin_connect_request())
        .await
        .unwrap();

    let saved = saved_item_ids.lock().unwrap().clone();
    assert_eq!(saved.len(), 3);
}

#[tokio::test]
async fn given_blocklisted_org_when_connect_simplefin_then_skips_hidden_org_rows_and_accounts() {
    let user_id = Uuid::new_v4();
    let jwt_id = "jwt_simplefin";
    let mut hidden = HashSet::new();
    hidden.insert("org-2".to_string());

    let (connection_service, saved_item_ids, upserted_account_ids) =
        build_simplefin_connection_service(
            three_org_snapshot(),
            hidden,
            Some(SETUP_TOKEN.to_string()),
            None,
        );

    let response = connection_service
        .connect_simplefin_provider(&user_id, jwt_id, &simplefin_connect_request())
        .await
        .unwrap();

    assert_eq!(
        response.institution_name,
        "SimpleFIN (2 institutions)".to_string()
    );
    let saved = saved_item_ids.lock().unwrap().clone();
    assert_eq!(saved.len(), 2);
    assert!(!saved.contains(&simplefin_org_item_id(&user_id, "org-2")));

    let accounts = upserted_account_ids.lock().unwrap().clone();
    assert_eq!(accounts.len(), 2);
    assert!(!accounts.contains("acct-2"));
}

#[tokio::test]
async fn given_stored_root_credentials_when_load_simplefin_access_url_then_returns_credentials() {
    let user_id = Uuid::new_v4();
    let stored_access_url = ACCESS_URL.to_string();

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_simplefin_root_credential()
        .with(mockall::predicate::eq(user_id))
        .times(1)
        .returning(move |_| {
            let access_url = stored_access_url.clone();
            Box::pin(async move { Ok(Some(access_url)) })
        });

    let db_repository: Arc<dyn crate::services::repository_service::DatabaseRepository> =
        Arc::new(mock_db);
    let credential_resolvers = build_credential_resolvers(Arc::clone(&db_repository), None);

    let connection_service = ConnectionService::new(
        db_repository,
        Arc::new(MockCacheService::new()),
        Arc::new(ProviderRegistry::new()),
        noop_categorizer(),
        credential_resolvers,
    );

    let credentials = connection_service
        .load_simplefin_access_url(&user_id)
        .await
        .unwrap();

    assert_eq!(credentials.provider, "simplefin");
    assert_eq!(credentials.access_token, ACCESS_URL);
    assert_eq!(credentials.item_id, format!("simplefin_root_{user_id}"));
}

async fn build_simplefin_handler_app(
    snapshot: SimpleFinAccountsResponse,
) -> Result<axum::Router, anyhow::Error> {
    use crate::config::{Config, MockEnvironment};
    use crate::create_app;
    use crate::models::app_state::AppState;
    use crate::services::categorization::category_descriptors::SYSTEM_CATEGORY_SLUGS;
    use crate::services::category_management::service::CategoryManagementService;
    use crate::services::{
        analytics_service::AnalyticsService, auth_service::AuthService,
        authorization_service::AuthorizationService, budget_service::BudgetService,
        cache_service::CacheService, connection_service::ConnectionService,
        otel_traces_relay::OtlpTracesRelay, plaid_service::PlaidService,
        repository_service::DatabaseRepository, sync_service::SyncService,
        sync_service_factory::SyncServiceFactory, RealPlaidClient,
    };

    let snapshot_for_accounts = snapshot;
    let mut mock_client = MockSimpleFinHttpClient::new();
    mock_client
        .expect_claim()
        .returning(|_| Ok(ACCESS_URL.to_string()));
    mock_client
        .expect_get_accounts()
        .returning(move |_, _| Ok(snapshot_for_accounts.clone()));

    let simplefin_provider: Arc<dyn FinancialDataProvider> =
        Arc::new(SimpleFinProvider::new(Arc::new(mock_client)));
    let provider_registry = Arc::new(ProviderRegistry::from_providers([(
        "simplefin",
        simplefin_provider,
    )]));
    let sync_service = Arc::new(SyncService::new(provider_registry.clone(), "simplefin"));

    let plaid_client = Arc::new(RealPlaidClient::new(
        "test_client_id".to_string(),
        "test_secret".to_string(),
        "sandbox".to_string(),
    ));
    let plaid_service = Arc::new(PlaidService::new(plaid_client.clone()));

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_simplefin_root_credential()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_db
        .expect_get_provider_transaction_ids_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock_db
        .expect_count_transactions()
        .returning(|_, _, _, _, _, _| Box::pin(async { Ok(0) }));
    mock_db
        .expect_store_simplefin_root_credential()
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_db
        .expect_list_simplefin_hidden_orgs()
        .returning(|_| Box::pin(async { Ok(HashSet::new()) }));
    mock_db
        .expect_save_provider_connection()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_db
        .expect_upsert_account()
        .returning(|_| Box::pin(async { Ok(()) }));

    let mut mock_cache = MockCacheService::new();
    mock_cache
        .expect_is_session_valid()
        .returning(|_| Box::pin(async { Ok(true) }));
    mock_cache
        .expect_invalidate_pattern()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_clear_transactions()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_clear_budgets()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_cache_jwt_scoped_bank_connection()
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_cache_jwt_scoped_bank_accounts()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    let db_repository: Arc<dyn DatabaseRepository> = Arc::new(mock_db);
    let cache_service: Arc<dyn CacheService> = Arc::new(mock_cache);
    let credential_resolvers =
        build_credential_resolvers(db_repository.clone(), Some(SETUP_TOKEN.to_string()));
    let connection_service = Arc::new(ConnectionService::new(
        db_repository.clone(),
        cache_service.clone(),
        provider_registry.clone(),
        noop_categorizer(),
        credential_resolvers,
    ));
    let sync_service_factory = Arc::new(SyncServiceFactory::new(
        connection_service.clone(),
        sync_service.clone(),
    ));

    let auth_service = Arc::new(
        AuthService::new("test_jwt_secret_key_for_integration_testing".to_string()).unwrap(),
    );

    std::env::set_var("OTEL_TRACES_EXPORTER", "none");
    let mut test_env = MockEnvironment::new();
    test_env.set("TELLER_ENV", "test");
    test_env.set("DEFAULT_PROVIDER", "simplefin");
    test_env.set("AUTH_COOKIE_SAME_SITE", "Lax");
    let config = Config::from_env_provider(&test_env).expect("Failed to create test config");

    let state = AppState {
        plaid_service,
        plaid_client,
        sync_service,
        sync_service_factory,
        analytics_service: Arc::new(AnalyticsService::new()),
        budget_service: Arc::new(BudgetService::new()),
        authorization_service: Arc::new(AuthorizationService::new()),
        config,
        db_repository,
        cache_service,
        categorizer: crate::test_fixtures::noop_categorizer(),
        connection_service,
        auth_service,
        provider_registry,
        otlp_traces_relay: Arc::new(OtlpTracesRelay::bogus_for_tests()),
        category_management_service: Arc::new(CategoryManagementService::new(
            SYSTEM_CATEGORY_SLUGS,
        )),
    };

    Ok(create_app(state))
}

#[tokio::test]
async fn given_simplefin_connect_request_when_post_providers_connect_then_returns_ok() {
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();
    let app = build_simplefin_handler_app(three_org_snapshot())
        .await
        .expect("test app should build");

    let request = TestFixtures::create_authenticated_post_request(
        "/api/providers/connect",
        &token,
        simplefin_connect_request(),
    );
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), 200);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload: ProviderConnectResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload.institution_name, "SimpleFIN (3 institutions)");
}

#[tokio::test]
async fn given_unknown_provider_when_post_providers_connect_then_returns_bad_request() {
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();
    let app = TestFixtures::create_test_app()
        .await
        .expect("test app should build");

    let request = TestFixtures::create_authenticated_post_request(
        "/api/providers/connect",
        &token,
        ProviderConnectRequest {
            provider: "unknown".to_string(),
            access_token: "token".to_string(),
            enrollment_id: String::new(),
            institution_name: None,
        },
    );
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), 400);
}

#[test]
fn given_hidden_org_when_filter_simplefin_transactions_then_returns_empty() {
    let account_id = Uuid::new_v4();
    let accounts = vec![Account {
        id: account_id,
        user_id: None,
        provider_account_id: Some("acct-hidden".to_string()),
        provider_connection_id: None,
        name: "Hidden".to_string(),
        account_type: "depository".to_string(),
        balance_current: None,
        mask: None,
        institution_name: None,
        provider_conn_id: Some("org-hidden".to_string()),
    }];
    let transactions = vec![Transaction {
        id: Uuid::new_v4(),
        account_id,
        user_id: None,
        provider_account_id: Some("acct-hidden".to_string()),
        provider_transaction_id: Some("txn-1".to_string()),
        amount: rust_decimal::Decimal::new(100, 2),
        date: chrono::NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
        merchant_name: Some("Store".to_string()),
        category_primary: "OTHER".to_string(),
        category_detailed: "OTHER".to_string(),
        category_confidence: "LOW".to_string(),
        payment_channel: None,
        pending: false,
        created_at: None,
    }];
    let mut hidden = HashSet::new();
    hidden.insert("org-hidden".to_string());

    let filtered = SyncService::filter_simplefin_transactions_for_connection(
        transactions,
        &accounts,
        "org-hidden",
        &hidden,
    );

    assert!(filtered.is_empty());
}

fn build_simplefin_sync_service(
    snapshot: SimpleFinAccountsResponse,
    hidden_orgs: HashSet<String>,
    transactions: Vec<SimpleFinTransaction>,
) -> SimpleFinSyncHarness {
    let snapshot_for_accounts = snapshot.clone();
    let mut mock_client = MockSimpleFinHttpClient::new();
    mock_client
        .expect_claim()
        .returning(|_| Ok(ACCESS_URL.to_string()));
    mock_client
        .expect_get_accounts()
        .returning(move |_, params| {
            if params.balances_only {
                Ok(snapshot_for_accounts.clone())
            } else {
                Ok(SimpleFinAccountsResponse {
                    errors: vec![],
                    connections: snapshot_for_accounts.connections.clone(),
                    accounts: snapshot_for_accounts
                        .accounts
                        .iter()
                        .map(|account| {
                            let mut cloned = account.clone();
                            cloned.transactions = transactions.clone();
                            cloned
                        })
                        .collect(),
                })
            }
        });

    let simplefin_provider: Arc<dyn FinancialDataProvider> =
        Arc::new(SimpleFinProvider::new(Arc::new(mock_client)));
    let provider_registry = Arc::new(ProviderRegistry::from_providers([(
        "simplefin",
        Arc::clone(&simplefin_provider),
    )]));
    let sync_service = Arc::new(SyncService::new(provider_registry.clone(), "simplefin"));

    let upsert_accounts = Arc::new(Mutex::new(0usize));
    let upsert_transactions = Arc::new(Mutex::new(0usize));

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_simplefin_root_credential()
        .returning(|_| Box::pin(async { Ok(Some(ACCESS_URL.to_string())) }));
    mock_db
        .expect_list_simplefin_hidden_orgs()
        .returning(move |_| {
            let hidden = hidden_orgs.clone();
            Box::pin(async move { Ok(hidden) })
        });
    mock_db
        .expect_save_provider_connection()
        .returning(|_| Box::pin(async { Ok(()) }));
    let upsert_accounts_clone = Arc::clone(&upsert_accounts);
    mock_db.expect_upsert_account().returning(move |_| {
        *upsert_accounts_clone.lock().unwrap() += 1;
        Box::pin(async { Ok(()) })
    });
    mock_db
        .expect_get_accounts_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    mock_db
        .expect_get_provider_transaction_ids_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));
    let upsert_transactions_clone = Arc::clone(&upsert_transactions);
    mock_db
        .expect_upsert_transactions_batch()
        .returning(move |batch, _| {
            *upsert_transactions_clone.lock().unwrap() += batch.len();
            Box::pin(async { Ok(()) })
        });
    mock_db
        .expect_count_transactions()
        .returning(|_, _, _, _, _, _| Box::pin(async { Ok(0) }));

    let mut mock_cache = MockCacheService::new();
    mock_cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_cache
        .expect_set_with_ttl()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_invalidate_pattern()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_clear_transactions()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_clear_budgets()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_cache_jwt_scoped_bank_connection()
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_cache_jwt_scoped_bank_accounts()
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    let db_repository: Arc<dyn crate::services::repository_service::DatabaseRepository> =
        Arc::new(mock_db);
    let credential_resolvers = build_credential_resolvers(Arc::clone(&db_repository), None);

    let connection_service = ConnectionService::new(
        db_repository,
        Arc::new(mock_cache),
        provider_registry,
        noop_categorizer(),
        credential_resolvers,
    );

    (
        connection_service,
        sync_service,
        simplefin_provider,
        upsert_accounts,
        upsert_transactions,
    )
}

#[tokio::test]
async fn given_blocklisted_connection_when_sync_simplefin_then_writes_no_accounts_or_transactions()
{
    let user_id = Uuid::new_v4();
    let mut connection =
        ProviderConnection::new(user_id, &simplefin_org_item_id(&user_id, "org-2"));
    connection.mark_connected("Bank B");
    let mut hidden = HashSet::new();
    hidden.insert("org-2".to_string());

    let (connection_service, sync_service, _, upsert_accounts, upsert_transactions) =
        build_simplefin_sync_service(three_org_snapshot(), hidden, vec![]);

    let result = connection_service
        .sync_provider_connection(
            SyncConnectionParams {
                provider: "simplefin",
                user_id: &user_id,
                jwt_id: "jwt_sync",
            },
            sync_service.as_ref(),
            &mut connection,
            None,
        )
        .await
        .unwrap();

    assert!(result.transactions.is_empty());
    assert_eq!(*upsert_accounts.lock().unwrap(), 0);
    assert_eq!(*upsert_transactions.lock().unwrap(), 0);
}

#[tokio::test]
async fn given_sync_floor_when_second_simplefin_sync_within_hour_then_rate_limited() {
    let user_id = Uuid::new_v4();
    let mut connection =
        ProviderConnection::new(user_id, &simplefin_org_item_id(&user_id, "org-1"));
    connection.mark_connected("Bank A");

    let floor_key = format!("simplefin:sync-floor:{user_id}");
    let (connection_service, sync_service, _, _, _) =
        build_simplefin_sync_service(three_org_snapshot(), HashSet::new(), vec![]);

    connection_service
        .sync_provider_connection(
            SyncConnectionParams {
                provider: "simplefin",
                user_id: &user_id,
                jwt_id: "jwt_sync",
            },
            sync_service.as_ref(),
            &mut connection,
            None,
        )
        .await
        .unwrap();

    let mut mock_cache = MockCacheService::new();
    mock_cache
        .expect_get_string()
        .with(mockall::predicate::eq(floor_key.clone()))
        .times(1)
        .returning(|_| Box::pin(async { Ok(Some("1".to_string())) }));

    let db_repository: Arc<dyn crate::services::repository_service::DatabaseRepository> =
        Arc::new(MockDatabaseRepository::new());
    let credential_resolvers = build_credential_resolvers(db_repository.clone(), None);
    let limited_service = ConnectionService::new(
        db_repository,
        Arc::new(mock_cache),
        Arc::new(ProviderRegistry::new()),
        noop_categorizer(),
        credential_resolvers,
    );

    let result = limited_service
        .sync_provider_connection(
            SyncConnectionParams {
                provider: "simplefin",
                user_id: &user_id,
                jwt_id: "jwt_sync",
            },
            sync_service.as_ref(),
            &mut connection,
            None,
        )
        .await;

    assert!(matches!(result, Err(ProviderSyncError::RateLimited)));
}

fn build_disconnect_service(mock_db: MockDatabaseRepository) -> ConnectionService {
    let mut mock_cache = MockCacheService::new();
    mock_cache
        .expect_clear_jwt_scoped_bank_connection_cache()
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_delete_access_token()
        .returning(|_, _| Box::pin(async { Ok(()) }));
    mock_cache
        .expect_invalidate_pattern()
        .returning(|_| Box::pin(async { Ok(()) }));

    let db_repository: Arc<dyn crate::services::repository_service::DatabaseRepository> =
        Arc::new(mock_db);
    let credential_resolvers = build_credential_resolvers(db_repository.clone(), None);

    ConnectionService::new(
        db_repository,
        Arc::new(mock_cache),
        Arc::new(ProviderRegistry::new()),
        noop_categorizer(),
        credential_resolvers,
    )
}

#[tokio::test]
async fn given_simplefin_org_connection_when_disconnect_then_blocklists_org_and_skips_credentials_delete(
) {
    let user_id = Uuid::new_v4();
    let connection = {
        let mut row = ProviderConnection::new(user_id, &simplefin_org_item_id(&user_id, "org-2"));
        row.mark_connected("Bank B");
        row
    };

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_disconnect_simplefin_org()
        .withf(move |uid, item, org, name| {
            *uid == user_id
                && *item == simplefin_org_item_id(&user_id, "org-2")
                && org == "org-2"
                && name.as_deref() == Some("Bank B")
        })
        .times(1)
        .returning(|_, _, _, _| Box::pin(async { Ok((2, 1)) }));
    mock_db.expect_delete_provider_credentials().times(0);
    mock_db.expect_delete_provider_connection().times(0);
    mock_db.expect_delete_provider_transactions().times(0);
    mock_db.expect_delete_provider_accounts().times(0);
    mock_db.expect_insert_simplefin_hidden_org().times(0);

    let service = build_disconnect_service(mock_db);
    let result = service
        .disconnect_owned_connection(&connection, &user_id, "jwt_disconnect")
        .await
        .unwrap();

    assert!(result.success);
    assert_eq!(result.data_cleared.transactions, 2);
    assert_eq!(result.data_cleared.accounts, 1);
}

#[tokio::test]
async fn given_simplefin_disconnect_failure_when_atomic_disconnect_fails_then_returns_error() {
    let user_id = Uuid::new_v4();
    let connection = ProviderConnection::new(user_id, &simplefin_org_item_id(&user_id, "org-1"));

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_disconnect_simplefin_org()
        .returning(|_, _, _, _| Box::pin(async { Err(anyhow::anyhow!("cascade delete failed")) }));
    mock_db.expect_insert_simplefin_hidden_org().times(0);

    let service = build_disconnect_service(mock_db);
    let result = service
        .disconnect_owned_connection(&connection, &user_id, "jwt_disconnect")
        .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn given_teller_connection_when_disconnect_then_does_not_call_simplefin_disconnect() {
    let user_id = Uuid::new_v4();
    let connection = ProviderConnection::new(user_id, "teller_enrollment-1");

    let mut mock_db = MockDatabaseRepository::new();
    mock_db.expect_disconnect_simplefin_org().times(0);
    mock_db.expect_insert_simplefin_hidden_org().times(0);
    mock_db
        .expect_delete_provider_transactions()
        .returning(|_| Box::pin(async { Ok(0) }));
    mock_db
        .expect_delete_provider_accounts()
        .returning(|_| Box::pin(async { Ok(0) }));
    mock_db
        .expect_delete_provider_credentials()
        .returning(|_| Box::pin(async { Ok(()) }));
    mock_db
        .expect_delete_provider_connection()
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let service = build_disconnect_service(mock_db);
    let result = service
        .disconnect_owned_connection(&connection, &user_id, "jwt_disconnect")
        .await
        .unwrap();

    assert!(result.success);
}

#[tokio::test]
async fn given_disconnected_org_when_sync_simplefin_then_writes_no_accounts_or_transactions() {
    let user_id = Uuid::new_v4();
    let mut connection =
        ProviderConnection::new(user_id, &simplefin_org_item_id(&user_id, "org-2"));
    connection.mark_connected("Bank B");
    let mut hidden = HashSet::new();
    hidden.insert("org-2".to_string());

    let (connection_service, sync_service, _, upsert_accounts, upsert_transactions) =
        build_simplefin_sync_service(three_org_snapshot(), hidden, vec![]);

    let result = connection_service
        .sync_provider_connection(
            SyncConnectionParams {
                provider: "simplefin",
                user_id: &user_id,
                jwt_id: "jwt_sync",
            },
            sync_service.as_ref(),
            &mut connection,
            None,
        )
        .await
        .unwrap();

    assert!(result.transactions.is_empty());
    assert_eq!(*upsert_accounts.lock().unwrap(), 0);
    assert_eq!(*upsert_transactions.lock().unwrap(), 0);
}
