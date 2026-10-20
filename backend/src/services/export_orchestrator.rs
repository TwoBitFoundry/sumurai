use std::sync::Arc;

use uuid::Uuid;

use crate::models::export::ExportFormat;
use crate::services::export_service::ExportService;
use crate::services::repository_service::DatabaseRepository;

#[derive(Debug, Clone, PartialEq)]
pub enum ExportOrchestrationError {
    LoadAccountsFailed,
    LoadTransactionsFailed,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ExportFile {
    pub format: ExportFormat,
    pub filename: String,
    pub body: String,
}

pub struct ExportOrchestrator {
    repository: Arc<dyn DatabaseRepository>,
}

impl ExportOrchestrator {
    pub fn new(repository: Arc<dyn DatabaseRepository>) -> Self {
        Self { repository }
    }

    pub async fn export(
        &self,
        user_id: Uuid,
        format: ExportFormat,
        connection_id: Option<Uuid>,
    ) -> Result<ExportFile, ExportOrchestrationError> {
        let mut accounts = self
            .repository
            .get_accounts_for_user(&user_id)
            .await
            .map_err(|_| ExportOrchestrationError::LoadAccountsFailed)?;

        if let Some(connection_id) = connection_id {
            accounts.retain(|account| account.provider_connection_id == Some(connection_id));
        }

        let account_ids = if accounts.is_empty() {
            Some(Vec::new())
        } else {
            Some(accounts.iter().map(|account| account.id).collect())
        };

        let transactions = self
            .repository
            .get_transactions_for_export(&user_id, account_ids.as_deref())
            .await
            .map_err(|_| ExportOrchestrationError::LoadTransactionsFailed)?;

        let date_range = transactions
            .iter()
            .map(|transaction| transaction.date)
            .min()
            .zip(
                transactions
                    .iter()
                    .map(|transaction| transaction.date)
                    .max(),
            );

        let scope = if connection_id.is_some() {
            accounts
                .first()
                .and_then(|account| account.institution_name.as_deref())
                .unwrap_or("institution")
        } else {
            "all"
        };

        let body = match format {
            ExportFormat::Csv => ExportService::to_csv(&accounts, &transactions),
            ExportFormat::Ofx => ExportService::to_ofx(&accounts, &transactions),
        };

        let filename = format.filename_for_scope(scope, date_range);

        Ok(ExportFile {
            format,
            filename,
            body,
        })
    }
}
