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

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BillingMode {
    Disabled,
    Paddle,
}

impl BillingMode {
    fn parse(value: &str) -> Result<Self> {
        match value {
            "disabled" => Ok(Self::Disabled),
            "paddle" => Ok(Self::Paddle),
            _ => Err(anyhow!("BILLING_MODE must be either disabled or paddle")),
        }
    }
}

#[derive(Clone)]
pub struct PaddleBillingConfig {
    pub environment: String,
    pub api_key: String,
    pub webhook_secret: String,
    pub monthly_price_id: String,
    pub cardless_trial_price_id: String,
    pub trials_enabled: bool,
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
    billing_mode: BillingMode,
    paddle_billing: Option<PaddleBillingConfig>,
    enabled_financial_providers: Option<Vec<String>>,
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
        let billing_mode = parse_billing_mode(env)?;
        let paddle_billing = parse_paddle_billing_config(env, billing_mode)?;
        let enabled_financial_providers = parse_enabled_financial_providers(env)?;

        Ok(Self {
            teller_application_id,
            teller_environment,
            auth_cookie_same_site,
            clear_sessions_on_boot,
            app_origins,
            billing_mode,
            paddle_billing,
            enabled_financial_providers,
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

    pub fn billing_mode(&self) -> BillingMode {
        self.billing_mode
    }

    pub fn is_billing_enabled(&self) -> bool {
        self.billing_mode == BillingMode::Paddle
    }

    pub fn is_trials_enabled(&self) -> bool {
        self.paddle_billing
            .as_ref()
            .map(|paddle| paddle.trials_enabled)
            .unwrap_or(false)
    }

    pub fn paddle_billing(&self) -> Option<&PaddleBillingConfig> {
        self.paddle_billing.as_ref()
    }

    pub fn enabled_financial_providers(&self) -> Option<&[String]> {
        self.enabled_financial_providers.as_deref()
    }

    pub fn is_financial_provider_enabled(&self, provider: &str) -> bool {
        let provider = provider.trim().to_lowercase();
        match &self.enabled_financial_providers {
            Some(providers) => providers.iter().any(|enabled| enabled == &provider),
            None => true,
        }
    }
}

fn parse_billing_mode(env: &dyn EnvironmentProvider) -> Result<BillingMode> {
    match env.get_var("BILLING_MODE") {
        Some(value) => BillingMode::parse(value.trim()),
        None => Ok(BillingMode::Disabled),
    }
}

fn parse_required_trimmed(env: &dyn EnvironmentProvider, key: &str) -> Result<String> {
    let value = env
        .get_var(key)
        .ok_or_else(|| anyhow!("{key} must be set when BILLING_MODE=paddle"))?;
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("{key} must not be empty when BILLING_MODE=paddle"));
    }
    Ok(trimmed.to_string())
}

fn parse_paddle_billing_config(
    env: &dyn EnvironmentProvider,
    billing_mode: BillingMode,
) -> Result<Option<PaddleBillingConfig>> {
    if billing_mode != BillingMode::Paddle {
        return Ok(None);
    }

    Ok(Some(PaddleBillingConfig {
        environment: parse_required_trimmed(env, "PADDLE_ENVIRONMENT")?,
        api_key: parse_required_trimmed(env, "PADDLE_API_KEY")?,
        webhook_secret: parse_required_trimmed(env, "PADDLE_WEBHOOK_SECRET")?,
        monthly_price_id: parse_required_trimmed(env, "PADDLE_MONTHLY_PRICE_ID")?,
        cardless_trial_price_id: parse_required_trimmed(env, "PADDLE_CARDLESS_TRIAL_PRICE_ID")?,
        trials_enabled: parse_bool_flag(env, "BILLING_TRIALS_ENABLED", false)?,
    }))
}

fn parse_bool_flag(env: &dyn EnvironmentProvider, key: &str, default: bool) -> Result<bool> {
    match env.get_var(key) {
        None => Ok(default),
        Some(value) => match value.trim().to_ascii_lowercase().as_str() {
            "true" | "1" | "yes" => Ok(true),
            "false" | "0" | "no" => Ok(false),
            _ => Err(anyhow!("{key} must be a boolean")),
        },
    }
}

fn parse_enabled_financial_providers(env: &dyn EnvironmentProvider) -> Result<Option<Vec<String>>> {
    let Some(raw) = env.get_var("ENABLED_FINANCIAL_PROVIDERS") else {
        return Ok(None);
    };

    let providers: Vec<String> = raw
        .split(',')
        .map(str::trim)
        .filter(|provider| !provider.is_empty())
        .map(str::to_lowercase)
        .collect();

    if providers.is_empty() {
        return Err(anyhow!(
            "ENABLED_FINANCIAL_PROVIDERS must contain at least one provider"
        ));
    }

    for provider in &providers {
        if !matches!(provider.as_str(), "plaid" | "teller" | "simplefin" | "diy") {
            return Err(anyhow!(
                "ENABLED_FINANCIAL_PROVIDERS contains unsupported provider '{}'",
                provider
            ));
        }
    }

    Ok(Some(providers))
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
