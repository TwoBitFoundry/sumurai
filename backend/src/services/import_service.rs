//! CSV transaction import parsing and persistence.

#![allow(dead_code)]

use chrono::{Datelike, NaiveDate, Utc};
use csv::{ReaderBuilder, StringRecord};
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;

use crate::models::import::{
    CsvColumnMapping, ImportDateRange, ImportFileFormat, PreviewTransaction, ValidateResponse,
};
use crate::models::transaction::Transaction;

const MAX_PREVIEW_ROWS: usize = 5;
const FIVE_YEAR_DAY_WINDOW: i64 = 365 * 5 + 2;
const CSV_HEADER_REQUIRED_ERROR: &str =
    "CSV files must include a header row with column names (for example Date, Description, Amount).";
const CSV_HEADER_ROW_LOOKS_LIKE_DATA_ERROR: &str = "CSV files must include a header row with column names. The first row looks like transaction data instead.";
const CSV_NO_TRANSACTION_ROWS_ERROR: &str = "No transaction rows were found in the CSV file.";

#[derive(Debug, Clone, Default)]
pub struct ParseOutcome {
    pub transactions: Vec<Transaction>,
    pub truncated_count: usize,
    pub errors: Vec<String>,
}

pub struct ImportService;

impl ImportService {
    pub fn parse_ofx(content: &str, account_id: &Uuid) -> ParseOutcome {
        let today = Utc::now().date_naive();
        let cutoff = five_year_cutoff(today);
        let mut transactions = Vec::new();
        let mut errors = Vec::new();
        let mut truncated_count = 0;
        let mut transaction_index = 0usize;
        let mut remaining = content;

        while let Some(start) = remaining.find("<STMTTRN>") {
            let after_start = &remaining[start + "<STMTTRN>".len()..];
            let Some(end) = after_start.find("</STMTTRN>") else {
                errors.push("OFX transaction block is missing a closing tag".to_string());
                break;
            };

            transaction_index += 1;
            let block = &after_start[..end];
            let fitid = extract_ofx_tag(block, "FITID");
            let date_raw = extract_ofx_tag(block, "DTPOSTED");
            let amount_raw = extract_ofx_tag(block, "TRNAMT");
            let merchant_name = extract_ofx_tag(block, "NAME");
            let trntype = extract_ofx_tag(block, "TRNTYPE");

            match (fitid, date_raw, amount_raw, merchant_name) {
                (Some(fitid), Some(date_raw), Some(amount_raw), Some(merchant_name)) => {
                    let parsed_date = parse_ofx_date(&date_raw);
                    let parsed_amount = Decimal::from_str(amount_raw.trim());

                    match (parsed_date, parsed_amount) {
                        (Some(date), Ok(amount)) => {
                            if date < cutoff {
                                truncated_count += 1;
                            } else {
                                transactions.push(Transaction::from_ofx(
                                    &fitid,
                                    date,
                                    amount,
                                    &merchant_name,
                                    trntype.as_deref(),
                                    account_id,
                                ));
                            }
                        }
                        (None, _) => errors.push(format!(
                            "OFX transaction {} has an invalid DTPOSTED value",
                            transaction_index
                        )),
                        (_, Err(_)) => errors.push(format!(
                            "OFX transaction {} has an invalid TRNAMT value",
                            transaction_index
                        )),
                    }
                }
                _ => errors.push(format!(
                    "OFX transaction {} is missing required statement fields",
                    transaction_index
                )),
            }

            remaining = &after_start[end + "</STMTTRN>".len()..];
        }

        if transaction_index == 0 {
            errors.push("No OFX transactions were found in the file".to_string());
        }

        ParseOutcome {
            transactions,
            truncated_count,
            errors,
        }
    }

