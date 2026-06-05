#![allow(dead_code)]

pub const EXCLUDED_MERCHANTS: &[&str] = &[
    "starbucks",
    "dunkindonuts",
    "mcdonalds",
    "chipotle",
    "subway",
    "dominos",
    "pizzahut",
    "panerabread",
    "wholefoodsmarket",
    "wholefoods",
    "traderjoes",
    "safeway",
    "kroger",
    "publix",
    "target",
    "walmart",
    "costco",
    "amazon",
    "lyft",
    "uber",
    "doordash",
    "grubhub",
    "instacart",
];

pub fn is_excluded(normalized: &str) -> bool {
    EXCLUDED_MERCHANTS.contains(&normalized)
}
