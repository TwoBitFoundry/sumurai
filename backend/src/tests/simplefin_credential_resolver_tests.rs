use std::sync::Arc;

use crate::providers::simplefin_credential_resolver::SimpleFinCredentialResolver;
use crate::providers::FinancialDataProvider;
use crate::providers::{
    credential_resolver::ProviderCredentialResolver,
    simplefin_provider::{MockSimpleFinHttpClient, SimpleFinProvider},
};
use crate::services::repository_service::MockDatabaseRepository;
use crate::test_fixtures::build_credential_resolvers;
use uuid::Uuid;

const ACCESS_URL: &str = "https://user:pass@beta-bridge.simplefin.org/simplefin";

#[tokio::test]
async fn given_stored_root_credential_when_resolve_for_sync_then_returns_access_url() {
    let user_id = Uuid::new_v4();
    let stored_user_id = user_id;

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_simplefin_root_credential()
        .with(mockall::predicate::eq(user_id))
        .times(1)
        .returning(move |_| {
            let user_id = stored_user_id;
            Box::pin(async move {
                assert_eq!(user_id, stored_user_id);
                Ok(Some(ACCESS_URL.to_string()))
            })
        });

    let resolver = SimpleFinCredentialResolver::new(Arc::new(mock_db), None);
    let credentials = resolver.resolve_for_sync(&user_id).await.unwrap();

    assert_eq!(credentials.provider, "simplefin");
    assert_eq!(credentials.access_token, ACCESS_URL);
    assert_eq!(credentials.item_id, format!("simplefin_root_{user_id}"));
}

#[tokio::test]
async fn given_no_stored_root_when_resolve_for_connect_then_claims_and_stores() {
    let user_id = Uuid::new_v4();
    let stored_user_id = user_id;
    let setup_token = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        "https://beta-bridge.simplefin.org/simplefin/claim/test",
    );

    let mut mock_client = MockSimpleFinHttpClient::new();
    mock_client
        .expect_claim()
        .times(1)
        .returning(|_| Ok(ACCESS_URL.to_string()));

    let provider: Arc<dyn FinancialDataProvider> =
        Arc::new(SimpleFinProvider::new(Arc::new(mock_client)));

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_simplefin_root_credential()
        .times(1)
        .returning(|_| Box::pin(async { Ok(None) }));
    mock_db
        .expect_store_simplefin_root_credential()
        .with(
            mockall::predicate::eq(user_id),
            mockall::predicate::eq(ACCESS_URL.to_string()),
        )
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let resolver = SimpleFinCredentialResolver::new(Arc::new(mock_db), Some(setup_token));
    let credentials = resolver
        .resolve_for_connect(&user_id, provider)
        .await
        .unwrap();

    assert_eq!(credentials.access_token, ACCESS_URL);
    assert_eq!(
        credentials.item_id,
        format!("simplefin_root_{stored_user_id}")
    );
}

#[tokio::test]
async fn given_resolver_map_when_resolve_for_sync_then_uses_simplefin_resolver() {
    let user_id = Uuid::new_v4();

    let mut mock_db = MockDatabaseRepository::new();
    mock_db
        .expect_get_simplefin_root_credential()
        .returning(|_| Box::pin(async { Ok(Some(ACCESS_URL.to_string())) }));

    let resolvers = build_credential_resolvers(Arc::new(mock_db), None);
    let resolver = resolvers
        .get("simplefin")
        .expect("simplefin resolver should be registered");

    let credentials = resolver.resolve_for_sync(&user_id).await.unwrap();
    assert_eq!(credentials.access_token, ACCESS_URL);
}
