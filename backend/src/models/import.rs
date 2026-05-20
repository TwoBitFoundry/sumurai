#![allow(dead_code)]

use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[allow(unused_imports)]
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub enum ImportFileFormat {
    Csv,
    Ofx,
    Qfx,
    Qbo,
    Qbx,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct CsvColumnMapping {
    pub date_column: Option<String>,
    pub amount_column: Option<String>,
    pub debit_column: Option<String>,
    pub credit_column: Option<String>,
    pub description_column: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct ImportDateRange {
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct PreviewTransaction {
    pub date: NaiveDate,
    #[schema(value_type = String)]
    pub amount: Decimal,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct ValidateResponse {
    pub valid: bool,
    pub format: Option<ImportFileFormat>,
    pub transaction_count: i64,
    pub truncated_count: i64,
    pub date_range: Option<ImportDateRange>,
    pub preview_rows: Vec<PreviewTransaction>,
    pub suggested_csv_mapping: Option<CsvColumnMapping>,
    pub csv_headers: Vec<String>,
    pub sample_csv_rows: Vec<Vec<String>>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct ImportResponse {
    pub imported_count: i64,
    pub skipped_count: i64,
    pub truncated_count: i64,
    pub total_parsed: i64,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct ImportMultipartRequest {
    pub file: String,
    pub account_id: String,
    pub csv_mapping: Option<String>,
}
