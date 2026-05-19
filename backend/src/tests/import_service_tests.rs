use chrono::NaiveDate;
use csv::StringRecord;
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;

use crate::models::import::{CsvColumnMapping, ImportFileFormat};
use crate::models::transaction::Transaction;
use crate::services::import_service::ImportService;

#[test]
fn given_ofx_fields_when_from_ofx_then_maps_expected_values() {
    let account_id = Uuid::new_v4();
    let date = NaiveDate::from_ymd_opt(2024, 1, 15).unwrap();

    let transaction = Transaction::from_ofx(
        "FITID-123",
        date,
        Decimal::from_str("-12.34").unwrap(),
        "COFFEE SHOP",
        Some("DEBIT"),
        &account_id,
    );

    assert_eq!(transaction.account_id, account_id);
    assert_eq!(
        transaction.provider_transaction_id,
        Some("FITID-123".to_string())
    );
    assert_eq!(transaction.provider_account_id, None);
    assert_eq!(transaction.amount, Decimal::from_str("12.34").unwrap());
    assert_eq!(transaction.date, date);
    assert_eq!(transaction.merchant_name, Some("Coffee Shop".to_string()));
    assert_eq!(transaction.category_primary, "OTHER");
    assert_eq!(transaction.category_detailed, "OTHER");
    assert_eq!(transaction.payment_channel, Some("debit".to_string()));
    assert!(!transaction.pending);
}

#[test]
fn given_split_csv_columns_when_from_csv_row_then_uses_debit_or_credit_column() {
    let account_id = Uuid::new_v4();
    let headers = StringRecord::from(vec!["Date", "Description", "Debit Amount", "Credit Amount"]);
    let mapping = CsvColumnMapping {
        date_column: Some("Date".to_string()),
        description_column: Some("Description".to_string()),
        debit_column: Some("Debit Amount".to_string()),
        credit_column: Some("Credit Amount".to_string()),
        amount_column: None,
    };

    let debit_row = StringRecord::from(vec!["01/15/2024", "Coffee Shop", "12.34", ""]);
    let debit_transaction =
        Transaction::from_csv_row(&headers, &debit_row, &mapping, &account_id).unwrap();

    assert_eq!(
        debit_transaction.amount,
        Decimal::from_str("12.34").unwrap()
    );
    assert_eq!(
        debit_transaction.merchant_name,
        Some("Coffee Shop".to_string())
    );
    assert_eq!(debit_transaction.provider_account_id, None);

    let credit_row = StringRecord::from(vec!["01/16/2024", "Refund", "", "18.50"]);
    let credit_transaction =
        Transaction::from_csv_row(&headers, &credit_row, &mapping, &account_id).unwrap();

    assert_eq!(
        credit_transaction.amount,
        Decimal::from_str("18.50").unwrap()
    );
    assert_eq!(credit_transaction.merchant_name, Some("Refund".to_string()));
}

#[test]
fn given_signed_amount_csv_when_from_csv_row_then_uses_absolute_amount() {
    let account_id = Uuid::new_v4();
    let headers = StringRecord::from(vec!["Date", "Description", "Amount"]);
    let mapping = CsvColumnMapping {
        date_column: Some("Date".to_string()),
        description_column: Some("Description".to_string()),
        amount_column: Some("Amount".to_string()),
        debit_column: None,
        credit_column: None,
    };
    let row = StringRecord::from(vec!["2024-01-15", "Bakery", "-18.50"]);

    let transaction = Transaction::from_csv_row(&headers, &row, &mapping, &account_id).unwrap();

    assert_eq!(transaction.amount, Decimal::from_str("18.50").unwrap());
    assert!(transaction
        .provider_transaction_id
        .as_ref()
        .is_some_and(|value| !value.is_empty()));
}

