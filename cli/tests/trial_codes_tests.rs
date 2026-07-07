use std::sync::Mutex;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sumurai_cli::{
    create_trial_code, disable_trial_code, hash_trial_code, list_trial_codes, TrialCodeRecord,
    TrialCodeStore,
};
use uuid::Uuid;

struct MockTrialCodeStore {
    records: Mutex<Vec<TrialCodeRecord>>,
    disabled_ids: Mutex<Vec<Uuid>>,
}

impl MockTrialCodeStore {
    fn new() -> Self {
        Self {
            records: Mutex::new(Vec::new()),
            disabled_ids: Mutex::new(Vec::new()),
        }
    }
}

#[async_trait]
impl TrialCodeStore for MockTrialCodeStore {
    async fn insert_trial_code(&self, record: TrialCodeRecord) -> Result<(), anyhow::Error> {
        self.records.lock().unwrap().push(record);
        Ok(())
    }

    async fn list_trial_codes(&self) -> Result<Vec<TrialCodeRecord>, anyhow::Error> {
        Ok(self.records.lock().unwrap().clone())
    }

    async fn disable_trial_code(
        &self,
        id: Uuid,
        _disabled_at: DateTime<Utc>,
    ) -> Result<(), anyhow::Error> {
        self.disabled_ids.lock().unwrap().push(id);
        Ok(())
    }
}

#[test]
fn given_same_code_with_different_case_when_hashing_then_hashes_normalized_code() {
    let upper = hash_trial_code("hash-key", "TRIAL-2026").unwrap();
    let lower = hash_trial_code("hash-key", " trial-2026 ").unwrap();

    assert_eq!(upper, lower);
}

#[tokio::test]
async fn given_trial_code_when_create_then_stores_hash_and_returns_plaintext_once() {
    let store = MockTrialCodeStore::new();
    let redeem_by_at = DateTime::parse_from_rfc3339("2026-12-31T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);

    let created = create_trial_code(&store, "hash-key", " trial-2026 ", redeem_by_at)
        .await
        .unwrap();

    let records = store.records.lock().unwrap().clone();
    assert_eq!(created.code, "TRIAL-2026");
    assert_eq!(records.len(), 1);
    assert_eq!(records[0].code_hash, created.code_hash);
    assert_ne!(records[0].code_hash, "TRIAL-2026");
    assert_eq!(records[0].redeem_by_at, redeem_by_at);
}

#[tokio::test]
async fn given_trial_codes_when_list_then_returns_metadata_only() {
    let store = MockTrialCodeStore::new();
    let redeem_by_at = Utc::now();
    let created = create_trial_code(&store, "hash-key", "TRIAL-2026", redeem_by_at)
        .await
        .unwrap();

    let listed = list_trial_codes(&store).await.unwrap();

    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, created.id);
    assert_eq!(listed[0].code_hash, created.code_hash);
}

#[tokio::test]
async fn given_trial_code_id_when_disable_then_records_disable_request() {
    let store = MockTrialCodeStore::new();
    let id = Uuid::new_v4();

    let message = disable_trial_code(&store, id).await.unwrap();

    assert_eq!(message, format!("Trial code {id} disabled."));
    assert_eq!(*store.disabled_ids.lock().unwrap(), vec![id]);
}
