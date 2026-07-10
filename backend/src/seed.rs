use crate::models::auth::User;
use crate::services::demo_mode_service::DemoModeService;
use crate::services::repository_service::DatabaseRepository;
use crate::services::{AuthService, CacheService};
use chrono::Utc;
use std::hash::{Hash, Hasher};
use std::sync::Arc;
use uuid::Uuid;

pub const DEMO_EMAIL: &str = "me@test.com";
const DEMO_PASSWORD: &str = "Test1234!";
pub const SUMURAI_DEMO_SIMPLEFIN_ORG_CONN_ID: &str = "sumurai_demo";

pub fn demo_scoped_provider_id(user_id: Uuid, key: &str) -> String {
    format!("{key}_{user_id}")
}

pub fn demo_simplefin_item_id(user_id: Uuid) -> String {
    crate::services::simplefin_org_service::simplefin_org_item_id(
        &user_id,
        SUMURAI_DEMO_SIMPLEFIN_ORG_CONN_ID,
    )
}

pub fn demo_diy_item_id(user_id: Uuid) -> String {
    format!("diy_{user_id}_diy_sumurai_demo")
}

pub fn demo_teller_item_id(user_id: Uuid) -> String {
    format!("teller_sumurai_demo_{user_id}")
}

pub fn demo_provider_account_id(user_id: Uuid, account_key: &str) -> String {
    demo_scoped_provider_id(user_id, account_key)
}

pub fn is_demo_simplefin_item_id(item_id: &str) -> bool {
    let suffix = format!("_{SUMURAI_DEMO_SIMPLEFIN_ORG_CONN_ID}");
    item_id
        .strip_prefix("simplefin_")
        .and_then(|rest| rest.strip_suffix(&suffix))
        .is_some_and(|user_part| Uuid::parse_str(user_part).is_ok())
}

pub fn is_demo_seed_item_id(user_id: Uuid, item_id: &str) -> bool {
    item_id == demo_simplefin_item_id(user_id)
        || item_id == demo_diy_item_id(user_id)
        || item_id == demo_teller_item_id(user_id)
}

fn seed_demo_user_enabled() -> bool {
    std::env::var("SEED_DEMO_USER")
        .map(|v| v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

fn demo_seed_hash(user_id: Uuid, key: &str, salt: &str) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    salt.hash(&mut hasher);
    user_id.hash(&mut hasher);
    key.hash(&mut hasher);
    hasher.finish()
}

pub fn demo_entity_id(user_id: Uuid, key: &str) -> Uuid {
    let high = demo_seed_hash(user_id, key, "sumurai-demo-seed-high");
    let low = demo_seed_hash(user_id, key, "sumurai-demo-seed-low");
    Uuid::from_fields(
        (high >> 32) as u32,
        (high >> 16) as u16,
        high as u16,
        &[
            (low >> 56) as u8,
            (low >> 48) as u8,
            (low >> 40) as u8,
            (low >> 32) as u8,
            (low >> 24) as u8,
            (low >> 16) as u8,
            (low >> 8) as u8,
            low as u8,
        ],
    )
}

pub async fn maybe_seed_demo_user(
    db: &Arc<dyn DatabaseRepository>,
    auth: &Arc<AuthService>,
) -> anyhow::Result<Option<User>> {
    if !seed_demo_user_enabled() {
        return Ok(None);
    }

    match db.get_user_by_email(DEMO_EMAIL).await {
        Ok(Some(_)) => {
            tracing::debug!("Demo user {} already exists, skipping seed", DEMO_EMAIL);
            return Ok(None);
        }
        Ok(None) => {}
        Err(e) => {
            tracing::warn!("Could not check for demo user: {}", e);
            return Ok(None);
        }
    }

    let password_hash = auth
        .hash_password(DEMO_PASSWORD)
        .map_err(|e| anyhow::anyhow!("Failed to hash demo password: {}", e))?;

    let user = User {
        id: Uuid::new_v4(),
        email: DEMO_EMAIL.to_string(),
        password_hash: Some(password_hash),
        provider: String::new(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        onboarding_completed: true,
        demo_mode_active: true,
    };

    if let Err(e) = db.create_user(&user).await {
        tracing::warn!("Failed to seed demo user: {}", e);
        return Ok(None);
    }

    tracing::info!("Demo user {} seeded (password login enabled)", DEMO_EMAIL);
    Ok(Some(user))
}

pub async fn maybe_seed_demo_dev_workspace(
    db: &Arc<dyn DatabaseRepository>,
    cache_service: &Arc<dyn CacheService>,
) -> anyhow::Result<()> {
    if !seed_demo_user_enabled() {
        return Ok(());
    }

    let Some(user) = db.get_user_by_email(DEMO_EMAIL).await? else {
        tracing::debug!(
            "Demo user {} not found, skipping demo workspace seed",
            DEMO_EMAIL
        );
        return Ok(());
    };

    if DemoModeService::is_demo_workspace_seeded(db, &user.id).await? {
        tracing::debug!(
            "Demo workspace already present for {}, skipping seed",
            DEMO_EMAIL
        );
        return Ok(());
    }

    DemoModeService::seed_demo_workspace_for_user(db, cache_service, &user).await?;
    tracing::info!("Demo workspace seeded for {}", DEMO_EMAIL);
    Ok(())
}
