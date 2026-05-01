use anyhow::{anyhow, Result};
#[cfg(test)]
use std::collections::HashMap;
use std::fmt;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AuthCookieSameSite {
    Strict,
    Lax,
}

impl AuthCookieSameSite {
    fn parse(value: &str) -> Result<Self> {
        match value {
            "Strict" => Ok(Self::Strict),
            "Lax" => Ok(Self::Lax),
            _ => Err(anyhow!(
                "AUTH_COOKIE_SAME_SITE must be either Strict or Lax"
            )),
        }
    }
}

impl fmt::Display for AuthCookieSameSite {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AuthCookieSameSite::Strict => f.write_str("Strict"),
            AuthCookieSameSite::Lax => f.write_str("Lax"),
        }
    }
}

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
    default_provider: String,
    teller_application_id: Option<String>,
    teller_environment: String,
    auth_cookie_same_site: AuthCookieSameSite,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Self::from_env_provider(&SystemEnvironment)
    }

    pub fn from_env_provider(env: &dyn EnvironmentProvider) -> Result<Self> {
        let default_provider = env
            .get_var("DEFAULT_PROVIDER")
            .unwrap_or_else(|| "teller".to_string());
        let teller_application_id = env.get_var("TELLER_APPLICATION_ID");
        let teller_environment = env
            .get_var("TELLER_ENV")
            .or_else(|| env.get_var("TELLER_ENVIRONMENT"))
            .ok_or_else(|| anyhow!("TELLER_ENV (or TELLER_ENVIRONMENT) must be set"))?;
        let auth_cookie_same_site = parse_same_site(
            env.get_var("AUTH_COOKIE_SAME_SITE")
                .ok_or_else(|| anyhow!("AUTH_COOKIE_SAME_SITE must be set"))?,
        )?;

        Ok(Self {
            default_provider,
            teller_application_id,
            teller_environment,
            auth_cookie_same_site,
        })
    }

    pub fn get_default_provider(&self) -> &str {
        &self.default_provider
    }

    pub fn get_teller_application_id(&self) -> Option<&str> {
        self.teller_application_id.as_deref()
    }

    pub fn get_teller_environment(&self) -> &str {
        &self.teller_environment
    }

    pub fn get_auth_cookie_same_site(&self) -> AuthCookieSameSite {
        self.auth_cookie_same_site
    }
}

fn parse_same_site(value: String) -> Result<AuthCookieSameSite> {
    AuthCookieSameSite::parse(&value)
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
