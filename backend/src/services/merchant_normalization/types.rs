use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
pub enum MatchSource {
    Enriched,
    EarlyContains,
    EarlyExact,
    Contains,
    Exact,
    Structural,
    Fallback,
}

#[derive(Debug, Clone, PartialEq)]
pub enum MerchantSource {
    Enriched,
    Raw,
}

#[derive(Debug, Clone)]
pub struct NormalizedMerchant {
    pub display: String,
    #[allow(dead_code)]
    pub canonical_key: Option<String>,
    #[allow(dead_code)]
    pub source: MatchSource,
    #[allow(dead_code)]
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AliasRow {
    pub match_type: String,
    pub match_key: String,
    pub canonical_name: String,
    pub priority: i32,
}

#[derive(Debug, Default)]
pub struct AliasIndex {
    pub exact: HashMap<String, String>,
    pub contains: Vec<(String, String, i32)>,
}

impl AliasIndex {
    pub fn from_rows(rows: Vec<AliasRow>) -> Self {
        let mut exact: HashMap<String, String> = HashMap::new();
        let mut contains: Vec<(String, String, i32)> = Vec::new();

        for row in rows {
            match row.match_type.as_str() {
                "exact" => {
                    exact.insert(row.match_key.to_uppercase(), row.canonical_name);
                }
                "contains" => {
                    contains.push((
                        row.match_key.to_uppercase(),
                        row.canonical_name,
                        row.priority,
                    ));
                }
                _ => {}
            }
        }

        contains.sort_by(|a, b| b.2.cmp(&a.2).then_with(|| b.0.len().cmp(&a.0.len())));

        Self { exact, contains }
    }
}
