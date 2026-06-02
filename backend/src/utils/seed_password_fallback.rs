use crate::models::auth::User;

pub fn seed_user_password_fallback(user: &User) -> bool {
    #[cfg(feature = "dev-seed")]
    {
        user.email.eq_ignore_ascii_case(crate::seed::DEMO_EMAIL)
            && user
                .password_hash
                .as_ref()
                .is_some_and(|hash| !hash.is_empty())
    }
    #[cfg(not(feature = "dev-seed"))]
    {
        let _ = user;
        false
    }
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
    fn seed_password_fallback_enabled_for_demo_user_with_password() {
        let user = demo_user_with_password();
        assert!(seed_user_password_fallback(&user));
    }

    #[cfg(feature = "dev-seed")]
    #[test]
    fn seed_password_fallback_disabled_for_other_users() {
        let user = User {
            id: Uuid::new_v4(),
            email: "other@example.com".to_string(),
            password_hash: Some("hash".to_string()),
            provider: String::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            onboarding_completed: true,
        };
        assert!(!seed_user_password_fallback(&user));
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
        };
        assert!(!seed_user_password_fallback(&user));
    }
}
