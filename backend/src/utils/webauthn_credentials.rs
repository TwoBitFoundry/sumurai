use crate::models::auth::WebAuthnCredential;
use webauthn_rs::prelude::Passkey;

pub fn usable_passkeys(credentials: &[WebAuthnCredential]) -> Vec<Passkey> {
    credentials
        .iter()
        .filter_map(|credential| serde_json::from_value(credential.passkey.clone()).ok())
        .collect()
}

pub fn has_usable_passkey(credentials: &[WebAuthnCredential]) -> bool {
    !usable_passkeys(credentials).is_empty()
}
