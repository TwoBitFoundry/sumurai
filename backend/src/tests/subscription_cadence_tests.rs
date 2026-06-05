use crate::services::subscription_detection::cadence::{
    amount_coefficient_of_variation, classify_cadence, normalize_to_monthly_cost, Cadence,
};

#[test]
fn monthly_gaps_are_classified_as_monthly() {
    let gaps = vec![30, 31, 29, 30];
    assert_eq!(classify_cadence(&gaps), Some(Cadence::Monthly));
}

#[test]
fn weekly_gaps_are_classified_as_weekly() {
    let gaps = vec![7, 7, 7];
    assert_eq!(classify_cadence(&gaps), Some(Cadence::Weekly));
}

#[test]
fn biweekly_gaps_are_classified_as_biweekly() {
    let gaps = vec![14, 14, 13];
    assert_eq!(classify_cadence(&gaps), Some(Cadence::Biweekly));
}

#[test]
fn annual_gaps_are_classified_as_annual() {
    let gaps = vec![365, 366];
    assert_eq!(classify_cadence(&gaps), Some(Cadence::Annual));
}

#[test]
fn quarterly_gaps_are_classified_as_quarterly() {
    let gaps = vec![90, 91, 92];
    assert_eq!(classify_cadence(&gaps), Some(Cadence::Quarterly));
}

#[test]
fn irregular_gaps_return_none() {
    let gaps = vec![7, 30, 90];
    assert_eq!(classify_cadence(&gaps), None);
}

#[test]
fn empty_or_single_gap_returns_none() {
    assert_eq!(classify_cadence(&[]), None);
    assert_eq!(classify_cadence(&[30]), Some(Cadence::Monthly));
}

#[test]
fn low_variance_amounts_pass_cv_gate() {
    let amounts = vec![9.99, 9.99, 9.99, 9.99];
    assert!(amount_coefficient_of_variation(&amounts) < 0.15);
}

#[test]
fn high_variance_amounts_fail_cv_gate() {
    let amounts = vec![9.99, 19.99, 4.99, 14.99];
    assert!(amount_coefficient_of_variation(&amounts) >= 0.15);
}

#[test]
fn monthly_cost_is_unchanged_for_monthly_cadence() {
    let cost = normalize_to_monthly_cost(9.99, Cadence::Monthly);
    assert!((cost - 9.99).abs() < 0.01);
}

#[test]
fn weekly_cost_is_multiplied_by_four_point_three_for_monthly() {
    let cost = normalize_to_monthly_cost(9.99, Cadence::Weekly);
    assert!((cost - 9.99 * 4.333).abs() < 0.1);
}

#[test]
fn annual_cost_is_divided_by_twelve_for_monthly() {
    let cost = normalize_to_monthly_cost(120.0, Cadence::Annual);
    assert!((cost - 10.0).abs() < 0.01);
}

#[test]
fn quarterly_cost_is_divided_by_three_for_monthly() {
    let cost = normalize_to_monthly_cost(30.0, Cadence::Quarterly);
    assert!((cost - 10.0).abs() < 0.01);
}
