use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::middleware::Next;
use axum::response::{IntoResponse, Json, Response};
use tower_governor::key_extractor::{KeyExtractor, SmartIpKeyExtractor};

use crate::models::api_error::ApiErrorResponse;
use crate::models::app_state::AppState;

pub async fn auth_ip_ban_middleware(
    State(app_state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    let ip_opt = SmartIpKeyExtractor.extract(&request).ok();

    if let Some(ip) = ip_opt.as_ref() {
        let ip_s = ip.to_string();
        match app_state.cache_service.is_auth_ip_banned(&ip_s).await {
            Ok(true) => {
                return (
                    StatusCode::FORBIDDEN,
                    Json(ApiErrorResponse::with_code(
                        "FORBIDDEN",
                        "Too many authentication attempts. Try again later.",
                        "AUTH_IP_BANNED",
                    )),
                )
                    .into_response();
            }
            Ok(false) => {}
            Err(e) => {
                tracing::warn!(
                    error = %e,
                    "Redis error checking auth IP ban; allowing request"
                );
            }
        }
    }

    let response = next.run(request).await;

    if response.status() == StatusCode::TOO_MANY_REQUESTS {
        if let Some(ip) = ip_opt.as_ref() {
            let ip_s = ip.to_string();
            if let Err(e) = app_state
                .cache_service
                .record_auth_rate_limit_exceeded(&ip_s)
                .await
            {
                tracing::warn!(
                    error = %e,
                    "Redis error recording auth rate limit strike"
                );
            }
        }
    }

    response
}
