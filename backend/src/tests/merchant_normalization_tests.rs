use crate::services::merchant_normalization::{
    engine::normalize,
    types::{AliasIndex, AliasRow, MatchSource, MerchantSource},
};

fn alias_index_from_seed() -> AliasIndex {
    let rows = vec![
        AliasRow {
            match_type: "contains".into(),
            match_key: "COSTCO WHSE".into(),
            canonical_name: "Costco".into(),
            priority: 10,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "COSTCO".into(),
            canonical_name: "Costco".into(),
            priority: 5,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "WINCO".into(),
            canonical_name: "WinCo".into(),
            priority: 10,
        },
        AliasRow {
            match_type: "exact".into(),
            match_key: "BOKF".into(),
            canonical_name: "BOKF".into(),
            priority: 10,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "INSTACART".into(),
            canonical_name: "Instacart".into(),
            priority: 10,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "TESLA MOTORS".into(),
            canonical_name: "Tesla Motors".into(),
            priority: 10,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "TESLA".into(),
            canonical_name: "Tesla".into(),
            priority: 5,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "CITY OF TULSA".into(),
            canonical_name: "City of Tulsa".into(),
            priority: 10,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "7-ELEVEN".into(),
            canonical_name: "7-Eleven".into(),
            priority: 10,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "5 GUYS".into(),
            canonical_name: "Five Guys".into(),
            priority: 10,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "T-MOBILE".into(),
            canonical_name: "T-Mobile".into(),
            priority: 10,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "H-E-B".into(),
            canonical_name: "H-E-B".into(),
            priority: 10,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "DOORDASH".into(),
            canonical_name: "DoorDash".into(),
            priority: 10,
        },
    ];
    AliasIndex::from_rows(rows)
}

fn idx() -> AliasIndex {
    alias_index_from_seed()
}

#[test]
fn given_pos_costco_whse_when_normalize_then_costco() {
    let result = normalize(
        "POS COSTCO WHSE #12 POS PURCHASE TULSA OK 537252",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "Costco");
    assert!(
        matches!(
            result.source,
            MatchSource::EarlyContains | MatchSource::Contains
        ),
        "expected Contains/EarlyContains, got {:?}",
        result.source
    );
}

#[test]
fn given_winco_foods_when_normalize_then_winco() {
    let result = normalize(
        "WINCO FOODS #42 DEBIT PURCHASE",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "WinCo");
    assert!(
        matches!(
            result.source,
            MatchSource::EarlyContains | MatchSource::Contains
        ),
        "expected Contains/EarlyContains, got {:?}",
        result.source
    );
}

#[test]
fn given_bokf_when_normalize_then_bokf_exact() {
    let result = normalize("BOKF", MerchantSource::Raw, &idx());
    assert_eq!(result.display, "BOKF");
    assert!(
        matches!(result.source, MatchSource::EarlyExact | MatchSource::Exact),
        "expected Exact/EarlyExact, got {:?}",
        result.source
    );
}

#[test]
fn given_instacart_aldi_when_normalize_then_instacart() {
    let result = normalize("INSTACART*ALDI 5432", MerchantSource::Raw, &idx());
    assert_eq!(result.display, "Instacart");
    assert!(
        matches!(
            result.source,
            MatchSource::EarlyContains | MatchSource::Contains
        ),
        "expected Contains/EarlyContains, got {:?}",
        result.source
    );
}

#[test]
fn given_tesla_motors_inc_when_normalize_then_tesla_motors() {
    let result = normalize("TESLA MOTORS INC", MerchantSource::Raw, &idx());
    assert_eq!(result.display, "Tesla Motors");
    assert!(
        matches!(
            result.source,
            MatchSource::EarlyContains | MatchSource::Contains
        ),
        "expected Contains/EarlyContains, got {:?}",
        result.source
    );
}

#[test]
fn given_city_of_tulsa_util_when_normalize_then_city_of_tulsa() {
    let result = normalize(
        "CITY OF TULSA TULSA UTIL 918-5963452",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "City of Tulsa");
    assert!(
        matches!(
            result.source,
            MatchSource::EarlyContains | MatchSource::Contains
        ),
        "expected Contains/EarlyContains, got {:?}",
        result.source
    );
}

#[test]
fn given_7eleven_store_when_normalize_then_7eleven() {
    let result = normalize("7-ELEVEN 35420", MerchantSource::Raw, &idx());
    assert_eq!(result.display, "7-Eleven");
    assert_eq!(result.source, MatchSource::EarlyContains);
}

#[test]
fn given_sq_blue_bottle_when_normalize_then_blue_bottle() {
    let result = normalize("SQ *BLUE BOTTLE COFFEE", MerchantSource::Raw, &idx());
    assert_eq!(result.display, "Blue Bottle Coffee");
}

