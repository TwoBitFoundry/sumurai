use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use anyhow::Result;
use async_trait::async_trait;
use chrono::NaiveDate;
use mockall::predicate::{always, eq};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use tokio::sync::Notify;
use uuid::Uuid;

use crate::models::auto_categorization_job::{
    AutoCategorizationJobState, AutoCategorizationJobStatus,
};
use crate::models::predicted_category::{Confidence, PredictedCategory};
use crate::models::transaction::Transaction;
use crate::services::auto_categorization::service::AutoCategorizationError;
use crate::services::auto_categorization::AutoCategorizationService;
use crate::services::cache_service::MockCacheService;
use crate::services::repository_service::MockDatabaseRepository;
use crate::services::Categorizer;

fn make_other_transaction(user_id: Uuid, id: Uuid, merchant: &str, amount: Decimal) -> Transaction {
    Transaction {
        id,
        account_id: Uuid::new_v4(),
        user_id: Some(user_id),
        provider_account_id: None,
        provider_transaction_id: Some(format!("txn-{id}")),
        amount,
        date: NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
        merchant_name: Some(merchant.to_string()),
        category_primary: "OTHER".to_string(),
        category_detailed: "OTHER".to_string(),
        category_confidence: String::new(),
        payment_channel: None,
        pending: false,
        created_at: None,
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
        mock.expect_set_with_ttl()
            .times(..)
            .returning(move |key, value, _ttl| {
                get_values
                    .lock()
                    .unwrap()
                    .insert(key.to_string(), value.to_string());
                Box::pin(async { Ok(()) })
            });
        mock.expect_get_string().times(..).returning(move |key| {
            let value = set_values.lock().unwrap().get(key).cloned();
            Box::pin(async move { Ok(value) })
        });
        mock.expect_clear_transactions()
            .times(..)
            .returning(|_| Box::pin(async { Ok(()) }));
        mock.expect_clear_budgets()
            .times(..)
            .returning(|_| Box::pin(async { Ok(()) }));
        mock.expect_invalidate_pattern()
            .times(..)
            .returning(|_| Box::pin(async { Ok(()) }));
        mock
    }
}

struct StubCategorizer {
    predictions: Vec<PredictedCategory>,
    gate: Option<Arc<Notify>>,
    entered: Option<Arc<AtomicBool>>,
}

#[async_trait]
impl Categorizer for StubCategorizer {
    async fn categorize_batch(&self, descriptions: Vec<String>) -> Result<Vec<PredictedCategory>> {
        if let Some(entered) = &self.entered {
            entered.store(true, Ordering::SeqCst);
        }
        if let Some(gate) = &self.gate {
            gate.notified().await;
        }

        Ok(descriptions
            .iter()
            .map(|_| self.predictions[0].clone())
            .collect())
    }
}

fn make_service(
    db: MockDatabaseRepository,
    cache: MockCacheService,
    categorizer: Arc<dyn Categorizer>,
) -> AutoCategorizationService {
    AutoCategorizationService::with_batch_size(Arc::new(db), Arc::new(cache), categorizer, 2)
}

async fn wait_for_terminal_status(
    service: &AutoCategorizationService,
    user_id: &Uuid,
) -> AutoCategorizationJobState {
    for _ in 0..100 {
        if let Some(state) = service.get_status(user_id).await.unwrap() {
            if !state.status.is_active() {
                return state;
            }
        }
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }
    panic!("job did not reach terminal status");
}

