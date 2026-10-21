use std::sync::Arc;

use uuid::Uuid;

use crate::models::custom_category::{CategoryListResponse, CustomCategory, CustomCategoryError};
use crate::models::domain_error::DomainError;
use crate::models::transaction_category_override::SetTransactionCategoryRequest;
use crate::services::category_management::service::{
    CategoryManagementService, CategoryServiceError,
};
use crate::services::repository_service::DatabaseRepository;
use crate::services::CacheService;

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

    pub async fn transaction_categories(&self, user_id: Uuid) -> Result<Vec<String>, DomainError> {
        self.repository
            .get_distinct_transaction_categories(&user_id)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to fetch transaction categories for user {}: {}",
                    user_id,
                    e
                );
                DomainError::internal("Failed to fetch categories")
            })
    }

    pub async fn list(&self, user_id: Uuid) -> Result<CategoryListResponse, DomainError> {
        self.category_management_service
            .list_categories_for_user(&*self.repository, &user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch categories for user {}: {}", user_id, e);
                DomainError::internal("Failed to fetch categories")
            })
    }

    pub async fn create_custom(
        &self,
        user_id: Uuid,
        name: &str,
    ) -> Result<CustomCategory, DomainError> {
        self.category_management_service
            .create_custom_category(&*self.repository, &user_id, name)
            .await
            .map_err(|error| match error {
                CategoryServiceError::Validation(e) => Self::invalid_custom_category(e),
                CategoryServiceError::Db(e) => {
                    tracing::error!(
                        "Failed to create custom category for user {}: {}",
                        user_id,
                        e
                    );
                    Self::internal_failure()
                }
                other => {
                    tracing::error!(
                        "Unexpected error creating custom category for user {}: {:?}",
                        user_id,
                        other
                    );
                    Self::internal_failure()
                }
            })
    }

    pub async fn delete_custom(&self, user_id: Uuid, id: Uuid) -> Result<(), DomainError> {
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
                DomainError::internal("Failed to delete custom category")
            })
    }

    pub async fn set_transaction_category(
        &self,
        user_id: Uuid,
        jwt_id: &str,
        transaction_id: Uuid,
        request: SetTransactionCategoryRequest,
    ) -> Result<(), DomainError> {
        self.category_management_service
            .set_transaction_category(&*self.repository, &user_id, &transaction_id, request)
            .await
            .map_err(|error| match error {
                CategoryServiceError::TransactionNotFound => {
                    DomainError::not_found("transaction_not_found").with_error_name("not_found")
                }
                CategoryServiceError::CustomCategoryNotFound => {
                    DomainError::bad_request("custom_category_not_found")
                        .with_error_name("validation_error")
                }
                CategoryServiceError::Db(e) => {
                    tracing::error!(
                        "Database error setting category for transaction {}: {}",
                        transaction_id,
                        e
                    );
                    Self::internal_failure()
                }
                CategoryServiceError::Validation(_) => {
                    DomainError::bad_request("validation_error").with_error_name("validation_error")
                }
            })?;

        self.invalidate_sankey_cache(jwt_id, transaction_id).await;
        Ok(())
    }

    fn internal_failure() -> DomainError {
        DomainError::internal("internal_server_error").with_error_name("internal_error")
    }

    fn invalid_custom_category(error: CustomCategoryError) -> DomainError {
        let (message, code) = match error {
            CustomCategoryError::NameTooLong => ("Name too long", "name_too_long"),
            CustomCategoryError::TooManyWords => ("Too many words", "too_many_words"),
            CustomCategoryError::EmptyName => ("Name is empty", "empty_name"),
            CustomCategoryError::InvalidCharacters => ("Invalid characters", "invalid_characters"),
            CustomCategoryError::CollidesWithSystemCategory => (
                "Collides with system category",
                "collides_with_system_category",
            ),
            CustomCategoryError::CollidesWithExistingCustom => (
                "Collides with existing custom category",
                "collides_with_existing_custom",
            ),
        };
        DomainError::bad_request(message)
            .with_code(code)
            .with_error_name("validation_error")
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
