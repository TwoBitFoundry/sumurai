use axum::{body::Bytes, extract::State, http::HeaderMap, response::Response};

use crate::models::app_state::AppState;

pub async fn post_browser_traces(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    state
        .otlp_traces_relay
        .forward_browser_traces(&headers, body)
        .await
}
