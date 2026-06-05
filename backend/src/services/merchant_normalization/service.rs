use std::sync::Arc;

use anyhow::Result;

use crate::models::transaction::Transaction;
use crate::services::cache_service::CacheService;
use crate::services::repository_service::DatabaseRepository;
use crate::utils::merchant_name::normalize_merchant_for_match;

use super::engine::normalize;
use super::types::{AliasIndex, MerchantSource};

const ALIAS_INDEX_CACHE_KEY: &str = "merchant_aliases_index";
const ALIAS_INDEX_TTL: u64 = 3600;

pub struct MerchantNormalizationService {
    db: Arc<dyn DatabaseRepository>,
    cache: Arc<dyn CacheService>,
}

impl MerchantNormalizationService {
    pub fn new(db: Arc<dyn DatabaseRepository>, cache: Arc<dyn CacheService>) -> Self {
        Self { db, cache }
    }

    pub async fn alias_index(&self) -> Result<Arc<AliasIndex>> {
        if let Some(cached) = self.cache.get_string(ALIAS_INDEX_CACHE_KEY).await? {
            if let Ok(rows) = serde_json::from_str(&cached) {
                return Ok(Arc::new(AliasIndex::from_rows(rows)));
            }
        }

        let rows = self.db.get_active_merchant_aliases().await?;
        let json = serde_json::to_string(&rows)?;
        self.cache
            .set_with_ttl(ALIAS_INDEX_CACHE_KEY, &json, ALIAS_INDEX_TTL)
            .await?;

        Ok(Arc::new(AliasIndex::from_rows(rows)))
    }

    pub async fn normalize_batch(&self, txns: &mut [Transaction]) -> Result<()> {
        if txns.is_empty() {
            return Ok(());
        }

        let index = self.alias_index().await?;

        for txn in txns.iter_mut() {
            let raw = txn
                .original_merchant_name
                .as_deref()
                .or(txn.merchant_name.as_deref())
                .unwrap_or("");

            if raw.is_empty() {
                continue;
            }

            let result = normalize(raw, MerchantSource::Raw, &index);
            txn.merchant_name = Some(result.display.clone());
            txn.normalized_merchant = Some(normalize_merchant_for_match(&result.display));
        }

        Ok(())
    }
}
