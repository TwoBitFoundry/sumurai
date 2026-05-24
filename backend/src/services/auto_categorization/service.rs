#![allow(dead_code)]

use std::sync::Arc;

use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use uuid::Uuid;

use crate::models::auto_categorization_job::{
    AutoCategorizationJobState, AutoCategorizationJobStatus, TransactionCategoryUpdate,
};
use crate::models::predicted_category::Confidence;
use crate::services::cache_service::CacheService;
use crate::services::categorization::classifier_labels::format_classifier_input;
use crate::services::repository_service::DatabaseRepository;
use crate::services::Categorizer;

const JOB_BATCH_SIZE: i64 = 128;
const ACTIVE_JOB_TTL_SECONDS: u64 = 7200;
const TERMINAL_JOB_TTL_SECONDS: u64 = 3600;

#[derive(Debug)]
pub enum AutoCategorizationError {
    ActiveJobExists(AutoCategorizationJobState),
    NoActiveJob,
    Storage(anyhow::Error),
}

impl From<anyhow::Error> for AutoCategorizationError {
    fn from(error: anyhow::Error) -> Self {
        Self::Storage(error)
    }
}

pub struct AutoCategorizationService {
    db: Arc<dyn DatabaseRepository>,
    cache: Arc<dyn CacheService>,
    categorizer: Arc<dyn Categorizer>,
    batch_size: i64,
}

impl AutoCategorizationService {
    pub fn new(
        db: Arc<dyn DatabaseRepository>,
        cache: Arc<dyn CacheService>,
        categorizer: Arc<dyn Categorizer>,
    ) -> Self {
        Self::with_batch_size(db, cache, categorizer, JOB_BATCH_SIZE)
    }

    pub fn with_batch_size(
        db: Arc<dyn DatabaseRepository>,
        cache: Arc<dyn CacheService>,
        categorizer: Arc<dyn Categorizer>,
        batch_size: i64,
    ) -> Self {
        Self {
            db,
            cache,
            categorizer,
            batch_size,
        }
    }

    pub async fn count_eligible(&self, user_id: &Uuid) -> Result<i64> {
        self.db
            .count_eligible_auto_categorize_transactions(user_id)
            .await
    }

    pub async fn start(
        &self,
        user_id: &Uuid,
        jwt_id: &str,
    ) -> Result<AutoCategorizationJobState, AutoCategorizationError> {
        if let Some(active) = self.load_status(user_id).await? {
            if active.status.is_active() {
                return Err(AutoCategorizationError::ActiveJobExists(active));
            }
        }

        let total = self
            .db
            .count_eligible_auto_categorize_transactions(user_id)
            .await?;

        let state = AutoCategorizationJobState {
            job_id: Uuid::new_v4(),
            status: AutoCategorizationJobStatus::Running,
            total,
            processed: 0,
            updated: 0,
            skipped: 0,
            started_at: Utc::now(),
            finished_at: None,
            error_message: None,
        };

        self.persist_status(user_id, &state, ACTIVE_JOB_TTL_SECONDS)
            .await?;
        self.clear_cancel_flag(user_id).await?;

        let worker = Self {
            db: Arc::clone(&self.db),
            cache: Arc::clone(&self.cache),
            categorizer: Arc::clone(&self.categorizer),
            batch_size: self.batch_size,
        };
        let user_id = *user_id;
        let jwt_id = jwt_id.to_string();
        let job_id = state.job_id;

        tokio::spawn(async move {
            if let Err(error) = worker.run_job(&user_id, &jwt_id, job_id).await {
                let _ = worker
                    .mark_failed(&user_id, job_id, error.to_string())
                    .await;
            }
        });

        Ok(state)
    }

    pub async fn get_status(&self, user_id: &Uuid) -> Result<Option<AutoCategorizationJobState>> {
        self.load_status(user_id).await
    }

    pub async fn cancel(
        &self,
        user_id: &Uuid,
    ) -> Result<AutoCategorizationJobState, AutoCategorizationError> {
        let Some(mut state) = self.load_status(user_id).await? else {
            return Err(AutoCategorizationError::NoActiveJob);
        };

        if !state.status.is_active() {
            return Ok(state);
        }

        self.set_cancel_flag(user_id).await?;
        state.status = AutoCategorizationJobStatus::Cancelling;
        self.persist_status(user_id, &state, ACTIVE_JOB_TTL_SECONDS)
            .await?;

        Ok(state)
    }

