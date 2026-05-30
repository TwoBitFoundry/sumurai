use crate::connection_pool::RepositoryPool;
use crate::db::PgPool;
use crate::models::auth::User;
use crate::services::repository_service::{DatabaseRepository, PostgresRepository};
use crate::utils::encryption_key::parse_encryption_key_hex;
use chrono::Utc;
use uuid::Uuid;

async fn connect_pool() -> Option<PgPool> {
    if std::env::var("DATABASE_URL").is_err() {
        eprintln!("[webauthn_repository_tests] Skipping: DATABASE_URL not set");
        return None;
    }
    let database_url = std::env::var("DATABASE_URL").unwrap();
    match PgPool::connect(&database_url).await {
        Ok(pool) => Some(pool),
        Err(err) => {
            eprintln!(
                "[webauthn_repository_tests] Skipping: cannot connect: {}",
                err
            );
            None
        }
    }
}

fn open_repository(pool: PgPool) -> PostgresRepository {
    let raw = std::env::var("ENCRYPTION_KEY")
        .expect("ENCRYPTION_KEY must be set when DATABASE_URL is set");
    let key = parse_encryption_key_hex(&raw).expect("ENCRYPTION_KEY must be 64 hex characters");
    PostgresRepository::new(RepositoryPool::from_pg_pool(pool), key)
}

async fn create_test_user(repo: &PostgresRepository) -> User {
    let user = User {
        id: Uuid::new_v4(),
        email: format!("webauthn_test_{}@example.com", Uuid::new_v4()),
        password_hash: None,
        provider: "teller".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        onboarding_completed: false,
    };
    repo.create_user(&user).await.unwrap();
    user
}

fn fake_passkey_json() -> serde_json::Value {
    serde_json::json!({
        "cred_id": "dGVzdA==",
        "keys": { "type_": "ES256", "key": "test" },
        "counter": 0,
        "user_verified": false
    })
}

fn fake_credential_id() -> Vec<u8> {
    Uuid::new_v4().as_bytes().to_vec()
}

#[tokio::test]
async fn given_no_credentials_when_list_then_empty() {
    let Some(pool) = connect_pool().await else {
        return;
    };
    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;

    let result = repo
        .list_webauthn_credentials_for_user(&user.id)
        .await
        .unwrap();
    assert!(result.is_empty());

    repo.delete_user(&user.id).await.unwrap();
}

#[tokio::test]
async fn given_inserted_credential_when_list_then_returns_it() {
    let Some(pool) = connect_pool().await else {
        return;
    };
    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;

    let cred_id = fake_credential_id();
    repo.insert_webauthn_credential(&user.id, cred_id.clone(), fake_passkey_json(), "My Key")
        .await
        .unwrap();

    let creds = repo
        .list_webauthn_credentials_for_user(&user.id)
        .await
        .unwrap();
    assert_eq!(creds.len(), 1);
    assert_eq!(creds[0].credential_id, cred_id);
    assert_eq!(creds[0].name, "My Key");
    assert_eq!(creds[0].user_id, user.id);
    assert!(creds[0].last_used_at.is_none());

    repo.delete_user(&user.id).await.unwrap();
}

#[tokio::test]
async fn given_inserted_credential_when_find_by_ids_then_returns_it() {
    let Some(pool) = connect_pool().await else {
        return;
    };
    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;

    let cred_id = fake_credential_id();
    repo.insert_webauthn_credential(&user.id, cred_id.clone(), fake_passkey_json(), "Key A")
        .await
        .unwrap();

    let found = repo
        .find_webauthn_credentials_by_credential_ids(&user.id, std::slice::from_ref(&cred_id))
        .await
        .unwrap();
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].credential_id, cred_id);

    let not_found = repo
        .find_webauthn_credentials_by_credential_ids(&user.id, &[fake_credential_id()])
        .await
        .unwrap();
    assert!(not_found.is_empty());

    repo.delete_user(&user.id).await.unwrap();
}

#[tokio::test]
async fn given_inserted_credential_when_update_counter_then_last_used_set() {
    let Some(pool) = connect_pool().await else {
        return;
    };
    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;

    let cred = repo
        .insert_webauthn_credential(
            &user.id,
            fake_credential_id(),
            fake_passkey_json(),
            "My Key",
        )
        .await
        .unwrap();
    assert!(cred.last_used_at.is_none());

    repo.update_webauthn_credential_counter_and_last_used(&user.id, &cred.id, 5)
        .await
        .unwrap();

    let updated = repo
        .list_webauthn_credentials_for_user(&user.id)
        .await
        .unwrap();
    assert_eq!(updated.len(), 1);
    assert!(updated[0].last_used_at.is_some());

    repo.delete_user(&user.id).await.unwrap();
}

