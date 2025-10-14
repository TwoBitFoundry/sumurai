use std::collections::HashMap;
use std::sync::Arc;

use super::FinancialDataProvider;

pub struct ProviderRegistry {
    providers: HashMap<String, Arc<dyn FinancialDataProvider>>,
}

impl ProviderRegistry {
    pub fn new() -> Self {
        Self {
            providers: HashMap::new(),
        }
    }

    pub fn from_providers<I, K>(providers: I) -> Self
    where
        I: IntoIterator<Item = (K, Arc<dyn FinancialDataProvider>)>,
        K: Into<String>,
    {
        let mut registry = Self::new();
        for (key, provider) in providers {
            registry.register(key, provider);
        }
        registry
    }

    pub fn register<K>(&mut self, key: K, provider: Arc<dyn FinancialDataProvider>)
    where
        K: Into<String>,
    {
        let key = key.into();
        let normalized = Self::normalize_key(&key);
        self.providers.insert(normalized, provider);
    }

    pub fn get(&self, key: &str) -> Option<Arc<dyn FinancialDataProvider>> {
        let normalized = Self::normalize_key(key);
        self.providers.get(&normalized).cloned()
    }

    fn normalize_key(key: &str) -> String {
        key.trim().to_lowercase()
    }
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        Self::new()
    }
}
