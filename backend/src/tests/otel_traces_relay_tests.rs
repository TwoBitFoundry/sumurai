use std::collections::HashMap;

use axum::http::{header::CONTENT_TYPE, HeaderMap, HeaderName, HeaderValue};

use crate::services::otel_traces_relay::{
    classify_browser_trace_request, upstream_default_headers, w3c_trace_context_from_headers,
    BrowserTraceIngestReject, W3CTraceContext,
};

#[test]
fn given_no_content_type_when_classifying_request_then_returns_missing_content_type() {
    let headers = HeaderMap::new();
    let body = b"\x01";
    let err =
        classify_browser_trace_request(&headers, body.as_slice()).expect_err("classification");
    assert_eq!(err, BrowserTraceIngestReject::MissingContentType);
}

#[test]
fn given_invalid_utf8_content_type_when_classifying_request_then_returns_missing_content_type() {
    let mut headers = HeaderMap::new();
    headers.insert(
        CONTENT_TYPE,
        HeaderValue::from_bytes(&[0xff, 0xfe]).unwrap(),
    );
    let body = b"\x01";
    let err =
        classify_browser_trace_request(&headers, body.as_slice()).expect_err("classification");
    assert_eq!(err, BrowserTraceIngestReject::MissingContentType);
}

#[test]
fn given_empty_body_when_classifying_request_then_returns_empty_payload() {
    let mut headers = HeaderMap::new();
    headers.insert(
        CONTENT_TYPE,
        HeaderValue::from_static("application/x-protobuf"),
    );
    let err = classify_browser_trace_request(&headers, b"").expect_err("classification");
    assert_eq!(err, BrowserTraceIngestReject::EmptyPayload);
}

#[test]
fn given_text_plain_content_type_when_classifying_request_then_returns_unsupported_media_type() {
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("text/plain"));
    let err = classify_browser_trace_request(&headers, b"not-otlp").expect_err("classification");
    assert_eq!(err, BrowserTraceIngestReject::UnsupportedOtlpMediaType);
}

#[test]
fn given_application_json_with_charset_when_classifying_then_returns_full_content_type() {
    let mut headers = HeaderMap::new();
    headers.insert(
        CONTENT_TYPE,
        HeaderValue::from_static("application/json; charset=utf-8"),
    );
    let ct = classify_browser_trace_request(&headers, b"{}").unwrap();
    assert_eq!(ct, "application/json; charset=utf-8");
}

#[test]
fn given_valid_headers_when_classifying_then_returns_content_type_slice() {
    let mut headers = HeaderMap::new();
    headers.insert(
        CONTENT_TYPE,
        HeaderValue::from_static("application/x-protobuf"),
    );
    let ct = classify_browser_trace_request(&headers, b"\x01").unwrap();
    assert_eq!(ct, "application/x-protobuf");
}

#[test]
fn given_traceparent_and_tracestate_when_extracting_context_then_returns_both_strings() {
    let mut headers = HeaderMap::new();
    headers.insert(
        HeaderName::from_static("traceparent"),
        HeaderValue::from_static("00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203311-01"),
    );
    headers.insert(
        HeaderName::from_static("tracestate"),
        HeaderValue::from_static("k=v"),
    );

    assert_eq!(
        w3c_trace_context_from_headers(&headers),
        W3CTraceContext {
            traceparent: Some(
                "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203311-01".to_string()
            ),
            tracestate: Some("k=v".to_string()),
        }
    );
}

#[test]
fn given_seq_api_key_header_when_building_default_headers_then_includes_matching_value() {
    let map = upstream_default_headers(Some(HashMap::from([(
        "X-Seq-ApiKey".to_string(),
        "upstream-secret-key".to_string(),
    )])))
    .expect("builder");

    assert!(
        map.iter().any(|(name, val)| {
            name.as_str().eq_ignore_ascii_case("x-seq-apikey")
                && val.to_str().ok() == Some("upstream-secret-key")
        }),
        "expected X-Seq-ApiKey upstream-secret-key in default header map"
    );
}
