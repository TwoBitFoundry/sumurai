use crate::models::analytics::BalanceCategory;
use crate::services::analytics_service::AnalyticsService;

#[test]
fn maps_account_types_to_balance_categories() {
    // Direct types
    assert_eq!(
        AnalyticsService::map_account_to_balance_category("depository", None),
        BalanceCategory::Cash
    );
    assert_eq!(
        AnalyticsService::map_account_to_balance_category("checking", None),
        BalanceCategory::Cash
    );
    assert_eq!(
        AnalyticsService::map_account_to_balance_category("cash", None),
        BalanceCategory::Cash
    );
    assert_eq!(
        AnalyticsService::map_account_to_balance_category("credit", None),
        BalanceCategory::Credit
    );
    assert_eq!(
        AnalyticsService::map_account_to_balance_category("loans", None),
        BalanceCategory::Loan
    );
    assert_eq!(
        AnalyticsService::map_account_to_balance_category("loan", None),
        BalanceCategory::Loan
    );
    assert_eq!(
        AnalyticsService::map_account_to_balance_category("investment", None),
        BalanceCategory::Investments
    );
    assert_eq!(
        AnalyticsService::map_account_to_balance_category("investments", None),
        BalanceCategory::Investments
    );
    assert_eq!(
        AnalyticsService::map_account_to_balance_category("savings", None),
        BalanceCategory::Cash
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