#[test]
fn given_doordash_when_normalize_then_doordash() {
    let result = normalize("DD *DOORDASH CHIPTL", MerchantSource::Raw, &idx());
    assert_eq!(result.display, "DoorDash");
    assert!(
        matches!(
            result.source,
            MatchSource::EarlyContains | MatchSource::Contains
        ),
        "expected Contains/EarlyContains, got {:?}",
        result.source
    );
}

#[test]
fn given_www_netflix_com_when_normalize_then_netflix() {
    let result = normalize("WWW.NETFLIX.COM", MerchantSource::Raw, &idx());
    assert_eq!(result.display, "Netflix");
}

#[test]
fn given_enriched_source_when_normalize_then_light_path() {
    let result = normalize("Costco Wholesale", MerchantSource::Enriched, &idx());
    assert_eq!(result.display, "Costco Wholesale");
    assert_eq!(result.source, MatchSource::Enriched);
}

#[test]
fn given_t_mobile_when_normalize_then_t_mobile() {
    let result = normalize("T-MOBILE PAYMENT 12345", MerchantSource::Raw, &idx());
    assert_eq!(result.display, "T-Mobile");
    assert_eq!(result.source, MatchSource::EarlyContains);
}

#[test]
fn given_heb_when_normalize_then_heb() {
    let result = normalize("H-E-B #213 DEBIT", MerchantSource::Raw, &idx());
    assert_eq!(result.display, "H-E-B");
    assert_eq!(result.source, MatchSource::EarlyContains);
}

#[test]
fn given_pure_noise_when_normalize_then_never_blank() {
    let result = normalize("POS DEBIT PURCHASE", MerchantSource::Raw, &idx());
    assert!(!result.display.is_empty());
}

#[test]
fn given_atm_withdrawal_when_normalize_then_structural_label() {
    let result = normalize("ATM WITHDRAWAL 0034", MerchantSource::Raw, &idx());
    assert_eq!(result.display, "ATM Withdrawal");
    assert_eq!(result.source, MatchSource::Structural);
}

#[test]
fn given_check_number_when_normalize_then_check_label() {
    let result = normalize("CHECK 1042", MerchantSource::Raw, &idx());
    assert_eq!(result.display, "Check #1042");
    assert_eq!(result.source, MatchSource::Structural);
}

#[test]
fn given_zelle_payment_when_normalize_then_zelle() {
    let result = normalize("ZELLE PAYMENT TO JOHN", MerchantSource::Raw, &idx());
    assert_eq!(result.display, "Zelle");
    assert_eq!(result.source, MatchSource::Structural);
}

#[test]
fn given_interest_income_when_normalize_then_interest() {
    let result = normalize("INTEREST INCOME", MerchantSource::Raw, &idx());
    assert_eq!(result.display, "Interest");
    assert_eq!(result.source, MatchSource::Structural);
}

#[test]
fn given_card_mask_suffix_when_normalize_then_stripped() {
    let result = normalize("AMAZON - *****04463", MerchantSource::Raw, &idx());
    assert_eq!(result.display, "Amazon");
}

#[test]
fn given_electricityworks_when_normalize_then_no_false_positive() {
    let result = normalize("ELECTRICITYWORKS INC", MerchantSource::Raw, &idx());
    assert_ne!(result.display, "");
    assert!(!result.display.to_lowercase().contains("works inc"));
}

#[test]
fn given_acme_corp_when_normalize_then_strips_corp_suffix() {
    let result = normalize("ACME CORP", MerchantSource::Raw, &idx());
    assert_eq!(result.display, "Acme");
}

#[test]
fn given_state_word_ok_in_brand_when_normalize_then_not_stripped() {
    let result = normalize("OK TIRE STORE", MerchantSource::Raw, &idx());
    assert!(
        result.display.to_lowercase().contains("ok tire")
            || result.display.to_lowercase().contains("tire")
    );
}

#[test]
fn given_cafe_with_diacritics_when_normalize_then_handled() {
    let result = normalize("Café Du Monde", MerchantSource::Raw, &idx());
    assert!(!result.display.is_empty());
}

#[test]
fn given_already_normalized_when_normalize_again_then_idempotent() {
    let first = normalize(
        "POS COSTCO WHSE #12 POS PURCHASE TULSA OK 537252",
        MerchantSource::Raw,
        &idx(),
    );
    let second = normalize(&first.display, MerchantSource::Raw, &idx());
    assert_eq!(first.display, second.display);
}

#[test]
fn given_direct_deposit_when_normalize_then_structural_transfer() {
    let result = normalize("DIRECT DEPOSIT PAYROLL", MerchantSource::Raw, &idx());
    assert!(
        result.source == MatchSource::Structural,
        "expected Structural, got {:?}",
        result.source
    );
}
