use std::collections::HashMap;
use std::time::Duration;

use axum::{
    body::{Body, Bytes},
    http::{
        header::{CONTENT_LENGTH, CONTENT_TYPE},
        HeaderMap as AxumHeaderMap, HeaderName as AxumHeaderName, HeaderValue as AxumHeaderValue,
        StatusCode,
    },
    response::{IntoResponse, Response},
};
use reqwest::{
    header::{HeaderMap as ReqwestHeaderMap, HeaderName, HeaderValue},
    Client,
};
use serde_json::json;

use crate::middleware::telemetry_middleware::TelemetryConfig;
use crate::models::api_error::ApiErrorResponse;

const RELAY_HTTP_CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const RELAY_HTTP_REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum BrowserTraceIngestReject {
    MissingContentType,
    UnsupportedOtlpMediaType,
    EmptyPayload,
}

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub(crate) struct W3CTraceContext {
    pub traceparent: Option<String>,
    pub tracestate: Option<String>,
}

pub(crate) fn classify_browser_trace_request<'a>(
    headers: &'a AxumHeaderMap,
    body: &[u8],
) -> Result<&'a str, BrowserTraceIngestReject> {
    let ct = headers
        .get(CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .ok_or(BrowserTraceIngestReject::MissingContentType)?;
    let essence = ct.split(';').next().map(str::trim).unwrap_or("");
    let allowed = essence.eq_ignore_ascii_case("application/x-protobuf")
        || essence.eq_ignore_ascii_case("application/json");
    if !allowed {
        return Err(BrowserTraceIngestReject::UnsupportedOtlpMediaType);
    }
    if body.is_empty() {
        return Err(BrowserTraceIngestReject::EmptyPayload);
    }
    Ok(ct)
}

pub(crate) fn w3c_trace_context_from_headers(headers: &AxumHeaderMap) -> W3CTraceContext {
    W3CTraceContext {
        traceparent: headers
            .get(AxumHeaderName::from_static("traceparent"))
            .and_then(|h| h.to_str().ok())
            .map(str::to_owned),
        tracestate: headers
            .get(AxumHeaderName::from_static("tracestate"))
            .and_then(|h| h.to_str().ok())
            .map(str::to_owned),
    }
}

pub(crate) fn upstream_default_headers(
    otlp_headers: Option<HashMap<String, String>>,
) -> anyhow::Result<ReqwestHeaderMap> {
    let mut map = ReqwestHeaderMap::new();
    let Some(hs) = otlp_headers else {
        return Ok(map);
    };
    for (key, val) in hs {
        let name = HeaderName::from_bytes(key.as_bytes())
            .map_err(|err| anyhow::anyhow!("invalid OTLP header name {key:?}: {err}"))?;
        let value = HeaderValue::from_str(&val)
            .map_err(|err| anyhow::anyhow!("invalid OTLP header value for {key}: {err}"))?;
        map.insert(name, value);
    }
    Ok(map)
}

#[derive(Clone)]
pub struct OtlpTracesRelay {
    traces_endpoint: String,
    client: Client,
}

impl OtlpTracesRelay {
    pub fn from_config(config: &TelemetryConfig) -> anyhow::Result<Self> {
        Self::new(config.otlp_endpoint.clone(), config.otlp_headers.clone())
    }

    pub fn new(
        traces_endpoint: String,
        otlp_headers: Option<HashMap<String, String>>,
    ) -> anyhow::Result<Self> {
        let default_headers = upstream_default_headers(otlp_headers)?;
        let client = Client::builder()
            .default_headers(default_headers)
            .connect_timeout(RELAY_HTTP_CONNECT_TIMEOUT)
            .timeout(RELAY_HTTP_REQUEST_TIMEOUT)
            .build()?;

        Ok(Self {
            traces_endpoint,
            client,
        })
    }

    #[cfg(test)]
    pub fn bogus_for_tests() -> Self {
        Self::new("http://127.0.0.1:1/ingest/otlp/v1/traces".to_string(), None)
            .expect("bogus relay constants")
    }

    pub async fn forward_browser_traces(
        &self,
        inbound_headers: &AxumHeaderMap,
        body: Bytes,
    ) -> Response {
        let content_type = match classify_browser_trace_request(inbound_headers, body.as_ref()) {
            Ok(ct) => ct,
            Err(BrowserTraceIngestReject::MissingContentType) => {
                return ApiErrorResponse::with_code(
                    "UNSUPPORTED_MEDIA_TYPE",
                    "Missing Content-Type",
                    "",
                )
                .into_response(StatusCode::UNSUPPORTED_MEDIA_TYPE)
                .into_response();
            }
            Err(BrowserTraceIngestReject::UnsupportedOtlpMediaType) => {
                return ApiErrorResponse::with_code(
                    "UNSUPPORTED_MEDIA_TYPE",
                    "Content-Type must be application/x-protobuf or application/json for OTLP",
                    "",
                )
                .into_response(StatusCode::UNSUPPORTED_MEDIA_TYPE)
                .into_response();
            }
            Err(BrowserTraceIngestReject::EmptyPayload) => {
                return ApiErrorResponse::with_code("BAD_REQUEST", "Empty OTLP payload", "")
                    .into_response(StatusCode::BAD_REQUEST)
                    .into_response();
            }
        };

        let w3c = w3c_trace_context_from_headers(inbound_headers);

        let mut req_builder = self
            .client
            .post(&self.traces_endpoint)
            .header(reqwest::header::CONTENT_TYPE, content_type)
            .body(body.to_vec());

        if let Some(ref tp) = w3c.traceparent {
            req_builder = req_builder.header("traceparent", tp);
        }
        if let Some(ref ts) = w3c.tracestate {
            req_builder = req_builder.header("tracestate", ts);
        }

        let upstream = match req_builder.send().await {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!(error = %e, " OTLP browser relay upstream request failed");
                return Self::json_error(StatusCode::BAD_GATEWAY, "upstream request failed");
            }
        };

        let status =
            StatusCode::from_u16(upstream.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
        let content_type_opt = upstream
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .cloned();
        match upstream.bytes().await {
            Ok(upstream_body) => {
                let len = upstream_body.len();
                let mut response = Response::new(Body::from(upstream_body));
                *response.status_mut() = status;
                if let Some(ct_hdr) = content_type_opt {
                    if let Ok(ax) = AxumHeaderValue::from_bytes(ct_hdr.as_bytes()) {
                        response.headers_mut().insert(CONTENT_TYPE, ax);
                    }
                }
                if let Ok(len_hdr) = AxumHeaderValue::from_str(&len.to_string()) {
                    response.headers_mut().insert(CONTENT_LENGTH, len_hdr);
                }
                response
            }
            Err(e) => {
                tracing::warn!(error = %e, "OTLP upstream body read failed");
                Self::json_error(StatusCode::BAD_GATEWAY, "upstream body read failed")
            }
        }
    }

    fn json_error(status: StatusCode, message: &'static str) -> Response {
        let payload = serde_json::to_vec(
            &json!({"error":"OTLP_RELAY","message":message,"code":"UPSTREAM_ERROR"}),
        )
        .unwrap_or_else(|_| b"{}".to_vec());

        Response::builder()
            .status(status)
            .header(CONTENT_TYPE, "application/json")
            .body(Body::from(payload))
            .unwrap_or_else(|_| Response::new(Body::empty()))
    }
}
