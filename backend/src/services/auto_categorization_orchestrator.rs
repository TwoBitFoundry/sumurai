use std::sync::Arc;

use uuid::Uuid;

use crate::models::auto_categorization_job::AutoCategorizationJobState;
use crate::services::auto_categorization::service::AutoCategorizationError;
use crate::services::AutoCategorizationService;

#[derive(Debug, Clone, PartialEq)]
pub enum AutoCategorizationOrchestrationError {
    ActiveJobExists(AutoCategorizationJobState),
    StartFailed,
    StatusFailed,
    NoActiveJob,
    CancelFailed,
}

pub struct AutoCategorizationOrchestrator {
    auto_categorization_service: Arc<AutoCategorizationService>,
}

impl AutoCategorizationOrchestrator {
    pub fn new(auto_categorization_service: Arc<AutoCategorizationService>) -> Self {
        Self {
            auto_categorization_service,
        }
    }

    pub async fn start(
        &self,
        user_id: Uuid,
        jwt_id: &str,
    ) -> Result<AutoCategorizationJobState, AutoCategorizationOrchestrationError> {
        self.auto_categorization_service
            .start(&user_id, jwt_id)
            .await
            .map_err(|error| match error {
                AutoCategorizationError::ActiveJobExists(job) => {
                    AutoCategorizationOrchestrationError::ActiveJobExists(job)
                }
                AutoCategorizationError::NoActiveJob => {
                    AutoCategorizationOrchestrationError::StartFailed
                }
                AutoCategorizationError::Storage(error) => {
                    tracing::error!(
                        "Failed to start auto-categorization for user {}: {}",
                        user_id,
                        error
                    );
                    AutoCategorizationOrchestrationError::StartFailed
                }
            })
    }

    pub async fn status(
        &self,
        user_id: Uuid,
    ) -> Result<Option<AutoCategorizationJobState>, AutoCategorizationOrchestrationError> {
        self.auto_categorization_service
            .get_status(&user_id)
            .await
            .map_err(|error| {
                tracing::error!(
                    "Failed to fetch auto-categorization status for user {}: {}",
                    user_id,
                    error
                );
                AutoCategorizationOrchestrationError::StatusFailed
            })
    }

    pub async fn cancel(
        &self,
        user_id: Uuid,
    ) -> Result<AutoCategorizationJobState, AutoCategorizationOrchestrationError> {
        self.auto_categorization_service
            .cancel(&user_id)
            .await
            .map_err(|error| match error {
                AutoCategorizationError::NoActiveJob => {
                    AutoCategorizationOrchestrationError::NoActiveJob
                }
                AutoCategorizationError::ActiveJobExists(_) => {
                    AutoCategorizationOrchestrationError::CancelFailed
                }
                AutoCategorizationError::Storage(error) => {
                    tracing::error!(
                        "Failed to cancel auto-categorization for user {}: {}",
                        user_id,
                        error
                    );
                    AutoCategorizationOrchestrationError::CancelFailed
                }
            })
    }
}
