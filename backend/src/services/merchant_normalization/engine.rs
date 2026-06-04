#![allow(dead_code)]

use unicode_normalization::UnicodeNormalization;

use crate::utils::merchant_name::normalize_merchant_display_case;

use super::rules::*;
use super::types::*;

pub fn normalize(raw: &str, src: MerchantSource, index: &AliasIndex) -> NormalizedMerchant {
    let original = raw.to_string();

    // Stage 0: Unicode preprocess — NFKC, collapse whitespace, uppercase for matching
    let nfkc: String = raw.nfkc().collect();
    let work = collapse_whitespace(&nfkc).trim().to_uppercase();

    // Stage 1: Enriched source light path — skip destructive stages
    if src == MerchantSource::Enriched {
        let display = normalize_merchant_display_case(raw.trim());
        let display = if display.is_empty() {
            normalize_merchant_display_case(&original)
        } else {
            display
        };
        return NormalizedMerchant {
            display,
            canonical_key: None,
            source: MatchSource::Enriched,
            confidence: 1.0,
        };
    }

    // Stage 2: Processor/aggregator split
    let work = apply_aggregator_split(work);

    // Stage 3: URL/punctuation normalize
    let work = normalize_url(&work);

    // Stage 3.5: Early structural check — preserve patterns that digit-stripping would destroy
    if let Some(display) = structural_label(&work) {
        return NormalizedMerchant {
            display,
            canonical_key: None,
            source: MatchSource::Structural,
            confidence: 0.85,
        };
    }

    // Stage 4: Early dictionary pass (protective) — before destructive cleaning
    if let Some(canonical) = lookup_contains(&work, index) {
        return NormalizedMerchant {
            display: canonical.clone(),
            canonical_key: Some(to_canonical_key(&canonical)),
            source: MatchSource::EarlyContains,
            confidence: 0.95,
        };
    }
    if let Some(canonical) = index.exact.get(&work) {
        return NormalizedMerchant {
            display: canonical.clone(),
            canonical_key: Some(to_canonical_key(canonical)),
            source: MatchSource::EarlyExact,
            confidence: 1.0,
        };
    }

    // Stage 5: Strip leading payment prefixes (loop until stable)
    let work = strip_leading_prefixes(work);

    // Stage 6: Strip trailing tails and codes
    let work = strip_trailing_tails(work);

    // Stage 7: Inline channel noise removal
    let work = strip_inline_noise(work);

    // Stage 8: Geographic suffix (guarded)
    let work = strip_geo_suffix(work);

    // Stage 9: Corporate suffix strip
    let work = strip_corporate_suffixes(work);

    // Stage 10: Collapse repeated tokens
    let work = collapse_repeated_tokens(work);

    // Stage 11: Canonical lookup (DB)
    if let Some(canonical) = lookup_contains(&work, index) {
        return NormalizedMerchant {
            display: canonical.clone(),
            canonical_key: Some(to_canonical_key(&canonical)),
            source: MatchSource::Contains,
            confidence: 0.9,
        };
    }
    if let Some(canonical) = index.exact.get(work.trim()) {
        return NormalizedMerchant {
            display: canonical.clone(),
            canonical_key: Some(to_canonical_key(canonical)),
            source: MatchSource::Exact,
            confidence: 1.0,
        };
    }

    // Stage 12: Structural fallback
    if let Some(display) = structural_label(&work) {
        return NormalizedMerchant {
            display,
            canonical_key: None,
            source: MatchSource::Structural,
            confidence: 0.85,
        };
    }

    // Stage 13: Title-case fallback
    let display = title_case_fallback(&work);

    // Stage 14: Finalize
    let display = finalize(display, &original);

    NormalizedMerchant {
        display,
        canonical_key: None,
        source: MatchSource::Fallback,
        confidence: 0.5,
    }
}

