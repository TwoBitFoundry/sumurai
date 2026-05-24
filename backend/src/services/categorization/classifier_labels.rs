#![allow(dead_code)]

use crate::models::predicted_category::{Confidence, PredictedCategory};
use rust_decimal::Decimal;

const MEDIUM_CONFIDENCE_FLOOR: f32 = 0.75;
const HIGH_CONFIDENCE_FLOOR: f32 = 0.90;

pub fn format_classifier_input(amount: &Decimal, description: &str) -> String {
    let direction = if amount.is_sign_negative() {
        "[debit]"
    } else {
        "[credit]"
    };
    format!("{direction} {}", description.trim())
}

pub fn pfc_primary_for_classifier_label(label: &str, input: &str) -> Option<&'static str> {
    match label {
        "Education" => Some("GENERAL_SERVICES"),
        "Entertainment" => Some("ENTERTAINMENT"),
        "Fees" => Some("BANK_FEES"),
        "Groceries" | "Restaurants" => Some("FOOD_AND_DRINK"),
        "Healthcare" => Some("MEDICAL"),
        "Income" => Some("INCOME"),
        "Insurance" => Some("GENERAL_SERVICES"),
        "Mortgage" => Some("LOAN_PAYMENTS"),
        "Personal Care" => Some("PERSONAL_CARE"),
        "Rent" | "Utilities" => Some("RENT_AND_UTILITIES"),
        "Shopping" => Some("SHOPPING"),
        "Subscription" => Some("ENTERTAINMENT"),
        "Transfer" => {
            if input.trim_start().starts_with("[credit]") {
                Some("TRANSFER_IN")
            } else {
                Some("TRANSFER_OUT")
            }
        }
        "Transportation" => Some("TRANSPORTATION"),
        "Travel" => Some("TRAVEL"),
        _ => None,
    }
}

pub fn classify_logits(labels: &[String], logits: &[f32], input: &str) -> PredictedCategory {
    if labels.len() != logits.len() || labels.is_empty() {
        return other_prediction();
    }

    let probabilities = softmax(logits);
    let Some((best_index, best_score)) = probabilities
        .iter()
        .enumerate()
        .max_by(|left, right| left.1.total_cmp(right.1))
    else {
        return other_prediction();
    };

    if *best_score < MEDIUM_CONFIDENCE_FLOOR {
        return other_prediction();
    }

    let Some(primary) = pfc_primary_for_classifier_label(&labels[best_index], input) else {
        return other_prediction();
    };

    PredictedCategory {
        primary: primary.to_string(),
        confidence: if *best_score >= HIGH_CONFIDENCE_FLOOR {
            Confidence::High
        } else {
            Confidence::Medium
        },
    }
}

pub fn deterministic_prediction(input: &str) -> Option<PredictedCategory> {
    let label = deterministic_label(input)?;
    let primary = pfc_primary_for_classifier_label(label, input)?;

    Some(PredictedCategory {
        primary: primary.to_string(),
        confidence: Confidence::High,
    })
}

