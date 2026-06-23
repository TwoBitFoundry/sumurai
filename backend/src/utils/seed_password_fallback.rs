use crate::models::auth::User;

pub fn dev_password_auth_enabled() -> bool {
    cfg!(feature = "dev-seed")
}

pub fn seed_user_password_fallback(user: &User) -> bool {
    dev_password_auth_enabled()
        && user
            .password_hash
            .as_ref()
            .is_some_and(|hash| !hash.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::auth::User;
    use crate::seed::DEMO_EMAIL;
    use chrono::Utc;
    use uuid::Uuid;

    fn demo_user_with_password() -> User {
        User {
            id: Uuid::new_v4(),
            email: DEMO_EMAIL.to_string(),
            password_hash: Some("hash".to_string()),
            provider: String::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            onboarding_completed: true,
            demo_mode_active: false,
        }
    }

    #[cfg(not(feature = "dev-seed"))]
    #[test]
    fn seed_password_fallback_disabled_without_dev_seed_feature() {
        let user = demo_user_with_password();
        assert!(!seed_user_password_fallback(&user));
    }

    #[cfg(feature = "dev-seed")]
    #[test]
    fn seed_password_fallback_enabled_for_any_user_with_password() {
        let user = demo_user_with_password();
        assert!(seed_user_password_fallback(&user));

        let other_user = User {
            id: Uuid::new_v4(),
            email: "other@example.com".to_string(),
            password_hash: Some("hash".to_string()),
            provider: String::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            onboarding_completed: true,
            demo_mode_active: false,
        };
        assert!(seed_user_password_fallback(&other_user));
    }

    #[cfg(feature = "dev-seed")]
    #[test]
    fn seed_password_fallback_disabled_without_password_hash() {
        let user = User {
            id: Uuid::new_v4(),
            email: DEMO_EMAIL.to_string(),
            password_hash: None,
            provider: String::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            onboarding_completed: true,
            demo_mode_active: false,
        };
        assert!(!seed_user_password_fallback(&user));
    }
}
