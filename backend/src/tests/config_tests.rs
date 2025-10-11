use crate::config::Config;

#[test]
fn test_config_from_env_uses_defaults_when_vars_missing() {
    let config = Config::from_env().unwrap();

    assert!(config.database_url.contains("postgresql://"));
    assert!(config.database_url.contains("localhost"));
}

#[test]
fn given_no_provider_env_when_get_default_provider_then_returns_teller() {
    std::env::remove_var("DEFAULT_PROVIDER");

    let config = Config::from_env().unwrap();

    assert_eq!(config.get_default_provider(), "teller");
}

#[test]
fn given_plaid_provider_env_when_get_default_provider_then_returns_plaid() {
    std::env::set_var("DEFAULT_PROVIDER", "plaid");

    let config = Config::from_env().unwrap();

    assert_eq!(config.get_default_provider(), "plaid");

    std::env::remove_var("DEFAULT_PROVIDER");
}

#[test]
fn given_teller_provider_env_when_get_default_provider_then_returns_teller() {
    std::env::set_var("DEFAULT_PROVIDER", "teller");

    let config = Config::from_env().unwrap();

    assert_eq!(config.get_default_provider(), "teller");

    std::env::remove_var("DEFAULT_PROVIDER");
}
