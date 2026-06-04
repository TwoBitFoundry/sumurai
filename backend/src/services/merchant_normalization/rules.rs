#![allow(dead_code)]

use once_cell::sync::Lazy;
use regex::Regex;
use std::collections::HashSet;

pub static LEADING_PREFIXES: &[&str] = &[
    "ACH DEBIT",
    "ACH CREDIT",
    "ACH",
    "CHK CARD PUR",
    "CHECKCARD",
    "CARD PURCHASE",
    "PRE-AUTHORIZED",
    "PRE-AUTH",
    "PREAUTHORIZED",
    "PREAUTH",
    "PIN PURCHASE",
    "PIN PUR",
    "PIN",
    "ELECTRONIC",
    "WITHDRAWAL",
    "BILL PAY",
    "BILLPAY",
    "AUTOPAY",
    "RECURRING",
    "RECUR",
    "MOBILE",
    "ONLINE",
    "PURCHASE",
    "MASTERCARD",
    "VISA",
    "DCARD",
    "CREDIT",
    "DEBIT",
    "POS",
    "EFT",
    "WEB",
    "SIG",
    "PMT",
    "PAYMENT",
];

pub static CORPORATE_SUFFIXES: &[&str] = &["PLLC", "LLP", "LLC", "INC", "CORP", "LTD", "CO", "THE"];

pub static SMALL_WORDS: &[&str] = &["of", "and", "the", "at", "for", "to", "in", "on", "a", "an"];

pub static US_STATES: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    [
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
        "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
        "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
        "VA", "WA", "WV", "WI", "WY", "DC",
    ]
    .iter()
    .copied()
    .collect()
});

pub static KEEP_AGGREGATOR: &[&str] = &["INSTACART", "GRUBHUB", "UBER EATS", "UBEREATS"];

pub static KEEP_MERCHANT_PREFIXES: &[&str] = &[
    "SQ *", "TST*", "TOAST*", "PAYPAL *", "PY *", "SP *", "WPY*", "IZ *", "EB *",
];

pub static DD_STAR_PREFIX: &str = "DD *";

pub static STRUCTURAL_PATTERNS: Lazy<Vec<(&'static str, &'static str)>> = Lazy::new(|| {
    vec![
        ("ATM", "ATM Withdrawal"),
        ("INTEREST", "Interest"),
        ("DIVIDEND", "Interest"),
        ("SERVICE CHARGE", "Bank Fee"),
        ("FEE", "Bank Fee"),
        ("ZELLE", "Zelle"),
        ("VENMO", "Venmo"),
        ("CASH APP", "Cash App"),
    ]
});

pub static RE_CARD_MASK: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"[*xX]{2,}\d+|\d{0,2}[*]+\d+").unwrap());

pub static RE_AUTH_CODE: Lazy<Regex> = Lazy::new(|| Regex::new(r"\b[A-Z0-9]{6,}\b").unwrap());

pub static RE_DIGIT_RUN: Lazy<Regex> = Lazy::new(|| Regex::new(r"\b\d{3,}\b").unwrap());

pub static RE_STORE_NUMBER: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"#\s*\d+|\bSTORE\s+\d+\b").unwrap());

pub static RE_DATE: Lazy<Regex> = Lazy::new(|| Regex::new(r"\b\d{2}/\d{2}\b").unwrap());

pub static RE_PHONE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\b\d{10}\b").unwrap());

pub static RE_GEO_SUFFIX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\b([A-Z][A-Z0-9 ]{1,20})\s+([A-Z]{2})\s*$").unwrap());

pub static RE_TRAILING_DASH_SEGMENT: Lazy<Regex> = Lazy::new(|| Regex::new(r"\s+-\s+.*$").unwrap());

pub static RE_URL_PREFIX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)^(?:https?://|www\.)").unwrap());

pub static RE_URL_SUFFIX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\.(com|net|org|io|co)$").unwrap());

pub static RE_CHECK: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)^check\s+#?(\d+)").unwrap());

pub static RE_INLINE_NOISE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"\b(?:POS PURCHASE|CHK CARD PUR|CPPWDRAWAL|POS|PURCHASE|DEBIT)\b|\bN\.?A\.?\b|\bUS[A]?\b",
    )
    .unwrap()
});

pub static RE_DIRECT_DEPOSIT: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\b(?:DIRECT\s+DEPOSIT|PAYROLL|ACH\s+CREDIT)\b").unwrap());

pub static RE_TRANSFER: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\b(?:TRANSFER|WIRE\s+TRANSFER)\b").unwrap());