#[tokio::test]
async fn given_no_active_job_when_starting_then_returns_running_without_waiting_for_worker() {
    let user_id = Uuid::new_v4();
    let jwt_id = "jwt-start-immediate";
    let gate = Arc::new(Notify::new());
    let txn_id = Uuid::new_v4();
    let txn = make_other_transaction(user_id, txn_id, "Coffee Shop", dec!(-5.00));

    let mut db = MockDatabaseRepository::new();
    db.expect_count_eligible_auto_categorize_transactions()
        .with(eq(user_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(1) }));
    db.expect_fetch_eligible_auto_categorize_transactions()
        .times(..)
        .returning(move |_, _, _, _| {
            let txn = txn.clone();
            Box::pin(async move { Ok(vec![txn]) })
        });
    db.expect_update_transaction_categories_batch()
        .times(..)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let service = make_service(
        db,
        InMemoryCache::new().into_mock(),
        Arc::new(StubCategorizer {
            predictions: vec![PredictedCategory {
                primary: "FOOD_AND_DRINK".to_string(),
                confidence: Confidence::High,
            }],
            gate: Some(Arc::clone(&gate)),
            entered: None,
        }),
    );

    let started = service.start(&user_id, jwt_id).await.unwrap();
    assert_eq!(started.status, AutoCategorizationJobStatus::Running);
    assert_eq!(started.total, 1);
    assert_eq!(started.processed, 0);

    gate.notify_one();
    let finished = wait_for_terminal_status(&service, &user_id).await;
    assert_eq!(finished.status, AutoCategorizationJobStatus::Completed);
}

#[tokio::test]
async fn given_active_job_when_starting_again_then_returns_active_job_exists() {
    let user_id = Uuid::new_v4();
    let jwt_id = "jwt-duplicate";
    let gate = Arc::new(Notify::new());
    let txn_id = Uuid::new_v4();
    let txn = make_other_transaction(user_id, txn_id, "Market", dec!(-12.00));

    let mut db = MockDatabaseRepository::new();
    db.expect_count_eligible_auto_categorize_transactions()
        .with(eq(user_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(1) }));
    db.expect_fetch_eligible_auto_categorize_transactions()
        .times(..)
        .returning(move |_, _, _, _| {
            let txn = txn.clone();
            Box::pin(async move { Ok(vec![txn]) })
        });
    db.expect_update_transaction_categories_batch()
        .times(..)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let service = make_service(
        db,
        InMemoryCache::new().into_mock(),
        Arc::new(StubCategorizer {
            predictions: vec![PredictedCategory {
                primary: "FOOD_AND_DRINK".to_string(),
                confidence: Confidence::High,
            }],
            gate: Some(Arc::clone(&gate)),
            entered: None,
        }),
    );

    let first = service.start(&user_id, jwt_id).await.unwrap();
    let duplicate = service.start(&user_id, jwt_id).await;

    match duplicate {
        Err(AutoCategorizationError::ActiveJobExists(state)) => {
            assert_eq!(state.job_id, first.job_id);
            assert!(state.status.is_active());
        }
        other => panic!("expected ActiveJobExists, got {other:?}"),
    }

    gate.notify_one();
    let _ = wait_for_terminal_status(&service, &user_id).await;
}

