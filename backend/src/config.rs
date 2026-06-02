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
    teller_application_id: Option<String>,
    teller_environment: Option<String>,
    auth_cookie_same_site: AuthCookieSameSite,
    clear_sessions_on_boot: bool,
    app_origins: Vec<String>,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Self::from_env_provider(&SystemEnvironment)
    }

    pub fn from_env_provider(env: &dyn EnvironmentProvider) -> Result<Self> {
        let teller_application_id = env.get_var("TELLER_APPLICATION_ID");
        let teller_environment = env
            .get_var("TELLER_ENV")
            .or_else(|| env.get_var("TELLER_ENVIRONMENT"));
        let auth_cookie_same_site = parse_same_site(
            env.get_var("AUTH_COOKIE_SAME_SITE")
                .ok_or_else(|| anyhow!("AUTH_COOKIE_SAME_SITE must be set"))?,
        )?;
        let clear_sessions_on_boot = env
            .get_var("CLEAR_SESSIONS_ON_BOOT")
            .map(|value| value.eq_ignore_ascii_case("true"))
            .unwrap_or(false);
        let app_origins = parse_app_origins(env)?;

        Ok(Self {
            teller_application_id,
            teller_environment,
            auth_cookie_same_site,
            clear_sessions_on_boot,
            app_origins,
        })
    }

    pub fn get_teller_application_id(&self) -> Option<&str> {
        self.teller_application_id.as_deref()
    }

    pub fn get_teller_environment(&self) -> &str {
        self.teller_environment.as_deref().unwrap_or("sandbox")
    }

    pub fn get_auth_cookie_same_site(&self) -> AuthCookieSameSite {
        self.auth_cookie_same_site
    }

    pub fn should_clear_sessions_on_boot(&self) -> bool {
        self.clear_sessions_on_boot
    }

    #[allow(dead_code)]
    pub fn app_origin(&self) -> &str {
        self.app_origins
            .first()
            .map(String::as_str)
            .expect("app_origins is never empty")
    }

    pub fn app_origins(&self) -> &[String] {
        &self.app_origins
    }
}

fn parse_app_origins(env: &dyn EnvironmentProvider) -> Result<Vec<String>> {
    let raw = env
        .get_var("APP_ORIGIN")
        .ok_or_else(|| anyhow!("APP_ORIGIN must be set"))?;

    let origins: Vec<String> = raw
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect();

    if origins.is_empty() {
        return Err(anyhow!("APP_ORIGIN must contain at least one origin"));
    }

    origins
        .iter()
        .map(|origin| normalize_origin(origin))
        .collect()
}

fn normalize_origin(origin: &str) -> Result<String> {
    let mut url = url::Url::parse(origin)
        .map_err(|error| anyhow!("Invalid origin '{}': {}", origin, error))?;

    if url.scheme() != "http" && url.scheme() != "https" {
        return Err(anyhow!(
            "Invalid origin '{}': scheme must be http or https",
            origin
        ));
    }

    if url.host().is_none() {
        return Err(anyhow!("Invalid origin '{}': missing host", origin));
    }

    url.set_path("");
    url.set_query(None);
    url.set_fragment(None);

    Ok(url.origin().ascii_serialization())
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
