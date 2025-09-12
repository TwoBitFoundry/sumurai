use crate::config::Config;

#[test]
fn test_config_from_env_uses_defaults_when_vars_missing() {
    let config = Config::from_env().unwrap();

    assert!(config.database_url.contains("postgresql://"));
    assert!(config.database_url.contains("localhost"));
}
