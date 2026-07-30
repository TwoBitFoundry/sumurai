use opentelemetry::trace::Status;
use reqwest::{RequestBuilder, Response};
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};
use tracing::{field::Empty, Instrument, Span};
use tracing_opentelemetry::OpenTelemetrySpanExt;

pub const MAX_TELEMETRY_TEXT_CHARS: usize = 8192;

pub fn truncate_telemetry_text(value: impl AsRef<str>) -> String {
    let value = value.as_ref();
    let mut truncated = value
        .chars()
        .take(MAX_TELEMETRY_TEXT_CHARS)
        .collect::<String>();
    if value.chars().count() > MAX_TELEMETRY_TEXT_CHARS {
        truncated.push('…');
    }
    truncated
}

pub async fn send(
    request: RequestBuilder,
    service: &'static str,
    method: &'static str,
    route: &str,
) -> Result<Response, reqwest::Error> {
    let span = tracing::info_span!(
        "external_http",
        event_name = "external.http",
        external.service = service,
        http.method = method,
        http.route = route,
        http.status_code = Empty,
        error.type = Empty,
        error.message = Empty,
        error.reason = Empty,
        error.stack_trace = Empty,
    );
    async move {
        let response = request
            .send()
            .await
            .inspect_err(|error| record_transport_error(service, method, route, error))?;
        let status = response.status();
        Span::current().record("http.status_code", status.as_u16());
        if status.is_success() {
            tracing::info!(
                event_name = "external.http.completed",
                external.service = service,
                http.method = method,
                http.route = route,
                http.status_code = status.as_u16(),
                message = "external endpoint completed",
                "external endpoint completed"
            );
        }
        if !status.is_success() {
            let message = status
                .canonical_reason()
                .unwrap_or("external endpoint request failed");
            Span::current().record("error.type", "http");
            Span::current().record("error.message", message);
            Span::current().record("error.reason", status.as_str());
            Span::current().set_status(Status::error(message.to_string()));
            tracing::error!(
                event_name = "external.http.error",
                external.service = service,
                http.method = method,
                http.route = route,
                http.status_code = status.as_u16(),
                error.type = "http",
                error.message = message,
                error.reason = status.as_str(),
                "external endpoint returned an error"
            );
        }
        Ok(response)
    }
    .instrument(span)
    .await
}

pub fn log_request_payload(service: &str, method: &str, route: &str, payload: &Value) {
    tracing::error!(
        event_name = "external.http.request",
        external.service = service,
        http.method = method,
        http.route = route,
        request.payload = %redacted_payload(payload),
        "external endpoint request sent"
    );
}

pub fn log_response_payload(service: &str, method: &str, route: &str, status: u16, body: &str) {
    let digest = Sha256::digest(body.as_bytes());
    let body_json = safe_response_summary(body);
    tracing::info!(
        event_name = "external.http.response_payload",
        external.service = service,
        http.method = method,
        http.route = route,
        http.status_code = status,
        response.payload = %body_json,
        response.body_bytes = body.len(),
        response.body_sha256 = %hex::encode(digest),
        "external endpoint response payload recorded"
    );
}

fn redacted_payload(value: &Value) -> Value {
    match value {
        Value::Object(object) => {
            let mut redacted = Map::new();
            for (key, value) in object {
                if is_sensitive_key(key) {
                    redacted.insert(key.clone(), Value::String("[REDACTED]".to_string()));
                } else {
                    redacted.insert(key.clone(), redacted_payload(value));
                }
            }
            Value::Object(redacted)
        }
        Value::Array(values) => Value::Array(values.iter().map(redacted_payload).collect()),
        Value::String(value) if value.chars().count() > 256 => {
            Value::String(value.chars().take(256).collect::<String>() + "…")
        }
        _ => value.clone(),
    }
}

fn is_sensitive_key(key: &str) -> bool {
    let key = key.to_ascii_lowercase();
    [
        "authorization",
        "api_key",
        "client_id",
        "client_token",
        "email",
        "password",
        "public_token",
        "secret",
        "token",
        "access_token",
        "customer_ip_address",
        "postal_code",
        "user_id",
    ]
    .iter()
    .any(|needle| key.contains(needle))
}

fn safe_response_summary(body: &str) -> Value {
    let Ok(value) = serde_json::from_str::<Value>(body) else {
        return serde_json::json!({ "format": "non_json", "present": !body.is_empty() });
    };
    let object = value.as_object();
    let error = object
        .and_then(|value| value.get("error"))
        .and_then(Value::as_object);
    serde_json::json!({
        "format": "json",
        "present": true,
        "error_type": error.and_then(|value| value.get("type")).and_then(Value::as_str),
        "error_code": error.and_then(|value| value.get("code")).and_then(Value::as_str),
        "error_message": error
            .and_then(|value| value.get("detail").or_else(|| value.get("message")))
            .and_then(Value::as_str)
            .map(|value| value.chars().take(256).collect::<String>()),
    })
}

fn record_transport_error(service: &str, method: &str, route: &str, error: &reqwest::Error) {
    Span::current().record("error.type", "transport");
    Span::current().record("error.message", truncate_telemetry_text(error.to_string()));
    Span::current().record("error.reason", "request_failed");
    Span::current().record(
        "error.stack_trace",
        truncate_telemetry_text(format!("{error:?}")),
    );
    Span::current().set_status(Status::error("external transport request failed"));
    tracing::error!(
        event_name = "external.http.transport_error",
        external.service = service,
        http.method = method,
        http.route = route,
        error.type = "transport",
        error.message = %error,
        error.reason = "request_failed",
        error.stack_trace = %truncate_telemetry_text(format!("{error:?}")),
        "external endpoint request could not be sent"
    );
}
