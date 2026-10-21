use anyhow::anyhow;
use uuid::Uuid;

use crate::handlers::auto_categorization::{cancel_failure, start_failure, status_failure};
use crate::models::auto_categorization_job::{
    AutoCategorizationJobState, AutoCategorizationJobStatus,
};
use crate::models::domain_error::DomainError;
use crate::services::auto_categorization::service::AutoCategorizationError;

fn active_job() -> AutoCategorizationJobState {
    AutoCategorizationJobState {
        job_id: Uuid::new_v4(),
        status: AutoCategorizationJobStatus::Running,
        total: 10,
        processed: 4,
        updated: 3,
        skipped: 1,
        started_at: chrono::Utc::now(),
        finished_at: None,
        error_message: None,
    }
}

#[test]
fn given_storage_error_when_mapping_start_failure_then_returns_internal_error() {
    let error = start_failure(
        Uuid::new_v4(),
        AutoCategorizationError::Storage(anyhow!("database unavailable")),
    );

    assert_eq!(
        error,
        DomainError::internal("Failed to start auto-categorization")
    );
}

#[test]
fn given_no_active_job_when_mapping_start_failure_then_returns_internal_error() {
    let error = start_failure(Uuid::new_v4(), AutoCategorizationError::NoActiveJob);

    assert_eq!(
        error,
        DomainError::internal("Failed to start auto-categorization")
    );
}

#[test]
fn given_storage_error_when_mapping_status_failure_then_returns_internal_error() {
    let error = status_failure(Uuid::new_v4(), anyhow!("redis unavailable"));

    assert_eq!(
        error,
        DomainError::internal("Failed to fetch auto-categorization status")
    );
}

#[test]
fn given_no_active_job_when_mapping_cancel_failure_then_returns_not_found_with_legacy_error_name() {
    let error = cancel_failure(Uuid::new_v4(), AutoCategorizationError::NoActiveJob);

    assert_eq!(
        error,
        DomainError::not_found("auto_categorization_job_not_found").with_error_name("not_found")
    );
}

#[test]
fn given_storage_error_when_mapping_cancel_failure_then_returns_internal_error() {
    let error = cancel_failure(
        Uuid::new_v4(),
        AutoCategorizationError::Storage(anyhow!("redis unavailable")),
    );

    assert_eq!(
        error,
        DomainError::internal("Failed to cancel auto-categorization")
    );
}

#[test]
fn given_active_job_exists_when_mapping_cancel_failure_then_returns_internal_error() {
    let error = cancel_failure(
        Uuid::new_v4(),
        AutoCategorizationError::ActiveJobExists(active_job()),
    );

    assert_eq!(
        error,
        DomainError::internal("Failed to cancel auto-categorization")
    );
}
