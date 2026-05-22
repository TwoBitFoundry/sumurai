use crate::utils::merchant_name::{
    category_lookup_key, format_custom_category_display, normalize_merchant_for_match,
};

#[test]
fn normalize_merchant_for_match_strips_non_alpha_and_lowercases() {
    assert_eq!(normalize_merchant_for_match("STARBUCKS #123"), "starbucks");
    assert_eq!(normalize_merchant_for_match("STARBUCKS 4421"), "starbucks");
    assert_eq!(normalize_merchant_for_match("SHELL OIL 5512"), "shelloil");
    assert_eq!(normalize_merchant_for_match("NETFLIX.COM"), "netflixcom");
}

#[test]
fn normalize_merchant_for_match_punctuation_and_symbols() {
    assert_eq!(normalize_merchant_for_match("Co-ffee!"), "coffee");
    assert_eq!(normalize_merchant_for_match("AT&T Wireless"), "attwireless");
    assert_eq!(normalize_merchant_for_match("7-ELEVEN"), "eleven");
}

#[test]
fn normalize_merchant_for_match_leading_trailing_whitespace() {
    assert_eq!(normalize_merchant_for_match("  WALMART  "), "walmart");
}

#[test]
fn normalize_merchant_for_match_empty_and_numbers_only() {
    assert_eq!(normalize_merchant_for_match(""), "");
    assert_eq!(normalize_merchant_for_match("12345"), "");
}

#[test]
fn normalize_merchant_for_match_multibyte() {
    assert_eq!(normalize_merchant_for_match("Café Latte"), "caflatte");
}

#[test]
fn category_lookup_key_lowercases_trims_and_strips_trailing_s() {
    assert_eq!(category_lookup_key("  coffee   runs  "), "coffee run");
    assert_eq!(category_lookup_key("Foods"), "food");
    assert_eq!(category_lookup_key("Coffee"), "coffee");
    assert_eq!(category_lookup_key("Buses"), "buse");
}

#[test]
fn category_lookup_key_multi_word() {
    assert_eq!(category_lookup_key("Coffee Runs"), "coffee run");
    assert_eq!(category_lookup_key("FOOD AND DRINK"), "food and drink");
}

#[test]
fn format_custom_category_display_title_cases_each_word() {
    assert_eq!(format_custom_category_display("coffee runs"), "Coffee Runs");
    assert_eq!(format_custom_category_display("  food   "), "Food");
    assert_eq!(format_custom_category_display("dining out"), "Dining Out");
}

#[test]
fn format_custom_category_display_handles_already_cased() {
    assert_eq!(format_custom_category_display("Coffee"), "Coffee");
    assert_eq!(format_custom_category_display("COFFEE"), "Coffee");
}
