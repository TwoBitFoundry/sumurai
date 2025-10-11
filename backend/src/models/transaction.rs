use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{de::IgnoredAny, Deserialize, Deserializer, Serialize};
use std::str::FromStr;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Transaction {
    pub id: Uuid,
    pub account_id: Uuid,
    pub user_id: Option<Uuid>,
    pub plaid_account_id: Option<String>,
    pub plaid_transaction_id: Option<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TransactionWithAccount {
    pub id: Uuid,
    pub account_id: Uuid,
    pub user_id: Option<Uuid>,
    pub plaid_account_id: Option<String>,
    pub plaid_transaction_id: Option<String>,
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

#[derive(Serialize)]
pub struct SyncTransactionsResponse {
    pub transactions: Vec<Transaction>,
    pub metadata: SyncMetadata,
}

#[derive(Serialize)]
pub struct SyncMetadata {
    pub transaction_count: i32,
    pub account_count: i32,
    pub sync_timestamp: String,
    pub start_date: String,
    pub end_date: String,
    pub connection_updated: bool,
}

impl Transaction {
    #[allow(dead_code)]
    pub fn new_mock(
        account_id: Uuid,
        amount: Decimal,
        date: NaiveDate,
        merchant_name: Option<String>,
        category_primary: String,
        category_detailed: String,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            account_id,
            user_id: None,
            plaid_account_id: None,
            plaid_transaction_id: None,
            amount,
            date,
            merchant_name,
            category_primary,
            category_detailed,
            category_confidence: "VERY_HIGH".to_string(),
            payment_channel: Some("in_store".to_string()),
            pending: false,
            created_at: Some(chrono::Utc::now()),
        }
    }

    pub fn from_teller(teller_txn: &serde_json::Value, account_id: &Uuid) -> Self {
        let amount_str = teller_txn["amount"].as_str().unwrap_or("0");
        let amount = Decimal::from_str(amount_str)
            .unwrap_or(Decimal::ZERO)
            .abs();

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
            plaid_account_id: None,
            plaid_transaction_id: teller_txn["id"].as_str().map(String::from),
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

    fn normalize_teller_category(teller_cat: &str) -> String {
        match teller_cat {
            "general" => "GENERAL_MERCHANDISE",
            "service" => "GENERAL_SERVICES",
            _ => "OTHER",
        }
        .to_string()
    }
}