fn collapse_whitespace(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn to_canonical_key(name: &str) -> String {
    name.chars()
        .filter(|c| c.is_alphanumeric())
        .map(|c| c.to_ascii_lowercase())
        .collect()
}

fn apply_aggregator_split(work: String) -> String {
    for prefix in KEEP_MERCHANT_PREFIXES {
        let upper = prefix.to_uppercase();
        if work.starts_with(&upper) {
            let rest = work[upper.len()..].trim().to_string();
            if !rest.is_empty() {
                return rest;
            }
        }
    }

    for agg in KEEP_AGGREGATOR {
        if word_boundary_contains(&work, agg) {
            return agg.to_string();
        }
    }

    if let Some(rest) = work.strip_prefix(DD_STAR_PREFIX) {
        let rest = rest.trim().to_string();
        if !rest.is_empty() {
            return rest;
        }
    }

    let star_pos = work.find('*');
    if let Some(pos) = star_pos {
        let before = work[..pos].trim();
        let after = work[pos + 1..].trim();
        let before_is_processor = !before.is_empty() && !before.contains(' ') && before.len() <= 12;
        if !after.is_empty() && KEEP_AGGREGATOR.contains(&before) {
            return before.to_string();
        }
        if !after.is_empty() && before_is_processor {
            return after.to_string();
        }
    }

    work
}

fn normalize_url(work: &str) -> String {
    let s = RE_URL_PREFIX.replace(work, "").to_string();
    let s = RE_URL_SUFFIX.replace(&s, "").to_string();
    s.replace('.', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn strip_leading_prefixes(mut work: String) -> String {
    loop {
        let trimmed = work.trim().to_string();
        let mut changed = false;
        for prefix in LEADING_PREFIXES {
            if let Some(stripped) = trimmed.strip_prefix(prefix) {
                let rest = stripped.trim().to_string();
                if !rest.is_empty() {
                    work = rest;
                    changed = true;
                    break;
                }
            }
        }
        if !changed {
            break;
        }
    }
    work
}

fn strip_trailing_tails(work: String) -> String {
    // Cut from first ` - `
    let s = RE_TRAILING_DASH_SEGMENT.replace(&work, "").to_string();
    // Strip card masks
    let s = RE_CARD_MASK.replace_all(&s, "").to_string();
    // Strip phone numbers
    let s = RE_PHONE.replace_all(&s, "").to_string();
    // Strip date patterns
    let s = RE_DATE.replace_all(&s, "").to_string();
    // Strip trailing digit runs ≥3 from right
    strip_trailing_digit_runs(s.trim().to_string())
}

fn strip_trailing_digit_runs(mut s: String) -> String {
    loop {
        let trimmed = s.trim_end();
        let last_token = trimmed.split_whitespace().next_back();
        match last_token {
            Some(tok) if tok.chars().all(|c| c.is_ascii_digit()) && tok.len() >= 3 => {
                s = trimmed[..trimmed.len() - tok.len()].trim_end().to_string();
            }
            _ => break,
        }
    }
    s
}

fn strip_inline_noise(work: String) -> String {
    let s = RE_STORE_NUMBER.replace_all(&work, "").to_string();
    let s = RE_INLINE_NOISE.replace_all(&s, "").to_string();
    collapse_whitespace(s.trim())
}

fn strip_geo_suffix(work: String) -> String {
    let tokens: Vec<&str> = work.split_whitespace().collect();
    if tokens.len() < 2 {
        return work;
    }

    let last = tokens[tokens.len() - 1];
    if US_STATES.contains(last) && tokens.len() >= 2 {
        let without_state = tokens[..tokens.len() - 1].join(" ");
        let second_last = tokens[tokens.len() - 2];
        if second_last.chars().all(|c| c.is_ascii_alphabetic()) && !without_state.trim().is_empty()
        {
            return without_state;
        }
    }

    work
}

fn strip_corporate_suffixes(work: String) -> String {
    let mut tokens: Vec<&str> = work.split_whitespace().collect();
    if tokens.len() <= 1 {
        return work;
    }
    while tokens.len() > 1 {
        let last = tokens[tokens.len() - 1];
        if CORPORATE_SUFFIXES.contains(&last) {
            tokens.pop();
        } else {
            break;
        }
    }
    tokens.join(" ")
}

fn collapse_repeated_tokens(work: String) -> String {
    let tokens: Vec<&str> = work.split_whitespace().collect();
    let mut out: Vec<&str> = Vec::new();
    for token in &tokens {
        if out.last().map(|t| *t == *token).unwrap_or(false) {
            continue;
        }
        out.push(token);
    }
    out.join(" ")
}

fn lookup_contains(work: &str, index: &AliasIndex) -> Option<String> {
    for (key, canonical, _priority) in &index.contains {
        if word_boundary_contains(work, key) {
            return Some(canonical.clone());
        }
    }
    None
}

fn word_boundary_contains(haystack: &str, needle: &str) -> bool {
    let pos = haystack.find(needle);
    let Some(idx) = pos else {
        return false;
    };
    let before_ok = idx == 0 || !haystack[..idx].ends_with(|c: char| c.is_alphanumeric());
    let end = idx + needle.len();
    let after_ok =
        end == haystack.len() || !haystack[end..].starts_with(|c: char| c.is_alphanumeric());
    before_ok && after_ok
}

fn structural_label(work: &str) -> Option<String> {
    if let Some(caps) = RE_CHECK.captures(work) {
        let num = caps.get(1).map(|m| m.as_str()).unwrap_or("");
        return Some(format!("Check #{}", num));
    }

    if RE_DIRECT_DEPOSIT.is_match(work) {
        return Some("Payroll".to_string());
    }

    if RE_TRANSFER.is_match(work) {
        return Some("Transfer".to_string());
    }

    let upper = work.to_uppercase();
    for (keyword, label) in STRUCTURAL_PATTERNS.iter() {
        if word_boundary_contains(&upper, keyword) {
            return Some(label.to_string());
        }
    }

    None
}

fn title_case_fallback(work: &str) -> String {
    normalize_merchant_display_case(work)
}

fn finalize(display: String, original: &str) -> String {
    let trimmed = display
        .trim_matches(|c: char| !c.is_alphanumeric())
        .to_string();

    let trimmed = if trimmed.is_empty() {
        normalize_merchant_display_case(original.trim())
    } else {
        trimmed
    };

    let trimmed = if trimmed.is_empty() {
        original.trim().to_string()
    } else {
        trimmed
    };

    if trimmed.len() > 64 {
        trimmed[..64].to_string()
    } else {
        trimmed
    }
}
