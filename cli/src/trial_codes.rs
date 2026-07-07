use async_trait::async_trait;
use billing_common::{hash_trial_code as hash_trial_code_digest, normalize_trial_code};
use chrono::{DateTime, Utc};
use uuid::Uuid;

pub use billing_common::hash_trial_code;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrialCodeRecord {
    pub id: Uuid,
    pub code_hash: String,
    pub redeem_by_at: DateTime<Utc>,
    pub redeemed_at: Option<DateTime<Utc>>,
    pub redeemed_by_user_id: Option<Uuid>,
    pub disabled_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug)]
pub enum TrialCodeError {
    InvalidCode,
    InvalidHashKey,
    Database(anyhow::Error),
}

impl std::fmt::Display for TrialCodeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidCode => write!(f, "Trial code is required"),
            Self::InvalidHashKey => write!(f, "Trial code hash key is required"),
            Self::Database(error) => write!(f, "{error}"),
        }
    }
}

impl std::error::Error for TrialCodeError {}

#[async_trait]
pub trait TrialCodeStore: Send + Sync {
    async fn insert_trial_code(&self, record: TrialCodeRecord) -> Result<(), anyhow::Error>;
    async fn list_trial_codes(&self) -> Result<Vec<TrialCodeRecord>, anyhow::Error>;
    async fn disable_trial_code(
        &self,
        id: Uuid,
        disabled_at: DateTime<Utc>,
    ) -> Result<(), anyhow::Error>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreatedTrialCode {
    pub id: Uuid,
    pub code: String,
    pub code_hash: String,
    pub redeem_by_at: DateTime<Utc>,
}

pub async fn create_trial_code(
    store: &dyn TrialCodeStore,
    hash_key: &str,
    code: &str,
    redeem_by_at: DateTime<Utc>,
) -> Result<CreatedTrialCode, TrialCodeError> {
    let normalized = normalize_trial_code(code).map_err(map_trial_code_hash_error)?;
    let code_hash = hash_trial_code_digest(hash_key, code).map_err(map_trial_code_hash_error)?;
    let now = Utc::now();
    let record = TrialCodeRecord {
        id: Uuid::new_v4(),
        code_hash: code_hash.clone(),
        redeem_by_at,
        redeemed_at: None,
        redeemed_by_user_id: None,
        disabled_at: None,
        created_at: now,
        updated_at: now,
    };

    store
        .insert_trial_code(record.clone())
        .await
        .map_err(TrialCodeError::Database)?;

    Ok(CreatedTrialCode {
        id: record.id,
        code: normalized,
        code_hash,
        redeem_by_at,
    })
}

pub async fn list_trial_codes(
    store: &dyn TrialCodeStore,
) -> Result<Vec<TrialCodeRecord>, TrialCodeError> {
    store
        .list_trial_codes()
        .await
        .map_err(TrialCodeError::Database)
}

pub async fn disable_trial_code(
    store: &dyn TrialCodeStore,
    id: Uuid,
) -> Result<String, TrialCodeError> {
    store
        .disable_trial_code(id, Utc::now())
        .await
        .map_err(TrialCodeError::Database)?;
    Ok(format!("Trial code {id} disabled."))
}

fn map_trial_code_hash_error(error: billing_common::TrialCodeHashError) -> TrialCodeError {
    match error {
        billing_common::TrialCodeHashError::InvalidCode => TrialCodeError::InvalidCode,
        billing_common::TrialCodeHashError::InvalidHashKey => TrialCodeError::InvalidHashKey,
    }
}