#[tokio::test]
async fn given_eligible_transactions_when_job_runs_then_applies_medium_and_high_predictions() {
    let user_id = Uuid::new_v4();
    let jwt_id = "jwt-confidence";
    let high_id = Uuid::new_v4();
    let medium_id = Uuid::new_v4();
    let low_id = Uuid::new_v4();
    let high_txn = make_other_transaction(user_id, high_id, "Whole Foods", dec!(-20.00));
    let medium_txn = make_other_transaction(user_id, medium_id, "Shell", dec!(-35.00));
    let low_txn = make_other_transaction(user_id, low_id, "Unknown", dec!(-5.00));

    let mut db = MockDatabaseRepository::new();
    db.expect_count_eligible_auto_categorize_transactions()
        .with(eq(user_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(3) }));
    db.expect_fetch_eligible_auto_categorize_transactions()
        .with(eq(user_id), always(), always(), always())
        .times(1)
        .returning(move |_, _, _, _| {
            let txns = vec![high_txn.clone(), medium_txn.clone(), low_txn.clone()];
            Box::pin(async move { Ok(txns) })
        });
    db.expect_update_transaction_categories_batch()
        .with(eq(user_id), always())
        .times(1)
        .returning(move |_, updates| {
            assert_eq!(updates.len(), 2);
            assert!(updates.iter().any(|update| {
                update.transaction_id == high_id
                    && update.category_primary == "FOOD_AND_DRINK"
                    && update.category_confidence == "HIGH"
            }));
            assert!(updates.iter().any(|update| {
                update.transaction_id == medium_id
                    && update.category_primary == "TRANSPORTATION"
                    && update.category_confidence == "MEDIUM"
            }));
            assert!(!updates.iter().any(|update| update.transaction_id == low_id));
            Box::pin(async { Ok(()) })
        });

    struct MultiPredictionCategorizer {
        call: Arc<Mutex<usize>>,
    }

    #[async_trait]
    impl Categorizer for MultiPredictionCategorizer {
        async fn categorize_batch(
            &self,
            descriptions: Vec<String>,
        ) -> Result<Vec<PredictedCategory>> {
            let mut predictions = Vec::with_capacity(descriptions.len());
            for _ in descriptions {
                let mut current = self.call.lock().unwrap();
                *current += 1;
                let prediction = match *current {
                    1 => PredictedCategory {
                        primary: "FOOD_AND_DRINK".to_string(),
                        confidence: Confidence::High,
                    },
                    2 => PredictedCategory {
                        primary: "TRANSPORTATION".to_string(),
                        confidence: Confidence::Medium,
                    },
                    _ => PredictedCategory {
                        primary: "OTHER".to_string(),
                        confidence: Confidence::Low,
                    },
                };
                predictions.push(prediction);
            }
            Ok(predictions)
        }
    }

    let service = make_service(
        db,
        InMemoryCache::new().into_mock(),
        Arc::new(MultiPredictionCategorizer {
            call: Arc::new(Mutex::new(0)),
        }),
    );

    service.start(&user_id, jwt_id).await.unwrap();
    let finished = wait_for_terminal_status(&service, &user_id).await;
    assert_eq!(finished.status, AutoCategorizationJobStatus::Completed);
    assert_eq!(finished.updated, 2);
    assert_eq!(finished.skipped, 1);
}

#[tokio::test]
async fn given_running_job_when_cancel_requested_then_stops_after_current_batch() {
    let user_id = Uuid::new_v4();
    let jwt_id = "jwt-cancel";
    let batch = (0..2)
        .map(|index| {
            make_other_transaction(
                user_id,
                Uuid::new_v4(),
                &format!("Batch One {index}"),
                dec!(-10.00),
            )
        })
        .collect::<Vec<_>>();

    let mut db = MockDatabaseRepository::new();
    db.expect_count_eligible_auto_categorize_transactions()
        .with(eq(user_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(2) }));
    db.expect_fetch_eligible_auto_categorize_transactions()
        .times(1)
        .returning({
            let batch = batch.clone();
            move |_, _, _, _| {
                let batch = batch.clone();
                Box::pin(async move { Ok(batch) })
            }
        });
    db.expect_update_transaction_categories_batch()
        .times(1)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let batch_gate = Arc::new(Notify::new());
    let batch_entered = Arc::new(AtomicBool::new(false));
    let service = make_service(
        db,
        InMemoryCache::new().into_mock(),
        Arc::new(StubCategorizer {
            predictions: vec![PredictedCategory {
                primary: "FOOD_AND_DRINK".to_string(),
                confidence: Confidence::High,
            }],
            gate: Some(Arc::clone(&batch_gate)),
            entered: Some(Arc::clone(&batch_entered)),
        }),
    );

    service.start(&user_id, jwt_id).await.unwrap();
    for _ in 0..50 {
        if batch_entered.load(Ordering::SeqCst) {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }
    service.cancel(&user_id).await.unwrap();
    batch_gate.notify_one();

    let finished = wait_for_terminal_status(&service, &user_id).await;
    assert_eq!(finished.status, AutoCategorizationJobStatus::Cancelled);
    assert_eq!(finished.processed, 2);
}