    pub fn detect_csv_mapping(headers: &StringRecord) -> CsvColumnMapping {
        CsvColumnMapping {
            date_column: detect_header(headers, &["date"]),
            amount_column: detect_header(
                headers,
                &["amount", "transaction amount", "signed amount"],
            ),
            debit_column: detect_header(headers, &["debit amount", "debit"]),
            credit_column: detect_header(headers, &["credit amount", "credit"]),
            description_column: detect_header(
                headers,
                &["description", "memo", "merchant", "name"],
            ),
        }
    }

    pub fn parse_csv(content: &str, mapping: &CsvColumnMapping, account_id: &Uuid) -> ParseOutcome {
        if let Err(message) = read_csv_headers(content) {
            return ParseOutcome {
                transactions: Vec::new(),
                truncated_count: 0,
                errors: vec![message],
            };
        }

        let today = Utc::now().date_naive();
        let cutoff = five_year_cutoff(today);
        let mut reader = csv_reader(content);
        let headers = match reader.headers() {
            Ok(headers) => headers.clone(),
            Err(err) => {
                return ParseOutcome {
                    transactions: Vec::new(),
                    truncated_count: 0,
                    errors: vec![format!("Unable to read CSV headers: {}", err)],
                };
            }
        };

        let mut transactions = Vec::new();
        let mut errors = Vec::new();
        let mut truncated_count = 0usize;

        for (index, record) in reader.records().enumerate() {
            let row_number = index + 2;
            match record {
                Ok(row) => match Transaction::from_csv_row(&headers, &row, mapping, account_id) {
                    Ok(transaction) => {
                        if transaction.date < cutoff {
                            truncated_count += 1;
                        } else {
                            transactions.push(transaction);
                        }
                    }
                    Err(err) => errors.push(format!("Row {}: {}", row_number, err)),
                },
                Err(err) => errors.push(format!("Row {}: {}", row_number, err)),
            }
        }

        ParseOutcome {
            transactions,
            truncated_count,
            errors,
        }
    }

    pub fn validate_file(content: &str, filename: &str, account_id: &Uuid) -> ValidateResponse {
        let Some(file_format) = detect_format(filename) else {
            return ValidateResponse {
                valid: false,
                format: None,
                transaction_count: 0,
                truncated_count: 0,
                date_range: None,
                preview_rows: Vec::new(),
                suggested_csv_mapping: None,
                csv_headers: Vec::new(),
                sample_csv_rows: Vec::new(),
                errors: vec![format!("Unsupported file extension for '{}'", filename)],
            };
        };

        match file_format {
            ImportFileFormat::Ofx
            | ImportFileFormat::Qfx
            | ImportFileFormat::Qbo
            | ImportFileFormat::Qbx => {
                let outcome = Self::parse_ofx(content, account_id);
                let preview_rows = preview_transactions(&outcome.transactions);
                let transaction_count = outcome.transactions.len() as i64;
                let date_range = date_range_for_transactions(&outcome.transactions);
                ValidateResponse {
                    valid: !outcome.transactions.is_empty() || outcome.errors.is_empty(),
                    format: Some(file_format),
                    transaction_count,
                    truncated_count: outcome.truncated_count as i64,
                    date_range,
                    preview_rows,
                    suggested_csv_mapping: None,
                    csv_headers: Vec::new(),
                    sample_csv_rows: Vec::new(),
                    errors: outcome.errors,
                }
            }
            ImportFileFormat::Csv => {
                let csv_headers = match read_csv_headers(content) {
                    Ok(headers) => headers,
                    Err(message) => {
                        return ValidateResponse {
                            valid: false,
                            format: Some(ImportFileFormat::Csv),
                            transaction_count: 0,
                            truncated_count: 0,
                            date_range: None,
                            preview_rows: Vec::new(),
                            suggested_csv_mapping: None,
                            csv_headers: Vec::new(),
                            sample_csv_rows: Vec::new(),
                            errors: vec![message],
                        };
                    }
                };

                let header_record = StringRecord::from(csv_headers.clone());
                let suggested_csv_mapping = Self::detect_csv_mapping(&header_record);
                let sample_csv_rows = collect_csv_samples(content, &csv_headers);
                let mapping_errors = csv_mapping_errors(&suggested_csv_mapping);

                if !mapping_errors.is_empty() {
                    return ValidateResponse {
                        valid: false,
                        format: Some(ImportFileFormat::Csv),
                        transaction_count: 0,
                        truncated_count: 0,
                        date_range: None,
                        preview_rows: Vec::new(),
                        suggested_csv_mapping: Some(suggested_csv_mapping),
                        csv_headers: display_csv_headers(&csv_headers),
                        sample_csv_rows,
                        errors: mapping_errors,
                    };
                }

                let outcome = Self::parse_csv(content, &suggested_csv_mapping, account_id);
                let preview_rows = preview_transactions(&outcome.transactions);
                let transaction_count = outcome.transactions.len() as i64;
                let date_range = date_range_for_transactions(&outcome.transactions);
                let mut errors = outcome.errors;
                let valid = if outcome.transactions.is_empty() {
                    if errors.is_empty() {
                        errors.push(CSV_NO_TRANSACTION_ROWS_ERROR.to_string());
                    }
                    false
                } else {
                    true
                };

                ValidateResponse {
                    valid,
                    format: Some(ImportFileFormat::Csv),
                    transaction_count,
                    truncated_count: outcome.truncated_count as i64,
                    date_range,
                    preview_rows,
                    suggested_csv_mapping: Some(suggested_csv_mapping),
                    csv_headers: display_csv_headers(&csv_headers),
                    sample_csv_rows,
                    errors,
                }
            }
        }
    }
}

