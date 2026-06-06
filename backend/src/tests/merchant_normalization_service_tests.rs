use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use chrono::NaiveDate;
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::models::transaction::Transaction;
use crate::services::cache_service::MockCacheService;
use crate::services::merchant_normalization::service::MerchantNormalizationService;
use crate::services::merchant_normalization::types::AliasRow;
use crate::services::repository_service::MockDatabaseRepository;

fn seed_aliases() -> Vec<AliasRow> {
    vec![
        AliasRow {
            match_type: "contains".into(),
            match_key: "COSTCO WHSE".into(),
            canonical_name: "Costco".into(),
            priority: 10,
        },
        AliasRow {
            match_type: "contains".into(),
            match_key: "WINCO".into(),
            canonical_name: "WinCo".into(),
            priority: 10,
        },
    ]
}

fn make_transaction(merchant: &str, original: Option<&str>) -> Transaction {
    Transaction {
        id: Uuid::new_v4(),
        account_id: Uuid::new_v4(),
        user_id: None,
        provider_account_id: None,
        provider_transaction_id: None,
        amount: Decimal::ZERO,
        date: NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
        merchant_name: Some(merchant.to_string()),
        category_primary: "OTHER".to_string(),
        category_detailed: "OTHER".to_string(),
        category_confidence: String::new(),
        payment_channel: None,
        pending: false,
        created_at: None,
        original_merchant_name: original.map(str::to_string),
        normalized_merchant: None,
        normalization_source: None,
    }
}

struct InMemoryCache {
    values: Arc<Mutex<HashMap<String, String>>>,
}

