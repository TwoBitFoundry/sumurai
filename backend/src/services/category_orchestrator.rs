use std::sync::Arc;

use uuid::Uuid;

use crate::models::custom_category::{CategoryListResponse, CustomCategory, CustomCategoryError};
use crate::models::transaction_category_override::SetTransactionCategoryRequest;
use crate::services::category_management::service::{
    CategoryManagementService, CategoryServiceError,
};
use crate::services::repository_service::DatabaseRepository;
use crate::services::CacheService;

#[derive(Debug, PartialEq)]
pub enum CategoryOrchestrationError {
    LoadTransactionCategoriesFailed,
    LoadCategoriesFailed,
    InvalidCustomCategory(CustomCategoryError),
    CreateCustomCategoryFailed,
    DeleteCustomCategoryFailed,
    TransactionNotFound,
    CustomCategoryNotFound,
    InvalidTransactionCategory,
    SetTransactionCategoryFailed,
}

pub struct CategoryOrchestrator {
    category_management_service: Arc<CategoryManagementService>,
    repository: Arc<dyn DatabaseRepository>,
    cache: Arc<dyn CacheService>,
}

impl CategoryOrchestrator {
    pub fn new(
        category_management_service: Arc<CategoryManagementService>,
        repository: Arc<dyn DatabaseRepository>,
        cache: Arc<dyn CacheService>,
    ) -> Self {
        Self {
            category_management_service,
            repository,
            cache,
        }
    }

    pub async fn transaction_categories(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<String>, CategoryOrchestrationError> {
        self.repository
            .get_distinct_transaction_categories(&user_id)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to fetch transaction categories for user {}: {}",
                    user_id,
                    e
                );
                CategoryOrchestrationError::LoadTransactionCategoriesFailed
            })
    }

    pub async fn list(
        &self,
        user_id: Uuid,
    ) -> Result<CategoryListResponse, CategoryOrchestrationError> {
        self.category_management_service
            .list_categories_for_user(&*self.repository, &user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch categories for user {}: {}", user_id, e);
                CategoryOrchestrationError::LoadCategoriesFailed
            })
    }

    pub async fn create_custom(
        &self,
        user_id: Uuid,
        name: &str,
    ) -> Result<CustomCategory, CategoryOrchestrationError> {
        self.category_management_service
            .create_custom_category(&*self.repository, &user_id, name)
            .await
            .map_err(|error| match error {
                CategoryServiceError::Validation(e) => {
                    CategoryOrchestrationError::InvalidCustomCategory(e)
                }
                CategoryServiceError::Db(e) => {
                    tracing::error!(
                        "Failed to create custom category for user {}: {}",
                        user_id,
                        e
                    );
                    CategoryOrchestrationError::CreateCustomCategoryFailed
                }
                other => {
                    tracing::error!(
                        "Unexpected error creating custom category for user {}: {:?}",
                        user_id,
                        other
                    );
                    CategoryOrchestrationError::CreateCustomCategoryFailed
                }
            })
    }

    pub async fn delete_custom(
        &self,
        user_id: Uuid,
        id: Uuid,
    ) -> Result<(), CategoryOrchestrationError> {
        self.category_management_service
            .delete_custom_category(&*self.repository, &user_id, &id)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to delete custom category {} for user {}: {}",
                    id,
                    user_id,
                    e
                );
                CategoryOrchestrationError::DeleteCustomCategoryFailed
            })
    }

    pub async fn set_transaction_category(
        &self,
        user_id: Uuid,
        jwt_id: &str,
        transaction_id: Uuid,
        request: SetTransactionCategoryRequest,
    ) -> Result<(), CategoryOrchestrationError> {
        self.category_management_service
            .set_transaction_category(&*self.repository, &user_id, &transaction_id, request)
            .await
            .map_err(|error| match error {
                CategoryServiceError::TransactionNotFound => {
                    CategoryOrchestrationError::TransactionNotFound
                }
                CategoryServiceError::CustomCategoryNotFound => {
                    CategoryOrchestrationError::CustomCategoryNotFound
                }
                CategoryServiceError::Db(e) => {
                    tracing::error!(
                        "Database error setting category for transaction {}: {}",
                        transaction_id,
                        e
                    );
                    CategoryOrchestrationError::SetTransactionCategoryFailed
                }
                CategoryServiceError::Validation(_) => {
                    CategoryOrchestrationError::InvalidTransactionCategory
                }
            })?;

        self.invalidate_sankey_cache(jwt_id, transaction_id).await;
        Ok(())
    }

    async fn invalidate_sankey_cache(&self, jwt_id: &str, transaction_id: Uuid) {
        if let Err(e) = self
            .cache
            .invalidate_pattern(&format!("{}_sankey_*", jwt_id))
            .await
        {
            tracing::warn!(
                "Failed to invalidate sankey cache after category update for transaction {}: {}",
                transaction_id,
                e
            );
        }
    }
}