pub fn detect_import_format(filename: &str) -> Option<ImportFileFormat> {
    detect_format(filename)
}

pub fn read_csv_headers(content: &str) -> Result<Vec<String>, String> {
    let mut reader = csv_reader(content);
    let headers = reader
        .headers()
        .map_err(|err| format!("Unable to read CSV headers: {}", err))?;
    let raw_headers: Vec<String> = headers.iter().map(|value| value.to_string()).collect();

    if raw_headers.is_empty() || raw_headers.iter().all(|header| header.trim().is_empty()) {
        return Err(CSV_HEADER_REQUIRED_ERROR.to_string());
    }

    if row_looks_like_data(&raw_headers) {
        return Err(CSV_HEADER_ROW_LOOKS_LIKE_DATA_ERROR.to_string());
    }

    Ok(raw_headers)
}

fn csv_reader(content: &str) -> csv::Reader<&[u8]> {
    ReaderBuilder::new()
        .flexible(true)
        .trim(csv::Trim::All)
        .has_headers(true)
        .from_reader(content.as_bytes())
}

fn collect_csv_samples(content: &str, csv_headers: &[String]) -> Vec<Vec<String>> {
    let mut reader = csv_reader(content);
    if reader.headers().is_err() {
        return Vec::new();
    }

    let mut rows = vec![display_csv_headers(csv_headers)];
    rows.extend(
        reader
            .records()
            .take(MAX_PREVIEW_ROWS)
            .filter_map(|record| record.ok())
            .map(|row| row.iter().map(|value| value.to_string()).collect()),
    );
    rows
}

fn display_csv_headers(headers: &[String]) -> Vec<String> {
    headers
        .iter()
        .enumerate()
        .map(|(index, header)| {
            if header.trim().is_empty() {
                format!("Column {}", index + 1)
            } else {
                header.trim().to_string()
            }
        })
        .collect()
}

fn row_looks_like_data(cells: &[String]) -> bool {
    if row_contains_header_keywords(cells) {
        return false;
    }

    let mut data_like = 0;
    let mut non_empty = 0;
    for cell in cells {
        let value = cell.trim();
        if value.is_empty() {
            continue;
        }
        non_empty += 1;
        if looks_like_date(value) || looks_like_amount(value) {
            data_like += 1;
        }
    }

    non_empty > 0 && data_like * 2 >= non_empty
}

