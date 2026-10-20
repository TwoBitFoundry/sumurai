use std::sync::Arc;

use csv::StringRecord;
use uuid::Uuid;

use crate::models::import::{CsvColumnMapping, ImportFileFormat, ImportResponse, ValidateResponse};
use crate::services::authorization_service::AuthorizationService;
use crate::services::cache_service::CacheService;
use crate::services::import_service::{detect_import_format, read_csv_headers, ImportService};
use crate::services::merchant_normalization::service::MerchantNormalizationService;
use crate::services::repository_service::DatabaseRepository;

const FORBIDDEN_STATUS_CODE: u16 = 403;

#[derive(Debug, Clone, PartialEq)]
pub enum ImportOrchestrationError {
    AccountNotOwned,
    AccountOwnershipCheckFailed,
    InvalidUtf8,
    UnsupportedFileExtension(String),
    InvalidCsvHeaders(String),
    InvalidCsvMapping(Vec<String>),
    NoValidTransactions(Vec<String>),
    LoadTransactionCountsFailed,
    NormalizeMerchantsFailed,
    ImportFailed,
    RefreshTransactionCountsFailed,
}

#[derive(Debug, Clone)]
pub struct ImportUpload {
    pub file_name: String,
    pub file_bytes: Vec<u8>,
    pub account_id: Uuid,
    pub csv_mapping: Option<CsvColumnMapping>,
}

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
    ) -> Result<ValidateResponse, ImportOrchestrationError> {
        let ImportUpload {
            file_name,
            file_bytes,
            account_id,
            csv_mapping: _,
        } = upload;

        self.ensure_account_owned(user_id, &account_id).await?;

        let content = decode_utf8(file_bytes)?;

        if detect_import_format(&file_name).is_none() {
            return Err(ImportOrchestrationError::UnsupportedFileExtension(
                file_name,
            ));
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
    ) -> Result<ImportResponse, ImportOrchestrationError> {
        let ImportUpload {
            file_name,
            file_bytes,
            account_id,
            csv_mapping,
        } = upload;

        self.ensure_account_owned(user_id, &account_id).await?;

        let content = decode_utf8(file_bytes)?;
        let format = detect_import_format(&file_name).ok_or(
            ImportOrchestrationError::UnsupportedFileExtension(file_name),
        )?;

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
                    return Err(ImportOrchestrationError::InvalidCsvMapping(mapping_errors));
                }

                ImportService::parse_csv(&content, &mapping, &account_id)
            }
        };

        if parsed.transactions.is_empty() {
            return Err(ImportOrchestrationError::NoValidTransactions(parsed.errors));
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
            .map_err(|_| ImportOrchestrationError::NormalizeMerchantsFailed)?;

        let transaction_counts_before = self
            .repository
            .get_transaction_count_by_account_for_user(&user_id)
            .await
            .map_err(|_| ImportOrchestrationError::LoadTransactionCountsFailed)?;
        let before_count = transaction_counts_before
            .get(&account_id)
            .copied()
            .unwrap_or(0);

        self.repository
            .upsert_transactions_batch(&transactions, &user_id)
            .await
            .map_err(|_| ImportOrchestrationError::ImportFailed)?;

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
            .map_err(|_| ImportOrchestrationError::RefreshTransactionCountsFailed)?;
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
    ) -> Result<(), ImportOrchestrationError> {
        let account_ids = vec![account_id.to_string()];
        self.authorization_service
            .validate_account_ownership(&account_ids, &user_id, self.repository.as_ref())
            .await
            .map(|_| ())
            .map_err(|status| {
                if status.as_u16() == FORBIDDEN_STATUS_CODE {
                    ImportOrchestrationError::AccountNotOwned
                } else {
                    ImportOrchestrationError::AccountOwnershipCheckFailed
                }
            })
    }
}

fn decode_utf8(file_bytes: Vec<u8>) -> Result<String, ImportOrchestrationError> {
    String::from_utf8(file_bytes).map_err(|_| ImportOrchestrationError::InvalidUtf8)
}

fn detect_csv_mapping_from_content(
    content: &str,
) -> Result<CsvColumnMapping, ImportOrchestrationError> {
    let headers = read_csv_headers(content).map_err(ImportOrchestrationError::InvalidCsvHeaders)?;
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