#[tokio::test]
async fn given_completed_job_when_reading_status_then_terminal_state_is_available() {
    let user_id = Uuid::new_v4();
    let jwt_id = "jwt-terminal";
    let txn_id = Uuid::new_v4();
    let txn = make_other_transaction(user_id, txn_id, "Done Shop", dec!(-8.00));

    let mut db = MockDatabaseRepository::new();
    db.expect_count_eligible_auto_categorize_transactions()
        .with(eq(user_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(1) }));
    db.expect_fetch_eligible_auto_categorize_transactions()
        .times(..)
        .returning(move |_, _, _, _| {
            let txn = txn.clone();
            Box::pin(async move { Ok(vec![txn]) })
        });
    db.expect_update_transaction_categories_batch()
        .times(..)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let cache = InMemoryCache::new();
    let service = make_service(
        db,
        cache.into_mock(),
        Arc::new(StubCategorizer {
            predictions: vec![PredictedCategory {
                primary: "SHOPPING".to_string(),
                confidence: Confidence::High,
            }],
            gate: None,
            entered: None,
        }),
    );

    service.start(&user_id, jwt_id).await.unwrap();
    let finished = wait_for_terminal_status(&service, &user_id).await;
    assert_eq!(finished.status, AutoCategorizationJobStatus::Completed);
    assert!(finished.finished_at.is_some());

    let restored = service.get_status(&user_id).await.unwrap().unwrap();
    assert_eq!(restored.job_id, finished.job_id);
    assert_eq!(restored.status, AutoCategorizationJobStatus::Completed);
}

#[tokio::test]
async fn given_completed_job_when_worker_finishes_then_session_caches_are_invalidated() {
    let user_id = Uuid::new_v4();
    let jwt_id = "jwt-cache";
    let txn_id = Uuid::new_v4();
    let txn = make_other_transaction(user_id, txn_id, "Cache Shop", dec!(-3.00));

    let mut db = MockDatabaseRepository::new();
    db.expect_count_eligible_auto_categorize_transactions()
        .with(eq(user_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(1) }));
    db.expect_fetch_eligible_auto_categorize_transactions()
        .times(..)
        .returning(move |_, _, _, _| {
            let txn = txn.clone();
            Box::pin(async move { Ok(vec![txn]) })
        });
    db.expect_update_transaction_categories_batch()
        .times(..)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let store = Arc::new(Mutex::new(HashMap::new()));
    let get_store = Arc::clone(&store);
    let set_store = Arc::clone(&store);

    let mut cache = MockCacheService::new();
    cache
        .expect_set_with_ttl()
        .times(..)
        .returning(move |key, value, _ttl| {
            set_store
                .lock()
                .unwrap()
                .insert(key.to_string(), value.to_string());
            Box::pin(async { Ok(()) })
        });
    cache.expect_get_string().times(..).returning(move |key| {
        let value = get_store.lock().unwrap().get(key).cloned();
        Box::pin(async move { Ok(value) })
    });
    cache
        .expect_clear_transactions()
        .with(eq(jwt_id.to_string()))
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));
    cache
        .expect_clear_budgets()
        .with(eq(jwt_id.to_string()))
        .times(1)
        .returning(|_| Box::pin(async { Ok(()) }));
    cache
        .expect_invalidate_pattern()
        .times(2)
        .returning(|pattern| {
            assert!(
                pattern.contains("_balances_overview") || pattern.contains("_net_worth_over_time_")
            );
            Box::pin(async { Ok(()) })
        });

    let service = make_service(
        db,
        cache,
        Arc::new(StubCategorizer {
            predictions: vec![PredictedCategory {
                primary: "SHOPPING".to_string(),
                confidence: Confidence::High,
            }],
            gate: None,
            entered: None,
        }),
    );

    service.start(&user_id, jwt_id).await.unwrap();
    let finished = wait_for_terminal_status(&service, &user_id).await;
    assert_eq!(finished.status, AutoCategorizationJobStatus::Completed);
}

