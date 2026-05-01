use crate::models::{budget::Budget, plaid::ProviderConnection};
use crate::services::authorization_service::AuthorizationService;
use crate::services::repository_service::MockDatabaseRepository;
use rust_decimal_macros::dec;
use uuid::Uuid;

#[tokio::test]
async fn given_owned_budget_when_authorize_then_returns_budget() {
    let mut repository = MockDatabaseRepository::new();
    let service = AuthorizationService::new();
    let user_id = Uuid::new_v4();
    let budget_id = Uuid::new_v4();
    let budget =
        Budget::new(user_id, "Groceries".to_string(), dec!(250.00)).into_with_id(budget_id);

    repository
        .expect_get_budget_by_id_for_user()
        .withf(move |id, uid| *id == budget_id && *uid == user_id)
        .returning(move |_, _| {
            let budget = budget.clone();
            Box::pin(async move { Ok(Some(budget)) })
        });

    let result = service
        .require_budget_owned(&budget_id, &user_id, &repository)
        .await;

    assert!(result.is_ok());
    assert_eq!(result.unwrap().id, budget_id);
}

#[tokio::test]
async fn given_foreign_budget_when_authorize_then_returns_not_found() {
    let mut repository = MockDatabaseRepository::new();
    let service = AuthorizationService::new();
    let user_id = Uuid::new_v4();
    let budget_id = Uuid::new_v4();

    repository
        .expect_get_budget_by_id_for_user()
        .withf(move |id, uid| *id == budget_id && *uid == user_id)
        .returning(|_, _| Box::pin(async { Ok(None) }));

    let result = service
        .require_budget_owned(&budget_id, &user_id, &repository)
        .await;

    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), axum::http::StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn given_owned_connection_when_authorize_then_returns_connection() {
    let mut repository = MockDatabaseRepository::new();
    let service = AuthorizationService::new();
    let user_id = Uuid::new_v4();
    let connection_id = Uuid::new_v4();
    let mut connection = ProviderConnection::new(user_id, "item_123");
    connection.id = connection_id;
    connection.mark_connected("Chase");

    repository
        .expect_get_provider_connection_by_id()
        .withf(move |id, uid| *id == connection_id && *uid == user_id)
        .returning(move |_, _| {
            let connection = connection.clone();
            Box::pin(async move { Ok(Some(connection)) })
        });

    let result = service
        .require_provider_connection_owned(&connection_id, &user_id, &repository)
        .await;

    assert!(result.is_ok());
    assert_eq!(result.unwrap().id, connection_id);
}

#[tokio::test]
async fn given_foreign_connection_when_authorize_then_returns_not_found() {
    let mut repository = MockDatabaseRepository::new();
    let service = AuthorizationService::new();
    let user_id = Uuid::new_v4();
    let connection_id = Uuid::new_v4();

    repository
        .expect_get_provider_connection_by_id()
        .withf(move |id, uid| *id == connection_id && *uid == user_id)
        .returning(|_, _| Box::pin(async { Ok(None) }));

    let result = service
        .require_provider_connection_owned(&connection_id, &user_id, &repository)
        .await;

    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), axum::http::StatusCode::NOT_FOUND);
}

trait BudgetTestExt {
    fn into_with_id(self, id: Uuid) -> Budget;
}

impl BudgetTestExt for Budget {
    fn into_with_id(mut self, id: Uuid) -> Budget {
        self.id = id;
        self
    }
}
