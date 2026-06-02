use crate::models::auth::User;
use crate::services::repository_service::DatabaseRepository;
use crate::services::AuthService;
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

pub const DEMO_EMAIL: &str = "me@test.com";
const DEMO_PASSWORD: &str = "Test1234!";

pub async fn maybe_seed_demo_user(
    db: &Arc<dyn DatabaseRepository>,
    auth: &Arc<AuthService>,
) -> anyhow::Result<()> {
    if !std::env::var("SEED_DEMO_USER")
        .map(|v| v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
    {
        return Ok(());
    }

    match db.get_user_by_email(DEMO_EMAIL).await {
        Ok(Some(_)) => {
            tracing::debug!("Demo user {} already exists, skipping seed", DEMO_EMAIL);
            return Ok(());
        }
        Ok(None) => {}
        Err(e) => {
            tracing::warn!("Could not check for demo user: {}", e);
            return Ok(());
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
    };

    if let Err(e) = db.create_user(&user).await {
        tracing::warn!("Failed to seed demo user: {}", e);
        return Ok(());
    }

    tracing::info!("Demo user {} seeded (password login enabled)", DEMO_EMAIL);
    Ok(())
}
