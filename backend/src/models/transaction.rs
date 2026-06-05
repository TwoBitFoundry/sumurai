use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{de::IgnoredAny, Deserialize, Deserializer, Serialize};
use std::str::FromStr;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::models::import::CsvColumnMapping;
use crate::models::simplefin::SimpleFinInstitutionSyncResult;
use crate::utils::merchant_name::normalize_merchant_display_case;
use csv::StringRecord;
use sha2::{Digest, Sha256};

#[allow(unused_imports)]
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[schema(example = json!({
    "id": "33333333-4444-5555-6666-777777777777",
    "account_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "user_id": "ffffffff-1111-2222-3333-444444444444",
    "provider_account_id": "acct-123",
    "provider_transaction_id": "txn-890",
    "amount": "24.99",
    "date": "2024-01-20",
    "merchant_name": "Sample Store",
    "category_primary": "SHOPPING",
    "category_detailed": "General merchandise",
    "category_confidence": "medium",
    "payment_channel": "online",
    "pending": false,
    "created_at": "2024-01-20T14:32:00Z"
}))]
pub struct Transaction {
    pub id: Uuid,
    pub account_id: Uuid,
    pub user_id: Option<Uuid>,
    pub provider_account_id: Option<String>,
    pub provider_transaction_id: Option<String>,
    #[schema(value_type = String)]
    pub amount: Decimal,
    pub date: NaiveDate,
    pub merchant_name: Option<String>,
    pub category_primary: String,
    pub category_detailed: String,
    pub category_confidence: String,
    pub payment_channel: Option<String>,
    pub pending: bool,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub original_merchant_name: Option<String>,
    pub normalized_merchant: Option<String>,
    pub normalization_source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[schema(example = json!({
    "id": "44444444-5555-6666-7777-888888888888",
    "account_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "user_id": "99999999-8888-7777-6666-555555555555",
    "provider_account_id": "acct-123",
    "provider_transaction_id": "txn-456",
    "amount": "42.75",
    "date": "2024-01-15",
    "merchant_name": "Coffee Collective",
    "category_primary": "FOOD_AND_DRINK",
    "category_detailed": "Coffee shop",
    "category_confidence": "high",
    "payment_channel": "in_store",
    "pending": false,
    "created_at": "2024-01-15T13:45:00Z",
    "account_name": "Demo Checking",
    "account_type": "depository",
    "account_mask": "1234"
}))]
pub struct TransactionWithAccount {
    pub id: Uuid,
    pub account_id: Uuid,
    pub user_id: Option<Uuid>,
    pub provider_account_id: Option<String>,
    pub provider_transaction_id: Option<String>,
    #[schema(value_type = String)]
    pub amount: Decimal,
    pub date: NaiveDate,
    pub merchant_name: Option<String>,
    pub category_primary: String,
    pub category_detailed: String,
    pub category_confidence: String,
    pub payment_channel: Option<String>,
    pub pending: bool,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub account_name: String,
    pub account_type: String,
    pub account_mask: Option<String>,
    pub is_custom: bool,
    pub is_overridden: bool,
    pub original_merchant_name: Option<String>,
    pub normalized_merchant: Option<String>,
    pub normalization_source: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema)]
#[schema(example = json!({
    "transactions": [{
        "id": "44444444-5555-6666-7777-888888888888",
        "account_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "user_id": "99999999-8888-7777-6666-555555555555",
        "provider_account_id": "acct-123",
        "provider_transaction_id": "txn-456",
        "amount": "42.75",
        "date": "2024-01-15",
        "merchant_name": "Coffee Collective",
        "category_primary": "FOOD_AND_DRINK",
        "category_detailed": "Coffee shop",
        "category_confidence": "high",
        "payment_channel": "in_store",
        "pending": false,
        "created_at": "2024-01-15T13:45:00Z",
        "account_name": "Demo Checking",
        "account_type": "depository",
        "account_mask": "1234"
    }],
    "total": 1,
    "page": 1,
    "page_size": 50
}))]
pub struct PaginatedTransactionsResponse {
    pub transactions: Vec<TransactionWithAccount>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[schema(example = json!({
    "amount": 42.75,
    "merchant": "Coffee Collective"
}))]
pub struct LargestTransaction {
    pub amount: f64,
    pub merchant: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[schema(example = json!({
    "total_count": 12,
    "total_spent": 184.25,
    "average_amount": 15.35,
    "largest": {
        "amount": 42.75,
        "merchant": "Coffee Collective"
    },
    "top_categories": ["FOOD_AND_DRINK", "TRANSPORTATION"]
}))]
pub struct TransactionsInsightsResponse {
    pub total_count: i64,
    pub total_spent: f64,
    pub average_amount: f64,
    pub largest: Option<LargestTransaction>,
    pub top_categories: Vec<String>,
}

pub struct TransactionsQuery {
    pub search: Option<String>,
    pub account_ids: Vec<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub category_primary: Option<String>,
}

impl<'de> Deserialize<'de> for TransactionsQuery {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct TransactionsQueryVisitor;

