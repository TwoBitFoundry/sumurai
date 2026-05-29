use crate::models::{
    account::Account,
    auth::{User, WebAuthnCredential},
    budget::Budget,
    custom_category::CustomCategory,
    plaid::ProviderConnection,
    transaction::Transaction,
    transaction_category_override::TransactionCategoryOverride,
};

fn fixed_to_utc(dt: chrono::DateTime<chrono::FixedOffset>) -> chrono::DateTime<chrono::Utc> {
    dt.with_timezone(&chrono::Utc)
}

fn opt_fixed_to_utc(
    dt: Option<chrono::DateTime<chrono::FixedOffset>>,
) -> Option<chrono::DateTime<chrono::Utc>> {
    dt.map(fixed_to_utc)
}

fn opt_fixed_to_utc_required(
    dt: Option<chrono::DateTime<chrono::FixedOffset>>,
) -> chrono::DateTime<chrono::Utc> {
    dt.map(fixed_to_utc).unwrap_or_else(chrono::Utc::now)
}

impl From<entity::users::Model> for User {
    fn from(m: entity::users::Model) -> Self {
        User {
            id: m.id,
            email: m.email,
            password_hash: m.password_hash,
            provider: m.provider,
            created_at: opt_fixed_to_utc_required(m.created_at),
            updated_at: opt_fixed_to_utc_required(m.updated_at),
            onboarding_completed: m.onboarding_completed,
        }
    }
}

impl From<entity::transactions::Model> for Transaction {
    fn from(m: entity::transactions::Model) -> Self {
        Transaction {
            id: m.id,
            account_id: m.account_id.unwrap_or_default(),
            user_id: m.user_id,
            provider_account_id: None,
            provider_transaction_id: m.provider_transaction_id,
            amount: m.amount,
            date: m.date,
            merchant_name: m.merchant_name,
            category_primary: m.category_primary,
            category_detailed: m.category_detailed,
            category_confidence: m.category_confidence,
            payment_channel: m.payment_channel,
            pending: m.pending.unwrap_or(false),
            created_at: opt_fixed_to_utc(m.created_at),
        }
    }
}

impl From<entity::accounts::Model> for Account {
    fn from(m: entity::accounts::Model) -> Self {
        Account {
            id: m.id,
            user_id: m.user_id,
            provider_account_id: m.provider_account_id,
            provider_connection_id: m.provider_connection_id,
            name: m.name,
            account_type: m.account_type,
            balance_current: m.balance_current,
            mask: m.mask,
            institution_name: None,
            provider_conn_id: None,
        }
    }
}

impl From<entity::budgets::Model> for Budget {
    fn from(m: entity::budgets::Model) -> Self {
        Budget {
            id: m.id,
            user_id: m.user_id,
            category: m.category,
            amount: m.amount,
            created_at: opt_fixed_to_utc_required(m.created_at),
            updated_at: opt_fixed_to_utc_required(m.updated_at),
        }
    }
}

impl From<entity::user_custom_categories::Model> for CustomCategory {
    fn from(m: entity::user_custom_categories::Model) -> Self {
        CustomCategory {
            id: m.id,
            user_id: m.user_id,
            display_name: m.display_name,
            lookup_key: m.lookup_key,
            created_at: opt_fixed_to_utc(m.created_at),
            updated_at: opt_fixed_to_utc(m.updated_at),
        }
    }
}

impl From<entity::provider_connections::Model> for ProviderConnection {
    fn from(m: entity::provider_connections::Model) -> Self {
        ProviderConnection {
            id: m.id,
            user_id: m.user_id.unwrap_or_default(),
            item_id: m.item_id,
            provider: m.provider,
            is_connected: m.is_connected,
            last_sync_at: opt_fixed_to_utc(m.last_sync_at),
            connected_at: opt_fixed_to_utc(m.connected_at),
            disconnected_at: opt_fixed_to_utc(m.disconnected_at),
            institution_id: m.institution_id,
            institution_name: m.institution_name,
            institution_logo_url: m.institution_logo_url,
            sync_cursor: m.sync_cursor,
            transaction_count: m.transaction_count.unwrap_or(0),
            account_count: m.account_count.unwrap_or(0),
            created_at: opt_fixed_to_utc(m.created_at),
            updated_at: opt_fixed_to_utc(m.updated_at),
        }
    }
}

impl From<entity::transaction_category_overrides::Model> for TransactionCategoryOverride {
    fn from(m: entity::transaction_category_overrides::Model) -> Self {
        TransactionCategoryOverride {
            id: m.id,
            user_id: m.user_id,
            normalized_merchant: m.normalized_merchant,
            category_name: m.category_name,
            custom_category_id: m.custom_category_id,
            created_at: opt_fixed_to_utc(m.created_at),
            updated_at: opt_fixed_to_utc(m.updated_at),
        }
    }
}

