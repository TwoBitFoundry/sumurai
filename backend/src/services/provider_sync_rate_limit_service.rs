use std::str::FromStr;
use std::sync::Arc;

use chrono::{DateTime, Datelike, NaiveDate, TimeZone, Utc};
use uuid::Uuid;

use crate::services::cache_service::CacheService;

const DEFAULT_SYNC_DAILY_LIMIT: i64 = 24;
const SYNC_DAILY_LIMIT_ENV: &str = "SYNC_DAILY_LIMIT";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SyncQuotaDecision {
    Allowed { count: i64, limit: i64 },
    Limited { retry_after_secs: u64 },
}

#[derive(Debug)]
pub enum ProviderSyncRateLimitError {
    InvalidClientDate,
    InvalidClientTimezone,
    Cache(anyhow::Error),
}

pub struct ProviderSyncRateLimitService {
    cache_service: Arc<dyn CacheService>,
    daily_limit: i64,
}

impl ProviderSyncRateLimitService {
    pub fn new(cache_service: Arc<dyn CacheService>) -> Self {
        let daily_limit = std::env::var(SYNC_DAILY_LIMIT_ENV)
            .ok()
            .and_then(|value| value.parse::<i64>().ok())
            .filter(|value| *value > 0)
            .unwrap_or(DEFAULT_SYNC_DAILY_LIMIT);

        Self {
            cache_service,
            daily_limit,
        }
    }

    pub async fn try_consume_sync_quota(
        &self,
        user_id: &Uuid,
        client_date: &str,
        client_timezone: &str,
    ) -> Result<SyncQuotaDecision, ProviderSyncRateLimitError> {
        self.try_consume_sync_quota_at(
            user_id,
            client_date,
            client_timezone,
            DateTime::<Utc>::from(std::time::SystemTime::now()),
        )
        .await
    }

    pub async fn try_consume_sync_quota_at(
        &self,
        user_id: &Uuid,
        client_date: &str,
        client_timezone: &str,
        now: DateTime<Utc>,
    ) -> Result<SyncQuotaDecision, ProviderSyncRateLimitError> {
        let client_date = NaiveDate::parse_from_str(client_date, "%Y-%m-%d")
            .map_err(|_| ProviderSyncRateLimitError::InvalidClientDate)?;
        let client_timezone = chrono_tz::Tz::from_str(client_timezone)
            .map_err(|_| ProviderSyncRateLimitError::InvalidClientTimezone)?;
        let key = self.quota_key(user_id, client_date);
        let retry_after_secs = self.retry_after_secs(client_date, client_timezone, now)?;

        let current_count = self
            .cache_service
            .get_counter(&key)
            .await
            .map_err(ProviderSyncRateLimitError::Cache)?
            .unwrap_or(0);

        if current_count >= self.daily_limit {
            return Ok(SyncQuotaDecision::Limited { retry_after_secs });
        }

        let count = self
            .cache_service
            .increment_counter(&key, retry_after_secs)
            .await
            .map_err(ProviderSyncRateLimitError::Cache)?;

        if count > self.daily_limit {
            return Ok(SyncQuotaDecision::Limited { retry_after_secs });
        }

        Ok(SyncQuotaDecision::Allowed {
            count,
            limit: self.daily_limit,
        })
    }

    fn quota_key(&self, user_id: &Uuid, client_date: NaiveDate) -> String {
        format!(
            "provider_sync:day:{user_id}:{}",
            client_date.format("%Y-%m-%d")
        )
    }

    fn retry_after_secs(
        &self,
        client_date: NaiveDate,
        client_timezone: chrono_tz::Tz,
        now: DateTime<Utc>,
    ) -> Result<u64, ProviderSyncRateLimitError> {
        let next_day = client_date
            .succ_opt()
            .ok_or(ProviderSyncRateLimitError::InvalidClientDate)?;
        let next_midnight = client_timezone
            .with_ymd_and_hms(next_day.year(), next_day.month(), next_day.day(), 0, 0, 0)
            .single()
            .ok_or(ProviderSyncRateLimitError::InvalidClientTimezone)?;
        let seconds = (next_midnight - now.with_timezone(&client_timezone)).num_seconds();
        Ok(seconds.max(1) as u64)
    }
}