        impl<'de> serde::de::Visitor<'de> for TransactionsQueryVisitor {
            type Value = TransactionsQuery;

            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                formatter.write_str("transactions query parameters")
            }

            fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
            where
                A: serde::de::MapAccess<'de>,
            {
                let mut search: Option<Option<String>> = None;
                let mut account_ids: Vec<String> = Vec::new();
                let mut page: Option<Option<i64>> = None;
                let mut page_size: Option<Option<i64>> = None;
                let mut start_date: Option<Option<String>> = None;
                let mut end_date: Option<Option<String>> = None;
                let mut category_primary: Option<Option<String>> = None;

                while let Some(key) = map.next_key::<String>()? {
                    match key.as_str() {
                        "search" => {
                            if search.is_some() {
                                return Err(serde::de::Error::duplicate_field("search"));
                            }
                            search = Some(map.next_value()?);
                        }
                        "account_ids" | "account_ids[]" | "account_ids%5B%5D" => {
                            let values: VecOrOne<String> = map.next_value()?;
                            account_ids.extend(values.into_vec());
                        }
                        "page" => {
                            if page.is_some() {
                                return Err(serde::de::Error::duplicate_field("page"));
                            }
                            page = Some(map.next_value()?);
                        }
                        "page_size" => {
                            if page_size.is_some() {
                                return Err(serde::de::Error::duplicate_field("page_size"));
                            }
                            page_size = Some(map.next_value()?);
                        }
                        "start_date" => {
                            if start_date.is_some() {
                                return Err(serde::de::Error::duplicate_field("start_date"));
                            }
                            start_date = Some(map.next_value()?);
                        }
                        "end_date" => {
                            if end_date.is_some() {
                                return Err(serde::de::Error::duplicate_field("end_date"));
                            }
                            end_date = Some(map.next_value()?);
                        }
                        "category_primary" => {
                            if category_primary.is_some() {
                                return Err(serde::de::Error::duplicate_field("category_primary"));
                            }
                            category_primary = Some(map.next_value()?);
                        }
                        _ => {
                            map.next_value::<IgnoredAny>()?;
                        }
                    }
                }

                Ok(TransactionsQuery {
                    search: search.unwrap_or(None),
                    account_ids,
                    page: page.unwrap_or(None),
                    page_size: page_size.unwrap_or(None),
                    start_date: start_date.unwrap_or(None),
                    end_date: end_date.unwrap_or(None),
                    category_primary: category_primary.unwrap_or(None),
                })
            }
        }

        deserializer.deserialize_map(TransactionsQueryVisitor)
    }
}

#[derive(Deserialize)]
#[serde(untagged)]
enum VecOrOne<T> {
    Vec(Vec<T>),
    One(T),
}

impl<T> VecOrOne<T> {
    fn into_vec(self) -> Vec<T> {
        match self {
            VecOrOne::Vec(vec) => vec,
            VecOrOne::One(item) => vec![item],
        }
    }
}

#[derive(Serialize, ToSchema)]
#[schema(example = json!({
    "transactions": [{
        "id": "44444444-5555-6666-7777-888888888888",
        "account_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "user_id": "99999999-8888-7777-6666-555555555555",
        "provider_account_id": "acct-123",
        "provider_transaction_id": "txn-456",
        "amount": "42.75",
        "date": "2024-01-15",
        "merchant_name": "Coffee Collective",
        "category_primary": "FOOD_AND_DRINK",
        "category_detailed": "Coffee shop",
        "category_confidence": "high",
        "payment_channel": "in_store",
        "pending": false,
        "created_at": "2024-01-15T13:45:00Z"
    }],
    "metadata": {
        "transaction_count": 1,
        "account_count": 1,
        "sync_timestamp": "2024-01-15T14:00:00Z",
        "start_date": "2024-01-01",
        "end_date": "2024-01-15",
        "connection_updated": true
    }
}))]
pub struct SyncTransactionsResponse {
    pub transactions: Vec<Transaction>,
    pub metadata: SyncMetadata,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub simplefin_institution_results: Option<Vec<SimpleFinInstitutionSyncResult>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bridge_warnings: Option<Vec<String>>,
}

