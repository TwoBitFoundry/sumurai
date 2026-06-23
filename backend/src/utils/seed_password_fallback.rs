use crate::models::auth::User;

pub fn dev_password_auth_enabled() -> bool {
    cfg!(feature = "dev-seed")
}

pub fn user_has_password(user: &User) -> bool {
    user.password_hash
        .as_ref()
        .is_some_and(|hash| !hash.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::auth::User;
    use chrono::Utc;
    use uuid::Uuid;

    #[cfg(not(feature = "dev-seed"))]
    #[test]
    fn dev_password_auth_disabled_without_dev_seed_feature() {
        assert!(!dev_password_auth_enabled());
    }

    #[cfg(feature = "dev-seed")]
    #[test]
    fn dev_password_auth_enabled_with_dev_seed_feature() {
        assert!(dev_password_auth_enabled());
    }

    #[test]
    fn user_has_password_when_hash_present() {
        let user = User {
            id: Uuid::new_v4(),
            email: "user@example.com".to_string(),
            password_hash: Some("hash".to_string()),
            provider: String::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            onboarding_completed: true,
            demo_mode_active: false,
        };
        assert!(user_has_password(&user));
    }

    #[test]
    fn user_has_password_false_when_hash_missing() {
        let user = User {
            id: Uuid::new_v4(),
            email: "user@example.com".to_string(),
            password_hash: None,
            provider: String::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            onboarding_completed: true,
            demo_mode_active: false,
        };
        assert!(!user_has_password(&user));
    }
}
