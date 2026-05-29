use crate::models::auth::WebAuthnCredential;
use crate::utils::webauthn_credentials::{has_usable_passkey, usable_passkeys};
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

    let credentials = [credential];
    assert!(usable_passkeys(&credentials).is_empty());
    assert!(!has_usable_passkey(&credentials));
}
