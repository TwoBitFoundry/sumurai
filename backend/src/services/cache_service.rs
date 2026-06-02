//! Redis cache for session-scoped API and connection data.

use crate::models::{
    cache::{CachedBankAccounts, CachedBankConnection, CachedTransaction},
    ip_ban::AuthIpBanPolicy,
    transaction::Transaction,
};
use anyhow::Result;
use async_trait::async_trait;
use redis::{aio::ConnectionManager, AsyncCommands, Client};
use uuid::Uuid;

const SYNCED_TRANSACTIONS_SUFFIX: &str = "_synced_transactions";
const ACCESS_TOKEN_SUFFIX: &str = "_access_token";
const SESSION_TOKEN_SUFFIX: &str = "_session_token";
const BANK_CONNECTION_SUFFIX: &str = "_bank_connection_";
const BANK_ACCOUNTS_SUFFIX: &str = "_bank_accounts_";
const SESSION_VALID_SUFFIX: &str = "_session_valid";
const BUDGETS_SUFFIX: &str = "_budgets";

const ACCESS_TOKEN_TTL: u64 = 3600;
const TRANSACTIONS_TTL: u64 = 1800;
const BANK_CONNECTION_TTL: u64 = 7200;
const BANK_ACCOUNTS_TTL: u64 = 7200;
const BUDGETS_TTL: u64 = 300;
pub const WEBAUTHN_CHALLENGE_TTL: u64 = 300;
const WEBAUTHN_CHALLENGE_SUFFIX: &str = "_webauthn_challenge";

pub fn synced_transactions_key(jwt_id: &str) -> String {
    format!("{}{}", jwt_id, SYNCED_TRANSACTIONS_SUFFIX)
}

#[async_trait]
#[cfg_attr(test, mockall::automock)]
pub trait CacheService: Send + Sync {
    async fn health_check(&self) -> Result<()>;
    async fn set_access_token(&self, jwt_id: &str, item_id: &str, access_token: &str)
        -> Result<()>;
    async fn delete_access_token(&self, jwt_id: &str, item_id: &str) -> Result<()>;
    async fn add_transaction(&self, jwt_id: &str, transaction: &Transaction) -> Result<()>;
    async fn clear_transactions(&self, jwt_id: &str) -> Result<()>;

    async fn invalidate_pattern(&self, pattern: &str) -> Result<()>;
    async fn set_with_ttl(&self, key: &str, value: &str, ttl_seconds: u64) -> Result<()>;
    async fn get_string(&self, key: &str) -> Result<Option<String>>;
    async fn get_counter(&self, key: &str) -> Result<Option<i64>>;
    async fn increment_counter(&self, key: &str, ttl_seconds: u64) -> Result<i64>;

    async fn set_jwt_token(&self, jwt_id: &str, token: &str, ttl_seconds: u64) -> Result<()>;
    async fn get_jwt_token(&self, jwt_id: &str) -> Result<Option<String>>;

    async fn cache_jwt_scoped_bank_connection(
        &self,
        jwt_id: &str,
        cached_connection: &CachedBankConnection,
    ) -> Result<()>;

    async fn cache_jwt_scoped_bank_accounts(
        &self,
        jwt_id: &str,
        connection_id: Uuid,
        cached_accounts: &CachedBankAccounts,
    ) -> Result<()>;

    async fn clear_jwt_scoped_bank_connection_cache(
        &self,
        jwt_id: &str,
        connection_id: Uuid,
    ) -> Result<()>;

    async fn set_session_valid(&self, jwt_id: &str, ttl_seconds: u64) -> Result<()>;
    async fn is_session_valid(&self, jwt_id: &str) -> Result<bool>;
    async fn invalidate_session(&self, jwt_id: &str) -> Result<()>;

    async fn clear_jwt_scoped_data(&self, jwt_id: &str) -> Result<()>;

    async fn is_auth_ip_banned(&self, ip: &str) -> Result<bool>;

    async fn record_auth_rate_limit_exceeded(&self, ip: &str) -> Result<()>;

