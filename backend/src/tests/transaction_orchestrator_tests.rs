use std::sync::Arc;

use anyhow::anyhow;
use uuid::Uuid;

use crate::models::transaction::{CursorTransactionsResponse, TransactionFilter, TransactionPage};
use crate::services::repository_service::MockDatabaseRepository;
use crate::services::transaction_orchestrator::{
    TransactionOrchestrationError, TransactionOrchestrator,
};

fn orchestrator(repository: MockDatabaseRepository) -> TransactionOrchestrator {
    TransactionOrchestrator::new(Arc::new(repository))
}

fn empty_page() -> CursorTransactionsResponse {
    CursorTransactionsResponse {
        transactions: vec![],
        next_cursor: None,
        prev_cursor: None,
        has_more: false,
    }
}

#[tokio::test]
async fn given_no_limit_when_listing_then_uses_default_page_size() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_transactions_keyset()
        .withf(|_, limit, _, _, _, _, _, _, _| *limit == 40)
        .times(1)
        .returning(|_, _, _, _, _, _, _, _, _| Box::pin(async { Ok(empty_page()) }));

    let result = orchestrator(repository)
        .list(
            Uuid::new_v4(),
            TransactionFilter::default(),
            TransactionPage::default(),
        )
        .await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn given_oversized_limit_when_listing_then_clamps_to_maximum_page_size() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_transactions_keyset()
        .withf(|_, limit, _, _, _, _, _, _, _| *limit == 100)
        .times(1)
        .returning(|_, _, _, _, _, _, _, _, _| Box::pin(async { Ok(empty_page()) }));

    let result = orchestrator(repository)
        .list(
            Uuid::new_v4(),
            TransactionFilter::default(),
            TransactionPage {
                cursor: None,
                limit: Some(500),
            },
        )
        .await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn given_blank_filters_when_listing_then_passes_none_to_repository() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_transactions_keyset()
        .withf(|_, _, cursor, search, _, _, _, category, merchant| {
            cursor.is_none() && search.is_none() && category.is_none() && merchant.is_none()
        })
        .times(1)
        .returning(|_, _, _, _, _, _, _, _, _| Box::pin(async { Ok(empty_page()) }));

    let filter = TransactionFilter {
        search: Some("   ".to_string()),
        merchant: Some(String::new()),
        category_primary: Some("\t".to_string()),
        ..TransactionFilter::default()
    };

    let result = orchestrator(repository)
        .list(Uuid::new_v4(), filter, TransactionPage::default())
        .await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn given_repository_failure_when_listing_then_reports_list_failed() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_transactions_keyset()
        .returning(|_, _, _, _, _, _, _, _, _| Box::pin(async { Err(anyhow!("database down")) }));

    let result = orchestrator(repository)
        .list(
            Uuid::new_v4(),
            TransactionFilter::default(),
            TransactionPage::default(),
        )
        .await;

    assert!(matches!(
        result,
        Err(TransactionOrchestrationError::ListTransactions)
    ));
}

#[tokio::test]
async fn given_repository_failure_when_loading_insights_then_reports_insights_failed() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_transactions_insights()
        .returning(|_, _, _, _, _, _| Box::pin(async { Err(anyhow!("database down")) }));

    let result = orchestrator(repository)
        .insights(Uuid::new_v4(), TransactionFilter::default())
        .await;

    assert_eq!(result, Err(TransactionOrchestrationError::LoadInsights));
}

#[tokio::test]
async fn given_repository_failure_when_loading_contextual_insights_then_reports_contextual_insights_failed(
) {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_transactions_contextual_insights()
        .returning(|_, _, _, _, _, _| Box::pin(async { Err(anyhow!("database down")) }));

    let result = orchestrator(repository)
        .contextual_insights(Uuid::new_v4(), TransactionFilter::default())
        .await;

    assert_eq!(
        result,
        Err(TransactionOrchestrationError::LoadContextualInsights)
    );
}
