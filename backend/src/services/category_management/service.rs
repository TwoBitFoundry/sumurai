#![allow(dead_code)]

use std::collections::HashSet;

use anyhow::Result;
use uuid::Uuid;

use crate::models::custom_category::{CategoryListResponse, CustomCategory, CustomCategoryError};
use crate::models::transaction_category_override::{
    SetTransactionCategoryRequest, TransactionCategoryOverride,
};
use crate::services::categorization::category_descriptors::{
    system_category_display_label, SYSTEM_CATEGORY_SLUGS,
};
use crate::services::repository_service::DatabaseRepository;
use crate::utils::merchant_name::{
    category_lookup_key, format_custom_category_display, normalize_merchant_for_match,
};

#[derive(Debug)]
pub enum CategoryServiceError {
    Validation(CustomCategoryError),
    TransactionNotFound,
    CustomCategoryNotFound,
    Db(anyhow::Error),
}

impl From<anyhow::Error> for CategoryServiceError {
    fn from(e: anyhow::Error) -> Self {
        Self::Db(e)
    }
}

pub struct CategoryManagementService {
    system_lookup_keys: HashSet<String>,
}

impl CategoryManagementService {
    pub fn new(system_slugs: &[&str]) -> Self {
        let mut system_lookup_keys = HashSet::new();
        for slug in system_slugs {
            system_lookup_keys.insert(category_lookup_key(&slug.replace('_', " ")));
            if let Some(label) = system_category_display_label(slug) {
                system_lookup_keys.insert(category_lookup_key(label));
            }
        }
        Self { system_lookup_keys }
    }

    pub fn system_slugs() -> Vec<String> {
        SYSTEM_CATEGORY_SLUGS
            .iter()
            .map(|s| s.to_string())
            .collect()
    }

    pub async fn list_categories_for_user<R: DatabaseRepository + ?Sized>(
        &self,
        repository: &R,
        user_id: &Uuid,
    ) -> Result<CategoryListResponse> {
        let custom = repository.list_custom_categories_for_user(user_id).await?;
        Ok(CategoryListResponse {
            system: Self::system_slugs(),
            custom,
        })
    }

    pub async fn create_custom_category<R: DatabaseRepository + ?Sized>(
        &self,
        repository: &R,
        user_id: &Uuid,
        raw_name: &str,
    ) -> Result<CustomCategory, CategoryServiceError> {
        let trimmed = raw_name.trim();

        if trimmed.is_empty() {
            return Err(CategoryServiceError::Validation(
                CustomCategoryError::EmptyName,
            ));
        }

        if !trimmed
            .chars()
            .all(|c| c.is_ascii_alphabetic() || c.is_ascii_whitespace())
        {
            return Err(CategoryServiceError::Validation(
                CustomCategoryError::InvalidCharacters,
            ));
        }

        let words: Vec<&str> = trimmed.split_whitespace().collect();
        if words.len() > 3 {
            return Err(CategoryServiceError::Validation(
                CustomCategoryError::TooManyWords,
            ));
        }

        let display = format_custom_category_display(trimmed);
        if display.len() > 30 {
            return Err(CategoryServiceError::Validation(
                CustomCategoryError::NameTooLong,
            ));
        }

        let key = category_lookup_key(trimmed);

        if self.system_lookup_keys.contains(&key) {
            return Err(CategoryServiceError::Validation(
                CustomCategoryError::CollidesWithSystemCategory,
            ));
        }

        let existing = repository.list_custom_categories_for_user(user_id).await?;

        if existing.iter().any(|cat| cat.lookup_key == key) {
            return Err(CategoryServiceError::Validation(
                CustomCategoryError::CollidesWithExistingCustom,
            ));
        }

        repository
            .create_custom_category(user_id, &display, &key)
            .await
            .map_err(CategoryServiceError::from)
    }

    pub async fn delete_custom_category<R: DatabaseRepository + ?Sized>(
        &self,
        repository: &R,
        user_id: &Uuid,
        id: &Uuid,
    ) -> Result<()> {
        repository.delete_custom_category(user_id, id).await
    }

    pub async fn set_transaction_category<R: DatabaseRepository + ?Sized>(
        &self,
        repository: &R,
        user_id: &Uuid,
        transaction_id: &Uuid,
        request: SetTransactionCategoryRequest,
    ) -> Result<Option<TransactionCategoryOverride>, CategoryServiceError> {
        let transaction = repository
            .get_transaction_by_id_for_user(user_id, transaction_id)
            .await?
            .ok_or(CategoryServiceError::TransactionNotFound)?;

        let normalized_merchant =
            normalize_merchant_for_match(transaction.merchant_name.as_deref().unwrap_or(""));

        if request.category_name == transaction.category_primary && !request.is_custom {
            repository
                .delete_transaction_category_override_by_norm(user_id, &normalized_merchant)
                .await?;
            return Ok(None);
        }

        let custom_category_id = if request.is_custom {
            let customs = repository.list_custom_categories_for_user(user_id).await?;
            let key = category_lookup_key(&request.category_name);
            let found = customs
                .iter()
                .find(|cat| cat.lookup_key == key)
                .ok_or(CategoryServiceError::CustomCategoryNotFound)?;
            Some(found.id)
        } else {
            None
        };

        let override_row = repository
            .upsert_transaction_category_override(
                user_id,
                &normalized_merchant,
                &request.category_name,
                custom_category_id,
            )
            .await?;

        Ok(Some(override_row))
    }
}
