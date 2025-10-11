use anyhow::Result;
use std::collections::HashMap;

pub trait EnvironmentProvider {
    fn get_var(&self, key: &str) -> Option<String>;
}

pub struct SystemEnvironment;

impl EnvironmentProvider for SystemEnvironment {
    fn get_var(&self, key: &str) -> Option<String> {
        std::env::var(key).ok()
    }
}

#[derive(Clone)]
pub struct Config {
    #[allow(dead_code)]
    pub database_url: String,
    default_provider: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        dotenv::dotenv().ok();
        Self::from_env_provider(&SystemEnvironment)
    }

    pub fn from_env_provider(env: &dyn EnvironmentProvider) -> Result<Self> {
        let database_url = env.get_var("DATABASE_URL").unwrap_or_else(|| {
            "postgresql://postgres:password@localhost:5432/accounting".to_string()
        });

        let default_provider = env.get_var("DEFAULT_PROVIDER")
            .unwrap_or_else(|| "teller".to_string());

        Ok(Self {
            database_url,
            default_provider,
        })
    }

    #[allow(dead_code)]
    pub fn default() -> Self {
        Self {
            database_url: "postgresql://postgres:password@localhost:5432/accounting".to_string(),
            default_provider: "teller".to_string(),
        }
    }

    pub fn get_default_provider(&self) -> &str {
        &self.default_provider
    }
}

#[cfg(test)]
pub struct MockEnvironment {
    vars: HashMap<String, String>,
}

#[cfg(test)]
impl MockEnvironment {
    pub fn new() -> Self {
        Self {
            vars: HashMap::new(),
        }
    }

    pub fn set(&mut self, key: &str, value: &str) {
        self.vars.insert(key.to_string(), value.to_string());
    }
}

#[cfg(test)]
impl EnvironmentProvider for MockEnvironment {
    fn get_var(&self, key: &str) -> Option<String> {
        self.vars.get(key).cloned()
    }
}
