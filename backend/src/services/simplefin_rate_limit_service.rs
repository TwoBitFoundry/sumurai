use crate::services::cache_service::CacheService;
use anyhow::Result;
use std::sync::Arc;
use uuid::Uuid;

#[allow(dead_code)]
pub struct SimpleFinRateLimitService {
    cache_service: Arc<dyn CacheService>,
}

impl SimpleFinRateLimitService {
    pub fn new(cache_service: Arc<dyn CacheService>) -> Self {
        Self { cache_service }
    }

    #[allow(dead_code)]
    pub async fn check_sync_floor(&self, user_id: &Uuid) -> Result<bool> {
        let key = self.sync_floor_key(user_id);
        let floor_exists = self.cache_service.get_string(&key).await?.is_some();
        Ok(!floor_exists)
    }

    #[allow(dead_code)]
    pub async fn apply_sync_floor(&self, user_id: &Uuid) -> Result<()> {
        let key = self.sync_floor_key(user_id);
        self.cache_service
            .set_with_ttl(&key, "1", self.sync_floor_ttl_seconds())
            .await
    }

    #[allow(dead_code)]
    fn sync_floor_key(&self, user_id: &Uuid) -> String {
        format!("simplefin_sync_floor:{user_id}")
    }

    #[allow(dead_code)]
    fn sync_floor_ttl_seconds(&self) -> u64 {
        3600
    }
}
