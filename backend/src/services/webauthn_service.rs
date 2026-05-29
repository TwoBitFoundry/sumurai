use anyhow::{anyhow, Result};
use url::Url;
use uuid::Uuid;
use webauthn_rs::prelude::{
    AuthenticationResult, CreationChallengeResponse, CredentialID, Passkey, PasskeyAuthentication,
    PasskeyRegistration, PublicKeyCredential, RegisterPublicKeyCredential,
    RequestChallengeResponse, Webauthn, WebauthnBuilder,
};

pub struct WebAuthnService {
    webauthn: Webauthn,
}

impl WebAuthnService {
    pub fn new(rp_id: &str, rp_origin: &Url) -> Result<Self> {
        let webauthn = WebauthnBuilder::new(rp_id, rp_origin)
            .map_err(|e| anyhow!("Failed to build WebAuthn: {:?}", e))?
            .build()
            .map_err(|e| anyhow!("Failed to build WebAuthn: {:?}", e))?;
        Ok(Self { webauthn })
    }

    pub fn begin_registration(
        &self,
        user_id: Uuid,
        user_email: &str,
        existing_credential_ids: &[Vec<u8>],
    ) -> Result<(CreationChallengeResponse, PasskeyRegistration)> {
        let exclude = if existing_credential_ids.is_empty() {
            None
        } else {
            Some(
                existing_credential_ids
                    .iter()
                    .map(|id| CredentialID::from(id.clone()))
                    .collect(),
            )
        };

        self.webauthn
            .start_passkey_registration(user_id, user_email, user_email, exclude)
            .map_err(|e| anyhow!("begin_registration failed: {:?}", e))
    }

    pub fn finish_registration(
        &self,
        state: &PasskeyRegistration,
        response: &RegisterPublicKeyCredential,
    ) -> Result<Passkey> {
        self.webauthn
            .finish_passkey_registration(response, state)
            .map_err(|e| anyhow!("finish_registration failed: {:?}", e))
    }

    pub fn begin_authentication(
        &self,
        passkeys: &[Passkey],
    ) -> Result<(RequestChallengeResponse, PasskeyAuthentication)> {
        self.webauthn
            .start_passkey_authentication(passkeys)
            .map_err(|e| anyhow!("begin_authentication failed: {:?}", e))
    }

    pub fn finish_authentication(
        &self,
        state: &PasskeyAuthentication,
        response: &PublicKeyCredential,
    ) -> Result<AuthenticationResult> {
        self.webauthn
            .finish_passkey_authentication(response, state)
            .map_err(|e| anyhow!("finish_authentication failed: {:?}", e))
    }
}
