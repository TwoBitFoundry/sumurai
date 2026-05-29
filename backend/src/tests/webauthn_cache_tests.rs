use crate::services::cache_service::RedisCache;
use uuid::Uuid;

async fn connect_cache() -> Option<RedisCache> {
    let url = match std::env::var("REDIS_URL") {
        Ok(u) => u,
        Err(_) => {
            eprintln!("[webauthn_cache_tests] Skipping: REDIS_URL not set");
            return None;
        }
    };
    match RedisCache::new(&url).await {
        Ok(c) => Some(c),
        Err(err) => {
            eprintln!("[webauthn_cache_tests] Skipping: cannot connect: {}", err);
            None
        }
    }
}

#[tokio::test]
async fn given_set_challenge_when_take_then_returns_value() {
    let Some(cache) = connect_cache().await else {
        return;
    };

    let session_id = Uuid::new_v4().to_string();
    cache
        .set_webauthn_challenge(&session_id, "state_payload")
        .await
        .unwrap();

    let taken = cache.take_webauthn_challenge(&session_id).await.unwrap();
    assert_eq!(taken, Some("state_payload".to_string()));
}

#[tokio::test]
async fn given_taken_challenge_when_take_again_then_none() {
    let Some(cache) = connect_cache().await else {
        return;
    };

    let session_id = Uuid::new_v4().to_string();
    cache
        .set_webauthn_challenge(&session_id, "state_payload")
        .await
        .unwrap();

    let _ = cache.take_webauthn_challenge(&session_id).await.unwrap();
    let second = cache.take_webauthn_challenge(&session_id).await.unwrap();
    assert!(second.is_none(), "challenge must be single-use");
}

#[tokio::test]
async fn given_no_challenge_when_take_then_none() {
    let Some(cache) = connect_cache().await else {
        return;
    };

    let session_id = Uuid::new_v4().to_string();
    let result = cache.take_webauthn_challenge(&session_id).await.unwrap();
    assert!(result.is_none());
}
