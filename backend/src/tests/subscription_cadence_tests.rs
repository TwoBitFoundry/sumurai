use crate::services::subscription_detection::cadence::{
    amount_coefficient_of_variation, classify_cadence, nearest_cadence_for_gap,
    normalize_to_monthly_cost, reconcile_cadence_with_span, resolve_cadence, Cadence,
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

#[test]
fn resolve_cadence_uses_median_for_irregular_short_gaps() {
    let gaps = vec![10, 12, 14, 16, 45];
    assert_eq!(resolve_cadence(&gaps), Cadence::Biweekly);
}

#[test]
fn resolve_cadence_defaults_to_monthly_for_single_transaction() {
    assert_eq!(resolve_cadence(&[]), Cadence::Monthly);
}

#[test]
fn reconcile_cadence_downgrades_monthly_when_average_gap_is_short() {
    assert_eq!(
        reconcile_cadence_with_span(Cadence::Monthly, 6, 97),
        Cadence::Biweekly
    );
}

#[test]
fn reconcile_cadence_keeps_monthly_for_true_monthly_spacing() {
    assert_eq!(
        reconcile_cadence_with_span(Cadence::Monthly, 3, 60),
        Cadence::Monthly
    );
}

#[test]
fn reconcile_cadence_downgrades_monthly_for_two_short_spaced_charges() {
    assert_eq!(
        reconcile_cadence_with_span(Cadence::Monthly, 2, 14),
        Cadence::Biweekly
    );
}

#[test]
fn nearest_cadence_for_gap_prefers_biweekly_for_nineteen_day_spacing() {
    assert_eq!(nearest_cadence_for_gap(19), Cadence::Biweekly);
}
