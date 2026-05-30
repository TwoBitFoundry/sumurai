use std::collections::HashMap;
use std::sync::Mutex;

use async_trait::async_trait;
use sumurai_cli::{reset_passkeys, PasskeyResetStore, ResetPasskeysError, UserRecord};
use uuid::Uuid;

struct MockPasskeyResetStore {
    users_by_email: HashMap<String, UserRecord>,
    users_by_id: HashMap<Uuid, UserRecord>,
    deleted_user_ids: Mutex<Vec<Uuid>>,
}

impl MockPasskeyResetStore {
    fn with_user(email: &str) -> (Self, UserRecord) {
        let user = UserRecord {
            id: Uuid::new_v4(),
            email: email.to_string(),
        };
        let mut users_by_email = HashMap::new();
        users_by_email.insert(email.to_lowercase(), user.clone());
        let mut users_by_id = HashMap::new();
        users_by_id.insert(user.id, user.clone());
        (
            Self {
                users_by_email,
                users_by_id,
                deleted_user_ids: Mutex::new(Vec::new()),
            },
            user,
        )
    }

    fn deleted_user_ids(&self) -> Vec<Uuid> {
        self.deleted_user_ids.lock().unwrap().clone()
    }
}

#[async_trait]
impl PasskeyResetStore for MockPasskeyResetStore {
    async fn find_user_by_identifier(
        &self,
        identifier: &str,
    ) -> Result<Option<UserRecord>, anyhow::Error> {
        let trimmed = identifier.trim();
        if let Ok(user_id) = Uuid::parse_str(trimmed) {
            return Ok(self.users_by_id.get(&user_id).cloned());
        }
        Ok(self.users_by_email.get(&trimmed.to_lowercase()).cloned())
    }

    async fn delete_all_passkeys(&self, user_id: Uuid) -> Result<u64, anyhow::Error> {
        self.deleted_user_ids.lock().unwrap().push(user_id);
        Ok(2)
    }
}

#[tokio::test]
async fn given_unknown_identifier_when_reset_passkeys_then_user_not_found_error() {
    let store = MockPasskeyResetStore {
        users_by_email: HashMap::new(),
        users_by_id: HashMap::new(),
        deleted_user_ids: Mutex::new(Vec::new()),
    };

    let result = reset_passkeys(&store, "missing@example.com").await;

    assert!(matches!(
        result,
        Err(ResetPasskeysError::UserNotFound(ref identifier))
            if identifier == "missing@example.com"
    ));
    assert!(store.deleted_user_ids().is_empty());
}

#[tokio::test]
async fn given_existing_user_when_reset_passkeys_then_clears_and_prints_confirmation() {
    let (store, user) = MockPasskeyResetStore::with_user("operator@example.com");

    let message = reset_passkeys(&store, "operator@example.com")
        .await
        .expect("reset should succeed");

    assert_eq!(
        message,
        "Passkeys cleared for operator@example.com. User will be prompted to enroll a new passkey on next sign-in."
    );
    assert_eq!(store.deleted_user_ids(), vec![user.id]);
}

#[tokio::test]
async fn given_user_id_identifier_when_reset_passkeys_then_clears_by_id() {
    let (store, user) = MockPasskeyResetStore::with_user("id-user@example.com");

    let message = reset_passkeys(&store, &user.id.to_string())
        .await
        .expect("reset should succeed");

    assert!(message.contains("id-user@example.com"));
    assert_eq!(store.deleted_user_ids(), vec![user.id]);
}
