use chrono::Utc;
use entity::{users, webauthn_credentials};
use sea_orm::Database;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use sumurai_cli::{reset_passkeys, PostgresPasskeyResetStore};
use uuid::Uuid;

fn fake_passkey_json() -> serde_json::Value {
    serde_json::json!({
        "cred_id": "dGVzdA==",
        "keys": { "type_": "ES256", "key": "test" },
        "counter": 0,
        "user_verified": false
    })
}

#[tokio::test]
async fn given_user_with_passkeys_when_reset_passkeys_then_credentials_removed() {
    let database_url = match std::env::var("DATABASE_URL") {
        Ok(url) => url,
        Err(_) => {
            eprintln!("[cli_reset_passkeys_integration] Skipping: DATABASE_URL not set");
            return;
        }
    };

    let db = match Database::connect(&database_url).await {
        Ok(db) => db,
        Err(error) => {
            eprintln!("[cli_reset_passkeys_integration] Skipping: cannot connect: {error}");
            return;
        }
    };

    let user_id = Uuid::new_v4();
    let email = format!("cli_reset_{}@example.com", Uuid::new_v4());

    users::ActiveModel {
        id: Set(user_id),
        email: Set(email.clone()),
        password_hash: Set(None),
        created_at: Set(Some(Utc::now().into())),
        updated_at: Set(Some(Utc::now().into())),
        onboarding_completed: Set(true),
        provider: Set(String::new()),
    }
    .insert(&db)
    .await
    .expect("insert user");

    for name in ["Device A", "Device B"] {
        webauthn_credentials::ActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(user_id),
            credential_id: Set(Uuid::new_v4().as_bytes().to_vec()),
            passkey: Set(fake_passkey_json()),
            name: Set(name.to_string()),
            created_at: Set(Utc::now().into()),
            last_used_at: Set(None),
        }
        .insert(&db)
        .await
        .expect("insert credential");
    }

    let store = PostgresPasskeyResetStore::connect(&database_url)
        .await
        .expect("connect store");
    let message = reset_passkeys(&store, &email)
        .await
        .expect("reset passkeys");
    assert!(message.contains(&email));

    let remaining = webauthn_credentials::Entity::find()
        .filter(webauthn_credentials::Column::UserId.eq(user_id))
        .all(&db)
        .await
        .expect("list credentials");
    assert!(remaining.is_empty());

    webauthn_credentials::Entity::delete_many()
        .filter(webauthn_credentials::Column::UserId.eq(user_id))
        .exec(&db)
        .await
        .ok();
    users::Entity::delete_by_id(user_id)
        .exec(&db)
        .await
        .expect("delete user");
}
