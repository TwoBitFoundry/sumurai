use chrono::{DateTime, Utc};
use cookie::{time::Duration as CookieDuration, Cookie, SameSite as CookieSameSite};

use crate::config::{AuthCookieSameSite, Config};

pub fn build_auth_cookie(token: &str, expires_at: DateTime<Utc>, config: &Config) -> String {
    build_cookie(
        "auth_token",
        token,
        Some(expires_at),
        config.get_auth_cookie_same_site(),
    )
}

pub fn build_clearing_auth_cookie(config: &Config) -> String {
    build_cookie(
        "auth_token",
        "",
        Some(Utc::now()),
        config.get_auth_cookie_same_site(),
    )
}

pub fn extract_auth_cookie(cookie_header: Option<&str>, cookie_name: &str) -> Option<String> {
    let cookie_header = cookie_header?;
    let mut token = None;

    for part in cookie_header.split(';') {
        let trimmed = part.trim();
        if trimmed.is_empty() {
            continue;
        }

        match trimmed.split_once('=') {
            Some((name, value)) if name.trim() == cookie_name => {
                let value = value.trim();
                if value.is_empty() || token.is_some() {
                    return None;
                }
                token = Some(value.to_string());
            }
            None if trimmed == cookie_name => return None,
            _ => {}
        }
    }

    token
}

fn build_cookie(
    name: &str,
    value: &str,
    expires_at: Option<DateTime<Utc>>,
    same_site: AuthCookieSameSite,
) -> String {
    let secure = matches!(same_site, AuthCookieSameSite::Strict);
    let mut builder = Cookie::build((name.to_string(), value.to_string()))
        .http_only(true)
        .path("/")
        .same_site(map_same_site(same_site))
        .secure(secure);

    if let Some(expires_at) = expires_at {
        let max_age = expires_at
            .signed_duration_since(Utc::now())
            .num_seconds()
            .max(0);
        builder = builder.max_age(CookieDuration::seconds(max_age));
    }

    builder.build().to_string()
}

fn map_same_site(value: AuthCookieSameSite) -> CookieSameSite {
    match value {
        AuthCookieSameSite::Strict => CookieSameSite::Strict,
        AuthCookieSameSite::Lax => CookieSameSite::Lax,
    }
}