    async fn get_budgets(&self, jwt_id: &str) -> Result<Option<String>>;
    async fn set_budgets(&self, jwt_id: &str, budgets_json: &str) -> Result<()>;
    async fn clear_budgets(&self, jwt_id: &str) -> Result<()>;

    async fn set_webauthn_challenge(&self, session_id: &str, state_json: &str) -> Result<()>;
    async fn take_webauthn_challenge(&self, session_id: &str) -> Result<Option<String>>;
}

pub struct RedisCache {
    connection_manager: ConnectionManager,
}

impl RedisCache {
    pub async fn new(redis_url: &str) -> Result<Self> {
        let client = Client::open(redis_url)?;
        let connection = client.get_connection_manager().await?;
        Ok(Self {
            connection_manager: connection,
        })
    }

    pub async fn health_check(&self) -> Result<()> {
        let mut conn = self.connection_manager.clone();
        let _: String = conn.ping().await?;
        Ok(())
    }

    fn access_token_key(&self, jwt_id: &str, item_id: &str) -> String {
        format!("{}{}_{}", jwt_id, ACCESS_TOKEN_SUFFIX, item_id)
    }

    fn jwt_session_key(&self, jwt_id: &str) -> String {
        format!("{}{}", jwt_id, SESSION_TOKEN_SUFFIX)
    }

    fn jwt_valid_key(&self, jwt_id: &str) -> String {
        format!("{}{}", jwt_id, SESSION_VALID_SUFFIX)
    }

    fn jwt_scoped_bank_connection_key(&self, jwt_id: &str, connection_id: Uuid) -> String {
        format!("{}{}{}", jwt_id, BANK_CONNECTION_SUFFIX, connection_id)
    }

    fn jwt_scoped_bank_accounts_key(&self, jwt_id: &str, connection_id: Uuid) -> String {
        format!("{}{}{}", jwt_id, BANK_ACCOUNTS_SUFFIX, connection_id)
    }

    fn budgets_key(&self, jwt_id: &str) -> String {
        format!("{}{}", jwt_id, BUDGETS_SUFFIX)
    }

    pub async fn cache_jwt_scoped_bank_connection(
        &self,
        jwt_id: &str,
        cached_connection: &CachedBankConnection,
    ) -> Result<()> {
        let mut conn = self.connection_manager.clone();
        let key = self.jwt_scoped_bank_connection_key(jwt_id, cached_connection.connection.id);
        let serialized = serde_json::to_string(cached_connection)?;
        conn.set_ex::<_, _, ()>(&key, &serialized, BANK_CONNECTION_TTL)
            .await?;
        Ok(())
    }

    pub async fn cache_jwt_scoped_bank_accounts(
        &self,
        jwt_id: &str,
        connection_id: Uuid,
        cached_accounts: &CachedBankAccounts,
    ) -> Result<()> {
        let mut conn = self.connection_manager.clone();
        let key = self.jwt_scoped_bank_accounts_key(jwt_id, connection_id);
        let serialized = serde_json::to_string(cached_accounts)?;
        conn.set_ex::<_, _, ()>(&key, &serialized, BANK_ACCOUNTS_TTL)
            .await?;
        Ok(())
    }

    pub async fn clear_jwt_scoped_bank_connection_cache(
        &self,
        jwt_id: &str,
        connection_id: Uuid,
    ) -> Result<()> {
        let connection_pattern = self.jwt_scoped_bank_connection_key(jwt_id, connection_id);
        let accounts_pattern = self.jwt_scoped_bank_accounts_key(jwt_id, connection_id);

        self.invalidate_pattern(&connection_pattern).await?;
        self.invalidate_pattern(&accounts_pattern).await?;

        Ok(())
    }

    pub async fn set_access_token(
        &self,
        jwt_id: &str,
        item_id: &str,
        access_token: &str,
    ) -> Result<()> {
        let mut conn = self.connection_manager.clone();
        let key = self.access_token_key(jwt_id, item_id);
        conn.set_ex::<_, _, ()>(&key, access_token, ACCESS_TOKEN_TTL)
            .await?;
        Ok(())
    }

