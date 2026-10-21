use std::sync::Arc;

use anyhow::anyhow;
use uuid::Uuid;

use crate::models::account::Account;
use crate::models::domain_error::DomainError;
use crate::models::import::{CsvColumnMapping, ImportUpload};
use crate::services::authorization_service::AuthorizationService;
use crate::services::cache_service::MockCacheService;
use crate::services::import_orchestrator::ImportOrchestrator;
use crate::services::repository_service::MockDatabaseRepository;

const CSV_CONTENT: &str = "Date,Description,Amount\n2024-01-05,Coffee,-4.50\n";

fn owned_account(user_id: Uuid, account_id: Uuid) -> Account {
    Account {
        id: account_id,
        user_id: Some(user_id),
        provider_account_id: None,
        provider_connection_id: None,
        name: "Checking".to_string(),
        account_type: "depository".to_string(),
        balance_current: None,
        mask: None,
        institution_name: None,
        provider_conn_id: None,
    }
}

fn repository_with_accounts(accounts: Vec<Account>) -> MockDatabaseRepository {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_accounts_for_user()
        .returning(move |_| {
            let accounts = accounts.clone();
            Box::pin(async move { Ok(accounts) })
        });
    repository
}

fn orchestrator(repository: MockDatabaseRepository) -> ImportOrchestrator {
    ImportOrchestrator::new(
        Arc::new(AuthorizationService::new()),
        Arc::new(repository),
        Arc::new(MockCacheService::new()),
    )
}

fn upload(
    file_name: &str,
    file_bytes: &[u8],
    account_id: Uuid,
    csv_mapping: Option<CsvColumnMapping>,
) -> ImportUpload {
    ImportUpload {
        file_name: file_name.to_string(),
        file_bytes: file_bytes.to_vec(),
        account_id,
        csv_mapping,
    }
}

#[tokio::test]
async fn given_owned_account_and_csv_when_validating_then_reports_valid_file() {
    let user_id = Uuid::new_v4();
    let account_id = Uuid::new_v4();
    let repository = repository_with_accounts(vec![owned_account(user_id, account_id)]);

    let result = orchestrator(repository)
        .validate(
            user_id,
            upload("transactions.csv", CSV_CONTENT.as_bytes(), account_id, None),
        )
        .await
        .unwrap();

    assert!(result.valid);
    assert_eq!(result.transaction_count, 1);
}

#[tokio::test]
async fn given_foreign_account_when_validating_then_reports_account_not_owned() {
    let account_id = Uuid::new_v4();
    let repository = repository_with_accounts(vec![]);

    let result = orchestrator(repository)
        .validate(
            Uuid::new_v4(),
            upload("transactions.csv", CSV_CONTENT.as_bytes(), account_id, None),
        )
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::forbidden(
            "Account does not belong to the authenticated user"
        ))
    );
}

#[tokio::test]
async fn given_repository_failure_when_validating_then_reports_ownership_check_failed() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_accounts_for_user()
        .returning(|_| Box::pin(async { Err(anyhow!("database down")) }));

    let result = orchestrator(repository)
        .validate(
            Uuid::new_v4(),
            upload(
                "transactions.csv",
                CSV_CONTENT.as_bytes(),
                Uuid::new_v4(),
                None,
            ),
        )
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::internal(
            "Failed to validate account ownership"
        ))
    );
}

#[tokio::test]
async fn given_non_utf8_bytes_when_validating_then_reports_invalid_utf8() {
    let user_id = Uuid::new_v4();
    let account_id = Uuid::new_v4();
    let repository = repository_with_accounts(vec![owned_account(user_id, account_id)]);

    let result = orchestrator(repository)
        .validate(
            user_id,
            upload("transactions.csv", &[0xff, 0xfe, 0xfd], account_id, None),
        )
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::bad_request(
            "Uploaded file must be valid UTF-8"
        ))
    );
}

#[tokio::test]
async fn given_unsupported_extension_when_validating_then_reports_unsupported_extension() {
    let user_id = Uuid::new_v4();
    let account_id = Uuid::new_v4();
    let repository = repository_with_accounts(vec![owned_account(user_id, account_id)]);

    let result = orchestrator(repository)
        .validate(
            user_id,
            upload("statement.pdf", CSV_CONTENT.as_bytes(), account_id, None),
        )
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::bad_request(
            "Unsupported file extension for 'statement.pdf'"
        ))
    );
}

#[tokio::test]
async fn given_empty_csv_mapping_when_importing_then_reports_each_missing_column() {
    let user_id = Uuid::new_v4();
    let account_id = Uuid::new_v4();
    let repository = repository_with_accounts(vec![owned_account(user_id, account_id)]);

    let result = orchestrator(repository)
        .import(
            user_id,
            "jwt",
            upload(
                "transactions.csv",
                CSV_CONTENT.as_bytes(),
                account_id,
                Some(CsvColumnMapping::default()),
            ),
        )
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::bad_request(
            "Unable to detect a CSV date column; Unable to detect a CSV description column; Unable to detect a CSV amount, debit, or credit column"
        ))
    );
}

#[tokio::test]
async fn given_data_row_as_csv_header_when_importing_without_mapping_then_reports_invalid_headers()
{
    let user_id = Uuid::new_v4();
    let account_id = Uuid::new_v4();
    let repository = repository_with_accounts(vec![owned_account(user_id, account_id)]);

    let result = orchestrator(repository)
        .import(
            user_id,
            "jwt",
            upload(
                "transactions.csv",
                b"2024-01-05,Coffee,-4.50\n2024-01-06,Lunch,-12.00\n",
                account_id,
                None,
            ),
        )
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::bad_request(
            "CSV files must include a header row with column names. The first row looks like transaction data instead."
        ))
    );
}

#[tokio::test]
async fn given_file_without_transactions_when_importing_then_reports_no_valid_transactions() {
    let user_id = Uuid::new_v4();
    let account_id = Uuid::new_v4();
    let repository = repository_with_accounts(vec![owned_account(user_id, account_id)]);

    let result = orchestrator(repository)
        .import(
            user_id,
            "jwt",
            upload("statement.ofx", b"not an ofx statement", account_id, None),
        )
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::bad_request(
            "No OFX transactions were found in the file"
        ))
    );
}

#[tokio::test]
async fn given_header_only_csv_when_importing_then_reports_default_no_transactions_message() {
    let user_id = Uuid::new_v4();
    let account_id = Uuid::new_v4();
    let repository = repository_with_accounts(vec![owned_account(user_id, account_id)]);

    let result = orchestrator(repository)
        .import(
            user_id,
            "jwt",
            upload(
                "transactions.csv",
                b"Date,Description,Amount\n",
                account_id,
                None,
            ),
        )
        .await;

    assert_eq!(
        result.err(),
        Some(DomainError::bad_request(
            "No valid transactions were found in the uploaded file"
        ))
    );
}

#[tokio::test]
async fn given_rows_with_parse_errors_when_importing_then_joins_row_errors_in_message() {
    let user_id = Uuid::new_v4();
    let account_id = Uuid::new_v4();
    let repository = repository_with_accounts(vec![owned_account(user_id, account_id)]);

    let result = orchestrator(repository)
        .import(
            user_id,
            "jwt",
            upload(
                "transactions.csv",
                b"Date,Description,Amount\nnot-a-date,Coffee,-4.50\nalso-bad,Lunch,-12.00\n",
                account_id,
                None,
            ),
        )
        .await;

    let error = result.err().unwrap();
    assert!(error.message.starts_with("Row 2: "));
    assert!(error.message.contains("; Row 3: "));
}
