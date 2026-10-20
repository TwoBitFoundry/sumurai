use std::sync::Arc;

use anyhow::anyhow;
use chrono::NaiveDate;
use rust_decimal_macros::dec;
use uuid::Uuid;

use crate::models::account::Account;
use crate::models::export::ExportFormat;
use crate::models::transaction::TransactionWithAccount;
use crate::services::export_orchestrator::{ExportOrchestrationError, ExportOrchestrator};
use crate::services::repository_service::MockDatabaseRepository;

fn orchestrator(repository: MockDatabaseRepository) -> ExportOrchestrator {
    ExportOrchestrator::new(Arc::new(repository))
}

fn account(id: Uuid, connection_id: Uuid, institution: &str) -> Account {
    Account {
        id,
        user_id: Some(Uuid::new_v4()),
        provider_account_id: Some(format!("provider-{id}")),
        provider_connection_id: Some(connection_id),
        name: "Checking".to_string(),
        account_type: "depository".to_string(),
        balance_current: Some(dec!(100.00)),
        mask: Some("1234".to_string()),
        institution_name: Some(institution.to_string()),
        provider_conn_id: None,
    }
}

fn transaction(account_id: Uuid, date: NaiveDate) -> TransactionWithAccount {
    TransactionWithAccount {
        id: Uuid::new_v4(),
        account_id,
        user_id: Some(Uuid::new_v4()),
        provider_account_id: Some(format!("provider-{account_id}")),
        provider_transaction_id: Some(Uuid::new_v4().to_string()),
        amount: dec!(-12.34),
        date,
        merchant_name: Some("Coffee Shop".to_string()),
        category_primary: "FOOD".to_string(),
        category_detailed: "FOOD".to_string(),
        category_confidence: "high".to_string(),
        payment_channel: Some("online".to_string()),
        pending: false,
        created_at: None,
        account_name: "Checking".to_string(),
        account_type: "depository".to_string(),
        account_mask: Some("1234".to_string()),
        is_custom: false,
        is_overridden: false,
        original_merchant_name: None,
        normalized_merchant: None,
        normalization_source: None,
    }
}

fn repository(
    accounts: Vec<Account>,
    transactions: Vec<TransactionWithAccount>,
    expected_account_ids: Vec<Uuid>,
) -> MockDatabaseRepository {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_accounts_for_user()
        .returning(move |_| {
            let accounts = accounts.clone();
            Box::pin(async move { Ok(accounts) })
        });
    repository
        .expect_get_transactions_for_export()
        .returning(move |_, account_ids| {
            assert_eq!(account_ids, Some(expected_account_ids.as_slice()));
            let transactions = transactions.clone();
            Box::pin(async move { Ok(transactions) })
        });
    repository
}

#[tokio::test]
async fn given_all_accounts_when_exporting_csv_then_names_file_by_scope_and_date_range() {
    let account_id = Uuid::new_v4();
    let accounts = vec![account(account_id, Uuid::new_v4(), "Demo Bank")];
    let transactions = vec![
        transaction(account_id, NaiveDate::from_ymd_opt(2024, 1, 10).unwrap()),
        transaction(account_id, NaiveDate::from_ymd_opt(2024, 1, 15).unwrap()),
    ];

    let file = orchestrator(repository(accounts, transactions, vec![account_id]))
        .export(Uuid::new_v4(), ExportFormat::Csv, None)
        .await
        .unwrap();

    assert_eq!(file.format, ExportFormat::Csv);
    assert_eq!(file.filename, "sumurai-export-all-20240110-20240115.csv");
    assert!(file.body.contains("Coffee Shop"));
}

#[tokio::test]
async fn given_connection_filter_when_exporting_then_limits_accounts_and_uses_institution_scope() {
    let kept_connection = Uuid::new_v4();
    let kept_account = Uuid::new_v4();
    let other_account = Uuid::new_v4();
    let accounts = vec![
        account(kept_account, kept_connection, "Demo Bank"),
        account(other_account, Uuid::new_v4(), "Other Bank"),
    ];
    let transactions = vec![transaction(
        kept_account,
        NaiveDate::from_ymd_opt(2024, 2, 1).unwrap(),
    )];

    let file = orchestrator(repository(accounts, transactions, vec![kept_account]))
        .export(Uuid::new_v4(), ExportFormat::Ofx, Some(kept_connection))
        .await
        .unwrap();

    assert_eq!(file.format, ExportFormat::Ofx);
    assert_eq!(
        file.filename,
        "sumurai-export-demo-bank-20240201-20240201.ofx"
    );
}

#[tokio::test]
async fn given_unknown_connection_when_exporting_then_requests_empty_account_set() {
    let accounts = vec![account(Uuid::new_v4(), Uuid::new_v4(), "Demo Bank")];

    let file = orchestrator(repository(accounts, Vec::new(), Vec::new()))
        .export(Uuid::new_v4(), ExportFormat::Csv, Some(Uuid::new_v4()))
        .await
        .unwrap();

    assert_eq!(
        file.filename,
        "sumurai-export-institution-no-transactions.csv"
    );
}

#[tokio::test]
async fn given_account_lookup_failure_when_exporting_then_reports_load_accounts_failed() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_accounts_for_user()
        .returning(|_| Box::pin(async { Err(anyhow!("db down")) }));

    let result = orchestrator(repository)
        .export(Uuid::new_v4(), ExportFormat::Csv, None)
        .await;

    assert_eq!(result, Err(ExportOrchestrationError::LoadAccountsFailed));
}

#[tokio::test]
async fn given_transaction_lookup_failure_when_exporting_then_reports_load_transactions_failed() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_get_accounts_for_user()
        .returning(|_| Box::pin(async { Ok(Vec::new()) }));
    repository
        .expect_get_transactions_for_export()
        .returning(|_, _| Box::pin(async { Err(anyhow!("db down")) }));

    let result = orchestrator(repository)
        .export(Uuid::new_v4(), ExportFormat::Csv, None)
        .await;

    assert_eq!(
        result,
        Err(ExportOrchestrationError::LoadTransactionsFailed)
    );
}
