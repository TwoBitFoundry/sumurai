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
            match_type: "contains".into(),
            match_key: "BOKF".into(),
            canonical_name: "BOKF".into(),
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
            match_key: "OK NATURAL GAS".into(),
            canonical_name: "Oklahoma Natural Gas".into(),
            priority: 10,
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
            match_key: "APPLECARD".into(),
            canonical_name: "Apple Card".into(),
            priority: 10,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "DOORDASH".into(),
            canonical_name: "DoorDash".into(),
            priority: 10,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "PLAYSTATION".into(),
            canonical_name: "PlayStation".into(),
            priority: 10,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "BURGER KING".into(),
            canonical_name: "Burger King".into(),
            priority: 10,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "OPENAI".into(),
            canonical_name: "OpenAI".into(),
            priority: 10,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "CURSOR AI POWERED IDE".into(),
            canonical_name: "Cursor".into(),
            priority: 10,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "QT".into(),
            canonical_name: "QuikTrip".into(),
            priority: 5,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "PAYPAL".into(),
            canonical_name: "PayPal".into(),
            priority: 10,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "NETFLIX".into(),
            canonical_name: "Netflix".into(),
            priority: 10,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "TURBOTAX".into(),
            canonical_name: "TurboTax".into(),
            priority: 10,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "BRAUMS".into(),
            canonical_name: "Braums".into(),
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
        matches!(
            result.source,
            MatchSource::EarlyExact
                | MatchSource::Exact
                | MatchSource::EarlyContains
                | MatchSource::Contains
        ),
        "expected Exact/Contains, got {:?}",
        result.source
    );
}

#[test]
fn given_bokf_bank_description_when_normalize_then_bokf() {
    let result = normalize(
        "BOKF, NA BOKF, NA - *****04463",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "BOKF");
}

#[test]
fn given_ok_natural_gas_when_normalize_then_ong() {
    let result = normalize(
        "OK NATURAL GAS UTIL PAYMT - *****8931078006",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "Oklahoma Natural Gas");
}