impl From<entity::webauthn_credentials::Model> for WebAuthnCredential {
    fn from(m: entity::webauthn_credentials::Model) -> Self {
        WebAuthnCredential {
            id: m.id,
            user_id: m.user_id,
            credential_id: m.credential_id,
            passkey: m.passkey,
            name: m.name,
            created_at: fixed_to_utc(m.created_at),
            last_used_at: opt_fixed_to_utc(m.last_used_at),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use uuid::Uuid;

    fn fixed_now() -> chrono::DateTime<chrono::FixedOffset> {
        chrono::Utc::now().fixed_offset()
    }

    #[test]
    fn user_from_entity_maps_all_fields() {
        let id = Uuid::new_v4();
        let now = fixed_now();
        let m = entity::users::Model {
            id,
            email: "test@example.com".to_string(),
            password_hash: Some("hash".to_string()),
            provider: "plaid".to_string(),
            created_at: Some(now),
            updated_at: Some(now),
            onboarding_completed: true,
        };
        let user = User::from(m);
        assert_eq!(user.id, id);
        assert_eq!(user.email, "test@example.com");
        assert_eq!(user.password_hash, Some("hash".to_string()));
        assert_eq!(user.provider, "plaid");
        assert!(user.onboarding_completed);
    }

    #[test]
    fn user_from_entity_uses_now_for_null_timestamps() {
        let before = Utc::now();
        let m = entity::users::Model {
            id: Uuid::new_v4(),
            email: "x@x.com".to_string(),
            password_hash: Some("h".to_string()),
            provider: "".to_string(),
            created_at: None,
            updated_at: None,
            onboarding_completed: false,
        };
        let user = User::from(m);
        assert!(user.created_at >= before);
        assert!(user.updated_at >= before);
    }

    #[test]
    fn transaction_from_entity_maps_pending_none_to_false() {
        use chrono::NaiveDate;
        use rust_decimal::Decimal;
        let m = entity::transactions::Model {
            id: Uuid::new_v4(),
            account_id: Some(Uuid::new_v4()),
            user_id: None,
            provider_transaction_id: None,
            amount: Decimal::ZERO,
            date: NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
            merchant_name: None,
            category_primary: "OTHER".to_string(),
            category_detailed: "OTHER".to_string(),
            category_confidence: "".to_string(),
            payment_channel: None,
            pending: None,
            created_at: None,
            normalized_merchant: None,
        };
        let txn = Transaction::from(m);
        assert!(!txn.pending);
        assert!(txn.created_at.is_none());
        assert!(txn.provider_account_id.is_none());
    }

    #[test]
    fn budget_from_entity_maps_amounts_and_timestamps() {
        use rust_decimal_macros::dec;
        let id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let now = fixed_now();
        let m = entity::budgets::Model {
            id,
            user_id,
            category: "FOOD_AND_DRINK".to_string(),
            amount: dec!(500.00),
            created_at: Some(now),
            updated_at: Some(now),
        };
        let budget = Budget::from(m);
        assert_eq!(budget.id, id);
        assert_eq!(budget.user_id, user_id);
        assert_eq!(budget.category, "FOOD_AND_DRINK");
        assert_eq!(budget.amount, dec!(500.00));
    }

    #[test]
    fn custom_category_from_entity_maps_fields() {
        let id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let m = entity::user_custom_categories::Model {
            id,
            user_id,
            display_name: "Coffee".to_string(),
            lookup_key: "coffee".to_string(),
            created_at: None,
            updated_at: None,
        };
        let cat = CustomCategory::from(m);
        assert_eq!(cat.id, id);
        assert_eq!(cat.display_name, "Coffee");
        assert_eq!(cat.lookup_key, "coffee");
        assert!(cat.created_at.is_none());
    }

    #[test]
    fn provider_connection_from_entity_unwraps_optional_counts() {
        let id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let now = fixed_now();
        let m = entity::provider_connections::Model {
            id,
            user_id: Some(user_id),
            item_id: "item-1".to_string(),
            provider: "plaid".to_string(),
            is_connected: true,
            last_sync_at: Some(now),
            connected_at: Some(now),
            disconnected_at: None,
            institution_id: Some("ins-1".to_string()),
            institution_name: Some("Demo Bank".to_string()),
            institution_logo_url: None,
            sync_cursor: None,
            transaction_count: None,
            account_count: None,
            created_at: Some(now),
            updated_at: Some(now),
        };
        let conn = ProviderConnection::from(m);
        assert_eq!(conn.transaction_count, 0);
        assert_eq!(conn.account_count, 0);
        assert_eq!(conn.user_id, user_id);
    }

    #[test]
    fn account_from_entity_sets_institution_fields_none() {
        use rust_decimal_macros::dec;
        let id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let m = entity::accounts::Model {
            id,
            user_id: Some(user_id),
            provider_account_id: Some("provider-acct".to_string()),
            provider_connection_id: None,
            name: "Checking".to_string(),
            account_type: "checking".to_string(),
            balance_current: Some(dec!(1200.00)),
            mask: Some("1234".to_string()),
            created_at: None,
            updated_at: None,
            subtype: None,
            official_name: None,
        };
        let account = Account::from(m);
        assert_eq!(account.id, id);
        assert_eq!(account.user_id, Some(user_id));
        assert_eq!(account.name, "Checking");
        assert_eq!(account.balance_current, Some(dec!(1200.00)));
        assert!(account.institution_name.is_none());
        assert!(account.provider_conn_id.is_none());
    }

    #[test]
    fn transaction_category_override_from_entity_maps_fields() {
        let id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let custom_cat_id = Uuid::new_v4();
        let now = fixed_now();
        let m = entity::transaction_category_overrides::Model {
            id,
            user_id,
            normalized_merchant: "starbucks".to_string(),
            category_name: "Coffee".to_string(),
            custom_category_id: Some(custom_cat_id),
            created_at: Some(now),
            updated_at: Some(now),
        };
        let o = TransactionCategoryOverride::from(m);
        assert_eq!(o.id, id);
        assert_eq!(o.normalized_merchant, "starbucks");
        assert_eq!(o.custom_category_id, Some(custom_cat_id));
    }
}
