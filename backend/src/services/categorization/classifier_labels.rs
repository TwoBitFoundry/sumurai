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

fn other_prediction() -> PredictedCategory {
    PredictedCategory {
        primary: "OTHER".to_string(),
        confidence: Confidence::Low,
    }
}
