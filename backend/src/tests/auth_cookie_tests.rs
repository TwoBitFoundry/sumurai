use chrono::{Duration, Utc};

use crate::config::{AuthCookieSameSite, Config, MockEnvironment};
use crate::utils::auth_cookie::{
    build_auth_cookie, build_clearing_auth_cookie, extract_auth_cookie,
};

fn create_cookie_config(same_site: &str) -> Config {
    let mut env = MockEnvironment::new();
    env.set("TELLER_ENV", "test");
    env.set("AUTH_COOKIE_SAME_SITE", same_site);
    Config::from_env_provider(&env).unwrap()
}

#[test]
fn given_missing_cookie_mode_when_loading_config_then_returns_error() {
    let mut env = MockEnvironment::new();
    env.set("TELLER_ENV", "test");

    let result = Config::from_env_provider(&env);

    assert!(result.is_err());
}

#[test]
fn given_valid_cookie_settings_when_loading_config_then_returns_values() {
    let mut env = MockEnvironment::new();
    env.set("TELLER_ENV", "test");
    env.set("AUTH_COOKIE_SAME_SITE", "Lax");

    let config = Config::from_env_provider(&env).unwrap();

    assert_eq!(config.get_auth_cookie_same_site(), AuthCookieSameSite::Lax);
}

#[test]
fn given_invalid_cookie_mode_when_loading_config_then_returns_error() {
    let mut env = MockEnvironment::new();
    env.set("TELLER_ENV", "test");
    env.set("AUTH_COOKIE_SAME_SITE", "Relaxed");

    let result = Config::from_env_provider(&env);

    assert!(result.is_err());
}

#[test]
fn given_token_when_building_auth_cookie_then_includes_required_attributes() {
    let config = create_cookie_config("Strict");
    let expires_at = Utc::now() + Duration::minutes(30);

    let cookie = build_auth_cookie("jwt-token-value", expires_at, &config);

    assert!(cookie.contains("auth_token=jwt-token-value"));
    assert!(cookie.contains("HttpOnly"));
    assert!(cookie.contains("Path=/"));
    assert!(cookie.contains("SameSite=Strict"));
    assert!(cookie.contains("Secure"));
    assert!(cookie
        .split(';')
        .any(|part| part.trim_start().starts_with("Max-Age=") && part.trim_start() != "Max-Age=0"));
}

#[test]
fn given_token_when_building_clearing_cookie_then_clears_same_name_and_path() {
    let config = create_cookie_config("Lax");

    let cookie = build_clearing_auth_cookie(&config);

    assert!(cookie.contains("auth_token="));
    assert!(cookie.contains("HttpOnly"));
    assert!(cookie.contains("Path=/"));
    assert!(cookie.contains("SameSite=Lax"));
    assert!(!cookie.contains("Secure"));
    assert!(cookie
        .split(';')
        .any(|part| part.trim_start() == "Max-Age=0"));
}

#[test]
fn given_default_mode_when_building_auth_cookie_then_uses_strict_security() {
    let config = create_cookie_config("Strict");
    let expires_at = Utc::now() + Duration::minutes(30);

    let cookie = build_auth_cookie("jwt-token-value", expires_at, &config);

    assert!(cookie.contains("Secure"));
}

#[test]
fn given_cookie_header_when_extracting_auth_cookie_then_returns_jwt() {
    let result = extract_auth_cookie(
        Some("foo=bar; auth_token=jwt-token-value; baz=qux"),
        "auth_token",
    );

    assert_eq!(result.as_deref(), Some("jwt-token-value"));
}

#[test]
fn given_missing_cookie_header_when_extracting_auth_cookie_then_returns_none() {
    let result = extract_auth_cookie(None, "auth_token");

    assert!(result.is_none());
}

#[test]
fn given_empty_auth_cookie_when_extracting_auth_cookie_then_returns_none() {
    let result = extract_auth_cookie(Some("auth_token="), "auth_token");

    assert!(result.is_none());
}

#[test]
fn given_malformed_auth_cookie_when_extracting_auth_cookie_then_returns_none() {
    let result = extract_auth_cookie(Some("foo=bar; auth_token"), "auth_token");

    assert!(result.is_none());
}

#[test]
fn given_duplicate_auth_cookies_when_extracting_auth_cookie_then_returns_none() {
    let result = extract_auth_cookie(
        Some("auth_token=jwt-token-value; foo=bar; auth_token=duplicate"),
        "auth_token",
    );

    assert!(result.is_none());
}
