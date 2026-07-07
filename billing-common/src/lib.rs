use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TrialCodeHashError {
    InvalidCode,
    InvalidHashKey,
}

impl std::fmt::Display for TrialCodeHashError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidCode => write!(f, "Trial code is required"),
            Self::InvalidHashKey => write!(f, "Trial code hash key is required"),
        }
    }
}

impl std::error::Error for TrialCodeHashError {}

pub fn normalize_trial_code(code: &str) -> Result<String, TrialCodeHashError> {
    let normalized = code.trim().to_uppercase();
    if normalized.is_empty() {
        Err(TrialCodeHashError::InvalidCode)
    } else {
        Ok(normalized)
    }
}

pub fn hash_trial_code(hash_key: &str, code: &str) -> Result<String, TrialCodeHashError> {
    if hash_key.trim().is_empty() {
        return Err(TrialCodeHashError::InvalidHashKey);
    }
    let normalized = normalize_trial_code(code)?;
    let mut mac = HmacSha256::new_from_slice(hash_key.as_bytes())
        .map_err(|_| TrialCodeHashError::InvalidHashKey)?;
    mac.update(normalized.as_bytes());
    Ok(hex::encode(mac.finalize().into_bytes()))
}

#[cfg(test)]
mod tests {
    use super::{hash_trial_code, normalize_trial_code};

    #[test]
    fn given_same_code_with_different_case_when_hashing_then_hashes_normalized_code() {
        let upper = hash_trial_code("hash-key", "TRIAL-2026").unwrap();
        let lower = hash_trial_code("hash-key", " trial-2026 ").unwrap();

        assert_eq!(upper, lower);
    }

    #[test]
    fn given_empty_code_when_normalizing_then_rejects() {
        assert_eq!(
            normalize_trial_code("   "),
            Err(super::TrialCodeHashError::InvalidCode)
        );
    }

    #[test]
    fn given_empty_hash_key_when_hashing_then_rejects() {
        assert_eq!(
            hash_trial_code("   ", "TRIAL-2026"),
            Err(super::TrialCodeHashError::InvalidHashKey)
        );
    }

    #[test]
    fn given_known_input_when_hashing_then_produces_stable_hex_digest() {
        let digest = hash_trial_code("test-trial-code-hash-key", "TRIAL-2026").unwrap();

        assert_eq!(digest.len(), 64);
        assert_eq!(
            digest,
            hash_trial_code("test-trial-code-hash-key", " trial-2026 ").unwrap()
        );
    }
}