#[tokio::test]
async fn given_inserted_credential_when_delete_then_gone() {
    let Some(pool) = connect_pool().await else {
        return;
    };
    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;

    let cred = repo
        .insert_webauthn_credential(&user.id, fake_credential_id(), fake_passkey_json(), "Key")
        .await
        .unwrap();

    let deleted = repo
        .delete_webauthn_credential(&user.id, &cred.id)
        .await
        .unwrap();
    assert!(deleted);

    let remaining = repo
        .list_webauthn_credentials_for_user(&user.id)
        .await
        .unwrap();
    assert!(remaining.is_empty());

    repo.delete_user(&user.id).await.unwrap();
}

#[tokio::test]
async fn given_delete_all_when_called_then_all_credentials_removed() {
    let Some(pool) = connect_pool().await else {
        return;
    };
    let repo = open_repository(pool);
    let user = create_test_user(&repo).await;

    repo.insert_webauthn_credential(&user.id, fake_credential_id(), fake_passkey_json(), "Key A")
        .await
        .unwrap();
    repo.insert_webauthn_credential(&user.id, fake_credential_id(), fake_passkey_json(), "Key B")
        .await
        .unwrap();

    let count = repo
        .delete_all_webauthn_credentials_for_user(&user.id)
        .await
        .unwrap();
    assert_eq!(count, 2);

    let remaining = repo
        .list_webauthn_credentials_for_user(&user.id)
        .await
        .unwrap();
    assert!(remaining.is_empty());

    repo.delete_user(&user.id).await.unwrap();
}

#[tokio::test]
async fn given_user_a_credential_when_user_b_lists_then_empty() {
    let Some(pool) = connect_pool().await else {
        return;
    };
    let repo = open_repository(pool);
    let user_a = create_test_user(&repo).await;
    let user_b = create_test_user(&repo).await;

    repo.insert_webauthn_credential(
        &user_a.id,
        fake_credential_id(),
        fake_passkey_json(),
        "A Key",
    )
    .await
    .unwrap();

    let user_b_creds = repo
        .list_webauthn_credentials_for_user(&user_b.id)
        .await
        .unwrap();
    assert!(
        user_b_creds.is_empty(),
        "RLS must prevent user B seeing user A credentials"
    );

    repo.delete_user(&user_a.id).await.unwrap();
    repo.delete_user(&user_b.id).await.unwrap();
}

#[tokio::test]
async fn given_user_a_credential_when_user_b_deletes_then_returns_false() {
    let Some(pool) = connect_pool().await else {
        return;
    };
    let repo = open_repository(pool);
    let user_a = create_test_user(&repo).await;
    let user_b = create_test_user(&repo).await;

    let cred = repo
        .insert_webauthn_credential(
            &user_a.id,
            fake_credential_id(),
            fake_passkey_json(),
            "A Key",
        )
        .await
        .unwrap();

    let deleted = repo
        .delete_webauthn_credential(&user_b.id, &cred.id)
        .await
        .unwrap();
    assert!(
        !deleted,
        "RLS must prevent user B deleting user A credentials"
    );

    let still_there = repo
        .list_webauthn_credentials_for_user(&user_a.id)
        .await
        .unwrap();
    assert_eq!(
        still_there.len(),
        1,
        "credential must still exist for user A"
    );

    repo.delete_user(&user_a.id).await.unwrap();
    repo.delete_user(&user_b.id).await.unwrap();
}

#[tokio::test]
async fn given_duplicate_credential_id_when_insert_then_error() {
    let Some(pool) = connect_pool().await else {
        return;
    };
    let repo = open_repository(pool);
    let user_a = create_test_user(&repo).await;
    let user_b = create_test_user(&repo).await;

    let cred_id = fake_credential_id();
    repo.insert_webauthn_credential(&user_a.id, cred_id.clone(), fake_passkey_json(), "Key")
        .await
        .unwrap();

    let result = repo
        .insert_webauthn_credential(&user_b.id, cred_id, fake_passkey_json(), "Duplicate")
        .await;
    assert!(
        result.is_err(),
        "unique constraint must reject duplicate credential_id"
    );

    repo.delete_user(&user_a.id).await.unwrap();
    repo.delete_user(&user_b.id).await.unwrap();
}