#[test]
fn given_applecard_payment_when_normalize_then_apple_card() {
    let result = normalize(
        "APPLECARD GSBANK PAYMENT - 1293128",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "Apple Card");
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
fn given_multibyte_name_past_sixty_four_bytes_when_normalize_then_truncates_on_char_boundary() {
    let raw = format!("Cafe {}", "é".repeat(31));

    let result = normalize(&raw, MerchantSource::Raw, &idx());

    assert!(result.display.is_char_boundary(result.display.len()));
    assert!(result.display.len() <= 64);
    assert_eq!(result.display, format!("Cafe {}{}", "É", "é".repeat(28)));
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

#[test]
fn given_cursor_runon_when_normalize_then_cursor() {
    let result = normalize(
        "CURSOR AI POWERED IDE2261 Market Street STE 86466 SAN FRANCI10025 CA USA",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "Cursor");
}

#[test]
fn given_qt_with_address_when_normalize_then_quiktrip() {
    let result = normalize(
        "QT 10 7626 E. 61ST ST. TULSA 74133 OK USA",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "QuikTrip");
}

#[test]
fn given_openai_with_address_when_normalize_then_openai() {
    let result = normalize(
        "OPENAI 1455 3rd Street SAN FRANCI94158 CA USA",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "OpenAI");
}

#[test]
fn given_playstation_with_address_when_normalize_then_playstation() {
    let result = normalize(
        "PLAYSTATION 2207 BRIDGEPOINTE PKWY SAN MATEO 94404 CA USA",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "PlayStation");
}

#[test]
fn given_burger_king_with_address_when_normalize_then_burger_king() {
    let result = normalize(
        "BURGER KING #27826 Q0747TH STREET SOUTH WICHITA 67216 KS USA",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "Burger King");
}

#[test]
fn given_15th_street_vet_runon_when_normalize_then_15th_street_veterinary() {
    let result = normalize(
        "15TH STREET VETERINARY6231 East 15th Street TULSA 74112 OK USA",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "15th Street Veterinary");
}

#[test]
fn given_braums_with_leading_store_number_when_normalize_then_braums() {
    let result = normalize(
        "103 BRAUMS STORE 550 E 47th St S WICHITA 67216 KS USA",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "Braums");
}

#[test]
fn given_progressive_ins_with_address_when_normalize_then_progressive_ins() {
    let result = normalize(
        "PROGRESSIVE INS 6300 Wilson Mills Rd MAYFIELD VLG 44143 OH USA (RETURN)",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "Progressive Ins");
}

#[test]
fn given_dep_turbotax_when_normalize_then_turbotax() {
    let result = normalize(
        "DEP TURBOTAX IRS REFUND - *****0165",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "TurboTax");
}

#[test]
fn given_tst_music_city_hot_chi_runon_when_normalize_then_music_city_hot_chi() {
    let result = normalize(
        "TST*MUSIC CITY HOT CHI1820 N College Ave 180 Fort Collins 80524 CO USA",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "Music City Hot Chi");
}

#[test]
fn given_24_7_travel_when_normalize_then_24_7_travel() {
    let result = normalize(
        "24 7 TRAVEL ST 2710 COMMERCE RD GOODLAND 67735 KS USA",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "24 7 Travel");
}

#[test]
fn given_ngrok_inc_with_address_when_normalize_then_ngrok() {
    let result = normalize(
        "NGROK INC. 445 Bush St Floor 8 SAN FRANCI94108 CA USA",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "Ngrok");
}

#[test]
fn given_simplefin_bridge_po_box_when_normalize_then_simplefin_bridge() {
    let result = normalize(
        "SIMPLEFIN BRIDGE PO Box 7081 CHESTNUT M30502 GA USA",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "Simplefin Bridge");
}

#[test]
fn given_paypal_without_star_when_normalize_then_merchant() {
    let result = normalize("PAYPAL GITHUB", MerchantSource::Raw, &idx());
    assert_eq!(result.display, "Github");
}

#[test]
fn given_paypal_alone_when_normalize_then_paypal() {
    let result = normalize("PAYPAL", MerchantSource::Raw, &idx());
    assert_eq!(result.display, "PayPal");
}

#[test]
fn given_paypal_star_form_when_normalize_then_merchant() {
    let result = normalize("PAYPAL * NETFLIX", MerchantSource::Raw, &idx());
    assert_eq!(result.display, "Netflix");
}

#[test]
fn given_fsp_processor_with_address_when_normalize_then_bailey_brothers() {
    let result = normalize(
        "FSP*BAILEY BROTHERS PL800 INDUSTRIAL DR YUKON 73099 OK USA",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "Bailey Brothers");
}

#[test]
fn given_buc_ees_with_address_when_normalize_then_buc_ees() {
    let result = normalize(
        "BUC-EES #0060 5201 Nugget Road BETHOUD 80513 CO USA",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "Buc-Ees");
}

#[test]
fn given_ordinal_prefix_not_cut_before_alpha() {
    let result = normalize(
        "15TH STREET BURGER KING 1200 MAIN ST TULSA",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "Burger King");
}

#[test]
fn given_two_digit_leading_token_not_stripped() {
    let result = normalize(
        "24 7 TRAVEL ST 2710 COMMERCE RD",
        MerchantSource::Raw,
        &idx(),
    );
    assert_eq!(result.display, "24 7 Travel");
}

#[test]
fn given_three_digit_leading_token_stripped() {
    let result = normalize("103 BRAUMS STORE 550 E", MerchantSource::Raw, &idx());
    assert_eq!(result.display, "Braums");
}

#[test]
fn given_pure_alpha_no_boundary_unchanged() {
    let result = normalize("STARBUCKS", MerchantSource::Raw, &idx());
    assert_eq!(result.display, "Starbucks");
}