#[test]
fn given_identical_csv_rows_when_building_transaction_ids_then_ids_match() {
    let account_id = Uuid::new_v4();
    let headers = StringRecord::from(vec!["Date", "Description", "Amount"]);
    let mapping = CsvColumnMapping {
        date_column: Some("Date".to_string()),
        description_column: Some("Description".to_string()),
        amount_column: Some("Amount".to_string()),
        debit_column: None,
        credit_column: None,
    };
    let first = StringRecord::from(vec!["2024-01-15", "Bakery", "18.50"]);
    let second = StringRecord::from(vec!["2024-01-15", "Bakery", "18.50"]);
    let different = StringRecord::from(vec!["2024-01-15", "Coffee Shop", "18.50"]);

    let first_transaction =
        Transaction::from_csv_row(&headers, &first, &mapping, &account_id).unwrap();
    let second_transaction =
        Transaction::from_csv_row(&headers, &second, &mapping, &account_id).unwrap();
    let different_transaction =
        Transaction::from_csv_row(&headers, &different, &mapping, &account_id).unwrap();

    assert_eq!(
        first_transaction.provider_transaction_id,
        second_transaction.provider_transaction_id
    );
    assert_ne!(
        first_transaction.provider_transaction_id,
        different_transaction.provider_transaction_id
    );
}

#[test]
fn given_bok_headers_when_detecting_csv_mapping_then_identifies_expected_columns() {
    let headers = StringRecord::from(vec!["Date", "Description", "Debit Amount", "Credit Amount"]);

    let mapping = ImportService::detect_csv_mapping(&headers);

    assert_eq!(mapping.date_column, Some("Date".to_string()));
    assert_eq!(mapping.description_column, Some("Description".to_string()));
    assert_eq!(mapping.debit_column, Some("Debit Amount".to_string()));
    assert_eq!(mapping.credit_column, Some("Credit Amount".to_string()));
    assert_eq!(mapping.amount_column, None);
}

#[test]
fn given_old_ofx_and_csv_rows_when_parsing_then_truncates_old_transactions() {
    let account_id = Uuid::new_v4();
    let ofx = "<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20180115000000<TRNAMT>-12.34<FITID>old-1<NAME>Old Coffee</STMTTRN><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20240115000000<TRNAMT>-45.67<FITID>new-1<NAME>New Coffee</STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>";

    let ofx_result = ImportService::parse_ofx(ofx, &account_id);
    assert_eq!(ofx_result.transactions.len(), 1);
    assert_eq!(ofx_result.truncated_count, 1);

    let csv = "Date,Description,Amount\n01/15/2018,Old Coffee,12.34\n01/15/2024,New Coffee,45.67\n";
    let mapping = CsvColumnMapping {
        date_column: Some("Date".to_string()),
        description_column: Some("Description".to_string()),
        amount_column: Some("Amount".to_string()),
        debit_column: None,
        credit_column: None,
    };
    let csv_result = ImportService::parse_csv(csv, &mapping, &account_id);
    assert_eq!(csv_result.transactions.len(), 1);
    assert_eq!(csv_result.truncated_count, 1);
}

#[test]
fn given_valid_and_invalid_files_when_validating_then_returns_preview_and_errors() {
    let account_id = Uuid::new_v4();
    let ofx = "<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20240115000000<TRNAMT>-12.34<FITID>fitid-1<NAME>COFFEE SHOP</STMTTRN><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20240116000000<TRNAMT>18.50<FITID>fitid-2<NAME>REFUND</STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>";
    let validate = ImportService::validate_file(ofx, "transactions.qfx", &account_id);

    assert_eq!(validate.format, Some(ImportFileFormat::Ofx));
    assert!(validate.valid);
    assert_eq!(validate.transaction_count, 2);
    assert_eq!(validate.preview_rows.len(), 2);
    let date_range = validate.date_range.unwrap();
    assert_eq!(
        date_range.start_date,
        NaiveDate::from_ymd_opt(2024, 1, 15).unwrap()
    );
    assert_eq!(
        date_range.end_date,
        NaiveDate::from_ymd_opt(2024, 1, 16).unwrap()
    );

    let invalid = ImportService::validate_file("not valid ofx", "transactions.ofx", &account_id);
    assert!(!invalid.valid);
    assert!(!invalid.errors.is_empty());
    assert_eq!(invalid.format, Some(ImportFileFormat::Ofx));
}
