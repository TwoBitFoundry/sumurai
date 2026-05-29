use async_trait::async_trait;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserRecord {
    pub id: Uuid,
    pub email: String,
}

#[derive(Debug)]
pub enum ResetPasskeysError {
    UserNotFound(String),
    Database(anyhow::Error),
}

impl std::fmt::Display for ResetPasskeysError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UserNotFound(identifier) => {
                write!(f, "No user found for identifier: {identifier}")
            }
            Self::Database(error) => write!(f, "{error}"),
        }
    }
}

impl std::error::Error for ResetPasskeysError {}

#[async_trait]
pub trait PasskeyResetStore: Send + Sync {
    async fn find_user_by_identifier(
        &self,
        identifier: &str,
    ) -> Result<Option<UserRecord>, anyhow::Error>;

    async fn delete_all_passkeys(&self, user_id: Uuid) -> Result<u64, anyhow::Error>;
}

pub async fn reset_passkeys(
    store: &dyn PasskeyResetStore,
    identifier: &str,
) -> Result<String, ResetPasskeysError> {
    let trimmed = identifier.trim();
    if trimmed.is_empty() {
        return Err(ResetPasskeysError::UserNotFound(String::new()));
    }

    let user = store
        .find_user_by_identifier(trimmed)
        .await
        .map_err(ResetPasskeysError::Database)?
        .ok_or_else(|| ResetPasskeysError::UserNotFound(trimmed.to_string()))?;

    store
        .delete_all_passkeys(user.id)
        .await
        .map_err(ResetPasskeysError::Database)?;

    Ok(format!(
        "Passkeys cleared for {}. User will be prompted to enroll a new passkey on next sign-in.",
        user.email
    ))
}
