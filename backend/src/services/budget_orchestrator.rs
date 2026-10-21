use std::sync::Arc;

use rust_decimal::Decimal;
use uuid::Uuid;

use crate::models::budget::{Budget, BudgetsOverviewResponse};
use crate::models::domain_error::DomainError;
use crate::services::repository_service::DatabaseRepository;
use crate::services::{BudgetService, CacheService};

pub struct BudgetOrchestrator {
    budget_service: Arc<BudgetService>,
    repository: Arc<dyn DatabaseRepository>,
    cache: Arc<dyn CacheService>,
}

impl BudgetOrchestrator {
    pub fn new(
        budget_service: Arc<BudgetService>,
        repository: Arc<dyn DatabaseRepository>,
        cache: Arc<dyn CacheService>,
    ) -> Self {
        Self {
            budget_service,
            repository,
            cache,
        }
    }

    pub async fn list(&self, user_id: Uuid, jwt_id: &str) -> Result<Vec<Budget>, DomainError> {
        if let Some(cached) = self.cached_budgets(jwt_id).await {
            return Ok(cached);
        }

        let budgets = self
            .budget_service
            .get_budgets_for_user(&*self.repository, user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get budgets for user {}: {}", user_id, e);
                DomainError::internal("Failed to fetch budgets")
            })?;

        self.store_budgets(jwt_id, &budgets).await;
        Ok(budgets)
    }

    pub async fn overview(
        &self,
        user_id: Uuid,
        jwt_id: &str,
    ) -> Result<BudgetsOverviewResponse, DomainError> {
        if let Some(budgets) = self.cached_budgets(jwt_id).await {
            let fixed_expenses = self
                .repository
                .get_fixed_expense_summary(&user_id)
                .await
                .map_err(|e| Self::fixed_expenses_failure(user_id, e))?;
            return Ok(BudgetsOverviewResponse {
                budgets,
                fixed_expenses,
            });
        }

        let (budgets_result, fixed_expenses_result) = tokio::join!(
            self.budget_service
                .get_budgets_for_user(&*self.repository, user_id),
            self.repository.get_fixed_expense_summary(&user_id),
        );

        let budgets = budgets_result.map_err(|e| {
            tracing::error!("Failed to get budgets for user {}: {}", user_id, e);
            DomainError::internal("Failed to fetch budgets")
        })?;
        let fixed_expenses =
            fixed_expenses_result.map_err(|e| Self::fixed_expenses_failure(user_id, e))?;

        self.store_budgets(jwt_id, &budgets).await;

        Ok(BudgetsOverviewResponse {
            budgets,
            fixed_expenses,
        })
    }

    pub async fn create(
        &self,
        user_id: Uuid,
        jwt_id: &str,
        category: String,
        amount: Decimal,
    ) -> Result<Budget, DomainError> {
        let created = self
            .budget_service
            .create_budget_for_user(&*self.repository, user_id, category, amount)
            .await
            .map_err(|e| {
                tracing::error!("Failed to create budget for user {}: {}", user_id, e);
                if e.contains("greater than zero") {
                    DomainError::bad_request("Budget amount must be greater than zero")
                } else if e.contains("income or transfer") {
                    DomainError::bad_request(
                        "Budgets cannot be created for income or transfer categories",
                    )
                } else if e.contains("already exists") {
                    DomainError::conflict("Budget category already exists")
                } else {
                    DomainError::internal("Failed to create budget")
                }
            })?;

        self.refresh_cache(user_id, jwt_id).await;
        Ok(created)
    }

    pub async fn update(
        &self,
        user_id: Uuid,
        jwt_id: &str,
        budget_id: Uuid,
        amount: Decimal,
    ) -> Result<Budget, DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::bad_request(
                "Budget amount must be greater than zero",
            ));
        }

        let updated = self
            .budget_service
            .update_budget_for_user(&*self.repository, budget_id, user_id, amount)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to update budget {} for user {}: {}",
                    budget_id,
                    user_id,
                    e
                );
                if e.contains("greater than zero") {
                    DomainError::bad_request("Budget amount must be greater than zero")
                } else if e.contains("not found") || e.contains("access denied") {
                    DomainError::not_found("Budget not found")
                } else {
                    DomainError::internal("Failed to update budget")
                }
            })?;

        self.refresh_cache(user_id, jwt_id).await;
        Ok(updated)
    }

    pub async fn delete(
        &self,
        user_id: Uuid,
        jwt_id: &str,
        budget_id: Uuid,
    ) -> Result<(), DomainError> {
        self.budget_service
            .delete_budget_for_user(&*self.repository, budget_id, user_id)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to delete budget {} for user {}: {}",
                    budget_id,
                    user_id,
                    e
                );
                if e.contains("not found") || e.contains("access denied") {
                    DomainError::not_found("Budget not found")
                } else {
                    DomainError::internal("Failed to delete budget")
                }
            })?;

        self.refresh_cache(user_id, jwt_id).await;
        Ok(())
    }

    fn fixed_expenses_failure(user_id: Uuid, error: anyhow::Error) -> DomainError {
        tracing::error!(
            "Failed to get fixed expense summary for user {}: {}",
            user_id,
            error
        );
        DomainError::internal("Failed to fetch fixed expenses")
    }

    async fn cached_budgets(&self, jwt_id: &str) -> Option<Vec<Budget>> {
        let serialized = self.cache.get_budgets(jwt_id).await.ok().flatten()?;
        serde_json::from_str::<Vec<Budget>>(&serialized).ok()
    }

    async fn store_budgets(&self, jwt_id: &str, budgets: &[Budget]) {
        if let Ok(serialized) = serde_json::to_string(budgets) {
            let _ = self.cache.set_budgets(jwt_id, &serialized).await;
        }
    }

    async fn refresh_cache(&self, user_id: Uuid, jwt_id: &str) {
        match self
            .budget_service
            .get_budgets_for_user(&*self.repository, user_id)
            .await
        {
            Ok(budgets) => match serde_json::to_string(&budgets) {
                Ok(serialized) => {
                    if let Err(error) = self.cache.set_budgets(jwt_id, &serialized).await {
                        tracing::warn!(
                            jwt_id,
                            error = %error,
                            "Failed to refresh budget cache after mutation"
                        );
                    }
                }
                Err(error) => {
                    tracing::warn!(
                        jwt_id,
                        error = %error,
                        "Failed to serialize budgets for cache refresh"
                    );
                    let _ = self.cache.clear_budgets(jwt_id).await;
                }
            },
            Err(error) => {
                tracing::warn!(
                    jwt_id,
                    user_id = %user_id,
                    error = %error,
                    "Failed to load budgets for cache refresh; clearing budget cache"
                );
                let _ = self.cache.clear_budgets(jwt_id).await;
            }
        }
    }
}