impl InMemoryCache {
    fn new() -> Self {
        Self {
            values: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn into_mock(self) -> MockCacheService {
        let values = self.values;
        let get_values = Arc::clone(&values);
        let set_values = Arc::clone(&values);

        let mut mock = MockCacheService::new();

        mock.expect_get_string().returning(move |key| {
            let value = get_values.lock().unwrap().get(key).cloned();
            Box::pin(async move { Ok(value) })
        });

        mock.expect_set_with_ttl()
            .returning(move |key, value, _ttl| {
                set_values
                    .lock()
                    .unwrap()
                    .insert(key.to_string(), value.to_string());
                Box::pin(async { Ok(()) })
            });

        mock
    }
}

fn make_service(aliases: Vec<AliasRow>) -> MerchantNormalizationService {
    let mut db = MockDatabaseRepository::new();
    db.expect_get_active_merchant_aliases().returning(move || {
        let rows = aliases.clone();
        Box::pin(async move { Ok(rows) })
    });

    let cache = InMemoryCache::new().into_mock();

    MerchantNormalizationService::new(Arc::new(db), Arc::new(cache))
}

#[tokio::test]
async fn given_simplefin_raw_description_when_normalize_batch_then_merchant_name_replaced() {
    let svc = make_service(seed_aliases());
    let mut txns = vec![make_transaction(
        "POS COSTCO WHSE #12 TULSA OK 537",
        Some("POS COSTCO WHSE #12 TULSA OK 537"),
    )];

    svc.normalize_batch(&mut txns).await.unwrap();

    assert_eq!(txns[0].merchant_name.as_deref(), Some("Costco"));
    assert_eq!(txns[0].normalized_merchant.as_deref(), Some("costco"));
    assert_eq!(
        txns[0].normalization_source.as_deref(),
        Some("sumurai_engine")
    );
}

#[tokio::test]
async fn given_transaction_with_original_when_normalize_batch_then_original_preserved() {
    let svc = make_service(seed_aliases());
    let raw = "WINCO FOODS #42 DEBIT PURCHASE";
    let mut txns = vec![make_transaction(raw, Some(raw))];

    svc.normalize_batch(&mut txns).await.unwrap();

    assert_eq!(txns[0].original_merchant_name.as_deref(), Some(raw));
    assert_eq!(txns[0].merchant_name.as_deref(), Some("WinCo"));
}

#[tokio::test]
async fn given_empty_batch_when_normalize_batch_then_no_error() {
    let svc = make_service(seed_aliases());
    let mut txns: Vec<Transaction> = vec![];
    svc.normalize_batch(&mut txns).await.unwrap();
}

#[tokio::test]
async fn given_cache_miss_when_alias_index_then_rebuilds_from_db() {
    let mut db = MockDatabaseRepository::new();
    db.expect_get_active_merchant_aliases()
        .times(1)
        .returning(|| Box::pin(async { Ok(vec![]) }));

    let cache = InMemoryCache::new().into_mock();
    let svc = MerchantNormalizationService::new(Arc::new(db), Arc::new(cache));

    let _ = svc.alias_index().await.unwrap();
}

#[tokio::test]
async fn given_cache_hit_when_alias_index_then_db_not_called() {
    let aliases = seed_aliases();
    let json = serde_json::to_string(&aliases).unwrap();

    let mut db = MockDatabaseRepository::new();
    db.expect_get_active_merchant_aliases().never();

    let cache_values: Arc<Mutex<HashMap<String, String>>> = Arc::new(Mutex::new(HashMap::new()));
    cache_values
        .lock()
        .unwrap()
        .insert("merchant_aliases_index_v2".to_string(), json);

    let get_values = Arc::clone(&cache_values);
    let set_values = Arc::clone(&cache_values);
    let mut cache = MockCacheService::new();
    cache.expect_get_string().returning(move |key| {
        let value = get_values.lock().unwrap().get(key).cloned();
        Box::pin(async move { Ok(value) })
    });
    cache.expect_set_with_ttl().returning(move |key, value, _| {
        set_values
            .lock()
            .unwrap()
            .insert(key.to_string(), value.to_string());
        Box::pin(async { Ok(()) })
    });

    let svc = MerchantNormalizationService::new(Arc::new(db), Arc::new(cache));
    let _ = svc.alias_index().await.unwrap();
}

#[tokio::test]
async fn given_empty_cached_alias_index_when_alias_index_then_rebuilds_from_db() {
    let aliases = seed_aliases();

    let mut db = MockDatabaseRepository::new();
    db.expect_get_active_merchant_aliases()
        .times(1)
        .returning(move || {
            let rows = aliases.clone();
            Box::pin(async move { Ok(rows) })
        });

    let cache_values: Arc<Mutex<HashMap<String, String>>> = Arc::new(Mutex::new(HashMap::new()));
    cache_values
        .lock()
        .unwrap()
        .insert("merchant_aliases_index_v2".to_string(), "[]".to_string());

    let get_values = Arc::clone(&cache_values);
    let set_values = Arc::clone(&cache_values);
    let mut cache = MockCacheService::new();
    cache.expect_get_string().returning(move |key| {
        let value = get_values.lock().unwrap().get(key).cloned();
        Box::pin(async move { Ok(value) })
    });
    cache.expect_set_with_ttl().returning(move |key, value, _| {
        set_values
            .lock()
            .unwrap()
            .insert(key.to_string(), value.to_string());
        Box::pin(async { Ok(()) })
    });

    let svc = MerchantNormalizationService::new(Arc::new(db), Arc::new(cache));
    let index = svc.alias_index().await.unwrap();

    assert!(!index.contains.is_empty());
}

#[tokio::test]
async fn given_empty_db_aliases_when_normalize_batch_then_builtin_aliases_still_apply() {
    let svc = make_service(vec![]);
    let mut txns = vec![
        make_transaction(
            "COSTCO WHSE #12 POS PURCHASE TULSA OK 851428",
            Some("COSTCO WHSE #12 POS PURCHASE TULSA OK 851428"),
        ),
        make_transaction(
            "STARBUCKS 2401 UTAH AVE S SEATTLE 98134 WA USA",
            Some("STARBUCKS 2401 UTAH AVE S SEATTLE 98134 WA USA"),
        ),
        make_transaction(
            "BOKF, NA BOKF, NA - *****04463",
            Some("BOKF, NA BOKF, NA - *****04463"),
        ),
    ];

    svc.normalize_batch(&mut txns).await.unwrap();

    assert_eq!(txns[0].merchant_name.as_deref(), Some("Costco"));
    assert_eq!(txns[1].merchant_name.as_deref(), Some("Starbucks"));
    assert_eq!(txns[2].merchant_name.as_deref(), Some("BOKF"));
}

#[tokio::test]
async fn given_raw_description_when_normalize_batch_then_normalized_merchant_set() {
    let svc = make_service(seed_aliases());
    let mut txns = vec![make_transaction(
        "POS COSTCO WHSE #12 TULSA OK 537",
        Some("POS COSTCO WHSE #12 TULSA OK 537"),
    )];

    svc.normalize_batch(&mut txns).await.unwrap();

    assert_eq!(txns[0].merchant_name.as_deref(), Some("Costco"));
}