fn row_contains_header_keywords(cells: &[String]) -> bool {
    const KEYWORDS: &[&str] = &[
        "date",
        "description",
        "amount",
        "debit",
        "credit",
        "memo",
        "merchant",
        "name",
        "posted",
        "balance",
        "type",
        "category",
        "payee",
        "details",
    ];

    cells.iter().any(|cell| {
        let normalized = cell.trim().to_ascii_lowercase();
        KEYWORDS.iter().any(|keyword| normalized.contains(keyword))
    })
}

fn looks_like_date(value: &str) -> bool {
    ["%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%Y/%m/%d", "%m-%d-%Y"]
        .iter()
        .any(|format| NaiveDate::parse_from_str(value.trim(), format).is_ok())
}

fn looks_like_amount(value: &str) -> bool {
    let cleaned = value
        .trim()
        .replace(['$', ','], "")
        .replace('(', "-")
        .replace(')', "");
    if cleaned.is_empty() {
        return false;
    }
    Decimal::from_str(&cleaned).is_ok()
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

fn preview_transactions(transactions: &[Transaction]) -> Vec<PreviewTransaction> {
    transactions
        .iter()
        .take(MAX_PREVIEW_ROWS)
        .map(|transaction| PreviewTransaction {
            date: transaction.date,
            amount: transaction.amount,
            description: transaction
                .merchant_name
                .clone()
                .unwrap_or_else(|| "Unknown".to_string()),
        })
        .collect()
}

fn date_range_for_transactions(transactions: &[Transaction]) -> Option<ImportDateRange> {
    let mut dates = transactions.iter().map(|transaction| transaction.date);
    let first = dates.next()?;
    let (start_date, end_date) = dates.fold((first, first), |(min_date, max_date), date| {
        (min_date.min(date), max_date.max(date))
    });

    Some(ImportDateRange {
        start_date,
        end_date,
    })
}

fn detect_format(filename: &str) -> Option<ImportFileFormat> {
    let lower = filename.to_ascii_lowercase();
    if lower.ends_with(".csv") {
        Some(ImportFileFormat::Csv)
    } else if lower.ends_with(".qfx") {
        Some(ImportFileFormat::Qfx)
    } else if lower.ends_with(".qbo") {
        Some(ImportFileFormat::Qbo)
    } else if lower.ends_with(".qbx") {
        Some(ImportFileFormat::Qbx)
    } else if lower.ends_with(".ofx") {
        Some(ImportFileFormat::Ofx)
    } else {
        None
    }
}

fn detect_header(headers: &StringRecord, candidates: &[&str]) -> Option<String> {
    headers
        .iter()
        .find(|header| {
            let normalized = header.trim().to_ascii_lowercase();
            candidates
                .iter()
                .any(|candidate| normalized == candidate.trim().to_ascii_lowercase())
        })
        .map(|header| header.to_string())
}

fn extract_ofx_tag(block: &str, tag: &str) -> Option<String> {
    let open_tag = format!("<{}>", tag);
    let start = block.find(&open_tag)?;
    let remainder = &block[start + open_tag.len()..];
    let end = remainder.find('<').unwrap_or(remainder.len());
    Some(remainder[..end].trim().to_string())
}

fn parse_ofx_date(raw: &str) -> Option<NaiveDate> {
    let digits: String = raw
        .chars()
        .filter(|ch| ch.is_ascii_digit())
        .take(8)
        .collect();
    if digits.len() != 8 {
        return None;
    }

    NaiveDate::parse_from_str(&digits, "%Y%m%d").ok()
}

fn five_year_cutoff(today: NaiveDate) -> NaiveDate {
    today
        .with_year(today.year() - 5)
        .unwrap_or_else(|| today - chrono::Duration::days(FIVE_YEAR_DAY_WINDOW))
}
