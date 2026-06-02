use std::sync::Arc;

use chrono::{TimeZone, Utc};
use uuid::Uuid;

use crate::services::cache_service::MockCacheService;
use crate::services::provider_sync_rate_limit_service::{
    ProviderSyncRateLimitService, SyncQuotaDecision,
};

fn build_service(
    cache_service: Arc<dyn crate::services::CacheService>,
) -> ProviderSyncRateLimitService {
    ProviderSyncRateLimitService::new(cache_service)
}

#[tokio::test]
async fn given_client_date_and_timezone_when_consuming_quota_then_uses_local_midnight_ttl() {
    let user_id = Uuid::new_v4();
    let client_date = "2026-06-02";
    let client_timezone = "America/Chicago";
    let now = Utc.with_ymd_and_hms(2026, 6, 2, 23, 30, 0).unwrap();
    let expected_key = format!("provider_sync:day:{user_id}:2026-06-02");
    let expected_ttl = 19_800;

    let mut cache = MockCacheService::new();
    cache
        .expect_get_counter()
        .with(mockall::predicate::eq(expected_key.clone()))
        .times(1)
        .returning(|_| Box::pin(async { Ok(None) }));
    cache
        .expect_increment_counter()
        .with(
            mockall::predicate::eq(expected_key.clone()),
            mockall::predicate::eq(expected_ttl),
        )
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(1i64) }));

    let service = build_service(Arc::new(cache));
    let result = service
        .try_consume_sync_quota_at(&user_id, client_date, client_timezone, now)
        .await
        .unwrap();

    assert_eq!(
        result,
        SyncQuotaDecision::Allowed {
            count: 1,
            limit: 24
        }
    );
}

#[tokio::test]
async fn given_twenty_four_existing_syncs_when_consuming_quota_then_returns_limited() {
    let user_id = Uuid::new_v4();
    let client_date = "2026-06-02";
    let client_timezone = "America/Chicago";
    let now = Utc.with_ymd_and_hms(2026, 6, 2, 23, 30, 0).unwrap();
    let expected_key = format!("provider_sync:day:{user_id}:2026-06-02");

    let mut cache = MockCacheService::new();
    cache
        .expect_get_counter()
        .with(mockall::predicate::eq(expected_key))
        .times(1)
        .returning(|_| Box::pin(async { Ok(Some(24)) }));
    cache.expect_increment_counter().times(0);

    let service = build_service(Arc::new(cache));
    let result = service
        .try_consume_sync_quota_at(&user_id, client_date, client_timezone, now)
        .await
        .unwrap();

    assert_eq!(
        result,
        SyncQuotaDecision::Limited {
            retry_after_secs: 19_800
        }
    );
}

#[tokio::test]
async fn given_invalid_timezone_when_consuming_quota_then_returns_error() {
    let user_id = Uuid::new_v4();
    let mut cache = MockCacheService::new();
    cache.expect_get_counter().times(0);
    cache.expect_increment_counter().times(0);

    let service = build_service(Arc::new(cache));
    let error = service
        .try_consume_sync_quota_at(
            &user_id,
            "2026-06-02",
            "Not/A_Timezone",
            Utc.with_ymd_and_hms(2026, 6, 2, 23, 30, 0).unwrap(),
        )
        .await;

    assert!(matches!(
        error,
        Err(crate::services::provider_sync_rate_limit_service::ProviderSyncRateLimitError::InvalidClientTimezone)
    ));
}