    async fn run_job(&self, user_id: &Uuid, jwt_id: &str, job_id: Uuid) -> Result<()> {
        let mut state = self
            .load_status(user_id)
            .await?
            .filter(|status| status.job_id == job_id)
            .ok_or_else(|| anyhow!("job state missing for worker"))?;

        let mut after_date = None;
        let mut after_id = None;

        while state.processed < state.total {
            let batch = self
                .db
                .fetch_eligible_auto_categorize_transactions(
                    user_id,
                    self.batch_size,
                    after_date,
                    after_id,
                )
                .await?;

            if batch.is_empty() {
                break;
            }

            if let Some(last) = batch.last() {
                after_date = Some(last.date);
                after_id = Some(last.id);
            }

            let descriptions = batch
                .iter()
                .map(|transaction| {
                    format_classifier_input(
                        &transaction.amount,
                        transaction.merchant_name.as_deref().unwrap_or(""),
                    )
                })
                .collect::<Vec<_>>();

            let predictions = self.categorizer.categorize_batch(descriptions).await?;

            if predictions.len() != batch.len() {
                return Err(anyhow!(
                    "categorizer returned {} predictions for {} transactions",
                    predictions.len(),
                    batch.len()
                ));
            }

            let mut updates = Vec::new();
            let mut batch_updated = 0_i64;
            let mut batch_skipped = 0_i64;

            for (transaction, prediction) in batch.iter().zip(predictions.iter()) {
                match prediction.confidence {
                    Confidence::High | Confidence::Medium => {
                        updates.push(TransactionCategoryUpdate {
                            transaction_id: transaction.id,
                            category_primary: prediction.primary.clone(),
                            category_detailed: prediction.primary.clone(),
                            category_confidence: prediction.confidence.as_str().to_string(),
                        });
                        batch_updated += 1;
                    }
                    Confidence::Low => {
                        batch_skipped += 1;
                    }
                }
            }

            if !updates.is_empty() {
                self.db
                    .update_transaction_categories_batch(user_id, &updates)
                    .await?;
            }

            state.processed += batch.len() as i64;
            state.updated += batch_updated;
            state.skipped += batch_skipped;
            self.persist_status(user_id, &state, ACTIVE_JOB_TTL_SECONDS)
                .await?;

            if self.is_cancel_requested(user_id).await? {
                state.status = AutoCategorizationJobStatus::Cancelled;
                state.finished_at = Some(Utc::now());
                self.persist_status(user_id, &state, TERMINAL_JOB_TTL_SECONDS)
                    .await?;
                self.clear_cancel_flag(user_id).await?;
                self.invalidate_session_caches(jwt_id).await?;
                return Ok(());
            }
        }

        state.status = AutoCategorizationJobStatus::Completed;
        state.finished_at = Some(Utc::now());
        self.persist_status(user_id, &state, TERMINAL_JOB_TTL_SECONDS)
            .await?;
        self.clear_cancel_flag(user_id).await?;
        self.invalidate_session_caches(jwt_id).await?;
        Ok(())
    }

    async fn mark_failed(&self, user_id: &Uuid, job_id: Uuid, error_message: String) -> Result<()> {
        let Some(mut state) = self
            .load_status(user_id)
            .await?
            .filter(|status| status.job_id == job_id)
        else {
            return Ok(());
        };

        state.status = AutoCategorizationJobStatus::Failed;
        state.finished_at = Some(Utc::now());
        state.error_message = Some(error_message);
        self.persist_status(user_id, &state, TERMINAL_JOB_TTL_SECONDS)
            .await?;
        self.clear_cancel_flag(user_id).await?;
        Ok(())
    }

    async fn invalidate_session_caches(&self, jwt_id: &str) -> Result<()> {
        self.cache
            .invalidate_pattern(&format!("{jwt_id}_balances_overview*"))
            .await?;
        self.cache
            .invalidate_pattern(&format!("{jwt_id}_net_worth_over_time_*"))
            .await?;
        self.cache.clear_transactions(jwt_id).await?;
        self.cache.clear_budgets(jwt_id).await?;
        Ok(())
    }

    async fn load_status(&self, user_id: &Uuid) -> Result<Option<AutoCategorizationJobState>> {
        let key = Self::job_state_key(user_id);
        let Some(raw) = self.cache.get_string(&key).await? else {
            return Ok(None);
        };

        let state = serde_json::from_str(&raw)
            .with_context(|| format!("invalid auto-categorization job state for {user_id}"))?;
        Ok(Some(state))
    }

    async fn persist_status(
        &self,
        user_id: &Uuid,
        state: &AutoCategorizationJobState,
        ttl_seconds: u64,
    ) -> Result<()> {
        let key = Self::job_state_key(user_id);
        let payload = serde_json::to_string(state)?;
        self.cache.set_with_ttl(&key, &payload, ttl_seconds).await?;
        Ok(())
    }

    async fn is_cancel_requested(&self, user_id: &Uuid) -> Result<bool> {
        let key = Self::cancel_flag_key(user_id);
        Ok(self.cache.get_string(&key).await?.as_deref() == Some("1"))
    }

    async fn set_cancel_flag(&self, user_id: &Uuid) -> Result<()> {
        let key = Self::cancel_flag_key(user_id);
        self.cache
            .set_with_ttl(&key, "1", ACTIVE_JOB_TTL_SECONDS)
            .await?;
        Ok(())
    }

    async fn clear_cancel_flag(&self, user_id: &Uuid) -> Result<()> {
        let key = Self::cancel_flag_key(user_id);
        self.cache.set_with_ttl(&key, "", 1).await?;
        Ok(())
    }

    fn job_state_key(user_id: &Uuid) -> String {
        format!("auto_categorize:job:{user_id}")
    }

    fn cancel_flag_key(user_id: &Uuid) -> String {
        format!("auto_categorize:cancel:{user_id}")
    }
}
