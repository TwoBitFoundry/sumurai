use crate::config::{Config, MockEnvironment};

fn nginx_block<'a>(template: &'a str, marker: &str) -> &'a str {
    let start = template.find(marker).expect("missing nginx block");
    let block = &template[start..];
    match block.find("\n\n") {
        Some(end) => &block[..end],
        None => block,
    }
}

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
    env.set("AUTH_COOKIE_SAME_SITE", "Strict");

    let config = Config::from_env_provider(&env).unwrap();

    assert_eq!(config.get_default_provider(), "plaid");
}

#[test]
fn given_teller_provider_env_when_from_env_provider_then_returns_teller() {
    let mut env = MockEnvironment::new();
    env.set("TELLER_ENV", "development");
    env.set("DEFAULT_PROVIDER", "teller");
    env.set("AUTH_COOKIE_SAME_SITE", "Strict");

    let config = Config::from_env_provider(&env).unwrap();

    assert_eq!(config.get_default_provider(), "teller");
}

#[test]
fn given_custom_database_url_when_from_env_provider_then_uses_custom_url() {
    let mut env = MockEnvironment::new();
    env.set("TELLER_ENV", "development");
    env.set("TELLER_ENV", "sandbox");
    env.set("AUTH_COOKIE_SAME_SITE", "Strict");

    let config = Config::from_env_provider(&env).ok();

    assert!(config.is_some());
}

#[test]
fn given_no_provider_specified_when_from_env_provider_then_defaults_to_teller() {
    let mut env = MockEnvironment::new();
    env.set("TELLER_ENV", "development");
    env.set("DATABASE_URL", "postgresql://localhost:5432/test");
    env.set("AUTH_COOKIE_SAME_SITE", "Strict");

    let config = Config::from_env_provider(&env).unwrap();

    assert_eq!(config.get_default_provider(), "teller");
}

#[test]
fn given_teller_application_id_when_from_env_provider_then_exposes_id() {
    let mut env = MockEnvironment::new();
    env.set("TELLER_ENV", "development");
    env.set("TELLER_APPLICATION_ID", "app-123");
    env.set("AUTH_COOKIE_SAME_SITE", "Strict");

    let config = Config::from_env_provider(&env).unwrap();

    assert_eq!(config.get_teller_application_id(), Some("app-123"));
    assert_eq!(config.get_teller_environment(), "development");
}

#[test]
fn given_teller_environment_when_from_env_provider_then_uses_value() {
    let mut env = MockEnvironment::new();
    env.set("TELLER_ENV", "sandbox");
    env.set("AUTH_COOKIE_SAME_SITE", "Strict");

    let config = Config::from_env_provider(&env).unwrap();

    assert_eq!(config.get_teller_environment(), "sandbox");
}

#[test]
fn given_missing_cookie_mode_when_from_env_provider_then_returns_error() {
    let mut env = MockEnvironment::new();
    env.set("TELLER_ENV", "development");

    let result = Config::from_env_provider(&env);

    assert!(result.is_err());
}

#[test]
fn given_valid_cookie_settings_when_from_env_provider_then_returns_values() {
    let mut env = MockEnvironment::new();
    env.set("TELLER_ENV", "development");
    env.set("AUTH_COOKIE_SAME_SITE", "Lax");

    let config = Config::from_env_provider(&env).unwrap();

    assert_eq!(config.get_auth_cookie_same_site().to_string(), "Lax");
}

#[test]
fn given_invalid_cookie_mode_when_from_env_provider_then_returns_error() {
    let mut env = MockEnvironment::new();
    env.set("TELLER_ENV", "development");
    env.set("AUTH_COOKIE_SAME_SITE", "Relaxed");

    let result = Config::from_env_provider(&env);

    assert!(result.is_err());
}

#[test]
fn given_nginx_template_when_read_then_includes_provider_csp_allowlists() {
    let template = include_str!("../../../nginx/nginx.conf.template");

    assert!(template.contains("Content-Security-Policy"));
    assert!(template.contains("https://cdn.teller.io"));
    assert!(template.contains("https://cdn.plaid.com"));
    assert!(template.contains("https://api.teller.io"));
    assert!(template.contains("https://production.plaid.com"));
    assert!(template.contains("https://sandbox.plaid.com"));
    assert!(template.contains("frame-src"));
    assert!(template.contains("connect-src"));
}

#[test]
fn given_nginx_template_when_read_then_restricts_seq_locations_to_internal_networks() {
    let template = include_str!("../../../nginx/nginx.conf.template");
    let seq_redirect = nginx_block(template, "location = /seq");
    let seq_proxy = nginx_block(template, "location /seq/");

    for block in [seq_redirect, seq_proxy] {
        assert!(block.contains("allow 10.0.0.0/8"));
        assert!(block.contains("allow 172.16.0.0/12"));
        assert!(block.contains("allow 192.168.0.0/16"));
        assert!(block.contains("deny all"));
    }
}

#[test]
fn given_nginx_template_when_read_then_limits_otlp_ingestion_at_the_edge() {
    let template = include_str!("../../../nginx/nginx.conf.template");
    let ingest_block = nginx_block(template, "location /ingest/otlp");

    assert!(
        template.contains("limit_req_zone $binary_remote_addr zone=seq_otlp_ingest:10m rate=5r/s;")
    );
    assert!(ingest_block.contains("limit_req zone=seq_otlp_ingest burst=30 nodelay;"));
    assert!(ingest_block.contains("limit_req_status 429;"));
    assert!(ingest_block.contains("client_max_body_size 10m;"));
    assert!(ingest_block.contains("proxy_http_version 1.1;"));
}

#[test]
fn given_nginx_template_when_read_then_restricts_otlp_ingestion_to_private_networks() {
    let template = include_str!("../../../nginx/nginx.conf.template");
    let ingest_block = nginx_block(template, "location /ingest/otlp");

    assert!(ingest_block.contains("allow 10.0.0.0/8"));
    assert!(ingest_block.contains("allow 172.16.0.0/12"));
    assert!(ingest_block.contains("allow 192.168.0.0/16"));
    assert!(ingest_block.contains("deny all"));
}

#[test]
fn given_nginx_template_when_read_then_does_not_inject_seq_api_key_on_otlp_edge_ingestion() {
    let template = include_str!("../../../nginx/nginx.conf.template");
    let ingest_block = nginx_block(template, "location /ingest/otlp");

    assert!(!ingest_block.contains("proxy_set_header X-Seq-ApiKey"));
    assert!(!template.contains("${SEQ_API_KEY}"));
}

#[test]
fn given_nginx_template_when_read_then_allows_large_browser_telemetry_batches_on_api_route() {
    let template = include_str!("../../../nginx/nginx.conf.template");
    let api_block = nginx_block(template, "location /api {\n            allow 10.0.0.0/8");
    assert!(api_block.contains("client_max_body_size 10m;"));
}
