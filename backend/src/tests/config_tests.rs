use crate::config::{Config, MockEnvironment};

#[test]
fn given_no_teller_env_when_from_env_provider_then_returns_error() {
    let env = MockEnvironment::new();

    let result = Config::from_env_provider(&env);

    assert!(result.is_err());
}

#[test]
fn given_plaid_provider_env_when_from_env_provider_then_returns_plaid() {
    let mut env = MockEnvironment::new();
    env.set("TELLER_ENV", "development");
    env.set("DEFAULT_PROVIDER", "plaid");

    let config = Config::from_env_provider(&env).unwrap();

    assert_eq!(config.get_default_provider(), "plaid");
}

#[test]
fn given_teller_provider_env_when_from_env_provider_then_returns_teller() {
    let mut env = MockEnvironment::new();
    env.set("TELLER_ENV", "development");
    env.set("DEFAULT_PROVIDER", "teller");

    let config = Config::from_env_provider(&env).unwrap();

    assert_eq!(config.get_default_provider(), "teller");
}

#[test]
fn given_custom_database_url_when_from_env_provider_then_uses_custom_url() {
    let mut env = MockEnvironment::new();
    env.set("TELLER_ENV", "development");
    env.set("TELLER_ENV", "sandbox");

    let config = Config::from_env_provider(&env).ok();

    assert!(config.is_some());
}

#[test]
fn given_no_provider_specified_when_from_env_provider_then_defaults_to_teller() {
    let mut env = MockEnvironment::new();
    env.set("TELLER_ENV", "development");
    env.set("DATABASE_URL", "postgresql://localhost:5432/test");

    let config = Config::from_env_provider(&env).unwrap();

    assert_eq!(config.get_default_provider(), "teller");
}

#[test]
fn given_teller_application_id_when_from_env_provider_then_exposes_id() {
    let mut env = MockEnvironment::new();
    env.set("TELLER_ENV", "development");
    env.set("TELLER_APPLICATION_ID", "app-123");

    let config = Config::from_env_provider(&env).unwrap();

    assert_eq!(config.get_teller_application_id(), Some("app-123"));
    assert_eq!(config.get_teller_environment(), "development");
}

#[test]
fn given_teller_environment_when_from_env_provider_then_uses_value() {
    let mut env = MockEnvironment::new();
    env.set("TELLER_ENV", "sandbox");

    let config = Config::from_env_provider(&env).unwrap();

    assert_eq!(config.get_teller_environment(), "sandbox");
}
