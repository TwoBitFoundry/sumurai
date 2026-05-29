use crate::models::auth::WebAuthnCredential;
use crate::test_fixtures::test_passkey_for_user;
use crate::utils::webauthn_credentials::{
    count_usable_credentials, has_usable_passkey, is_usable_credential, usable_passkeys,
};
use chrono::Utc;
use serde_json::json;
use uuid::Uuid;

#[test]
fn given_invalid_passkey_json_when_usable_passkeys_then_empty() {
    let credential = WebAuthnCredential {
        id: Uuid::new_v4(),
        user_id: Uuid::new_v4(),
        credential_id: vec![1, 2, 3],
        passkey: json!({}),
        name: "broken".to_string(),
        created_at: Utc::now(),
        last_used_at: None,
    };

    assert!(!is_usable_credential(&credential));
    let credentials = [credential];
    assert!(usable_passkeys(&credentials).is_empty());
    assert!(!has_usable_passkey(&credentials));
    assert_eq!(count_usable_credentials(&credentials), 0);
}

#[test]
fn given_one_usable_and_one_broken_when_count_usable_then_one() {
    let user_id = Uuid::new_v4();
    let usable = test_passkey_for_user(user_id);
    let broken = WebAuthnCredential {
        id: Uuid::new_v4(),
        user_id,
        credential_id: vec![4, 5, 6],
        passkey: json!({}),
        name: "Broken".to_string(),
        created_at: Utc::now(),
        last_used_at: None,
    };

    let credentials = [usable, broken];
    assert_eq!(count_usable_credentials(&credentials), 1);
    assert!(is_usable_credential(&credentials[0]));
    assert!(!is_usable_credential(&credentials[1]));
}