fn deterministic_label(input: &str) -> Option<&'static str> {
    let normalized = normalized_text(input);
    let is_credit = input.trim_start().starts_with("[credit]");

    if has_any(
        &normalized,
        &["overdraft", "atm", "service", "maintenance", "late", "fee"],
    ) {
        return Some("Fees");
    }

    if has_any(&normalized, &["xfer"]) {
        return Some("Transfer");
    }

    if is_credit
        && has_any(
            &normalized,
            &[
                "payroll",
                "payout",
                "deposit",
                "salary",
                "interest",
                "refund",
                "cashback",
                "benefit",
                "directdep",
            ],
        )
    {
        return Some("Income");
    }

    if has_any(&normalized, &["mortgage", "loan", "escrow", "principal"]) {
        return Some("Mortgage");
    }

    if has_any(&normalized, &["apartment", "rent", "property", "lease"]) {
        return Some("Rent");
    }

    if has_any(
        &normalized,
        &[
            "pharmacy",
            "prescription",
            "rx",
            "doctor",
            "dental",
            "dentist",
            "vision",
            "hospital",
            "urgent",
            "medical",
            "copay",
        ],
    ) {
        return Some("Healthcare");
    }

    if has_any(
        &normalized,
        &["barber", "salon", "spa", "beauty", "nail", "gym", "fitness"],
    ) {
        return Some("Personal Care");
    }

    if has_any(
        &normalized,
        &[
            "airline", "airlines", "hotel", "motel", "lodging", "resort", "rental", "airport",
            "cruise",
        ],
    ) {
        return Some("Travel");
    }

    if has_any(
        &normalized,
        &[
            "fuel",
            "charging",
            "parking",
            "toll",
            "rideshare",
            "taxi",
            "transit",
            "dmv",
            "gasoline",
        ],
    ) {
        return Some("Transportation");
    }

    if has_any(
        &normalized,
        &[
            "electric",
            "utility",
            "utilities",
            "water",
            "gas",
            "internet",
            "phone",
            "trash",
            "sewer",
            "solar",
        ],
    ) {
        return Some("Utilities");
    }

    if has_any(
        &normalized,
        &[
            "grocery",
            "groceries",
            "supermarket",
            "farmers",
            "warehouse",
        ],
    ) {
        return Some("Groceries");
    }

    if has_any(
        &normalized,
        &[
            "restaurant",
            "coffee",
            "cafe",
            "pizza",
            "burger",
            "taco",
            "delivery",
            "food",
        ],
    ) {
        return Some("Restaurants");
    }

    if has_any(
        &normalized,
        &["streaming", "subscription", "monthly", "annual", "saas"],
    ) {
        return Some("Subscription");
    }

    if has_any(
        &normalized,
        &[
            "movie",
            "theater",
            "cinema",
            "concert",
            "event",
            "ticket",
            "gaming",
            "sportsbook",
            "casino",
        ],
    ) {
        return Some("Entertainment");
    }

    if has_any(
        &normalized,
        &[
            "tuition",
            "student",
            "course",
            "certification",
            "textbook",
            "tutoring",
        ],
    ) {
        return Some("Education");
    }

    if has_any(&normalized, &["insurance", "premium", "warranty"]) {
        return Some("Insurance");
    }

    if has_any(
        &normalized,
        &[
            "wire",
            "ach",
            "transfer",
            "venmo",
            "zelle",
            "cashapp",
            "xfer",
            "brokerage",
            "sweep",
            "autopay",
            "cashier",
        ],
    ) {
        return Some("Transfer");
    }

    if has_any(
        &normalized,
        &[
            "department",
            "order",
            "ecommerce",
            "pet",
            "liquor",
            "hardware",
            "electronics",
        ],
    ) {
        return Some("Shopping");
    }

    None
}

fn softmax(logits: &[f32]) -> Vec<f32> {
    let max = logits.iter().copied().fold(f32::NEG_INFINITY, f32::max);
    let exp_values = logits
        .iter()
        .map(|value| (*value - max).exp())
        .collect::<Vec<_>>();
    let sum = exp_values.iter().sum::<f32>();
    if sum == 0.0 {
        return vec![0.0; logits.len()];
    }

    exp_values.iter().map(|value| value / sum).collect()
}

fn normalized_text(input: &str) -> String {
    input
        .to_ascii_lowercase()
        .chars()
        .filter(|value| value.is_ascii_alphanumeric())
        .collect::<String>()
}

fn has_any(normalized: &str, keywords: &[&str]) -> bool {
    keywords.iter().any(|keyword| normalized.contains(keyword))
}

fn other_prediction() -> PredictedCategory {
    PredictedCategory {
        primary: "OTHER".to_string(),
        confidence: Confidence::Low,
    }
}
