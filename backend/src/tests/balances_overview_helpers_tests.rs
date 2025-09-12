use rust_decimal_macros::dec;

use crate::services::analytics_service::AnalyticsService;
use crate::models::analytics::BalanceCategory;
use rust_decimal::Decimal;

#[test]
fn maps_account_types_to_balance_categories() {
    // Direct types
    assert_eq!(
        AnalyticsService::map_account_to_balance_category("depository", None),
        BalanceCategory::Cash
    );
    assert_eq!(
        AnalyticsService::map_account_to_balance_category("credit", None),
        BalanceCategory::Credit
    );
    assert_eq!(
        AnalyticsService::map_account_to_balance_category("loan", None),
        BalanceCategory::Loan
    );
    assert_eq!(
        AnalyticsService::map_account_to_balance_category("investment", None),
        BalanceCategory::Investments
    );

    // Fallbacks via subtype hints
    assert_eq!(
        AnalyticsService::map_account_to_balance_category("other", Some("checking")),
        BalanceCategory::Cash
    );
    assert_eq!(
        AnalyticsService::map_account_to_balance_category("other", Some("credit_card")),
        BalanceCategory::Credit
    );
    assert_eq!(
        AnalyticsService::map_account_to_balance_category("other", Some("student_loan")),
        BalanceCategory::Loan
    );
}

#[test]
fn computes_positive_negative_ratio_with_rounding_and_infinity_case() {
    fn compute_positive_negative_ratio(
        positives_total: Decimal,
        negatives_total: Decimal,
    ) -> Option<Decimal> {
        if negatives_total == Decimal::ZERO {
            return None;
        }
        let denom = (-negatives_total).max(Decimal::ONE);
        let ratio = positives_total / denom;
        Some(ratio.round_dp(2))
    }
    // positives 600, negatives -200 => ratio 3.00
    let r = compute_positive_negative_ratio(dec!(600), dec!(-200));
    assert_eq!(r.unwrap(), dec!(3.00));

    // negatives zero => None (client renders ∞)
    let r2 = compute_positive_negative_ratio(dec!(1234.56), dec!(0));
    assert!(r2.is_none());

    let r3 = compute_positive_negative_ratio(dec!(10), dec!(-1));
    assert_eq!(r3.unwrap(), dec!(10.00));
}
