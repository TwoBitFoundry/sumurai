use crate::config::{Config, MockEnvironment};

#[test]
fn given_no_env_vars_when_from_env_provider_then_uses_defaults() {
    let env = MockEnvironment::new();

    let config = Config::from_env_provider(&env).unwrap();

    assert_eq!(
        config.database_url,
        "postgresql://postgres:password@localhost:5432/accounting"
    );
    assert_eq!(config.get_default_provider(), "teller");
    assert_eq!(config.get_teller_application_id(), None);
}

#[test]
fn given_plaid_provider_env_when_from_env_provider_then_returns_plaid() {
    let mut env = MockEnvironment::new();
    env.set("DEFAULT_PROVIDER", "plaid");

    let config = Config::from_env_provider(&env).unwrap();

    assert_eq!(config.get_default_provider(), "plaid");
}

#[test]
fn given_teller_provider_env_when_from_env_provider_then_returns_teller() {
    let mut env = MockEnvironment::new();
    env.set("DEFAULT_PROVIDER", "teller");

    let config = Config::from_env_provider(&env).unwrap();

    assert_eq!(config.get_default_provider(), "teller");
}

#[test]
fn given_custom_database_url_when_from_env_provider_then_uses_custom_url() {
    let mut env = MockEnvironment::new();
    env.set("DATABASE_URL", "postgresql://custom:pass@db:5432/test");

    let config = Config::from_env_provider(&env).unwrap();

    assert_eq!(config.database_url, "postgresql://custom:pass@db:5432/test");
}

#[test]
fn given_no_provider_specified_when_from_env_provider_then_defaults_to_teller() {
    let mut env = MockEnvironment::new();
    env.set("DATABASE_URL", "postgresql://localhost:5432/test");

    let config = Config::from_env_provider(&env).unwrap();

    assert_eq!(config.get_default_provider(), "teller");
}

#[test]
fn given_teller_application_id_when_from_env_provider_then_exposes_id() {
    let mut env = MockEnvironment::new();
    env.set("TELLER_APPLICATION_ID", "app-123");

    let config = Config::from_env_provider(&env).unwrap();

    assert_eq!(config.get_teller_application_id(), Some("app-123"));
}
