use crate::models::auth::User;
use crate::services::repository_service::DatabaseRepository;
use crate::services::AuthService;
use chrono::Utc;
use std::hash::{Hash, Hasher};
use std::sync::Arc;
use uuid::Uuid;

pub const DEMO_EMAIL: &str = "me@test.com";
const DEMO_PASSWORD: &str = "Test1234!";
pub const SUMURAI_DEMO_ORG_CONN_ID: &str = "sumurai_demo";
pub const MIN_DEMO_TRANSACTION_COUNT: usize = 300;

pub const DEMO_SIMPLEFIN_PROVIDER_TXN_IDS: [&str; 26] = [
    "sumurai_demo_txn_01",
    "sumurai_demo_txn_02",
    "sumurai_demo_txn_03",
    "sumurai_demo_txn_04",
    "sumurai_demo_txn_05",
    "sumurai_demo_txn_06",
    "sumurai_demo_txn_07",
    "sumurai_demo_txn_08",
    "sumurai_demo_txn_09",
    "sumurai_demo_txn_10",
    "sumurai_demo_txn_11",
    "sumurai_demo_txn_12",
    "sumurai_demo_txn_13",
    "sumurai_demo_txn_14",
    "sumurai_demo_txn_15",
    "sumurai_demo_txn_16",
    "sumurai_demo_txn_17",
    "sumurai_demo_txn_18",
    "sumurai_demo_txn_19",
    "sumurai_demo_gym_01",
    "sumurai_demo_gym_02",
    "sumurai_demo_gym_03",
    "sumurai_demo_gym_04",
    "sumurai_demo_excl_01",
    "sumurai_demo_excl_02",
    "sumurai_demo_excl_03",
];

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

#[cfg_attr(not(test), allow(dead_code))]
pub fn is_demo_simplefin_seeded(provider_txn_ids: &[String]) -> bool {
    let demo_count = provider_txn_ids
        .iter()
        .filter(|id| id.starts_with("sumurai_demo_"))
        .count();

    demo_count >= MIN_DEMO_TRANSACTION_COUNT
        && DEMO_SIMPLEFIN_PROVIDER_TXN_IDS
            .iter()
            .all(|expected| provider_txn_ids.iter().any(|id| id == expected))
}

pub async fn maybe_seed_demo_user(
    db: &Arc<dyn DatabaseRepository>,
    auth: &Arc<AuthService>,
) -> anyhow::Result<Option<User>> {
    if !std::env::var("SEED_DEMO_USER")
        .map(|v| v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
    {
        return Ok(None);
    }

    match db.get_user_by_email(DEMO_EMAIL).await {
        Ok(Some(user)) => {
            tracing::debug!("Demo user {} already exists, skipping seed", DEMO_EMAIL);
            return Ok(Some(user));
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