    pub async fn delete_access_token(&self, jwt_id: &str, item_id: &str) -> Result<()> {
        let mut conn = self.connection_manager.clone();
        let key = self.access_token_key(jwt_id, item_id);

        conn.del::<_, ()>(&key).await?;
        Ok(())
    }

    pub async fn add_transaction(&self, jwt_id: &str, transaction: &Transaction) -> Result<()> {
        let mut conn = self.connection_manager.clone();
        let key = synced_transactions_key(jwt_id);
        let result: Option<String> = conn.get(&key).await?;

        let mut transactions = match result {
            Some(serialized) => {
                let cached: CachedTransaction = serde_json::from_str(&serialized)?;
                cached.transactions
            }
            None => Vec::new(),
        };

        transactions.push(transaction.clone());

        let cached_transactions = CachedTransaction {
            transactions,
            cached_at: chrono::Utc::now(),
        };
        let serialized = serde_json::to_string(&cached_transactions)?;
        conn.set_ex::<_, _, ()>(&key, serialized, TRANSACTIONS_TTL)
            .await?;
        Ok(())
    }

    pub async fn clear_transactions(&self, jwt_id: &str) -> Result<()> {
        let mut conn = self.connection_manager.clone();
        let key = synced_transactions_key(jwt_id);
        conn.del::<_, ()>(key).await?;
        Ok(())
    }

    pub async fn invalidate_pattern(&self, pattern: &str) -> Result<()> {
        let mut conn = self.connection_manager.clone();
        let keys: Vec<String> = conn.keys(pattern).await?;
        for key in keys {
            let _: () = conn.del(key).await?;
        }
        Ok(())
    }

    pub async fn set_with_ttl(&self, key: &str, value: &str, ttl_seconds: u64) -> Result<()> {
        let mut conn = self.connection_manager.clone();
        conn.set_ex::<_, _, ()>(key, value, ttl_seconds).await?;
        Ok(())
    }

    pub async fn get_string(&self, key: &str) -> Result<Option<String>> {
        let mut conn = self.connection_manager.clone();
        let result: Option<String> = conn.get(key).await?;
        Ok(result)
    }

    pub async fn get_counter(&self, key: &str) -> Result<Option<i64>> {
        let mut conn = self.connection_manager.clone();
        let result: Option<i64> = conn.get(key).await?;
        Ok(result)
    }

    pub async fn increment_counter(&self, key: &str, ttl_seconds: u64) -> Result<i64> {
        let mut conn = self.connection_manager.clone();
        let count: i64 = conn.incr(key, 1i64).await?;
        if count == 1 {
            conn.expire::<_, ()>(key, ttl_seconds as i64).await?;
        }
        Ok(count)
    }

    pub async fn set_jwt_token(&self, jwt_id: &str, token: &str, ttl_seconds: u64) -> Result<()> {
        let mut conn = self.connection_manager.clone();
        let key = self.jwt_session_key(jwt_id);
        conn.set_ex::<_, _, ()>(&key, token, ttl_seconds).await?;
        Ok(())
    }

    pub async fn get_jwt_token(&self, jwt_id: &str) -> Result<Option<String>> {
        let mut conn = self.connection_manager.clone();
        let key = self.jwt_session_key(jwt_id);
        let result: Option<String> = conn.get(&key).await?;
        Ok(result)
    }

    pub async fn set_session_valid(&self, jwt_id: &str, ttl_seconds: u64) -> Result<()> {
        let mut conn = self.connection_manager.clone();
        let key = self.jwt_valid_key(jwt_id);
        conn.set_ex::<_, _, ()>(&key, "1", ttl_seconds).await?;
        Ok(())
    }

    pub async fn is_session_valid(&self, jwt_id: &str) -> Result<bool> {
        let mut conn = self.connection_manager.clone();
        let key = self.jwt_valid_key(jwt_id);
        let result: Result<Option<String>> = conn.get(&key).await.map_err(anyhow::Error::from);

        match result {
            Ok(Some(_)) => {
                tracing::debug!(cache_hit = true, "Session validation cache hit");
                Ok(true)
            }
            Ok(None) => {
                tracing::debug!(cache_hit = false, "Session validation cache miss");
                Ok(false)
            }
            Err(e) => {
                tracing::warn!(error = %e, "Session validation cache error");
                Err(anyhow::anyhow!("Cache error: {}", e))
            }
        }
    }

