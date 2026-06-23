use crate::models::auth::User;
use crate::services::repository_service::DatabaseRepository;
use crate::services::CacheService;
use std::sync::Arc;

pub struct DemoModeService;

impl DemoModeService {
    pub async fn seed_demo_workspace_for_user(
        db: &Arc<dyn DatabaseRepository>,
        cache_service: &Arc<dyn CacheService>,
        user: &User,
    ) -> anyhow::Result<()> {
        crate::seed::seed_demo_simplefin_workspace_for_user(db, cache_service, user).await
    }
}
