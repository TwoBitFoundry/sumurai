use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{de::IgnoredAny, Deserialize, Deserializer, Serialize};
use std::str::FromStr;
use utoipa::ToSchema;
use uuid::Uuid;

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
}

pub struct TransactionsQuery {
    pub search: Option<String>,
    pub account_ids: Vec<String>,
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
                        _ => {
                            map.next_value::<IgnoredAny>()?;
                        }
                    }
                }

                Ok(TransactionsQuery {
                    search: search.unwrap_or(None),
                    account_ids,
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
    pub fn from_teller(
        teller_txn: &serde_json::Value,
        account_id: &Uuid,
        provider_account_id: Option<&str>,
    ) -> Self {
        let amount_str = teller_txn["amount"].as_str().unwrap_or("0");
        let amount = Decimal::from_str(amount_str).unwrap_or(Decimal::ZERO).abs();

        let date = teller_txn["date"]
            .as_str()
            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
            .unwrap_or_else(|| chrono::Utc::now().date_naive());

        let category = teller_txn["details"]["category"]
            .as_str()
            .unwrap_or("general");

        let merchant_name = teller_txn["details"]["counterparty"]["name"]
            .as_str()
            .or_else(|| teller_txn["description"].as_str())
            .map(String::from);

        Self {
            id: Uuid::new_v4(),
            account_id: *account_id,
            user_id: None,
            provider_account_id: provider_account_id.map(String::from),
            provider_transaction_id: teller_txn["id"].as_str().map(String::from),
            amount,
            date,
            merchant_name,
            category_primary: Self::normalize_teller_category(category),
            category_detailed: String::new(),
            category_confidence: String::new(),
            payment_channel: None,
            pending: teller_txn["status"].as_str() != Some("posted"),
            created_at: Some(chrono::Utc::now()),
        }
    }

    pub fn from_plaid(plaid_txn: &serde_json::Value, account_id: &Uuid) -> Self {
        let amount = plaid_txn["amount"]
            .as_f64()
            .and_then(Decimal::from_f64_retain)
            .unwrap_or(Decimal::ZERO)
            .abs();

        let date = plaid_txn["date"]
            .as_str()
            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
            .unwrap_or_else(|| chrono::Utc::now().date_naive());

        let categories = plaid_txn["category"].as_array();
        let category_primary = categories
            .and_then(|arr| arr.first())
            .and_then(|v| v.as_str())
            .unwrap_or("OTHER")
            .to_string();

        let category_detailed = categories
            .and_then(|arr| arr.get(1))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        Self {
            id: Uuid::new_v4(),
            account_id: *account_id,
            user_id: None,
            provider_account_id: plaid_txn["account_id"].as_str().map(String::from),
            provider_transaction_id: plaid_txn["transaction_id"].as_str().map(String::from),
            amount,
            date,
            merchant_name: plaid_txn["merchant_name"]
                .as_str()
                .or_else(|| plaid_txn["name"].as_str())
                .map(String::from),
            category_primary,
            category_detailed,
            category_confidence: plaid_txn["personal_finance_category"]["confidence_level"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            payment_channel: plaid_txn["payment_channel"].as_str().map(String::from),
            pending: plaid_txn["pending"].as_bool().unwrap_or(false),
            created_at: Some(chrono::Utc::now()),
        }
    }

    fn normalize_teller_category(teller_cat: &str) -> String {
        match teller_cat {
            "general" => "GENERAL_MERCHANDISE",
            "service" => "GENERAL_SERVICES",
            _ => "OTHER",
        }
        .to_string()
    }
}
