use anyhow::{anyhow, Result};

pub fn parse_encryption_key_hex(key_str: &str) -> Result<[u8; 32]> {
    let key_str = key_str.trim();
    if key_str.is_empty() {
        return Err(anyhow!(
            "ENCRYPTION_KEY environment variable is required. Generate one with `openssl rand -hex 32`."
        ));
    }

    let key_bytes = hex::decode(key_str).map_err(|_| {
        anyhow!(
            "ENCRYPTION_KEY must be 64 hexadecimal characters (output of `openssl rand -hex 32`)."
        )
    })?;

    if key_bytes.len() != 32 {
        return Err(anyhow!(
            "ENCRYPTION_KEY must decode to 32 bytes (64 hex characters)."
        ));
    }

    let mut encryption_key = [0u8; 32];
    encryption_key.copy_from_slice(&key_bytes);
    Ok(encryption_key)
}
