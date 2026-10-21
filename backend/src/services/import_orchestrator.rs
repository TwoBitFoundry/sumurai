use std::sync::Arc;

use csv::StringRecord;
use uuid::Uuid;

use crate::models::domain_error::DomainError;
use crate::models::import::{
    CsvColumnMapping, ImportFileFormat, ImportResponse, ImportUpload, ValidateResponse,
};
use crate::services::authorization_service::AuthorizationService;
use crate::services::cache_service::CacheService;
use crate::services::import_service::{detect_import_format, read_csv_headers, ImportService};
use crate::services::merchant_normalization::service::MerchantNormalizationService;
use crate::services::repository_service::DatabaseRepository;

const FORBIDDEN_STATUS_CODE: u16 = 403;

pub struct ImportOrchestrator {
    authorization_service: Arc<AuthorizationService>,
    repository: Arc<dyn DatabaseRepository>,
    cache: Arc<dyn CacheService>,
}

impl ImportOrchestrator {
    pub fn new(
        authorization_service: Arc<AuthorizationService>,
        repository: Arc<dyn DatabaseRepository>,
        cache: Arc<dyn CacheService>,
    ) -> Self {
        Self {
            authorization_service,
            repository,
            cache,
        }
    }

    pub async fn validate(
        &self,
        user_id: Uuid,
        upload: ImportUpload,
    ) -> Result<ValidateResponse, DomainError> {
        let ImportUpload {
            file_name,
            file_bytes,
            account_id,
            csv_mapping: _,
        } = upload;

        self.ensure_account_owned(user_id, &account_id).await?;

        let content = decode_utf8(file_bytes)?;

        if detect_import_format(&file_name).is_none() {
            return Err(DomainError::bad_request(format!(
                "Unsupported file extension for '{}'",
                file_name
            )));
        }

        Ok(ImportService::validate_file(
            &content,
            &file_name,
            &account_id,
        ))
    }

    pub async fn import(
        &self,
        user_id: Uuid,
        jwt_id: &str,
        upload: ImportUpload,
    ) -> Result<ImportResponse, DomainError> {
        let ImportUpload {
            file_name,
            file_bytes,
            account_id,
            csv_mapping,
        } = upload;

        self.ensure_account_owned(user_id, &account_id).await?;

        let content = decode_utf8(file_bytes)?;
        let format = detect_import_format(&file_name).ok_or_else(|| {
            DomainError::bad_request(format!("Unsupported file extension for '{}'", file_name))
        })?;

        let mut parsed = match format {
            ImportFileFormat::Ofx
            | ImportFileFormat::Qfx
            | ImportFileFormat::Qbo
            | ImportFileFormat::Qbx => ImportService::parse_ofx(&content, &account_id),
            ImportFileFormat::Csv => {
                let mapping = match csv_mapping {
                    Some(mapping) => mapping,
                    None => detect_csv_mapping_from_content(&content)?,
                };

                let mapping_errors = csv_mapping_errors(&mapping);
                if !mapping_errors.is_empty() {
                    return Err(DomainError::bad_request(mapping_errors.join("; ")));
                }

                ImportService::parse_csv(&content, &mapping, &account_id)
            }
        };

        if parsed.transactions.is_empty() {
            let message = if parsed.errors.is_empty() {
                "No valid transactions were found in the uploaded file".to_string()
            } else {
                parsed.errors.join("; ")
            };
            return Err(DomainError::bad_request(message));
        }

        let mut transactions = std::mem::take(&mut parsed.transactions);

        for transaction in &mut transactions {
            transaction.user_id = Some(user_id);
        }

        let merchant_normalization_service =
            MerchantNormalizationService::new(self.repository.clone(), self.cache.clone());
        merchant_normalization_service
            .normalize_batch(&mut transactions)
            .await
            .map_err(|_| DomainError::internal("Failed to normalize imported merchants"))?;

        let transaction_counts_before = self
            .repository
            .get_transaction_count_by_account_for_user(&user_id)
            .await
            .map_err(|_| DomainError::internal("Failed to load existing transaction counts"))?;
        let before_count = transaction_counts_before
            .get(&account_id)
            .copied()
            .unwrap_or(0);

        self.repository
            .upsert_transactions_batch(&transactions, &user_id)
            .await
            .map_err(|_| DomainError::internal("Failed to import transactions"))?;

        if let Err(e) = self.cache.clear_transactions(jwt_id).await {
            tracing::warn!(
                "Failed to clear transaction cache after file import for user {}: {}",
                user_id,
                e
            );
        }

        let transaction_counts_after = self
            .repository
            .get_transaction_count_by_account_for_user(&user_id)
            .await
            .map_err(|_| DomainError::internal("Failed to refresh transaction counts"))?;
        let after_count = transaction_counts_after
            .get(&account_id)
            .copied()
            .unwrap_or(before_count);

        let imported_count = after_count.saturating_sub(before_count);
        let total_parsed = transactions.len() as i64;
        let skipped_count = total_parsed.saturating_sub(imported_count);

        Ok(ImportResponse {
            imported_count,
            skipped_count,
            truncated_count: parsed.truncated_count as i64,
            total_parsed,
            errors: std::mem::take(&mut parsed.errors),
        })
    }

    async fn ensure_account_owned(
        &self,
        user_id: Uuid,
        account_id: &Uuid,
    ) -> Result<(), DomainError> {
        let account_ids = vec![account_id.to_string()];
        self.authorization_service
            .validate_account_ownership(&account_ids, &user_id, self.repository.as_ref())
            .await
            .map(|_| ())
            .map_err(|status| {
                if status.as_u16() == FORBIDDEN_STATUS_CODE {
                    DomainError::forbidden("Account does not belong to the authenticated user")
                } else {
                    DomainError::internal("Failed to validate account ownership")
                }
            })
    }
}

fn decode_utf8(file_bytes: Vec<u8>) -> Result<String, DomainError> {
    String::from_utf8(file_bytes)
        .map_err(|_| DomainError::bad_request("Uploaded file must be valid UTF-8"))
}

fn detect_csv_mapping_from_content(content: &str) -> Result<CsvColumnMapping, DomainError> {
    let headers = read_csv_headers(content).map_err(DomainError::bad_request)?;
    Ok(ImportService::detect_csv_mapping(&StringRecord::from(
        headers,
    )))
}

fn csv_mapping_errors(mapping: &CsvColumnMapping) -> Vec<String> {
    let mut errors = Vec::new();

    if mapping.date_column.is_none() {
        errors.push("Unable to detect a CSV date column".to_string());
    }
    if mapping.description_column.is_none() {
        errors.push("Unable to detect a CSV description column".to_string());
    }
    if mapping.amount_column.is_none()
        && mapping.debit_column.is_none()
        && mapping.credit_column.is_none()
    {
        errors.push("Unable to detect a CSV amount, debit, or credit column".to_string());
    }

    errors
}