    pub async fn invalidate_session(&self, jwt_id: &str) -> Result<()> {
        let mut conn = self.connection_manager.clone();
        let token_key = self.jwt_session_key(jwt_id);
        let valid_key = self.jwt_valid_key(jwt_id);
        conn.del::<_, ()>(&token_key).await?;
        conn.del::<_, ()>(&valid_key).await?;
        Ok(())
    }

    pub async fn clear_jwt_scoped_data(&self, jwt_id: &str) -> Result<()> {
        let mut conn = self.connection_manager.clone();

        let pattern = format!("{}*", jwt_id);
        let keys: Vec<String> = conn.keys(&pattern).await?;
        for key in keys {
            let _: () = conn.del(key).await?;
        }

        Ok(())
    }

    pub async fn is_auth_ip_banned(&self, ip: &str) -> Result<bool> {
        let mut conn = self.connection_manager.clone();
        let key = AuthIpBanPolicy::ban_key(ip);
        let exists: bool = conn.exists(&key).await?;
        Ok(exists)
    }

    pub async fn record_auth_rate_limit_exceeded(&self, ip: &str) -> Result<()> {
        let mut conn = self.connection_manager.clone();
        let strike_key = AuthIpBanPolicy::strike_key(ip);
        let ban_key = AuthIpBanPolicy::ban_key(ip);

        let count: i64 = conn.incr(&strike_key, 1i64).await?;

        if count == 1 {
            conn.expire::<_, ()>(
                &strike_key,
                AuthIpBanPolicy::STRIKE_TRACKING_WINDOW_SECS as i64,
            )
            .await?;
        }

        let lockout_secs = AuthIpBanPolicy::lockout_secs_for_strike_count(count);
        conn.set_ex::<_, _, ()>(&ban_key, "1", lockout_secs).await?;

        tracing::warn!(
            ip,
            strike_count = count,
            lockout_secs,
            "Auth endpoint progressive lockout after rate limit"
        );

        Ok(())
    }

    pub async fn get_budgets(&self, jwt_id: &str) -> Result<Option<String>> {
        self.get_string(&self.budgets_key(jwt_id)).await
    }

    pub async fn set_budgets(&self, jwt_id: &str, budgets_json: &str) -> Result<()> {
        self.set_with_ttl(&self.budgets_key(jwt_id), budgets_json, BUDGETS_TTL)
            .await
    }

    pub async fn clear_budgets(&self, jwt_id: &str) -> Result<()> {
        let mut conn = self.connection_manager.clone();
        conn.del::<_, ()>(self.budgets_key(jwt_id)).await?;
        Ok(())
    }

    fn webauthn_challenge_key(&self, session_id: &str) -> String {
        format!("{}{}", session_id, WEBAUTHN_CHALLENGE_SUFFIX)
    }

    pub async fn set_webauthn_challenge(&self, session_id: &str, state_json: &str) -> Result<()> {
        self.set_with_ttl(
            &self.webauthn_challenge_key(session_id),
            state_json,
            WEBAUTHN_CHALLENGE_TTL,
        )
        .await
    }

    pub async fn take_webauthn_challenge(&self, session_id: &str) -> Result<Option<String>> {
        let key = self.webauthn_challenge_key(session_id);
        let value = self.get_string(&key).await?;
        if value.is_some() {
            let mut conn = self.connection_manager.clone();
            conn.del::<_, ()>(&key).await?;
        }
        Ok(value)
    }
}

#[async_trait]
impl CacheService for RedisCache {
    async fn health_check(&self) -> Result<()> {
        self.health_check().await
    }

    async fn set_access_token(
        &self,
        jwt_id: &str,
        item_id: &str,
        access_token: &str,
    ) -> Result<()> {
        self.set_access_token(jwt_id, item_id, access_token).await
    }