#[tokio::test]
async fn given_multiple_batches_when_earlier_rows_are_categorized_then_later_batches_use_cursor() {
    let user_id = Uuid::new_v4();
    let jwt_id = "jwt-cursor-pages";
    let date = NaiveDate::from_ymd_opt(2024, 3, 1).unwrap();
    let first_id = Uuid::parse_str("00000000-0000-4000-8000-000000000001").unwrap();
    let second_id = Uuid::parse_str("00000000-0000-4000-8000-000000000002").unwrap();
    let third_id = Uuid::parse_str("00000000-0000-4000-8000-000000000003").unwrap();

    let mut first_txn = make_other_transaction(user_id, first_id, "Shop A", dec!(-10.00));
    first_txn.date = date;
    let mut second_txn = make_other_transaction(user_id, second_id, "Shop B", dec!(-11.00));
    second_txn.date = date;
    let mut third_txn = make_other_transaction(user_id, third_id, "Shop C", dec!(-12.00));
    third_txn.date = date;

    let first_batch = vec![first_txn, second_txn.clone()];
    let second_batch = vec![third_txn];
    let cursor_date = second_txn.date;
    let cursor_id = second_txn.id;

    let mut db = MockDatabaseRepository::new();
    db.expect_count_eligible_auto_categorize_transactions()
        .with(eq(user_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(3) }));
    db.expect_fetch_eligible_auto_categorize_transactions()
        .with(
            eq(user_id),
            eq(2_i64),
            eq(None::<NaiveDate>),
            eq(None::<Uuid>),
        )
        .times(1)
        .returning({
            let batch = first_batch.clone();
            move |_, _, _, _| {
                let batch = batch.clone();
                Box::pin(async move { Ok(batch) })
            }
        });
    db.expect_fetch_eligible_auto_categorize_transactions()
        .with(
            eq(user_id),
            eq(2_i64),
            eq(Some(cursor_date)),
            eq(Some(cursor_id)),
        )
        .times(1)
        .returning({
            let batch = second_batch.clone();
            move |_, _, _, _| {
                let batch = batch.clone();
                Box::pin(async move { Ok(batch) })
            }
        });
    db.expect_update_transaction_categories_batch()
        .times(2)
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let service = make_service(
        db,
        InMemoryCache::new().into_mock(),
        Arc::new(StubCategorizer {
            predictions: vec![PredictedCategory {
                primary: "FOOD_AND_DRINK".to_string(),
                confidence: Confidence::High,
            }],
            gate: None,
            entered: None,
        }),
    );

    service.start(&user_id, jwt_id).await.unwrap();
    let finished = wait_for_terminal_status(&service, &user_id).await;
    assert_eq!(finished.status, AutoCategorizationJobStatus::Completed);
    assert_eq!(finished.processed, 3);
    assert_eq!(finished.updated, 3);
}

#[tokio::test]
async fn given_eligible_query_when_counting_then_excludes_override_backed_transactions() {
    let user_id = Uuid::new_v4();

    let mut db = MockDatabaseRepository::new();
    db.expect_count_eligible_auto_categorize_transactions()
        .with(eq(user_id))
        .times(1)
        .returning(|_| Box::pin(async { Ok(2) }));

    let service = make_service(
        db,
        InMemoryCache::new().into_mock(),
        Arc::new(StubCategorizer {
            predictions: vec![PredictedCategory {
                primary: "FOOD_AND_DRINK".to_string(),
                confidence: Confidence::High,
            }],
            gate: None,
            entered: None,
        }),
    );

    let count = service
        .count_eligible(&user_id)
        .await
        .expect("eligible count");
    assert_eq!(count, 2);
}
