pub const SYSTEM_CATEGORY_SLUGS: &[&str] = &[
    "BANK_FEES",
    "ENTERTAINMENT",
    "FOOD_AND_DRINK",
    "GENERAL_MERCHANDISE",
    "GENERAL_SERVICES",
    "GOVERNMENT_AND_NON_PROFIT",
    "HOME_IMPROVEMENT",
    "INCOME",
    "LOAN_PAYMENTS",
    "MEDICAL",
    "OTHER",
    "PERSONAL_CARE",
    "RENT_AND_UTILITIES",
    "SHOPPING",
    "TRANSFER_IN",
    "TRANSFER_OUT",
    "TRANSPORTATION",
    "TRAVEL",
];

pub const SYSTEM_CATEGORY_LABELS: &[(&str, &str)] = &[
    ("BANK_FEES", "Bank Fees"),
    ("ENTERTAINMENT", "Entertainment"),
    ("FOOD_AND_DRINK", "Food & Drink"),
    ("GENERAL_MERCHANDISE", "Merch"),
    ("GENERAL_SERVICES", "Services"),
    ("GOVERNMENT_AND_NON_PROFIT", "Govt & Non Profit"),
    ("HOME_IMPROVEMENT", "Home"),
    ("INCOME", "Income"),
    ("LOAN_PAYMENTS", "Loan Payments"),
    ("MEDICAL", "Medical"),
    ("OTHER", "Other"),
    ("PERSONAL_CARE", "Personal Care"),
    ("RENT_AND_UTILITIES", "Bills"),
    ("SHOPPING", "Shopping"),
    ("TRANSFER_IN", "Transfer In"),
    ("TRANSFER_OUT", "Transfer Out"),
    ("TRANSPORTATION", "Transport"),
    ("TRAVEL", "Travel"),
];

pub fn system_category_display_label(slug: &str) -> Option<&'static str> {
    SYSTEM_CATEGORY_LABELS
        .iter()
        .find(|(key, _)| *key == slug)
        .map(|(_, label)| *label)
}
