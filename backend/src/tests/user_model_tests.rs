use crate::models::auth::User;
use chrono::Utc;
use uuid::Uuid;

#[test]
fn given_new_user_when_created_with_provider_then_has_provider_field() {
    let user = User {
        id: Uuid::new_v4(),
        email: "test@example.com".to_string(),
        password_hash: "hashed_password".to_string(),
        provider: "teller".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        onboarding_completed: false,
    };

    assert_eq!(user.provider, "teller");
}

#[test]
fn given_user_with_plaid_provider_when_checked_then_has_plaid() {
    let user = User {
        id: Uuid::new_v4(),
        email: "premium@example.com".to_string(),
        password_hash: "hashed_password".to_string(),
        provider: "plaid".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        onboarding_completed: false,
    };

    assert_eq!(user.provider, "plaid");
}

#[test]
fn given_user_when_serialized_then_includes_provider() {
    let user = User {
        id: Uuid::new_v4(),
        email: "test@example.com".to_string(),
        password_hash: "hashed_password".to_string(),
        provider: "teller".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        onboarding_completed: false,
    };

    let json_result = serde_json::to_string(&user);

    assert!(json_result.is_ok());
    let json_str = json_result.unwrap();
    assert!(json_str.contains("\"provider\":\"teller\""));
}
