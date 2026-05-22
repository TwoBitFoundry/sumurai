#[allow(dead_code)]
pub fn normalize_merchant_for_match(raw: &str) -> String {
    raw.chars()
        .filter(|c| c.is_ascii_alphabetic())
        .map(|c| c.to_ascii_lowercase())
        .collect()
}

#[allow(dead_code)]
pub fn category_lookup_key(raw: &str) -> String {
    raw.split_whitespace()
        .map(|word| {
            let lower = word.to_lowercase();
            lower.strip_suffix('s').unwrap_or(&lower).to_string()
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[allow(dead_code)]
pub fn format_custom_category_display(raw: &str) -> String {
    raw.split_whitespace()
        .map(title_case_segment)
        .collect::<Vec<_>>()
        .join(" ")
}

fn title_case_segment(segment: &str) -> String {
    let mut chars = segment.chars();
    match chars.next() {
        None => String::new(),
        Some(c) => {
            let mut out = c.to_uppercase().to_string();
            out.extend(chars.flat_map(|ch| ch.to_lowercase()));
            out
        }
    }
}

fn title_case_token(token: &str) -> String {
    token
        .split('-')
        .map(title_case_segment)
        .collect::<Vec<_>>()
        .join("-")
}

pub fn normalize_merchant_display_case(raw: &str) -> String {
    raw.split_whitespace()
        .map(title_case_token)
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}
