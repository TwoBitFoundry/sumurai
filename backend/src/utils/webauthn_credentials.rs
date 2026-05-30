use crate::models::auth::WebAuthnCredential;
use webauthn_rs::prelude::Passkey;

pub fn is_usable_credential(credential: &WebAuthnCredential) -> bool {
    serde_json::from_value::<Passkey>(credential.passkey.clone()).is_ok()
}

pub fn usable_passkeys(credentials: &[WebAuthnCredential]) -> Vec<Passkey> {
    credentials
        .iter()
        .filter(|credential| is_usable_credential(credential))
        .filter_map(|credential| serde_json::from_value(credential.passkey.clone()).ok())
        .collect()
}

pub fn has_usable_passkey(credentials: &[WebAuthnCredential]) -> bool {
    !usable_passkeys(credentials).is_empty()
}

pub fn count_usable_credentials(credentials: &[WebAuthnCredential]) -> usize {
    credentials
        .iter()
        .filter(|credential| is_usable_credential(credential))
        .count()
}
