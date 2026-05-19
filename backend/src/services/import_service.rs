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
        match detect_format(filename) {
            Some(ImportFileFormat::Ofx) => {
                let outcome = Self::parse_ofx(content, account_id);
                let preview_rows = preview_transactions(&outcome.transactions);
                let transaction_count = outcome.transactions.len() as i64;
                let date_range = date_range_for_transactions(&outcome.transactions);
                ValidateResponse {
                    valid: !outcome.transactions.is_empty() || outcome.errors.is_empty(),
                    format: Some(ImportFileFormat::Ofx),
                    transaction_count,
                    truncated_count: outcome.truncated_count as i64,
                    date_range,
                    preview_rows,
                    suggested_csv_mapping: None,
                    sample_csv_rows: Vec::new(),
                    errors: outcome.errors,
                }
            }
            Some(ImportFileFormat::Csv) => {
                let mut reader = csv_reader(content);
                let headers = match reader.headers() {
                    Ok(headers) => headers.clone(),
                    Err(err) => {
                        return ValidateResponse {
                            valid: false,
                            format: Some(ImportFileFormat::Csv),
                            transaction_count: 0,
                            truncated_count: 0,
                            date_range: None,
                            preview_rows: Vec::new(),
                            suggested_csv_mapping: None,
                            sample_csv_rows: Vec::new(),
                            errors: vec![format!("Unable to read CSV headers: {}", err)],
                        };
                    }
                };

                let suggested_csv_mapping = Self::detect_csv_mapping(&headers);
                let sample_csv_rows = collect_csv_samples(content);
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
                        sample_csv_rows,
                        errors: mapping_errors,
                    };
                }

                let outcome = Self::parse_csv(content, &suggested_csv_mapping, account_id);
                let preview_rows = preview_transactions(&outcome.transactions);
                let transaction_count = outcome.transactions.len() as i64;
                let date_range = date_range_for_transactions(&outcome.transactions);
                let valid = !outcome.transactions.is_empty() || outcome.errors.is_empty();

                ValidateResponse {
                    valid,
                    format: Some(ImportFileFormat::Csv),
                    transaction_count,
                    truncated_count: outcome.truncated_count as i64,
                    date_range,
                    preview_rows,
                    suggested_csv_mapping: Some(suggested_csv_mapping),
                    sample_csv_rows,
                    errors: outcome.errors,
                }
            }
            None => ValidateResponse {
                valid: false,
                format: None,
                transaction_count: 0,
                truncated_count: 0,
                date_range: None,
                preview_rows: Vec::new(),
                suggested_csv_mapping: None,
                sample_csv_rows: Vec::new(),
                errors: vec![format!("Unsupported file extension for '{}'", filename)],
            },
        }
    }
}

fn csv_reader(content: &str) -> csv::Reader<&[u8]> {
    ReaderBuilder::new()
        .flexible(true)
        .trim(csv::Trim::All)
        .has_headers(true)
        .from_reader(content.as_bytes())
}

fn collect_csv_samples(content: &str) -> Vec<Vec<String>> {
    let mut reader = csv_reader(content);
    if reader.headers().is_err() {
        return Vec::new();
    }

    reader
        .records()
        .take(MAX_PREVIEW_ROWS)
        .filter_map(|record| record.ok())
        .map(|row| row.iter().map(|value| value.to_string()).collect())
        .collect()
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
    } else if lower.ends_with(".ofx") || lower.ends_with(".qfx") || lower.ends_with(".qbo") {
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
