use std::sync::Arc;

use uuid::Uuid;

use crate::models::transaction::{
    ContextualInsightsResponse, CursorTransactionsResponse, TransactionFilter, TransactionPage,
    TransactionsInsightsResponse,
};
use crate::services::repository_service::DatabaseRepository;

const DEFAULT_PAGE_LIMIT: i64 = 40;
const MIN_PAGE_LIMIT: i64 = 1;
const MAX_PAGE_LIMIT: i64 = 100;

#[derive(Debug, Clone, PartialEq)]
pub enum TransactionOrchestrationError {
    ListTransactions,
    LoadInsights,
    LoadContextualInsights,
}

pub struct TransactionOrchestrator {
    repository: Arc<dyn DatabaseRepository>,
}

impl TransactionOrchestrator {
    pub fn new(repository: Arc<dyn DatabaseRepository>) -> Self {
        Self { repository }
    }

    pub async fn list(
        &self,
        user_id: Uuid,
        filter: TransactionFilter,
        page: TransactionPage,
    ) -> Result<CursorTransactionsResponse, TransactionOrchestrationError> {
        let limit = page
            .limit
            .unwrap_or(DEFAULT_PAGE_LIMIT)
            .clamp(MIN_PAGE_LIMIT, MAX_PAGE_LIMIT);
        let search = trimmed(filter.search.as_deref());
        let category_primary = trimmed(filter.category_primary.as_deref());
        let merchant = trimmed(filter.merchant.as_deref());
        let account_ids = filter.account_ids.as_deref();

        tracing::info!(
            search = ?search,
            limit,
            has_cursor = page.cursor.is_some(),
            "Transactions keyset query params"
        );

        let result = self
            .repository
            .get_transactions_keyset(
                &user_id,
                limit,
                page.cursor.as_deref(),
                search,
                account_ids,
                filter.start_date,
                filter.end_date,
                category_primary,
                merchant,
            )
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch transactions for user {}: {}", user_id, e);
                TransactionOrchestrationError::ListTransactions
            })?;

        tracing::info!(
            record_count = result.transactions.len(),
            has_more = result.has_more,
            "Data access: transactions"
        );

        Ok(result)
    }

    pub async fn insights(
        &self,
        user_id: Uuid,
        filter: TransactionFilter,
    ) -> Result<TransactionsInsightsResponse, TransactionOrchestrationError> {
        self.repository
            .get_transactions_insights(
                &user_id,
                trimmed(filter.search.as_deref()),
                filter.account_ids.as_deref(),
                filter.start_date,
                filter.end_date,
                trimmed(filter.category_primary.as_deref()),
            )
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to load transaction insights for user {}: {}",
                    user_id,
                    e
                );
                TransactionOrchestrationError::LoadInsights
            })
    }

    pub async fn contextual_insights(
        &self,
        user_id: Uuid,
        filter: TransactionFilter,
    ) -> Result<ContextualInsightsResponse, TransactionOrchestrationError> {
        self.repository
            .get_transactions_contextual_insights(
                &user_id,
                trimmed(filter.search.as_deref()),
                filter.account_ids.as_deref(),
                filter.start_date,
                filter.end_date,
                trimmed(filter.category_primary.as_deref()),
            )
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to load contextual insights for user {}: {}",
                    user_id,
                    e
                );
                TransactionOrchestrationError::LoadContextualInsights
            })
    }
}

fn trimmed(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}
