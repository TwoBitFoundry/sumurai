use std::sync::{Arc, Once, OnceLock};
use std::time::Duration;

use axum::body::Body;
use axum::http::header::{CONTENT_TYPE, RETRY_AFTER};
use axum::http::{Response, StatusCode};
use governor::middleware::NoOpMiddleware;
use tower_governor::governor::{GovernorConfig, GovernorConfigBuilder};
use tower_governor::key_extractor::SmartIpKeyExtractor;
use tower_governor::{GovernorError, GovernorLayer};

use crate::models::api_error::ApiErrorResponse;
use crate::models::rate_limit::AuthEndpointRateLimitPolicy;

type AuthGovernorConfig = GovernorConfig<SmartIpKeyExtractor, NoOpMiddleware>;

static LOGIN_GOVERNOR_CONFIG: OnceLock<Arc<AuthGovernorConfig>> = OnceLock::new();
static REGISTER_GOVERNOR_CONFIG: OnceLock<Arc<AuthGovernorConfig>> = OnceLock::new();
static CLEANUP_STARTED: Once = Once::new();

fn build_auth_endpoint_config() -> Arc<AuthGovernorConfig> {
    let mut base = GovernorConfigBuilder::default();
    let mut builder = base.key_extractor(SmartIpKeyExtractor);
    builder.period(AuthEndpointRateLimitPolicy::token_refill_period());
    builder.burst_size(AuthEndpointRateLimitPolicy::BURST);
    Arc::new(builder.finish().expect("auth rate limit governor config"))
}

fn login_config() -> Arc<AuthGovernorConfig> {
    LOGIN_GOVERNOR_CONFIG
        .get_or_init(build_auth_endpoint_config)
        .clone()
}

fn register_config() -> Arc<AuthGovernorConfig> {
    REGISTER_GOVERNOR_CONFIG
        .get_or_init(build_auth_endpoint_config)
        .clone()
}

pub fn auth_login_governor_layer() -> GovernorLayer<SmartIpKeyExtractor, NoOpMiddleware, Body> {
    GovernorLayer::new(login_config()).error_handler(governor_error_response)
}

pub fn auth_register_governor_layer() -> GovernorLayer<SmartIpKeyExtractor, NoOpMiddleware, Body> {
    GovernorLayer::new(register_config()).error_handler(governor_error_response)
}

pub fn spawn_auth_rate_limit_cleanup() {
    CLEANUP_STARTED.call_once(|| {
        let login = login_config().limiter().clone();
        let register = register_config().limiter().clone();
        std::thread::spawn(move || loop {
            std::thread::sleep(Duration::from_secs(60));
            login.retain_recent();
            register.retain_recent();
        });
    });
}

fn governor_error_response(err: GovernorError) -> Response<Body> {
    match err {
        GovernorError::TooManyRequests { wait_time, headers } => {
            let mut res = json_rate_limit_response(wait_time);
            if let Some(h) = headers {
                res.headers_mut().extend(h);
            }
            res
        }
        GovernorError::UnableToExtractKey => Response::builder()
            .status(StatusCode::BAD_REQUEST)
            .header(CONTENT_TYPE, "application/json")
            .body(Body::from(
                serde_json::to_vec(&ApiErrorResponse::with_code(
                    "BAD_REQUEST",
                    "Could not determine client address",
                    "RATE_LIMIT_KEY",
                ))
                .unwrap_or_else(|_| b"{}".to_vec()),
            ))
            .unwrap_or_else(|_| Response::new(Body::empty())),
        GovernorError::Other { code, msg, headers } => {
            let body = msg.unwrap_or_else(|| "Error".to_string());
            let mut res = Response::builder()
                .status(code)
                .body(Body::from(body))
                .unwrap_or_else(|_| Response::new(Body::empty()));
            if let Some(h) = headers {
                res.headers_mut().extend(h);
            }
            res
        }
    }
}

fn json_rate_limit_response(wait_secs: u64) -> Response<Body> {
    let payload = ApiErrorResponse::with_code(
        "TOO_MANY_REQUESTS",
        "Too many authentication attempts. Try again later.",
        "RATE_LIMITED",
    );
    let body = serde_json::to_vec(&payload).unwrap_or_else(|_| b"{}".to_vec());

    Response::builder()
        .status(StatusCode::TOO_MANY_REQUESTS)
        .header(CONTENT_TYPE, "application/json")
        .header(RETRY_AFTER, wait_secs.to_string())
        .body(Body::from(body))
        .unwrap_or_else(|_| Response::new(Body::empty()))
}
