use std::sync::Arc;

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use chrono::Utc;
use uuid::Uuid;

use crate::models::auto_categorization_job::{
    AutoCategorizationJobState, AutoCategorizationJobStatus,
};
use crate::models::predicted_category::PredictedCategory;
use crate::services::auto_categorization_orchestrator::{
    AutoCategorizationOrchestrationError, AutoCategorizationOrchestrator,
};
use crate::services::cache_service::MockCacheService;
use crate::services::repository_service::MockDatabaseRepository;
use crate::services::{AutoCategorizationService, Categorizer};

struct NoopCategorizer;

#[async_trait]
impl Categorizer for NoopCategorizer {
    async fn categorize_batch(&self, _descriptions: Vec<String>) -> Result<Vec<PredictedCategory>> {
        Ok(vec![])
    }
}

fn orchestrator(
    repository: MockDatabaseRepository,
    cache: MockCacheService,
) -> AutoCategorizationOrchestrator {
    let service = AutoCategorizationService::new(
        Arc::new(repository),
        Arc::new(cache),
        Arc::new(NoopCategorizer),
    );
    AutoCategorizationOrchestrator::new(Arc::new(service))
}

fn job_state(status: AutoCategorizationJobStatus) -> AutoCategorizationJobState {
    AutoCategorizationJobState {
        job_id: Uuid::new_v4(),
        status,
        total: 10,
        processed: 4,
        updated: 3,
        skipped: 1,
        started_at: Utc::now(),
        finished_at: None,
        error_message: None,
    }
}

fn serialized(state: &AutoCategorizationJobState) -> String {
    serde_json::to_string(state).unwrap()
}

#[tokio::test]
async fn given_active_job_when_starting_then_reports_active_job_exists() {
    let active = job_state(AutoCategorizationJobStatus::Running);
    let stored = serialized(&active);

    let mut cache = MockCacheService::new();
    cache.expect_get_string().returning(move |_| {
        let stored = stored.clone();
        Box::pin(async move { Ok(Some(stored)) })
    });

    let result = orchestrator(MockDatabaseRepository::new(), cache)
        .start(Uuid::new_v4(), "jwt")
        .await;

    assert_eq!(
        result,
        Err(AutoCategorizationOrchestrationError::ActiveJobExists(
            active
        ))
    );
}

#[tokio::test]
async fn given_no_active_job_when_starting_then_persists_running_job() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_count_eligible_auto_categorize_transactions()
        .times(1)
        .returning(|_| Box::pin(async { Ok(0) }));

    let mut cache = MockCacheService::new();
    cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));
    cache
        .expect_set_with_ttl()
        .times(2)
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    let started = orchestrator(repository, cache)
        .start(Uuid::new_v4(), "jwt")
        .await
        .unwrap();

    assert_eq!(started.status, AutoCategorizationJobStatus::Running);
    assert_eq!(started.total, 0);
    assert_eq!(started.processed, 0);
}

#[tokio::test]
async fn given_count_failure_when_starting_then_reports_start_failed() {
    let mut repository = MockDatabaseRepository::new();
    repository
        .expect_count_eligible_auto_categorize_transactions()
        .returning(|_| Box::pin(async { Err(anyhow!("database unavailable")) }));

    let mut cache = MockCacheService::new();
    cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));

    let result = orchestrator(repository, cache)
        .start(Uuid::new_v4(), "jwt")
        .await;

    assert_eq!(
        result,
        Err(AutoCategorizationOrchestrationError::StartFailed)
    );
}

#[tokio::test]
async fn given_stored_job_when_reading_status_then_returns_job() {
    let stored_job = job_state(AutoCategorizationJobStatus::Completed);
    let stored = serialized(&stored_job);

    let mut cache = MockCacheService::new();
    cache.expect_get_string().returning(move |_| {
        let stored = stored.clone();
        Box::pin(async move { Ok(Some(stored)) })
    });

    let result = orchestrator(MockDatabaseRepository::new(), cache)
        .status(Uuid::new_v4())
        .await;

    assert_eq!(result, Ok(Some(stored_job)));
}

#[tokio::test]
async fn given_no_job_when_reading_status_then_returns_none() {
    let mut cache = MockCacheService::new();
    cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));

    let result = orchestrator(MockDatabaseRepository::new(), cache)
        .status(Uuid::new_v4())
        .await;

    assert_eq!(result, Ok(None));
}

#[tokio::test]
async fn given_corrupt_job_state_when_reading_status_then_reports_status_failed() {
    let mut cache = MockCacheService::new();
    cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(Some("not json".to_string())) }));

    let result = orchestrator(MockDatabaseRepository::new(), cache)
        .status(Uuid::new_v4())
        .await;

    assert_eq!(
        result,
        Err(AutoCategorizationOrchestrationError::StatusFailed)
    );
}

#[tokio::test]
async fn given_cache_failure_when_reading_status_then_reports_status_failed() {
    let mut cache = MockCacheService::new();
    cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Err(anyhow!("redis unavailable")) }));

    let result = orchestrator(MockDatabaseRepository::new(), cache)
        .status(Uuid::new_v4())
        .await;

    assert_eq!(
        result,
        Err(AutoCategorizationOrchestrationError::StatusFailed)
    );
}

#[tokio::test]
async fn given_no_job_when_cancelling_then_reports_no_active_job() {
    let mut cache = MockCacheService::new();
    cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Ok(None) }));

    let result = orchestrator(MockDatabaseRepository::new(), cache)
        .cancel(Uuid::new_v4())
        .await;

    assert_eq!(
        result,
        Err(AutoCategorizationOrchestrationError::NoActiveJob)
    );
}

#[tokio::test]
async fn given_terminal_job_when_cancelling_then_returns_job_without_setting_cancel_flag() {
    let completed = job_state(AutoCategorizationJobStatus::Completed);
    let stored = serialized(&completed);

    let mut cache = MockCacheService::new();
    cache.expect_get_string().returning(move |_| {
        let stored = stored.clone();
        Box::pin(async move { Ok(Some(stored)) })
    });
    cache.expect_set_with_ttl().never();

    let result = orchestrator(MockDatabaseRepository::new(), cache)
        .cancel(Uuid::new_v4())
        .await;

    assert_eq!(result, Ok(completed));
}

#[tokio::test]
async fn given_active_job_when_cancelling_then_marks_job_cancelling() {
    let running = job_state(AutoCategorizationJobStatus::Running);
    let stored = serialized(&running);

    let mut cache = MockCacheService::new();
    cache.expect_get_string().returning(move |_| {
        let stored = stored.clone();
        Box::pin(async move { Ok(Some(stored)) })
    });
    cache
        .expect_set_with_ttl()
        .times(2)
        .returning(|_, _, _| Box::pin(async { Ok(()) }));

    let result = orchestrator(MockDatabaseRepository::new(), cache)
        .cancel(Uuid::new_v4())
        .await
        .unwrap();

    assert_eq!(result.status, AutoCategorizationJobStatus::Cancelling);
    assert_eq!(result.job_id, running.job_id);
}

#[tokio::test]
async fn given_cache_failure_when_cancelling_then_reports_cancel_failed() {
    let mut cache = MockCacheService::new();
    cache
        .expect_get_string()
        .returning(|_| Box::pin(async { Err(anyhow!("redis unavailable")) }));

    let result = orchestrator(MockDatabaseRepository::new(), cache)
        .cancel(Uuid::new_v4())
        .await;

    assert_eq!(
        result,
        Err(AutoCategorizationOrchestrationError::CancelFailed)
    );
}