#[derive(Debug, Clone)]
pub struct ProviderTransactionsResult {
    pub transactions: Vec<Transaction>,
    pub page_count: i32,
}

#[derive(Serialize, ToSchema)]
#[schema(example = json!({
    "transaction_count": 25,
    "account_count": 2,
    "sync_timestamp": "2024-01-15T14:00:00Z",
    "start_date": "2024-01-01",
    "end_date": "2024-01-15",
    "connection_updated": true
}))]
pub struct SyncMetadata {
    pub transaction_count: i32,
    pub account_count: i32,
    pub sync_timestamp: String,
    pub start_date: String,
    pub end_date: String,
    pub connection_updated: bool,
}

impl Transaction {
    #[allow(clippy::too_many_arguments)]
    pub fn from_ofx(
        fitid: &str,
        date: NaiveDate,
        amount: Decimal,
        merchant_name: &str,
        trntype: Option<&str>,
        account_id: &Uuid,
    ) -> Self {
        let normalized_merchant_name = normalize_merchant_display_case(merchant_name.trim());
        let payment_channel = trntype
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|value| value.to_ascii_lowercase());

        Self {
            id: Uuid::new_v4(),
            account_id: *account_id,
            user_id: None,
            provider_account_id: None,
            provider_transaction_id: Some(Self::import_provider_transaction_id(account_id, fitid)),
            amount,
            date,
            merchant_name: if normalized_merchant_name.is_empty() {
                None
            } else {
                Some(normalized_merchant_name)
            },
            category_primary: "OTHER".to_string(),
            category_detailed: "OTHER".to_string(),
            category_confidence: String::new(),
            payment_channel,
            pending: false,
            created_at: Some(chrono::Utc::now()),
            original_merchant_name: Some(merchant_name.trim().to_string()),
            normalized_merchant: None,
            normalization_source: None,
        }
    }

    pub fn from_csv_row(
        headers: &StringRecord,
        row: &StringRecord,
        mapping: &CsvColumnMapping,
        account_id: &Uuid,
    ) -> Result<Self, String> {
        let date_raw = Self::csv_value(row, headers, mapping.date_column.as_deref(), "date")?;
        let date = Self::parse_csv_date(date_raw)
            .ok_or_else(|| format!("Unable to parse date value '{}'", date_raw))?;

        let description_raw = Self::csv_value(
            row,
            headers,
            mapping.description_column.as_deref(),
            "description",
        )?;
        let description = description_raw.trim();
        if description.is_empty() {
            return Err("Description is required".to_string());
        }

        let amount = if let Some(column) = mapping.amount_column.as_deref() {
            let value = Self::csv_value(row, headers, Some(column), "amount")?;
            Self::parse_csv_decimal(value)?
        } else {
            let debit = mapping
                .debit_column
                .as_deref()
                .and_then(|column| Self::csv_optional_value(row, headers, Some(column)));
            let credit = mapping
                .credit_column
                .as_deref()
                .and_then(|column| Self::csv_optional_value(row, headers, Some(column)));

            match (debit, credit) {
                (Some(debit), Some(credit))
                    if !debit.trim().is_empty() && !credit.trim().is_empty() =>
                {
                    return Err("Debit and credit columns both contain values".to_string());
                }
                (Some(debit), _) if !debit.trim().is_empty() => {
                    -Self::parse_csv_decimal(debit)?.abs()
                }
                (_, Some(credit)) if !credit.trim().is_empty() => {
                    Self::parse_csv_decimal(credit)?.abs()
                }
                _ => {
                    return Err("A debit, credit, or amount column must contain a value".to_string())
                }
            }
        };

        let provider_transaction_id =
            Self::csv_provider_transaction_id(account_id, date, &amount, description);

        Ok(Self {
            id: Uuid::new_v4(),
            account_id: *account_id,
            user_id: None,
            provider_account_id: None,
            provider_transaction_id: Some(provider_transaction_id),
            amount,
            date,
            merchant_name: Some(normalize_merchant_display_case(description)),
            category_primary: "OTHER".to_string(),
            category_detailed: "OTHER".to_string(),
            category_confidence: String::new(),
            payment_channel: None,
            pending: false,
            created_at: Some(chrono::Utc::now()),
            original_merchant_name: Some(description.to_string()),
            normalized_merchant: None,
            normalization_source: None,
        })
    }

    fn csv_value<'a>(
        row: &'a StringRecord,
        headers: &StringRecord,
        column: Option<&str>,
        field_name: &str,
    ) -> Result<&'a str, String> {
        let column = column.ok_or_else(|| format!("{} column is required", field_name))?;
        let index = headers
            .iter()
            .position(|header| header.trim().eq_ignore_ascii_case(column.trim()))
            .ok_or_else(|| format!("{} column '{}' was not found", field_name, column))?;
        row.get(index)
            .ok_or_else(|| format!("{} column '{}' is missing in row", field_name, column))
    }

    fn csv_optional_value<'a>(
        row: &'a StringRecord,
        headers: &StringRecord,
        column: Option<&str>,
    ) -> Option<&'a str> {
        let column = column?;
        let index = headers
            .iter()
            .position(|header| header.trim().eq_ignore_ascii_case(column.trim()))?;
        row.get(index)
    }

    fn parse_csv_date(raw: &str) -> Option<NaiveDate> {
        let value = raw.trim();
        ["%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%Y/%m/%d", "%m-%d-%Y"]
            .iter()
            .find_map(|format| NaiveDate::parse_from_str(value, format).ok())
    }

    fn parse_csv_decimal(raw: &str) -> Result<Decimal, String> {
        let cleaned = raw
            .trim()
            .replace(['$', ','], "")
            .replace('(', "-")
            .replace(')', "");

        Decimal::from_str(&cleaned).map_err(|_| format!("Unable to parse amount value '{}'", raw))
    }

    pub fn import_provider_transaction_id(account_id: &Uuid, external_id: &str) -> String {
        format!("import:{account_id}:{}", external_id.trim())
    }

    fn csv_provider_transaction_id(
        account_id: &Uuid,
        date: NaiveDate,
        amount: &Decimal,
        description: &str,
    ) -> String {
        let mut hasher = Sha256::new();
        hasher.update(account_id.to_string().as_bytes());
        hasher.update(b"|");
        hasher.update(date.to_string().as_bytes());
        hasher.update(b"|");
        hasher.update(amount.normalize().to_string().as_bytes());
        hasher.update(b"|");
        hasher.update(description.trim().as_bytes());
        hex::encode(hasher.finalize())
    }

    pub fn merchant_name_from_teller(teller_txn: &serde_json::Value) -> Option<String> {
        let raw = teller_txn["details"]["counterparty"]["name"]
            .as_str()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .or_else(|| {
                teller_txn["description"]
                    .as_str()
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
            })?;
        let normalized = normalize_merchant_display_case(raw);
        if normalized.is_empty() {
            None
        } else {
            Some(normalized)
        }
    }

    pub fn from_teller(
        teller_txn: &serde_json::Value,
        account_id: &Uuid,
        provider_account_id: Option<&str>,
    ) -> Self {
        let amount_str = teller_txn["amount"].as_str().unwrap_or("0");
        let raw_amount = Decimal::from_str(amount_str).unwrap_or(Decimal::ZERO);

        let date = teller_txn["date"]
            .as_str()
            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
            .unwrap_or_else(|| chrono::Utc::now().date_naive());

        let category = teller_txn["details"]["category"].as_str().unwrap_or("");
        let (category_primary, category_detailed) =
            Self::normalize_teller_category(category, &raw_amount);
        let amount = raw_amount;

        let merchant_name = Self::merchant_name_from_teller(teller_txn);

        Self {
            id: Uuid::new_v4(),
            account_id: *account_id,
            user_id: None,
            provider_account_id: provider_account_id.map(String::from),
            provider_transaction_id: teller_txn["id"].as_str().map(String::from),
            amount,
            date,
            merchant_name,
            category_primary,
            category_detailed,
            category_confidence: String::new(),
            payment_channel: None,
            pending: teller_txn["status"].as_str() != Some("posted"),
            created_at: Some(chrono::Utc::now()),
            original_merchant_name: None,
            normalized_merchant: None,
            normalization_source: None,
        }
    }

    pub fn merchant_name_from_plaid(plaid_txn: &serde_json::Value) -> Option<String> {
        let merchant = plaid_txn
            .get("merchant_name")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty());
        let name = plaid_txn
            .get("name")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty());
        for raw in [merchant, name].into_iter().flatten() {
            let normalized = normalize_merchant_display_case(raw);
            if !normalized.is_empty() {
                return Some(normalized);
            }
        }
        None
    }

    pub fn from_plaid(plaid_txn: &serde_json::Value, account_id: &Uuid) -> Self {
        let amount = plaid_txn["amount"]
            .as_f64()
            .and_then(Decimal::from_f64_retain)
            .map(|value| -value)
            .unwrap_or(Decimal::ZERO);

        let date = plaid_txn["date"]
            .as_str()
            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
            .unwrap_or_else(|| chrono::Utc::now().date_naive());

        let pfc = plaid_txn.get("personal_finance_category");
        let category_primary = pfc
            .and_then(|p| p.get("primary"))
            .and_then(|v| v.as_str())
            .unwrap_or("OTHER")
            .to_string();

        let category_detailed = pfc
            .and_then(|p| p.get("detailed"))
            .and_then(|v| v.as_str())
            .unwrap_or(&category_primary)
            .to_string();

        Self {
            id: Uuid::new_v4(),
            account_id: *account_id,
            user_id: None,
            provider_account_id: plaid_txn["account_id"].as_str().map(String::from),
            provider_transaction_id: plaid_txn["transaction_id"].as_str().map(String::from),
            amount,
            date,
            merchant_name: Self::merchant_name_from_plaid(plaid_txn),
            category_primary,
            category_detailed,
            category_confidence: pfc
                .and_then(|p| p.get("confidence_level"))
                .and_then(|v| v.as_str())
                .unwrap_or("MEDIUM")
                .to_string(),
            payment_channel: plaid_txn["payment_channel"].as_str().map(String::from),
            pending: plaid_txn["pending"].as_bool().unwrap_or(false),
            created_at: Some(chrono::Utc::now()),
            original_merchant_name: None,
            normalized_merchant: None,
            normalization_source: None,
        }
    }

    fn normalize_teller_category(teller_cat: &str, amount: &Decimal) -> (String, String) {
        let (primary, detailed) = match teller_cat {
            "accommodation" => ("TRAVEL", "TRAVEL_LODGING"),
            "advertising" => ("GENERAL_SERVICES", "GENERAL_SERVICES_CONSULTING_AND_LEGAL"),
            "bar" => ("ENTERTAINMENT", "ENTERTAINMENT_OTHER_ENTERTAINMENT"),
            "charity" => (
                "GOVERNMENT_AND_NON_PROFIT",
                "GOVERNMENT_AND_NON_PROFIT_DONATIONS",
            ),
            "clothing" => (
                "GENERAL_MERCHANDISE",
                "GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES",
            ),
            "dining" => ("FOOD_AND_DRINK", "FOOD_AND_DRINK_RESTAURANT"),
            "education" => ("GENERAL_SERVICES", "GENERAL_SERVICES_EDUCATION"),
            "electronics" => ("GENERAL_MERCHANDISE", "GENERAL_MERCHANDISE_ELECTRONICS"),
            "entertainment" => ("ENTERTAINMENT", "ENTERTAINMENT_OTHER_ENTERTAINMENT"),
            "fuel" => ("TRANSPORTATION", "TRANSPORTATION_GAS"),
            "general" => (
                "GENERAL_MERCHANDISE",
                "GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE",
            ),
            "groceries" => ("FOOD_AND_DRINK", "FOOD_AND_DRINK_GROCERIES"),
            "health" => ("MEDICAL", "MEDICAL_OTHER_MEDICAL"),
            "home" => (
                "HOME_IMPROVEMENT",
                "HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT",
            ),
            "income" => ("INCOME", "INCOME_WAGES"),
            "insurance" => ("GENERAL_SERVICES", "GENERAL_SERVICES_INSURANCE"),
            "investment" if !amount.is_sign_negative() => {
                ("TRANSFER_IN", "TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS")
            }
            "investment" => (
                "TRANSFER_OUT",
                "TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS",
            ),
            "loan" => ("LOAN_PAYMENTS", "LOAN_PAYMENTS_OTHER_PAYMENT"),
            "office" => ("GENERAL_MERCHANDISE", "GENERAL_MERCHANDISE_OFFICE_SUPPLIES"),
            "phone" => ("RENT_AND_UTILITIES", "RENT_AND_UTILITIES_TELEPHONE"),
            "service" => (
                "GENERAL_SERVICES",
                "GENERAL_SERVICES_OTHER_GENERAL_SERVICES",
            ),
            "shopping" => (
                "GENERAL_MERCHANDISE",
                "GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE",
            ),
            "software" => (
                "GENERAL_MERCHANDISE",
                "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES",
            ),
            "sport" => ("PERSONAL_CARE", "PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS"),
            "tax" => (
                "GOVERNMENT_AND_NON_PROFIT",
                "GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT",
            ),
            "transport" | "transportation" => {
                ("TRANSPORTATION", "TRANSPORTATION_OTHER_TRANSPORTATION")
            }
            "utilities" => (
                "RENT_AND_UTILITIES",
                "RENT_AND_UTILITIES_GAS_AND_ELECTRICITY",
            ),
            _ => ("OTHER", "OTHER"),
        };
        (primary.to_string(), detailed.to_string())
    }
}