    async fn delete_access_token(&self, jwt_id: &str, item_id: &str) -> Result<()> {
        self.delete_access_token(jwt_id, item_id).await
    }

    async fn add_transaction(&self, jwt_id: &str, transaction: &Transaction) -> Result<()> {
        self.add_transaction(jwt_id, transaction).await
    }

    async fn clear_transactions(&self, jwt_id: &str) -> Result<()> {
        self.clear_transactions(jwt_id).await
    }

    async fn invalidate_pattern(&self, pattern: &str) -> Result<()> {
        self.invalidate_pattern(pattern).await
    }

    async fn set_with_ttl(&self, key: &str, value: &str, ttl_seconds: u64) -> Result<()> {
        self.set_with_ttl(key, value, ttl_seconds).await
    }

    async fn get_string(&self, key: &str) -> Result<Option<String>> {
        self.get_string(key).await
    }

    async fn get_counter(&self, key: &str) -> Result<Option<i64>> {
        self.get_counter(key).await
    }

    async fn increment_counter(&self, key: &str, ttl_seconds: u64) -> Result<i64> {
        self.increment_counter(key, ttl_seconds).await
    }

    async fn set_jwt_token(&self, jwt_id: &str, token: &str, ttl_seconds: u64) -> Result<()> {
        self.set_jwt_token(jwt_id, token, ttl_seconds).await
    }

    async fn get_jwt_token(&self, jwt_id: &str) -> Result<Option<String>> {
        self.get_jwt_token(jwt_id).await
    }

    async fn cache_jwt_scoped_bank_connection(
        &self,
        jwt_id: &str,
        cached_connection: &CachedBankConnection,
    ) -> Result<()> {
        self.cache_jwt_scoped_bank_connection(jwt_id, cached_connection)
            .await
    }

    async fn cache_jwt_scoped_bank_accounts(
        &self,
        jwt_id: &str,
        connection_id: Uuid,
        cached_accounts: &CachedBankAccounts,
    ) -> Result<()> {
        self.cache_jwt_scoped_bank_accounts(jwt_id, connection_id, cached_accounts)
            .await
    }

    async fn clear_jwt_scoped_bank_connection_cache(
        &self,
        jwt_id: &str,
        connection_id: Uuid,
    ) -> Result<()> {
        self.clear_jwt_scoped_bank_connection_cache(jwt_id, connection_id)
            .await
    }

    async fn set_session_valid(&self, jwt_id: &str, ttl_seconds: u64) -> Result<()> {
        self.set_session_valid(jwt_id, ttl_seconds).await
    }

    async fn is_session_valid(&self, jwt_id: &str) -> Result<bool> {
        self.is_session_valid(jwt_id).await
    }

    async fn invalidate_session(&self, jwt_id: &str) -> Result<()> {
        self.invalidate_session(jwt_id).await
    }

    async fn clear_jwt_scoped_data(&self, jwt_id: &str) -> Result<()> {
        self.clear_jwt_scoped_data(jwt_id).await
    }

    async fn is_auth_ip_banned(&self, ip: &str) -> Result<bool> {
        self.is_auth_ip_banned(ip).await
    }

    async fn record_auth_rate_limit_exceeded(&self, ip: &str) -> Result<()> {
        self.record_auth_rate_limit_exceeded(ip).await
    }

    async fn get_budgets(&self, jwt_id: &str) -> Result<Option<String>> {
        self.get_budgets(jwt_id).await
    }

    async fn set_budgets(&self, jwt_id: &str, budgets_json: &str) -> Result<()> {
        self.set_budgets(jwt_id, budgets_json).await
    }

    async fn clear_budgets(&self, jwt_id: &str) -> Result<()> {
        self.clear_budgets(jwt_id).await
    }

    async fn set_webauthn_challenge(&self, session_id: &str, state_json: &str) -> Result<()> {
        self.set_webauthn_challenge(session_id, state_json).await
    }

    async fn take_webauthn_challenge(&self, session_id: &str) -> Result<Option<String>> {
        self.take_webauthn_challenge(session_id).await
    }
}
