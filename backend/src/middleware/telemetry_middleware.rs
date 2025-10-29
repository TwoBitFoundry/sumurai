use anyhow::Result;
use axum::{
    body::Body, extract::Request, http::header::AUTHORIZATION, middleware::Next, response::Response,
};
use axum_tracing_opentelemetry::tracing_opentelemetry_instrumentation_sdk as otel_sdk;
use chrono::Utc;
use opentelemetry::{global, trace::TracerProvider};
use opentelemetry_otlp::{WithExportConfig, WithHttpConfig};
use opentelemetry_sdk::{propagation::TraceContextPropagator, trace::SdkTracerProvider, Resource};
use sha2::{Digest, Sha256};
use std::{collections::HashMap, fmt::Write};
use tracing::Span;
use tracing_opentelemetry::OpenTelemetrySpanExt;
use tracing_subscriber::{
    filter::LevelFilter,
    fmt::{
        format::{FormatEvent, FormatFields, Writer},
        FmtContext,
    },
    layer::SubscriberExt,
    registry::{LookupSpan, Registry},
    util::SubscriberInitExt,
    EnvFilter,
};
use tracing_subscriber::Layer;

pub struct TelemetryConfig {
    pub env_filter: Option<String>,
    pub otlp_endpoint: String,
    pub otlp_headers: Option<HashMap<String, String>>,
}

impl Default for TelemetryConfig {
    fn default() -> Self {
        Self::from_env()
    }
}

impl TelemetryConfig {
    pub fn from_env() -> Self {
        let otlp_endpoint = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT")
            .unwrap_or_else(|_| "http://localhost:5341/ingest/otlp/v1/traces".to_string());

        let otlp_headers = std::env::var("OTEL_EXPORTER_OTLP_HEADERS")
            .ok()
            .and_then(parse_otlp_headers);

        Self {
            env_filter: std::env::var("RUST_LOG").ok(),
            otlp_endpoint,
            otlp_headers,
        }
    }
}

pub struct TelemetryHandle {
    tracer_provider: SdkTracerProvider,
}

impl TelemetryHandle {
    pub fn shutdown(self) -> Result<()> {
        self.tracer_provider
            .shutdown()
            .map_err(|err| anyhow::anyhow!("failed to shutdown tracer provider: {err}"))
    }
}

pub fn init(config: &TelemetryConfig) -> Result<TelemetryHandle> {
    let env_filter = match &config.env_filter {
        Some(filter) => {
            EnvFilter::try_new(filter.clone()).unwrap_or_else(|_| EnvFilter::new("info"))
        }
        None => EnvFilter::new("info"),
    };

    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_target(false)
        .event_format(SeqJsonFormatter);

    global::set_text_map_propagator(TraceContextPropagator::new());

    println!("OTLP exporter endpoint: {}", config.otlp_endpoint);

    let mut exporter_builder = opentelemetry_otlp::SpanExporter::builder()
        .with_http()
        .with_endpoint(config.otlp_endpoint.clone());

    if let Some(headers) = &config.otlp_headers {
        let header_names = headers.keys().cloned().collect::<Vec<_>>();
        println!("OTLP exporter headers configured: {:?}", header_names);
        exporter_builder = exporter_builder.with_headers(headers.clone());
    }

    let exporter = exporter_builder.build()?;

    let resource = Resource::builder()
        .with_service_name("sumaura-backend")
        .build();

    let tracer_provider = opentelemetry_sdk::trace::SdkTracerProvider::builder()
        .with_resource(resource)
        .with_batch_exporter(exporter)
        .build();

    let tracer = tracer_provider.tracer("accounting-backend");

    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .with(
            tracing_opentelemetry::layer()
                .with_tracer(tracer)
                .with_filter(LevelFilter::INFO),
        )
        .try_init()
        .map_err(|err| anyhow::anyhow!("failed to initialize tracing subscriber: {err}"))?;

    global::set_tracer_provider(tracer_provider.clone());

    Ok(TelemetryHandle { tracer_provider })
}

#[derive(Clone)]
pub struct EncryptedToken(pub String);

pub fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn attach_encrypted_token_to_span(span: &Span, encrypted_token: &str) {
    let attribute_value = encrypted_token.to_owned();
    span.set_attribute("encrypted_token", attribute_value.clone());

    let _ = span.with_subscriber(|(id, dispatch)| {
        if let Some(registry) = dispatch.downcast_ref::<Registry>() {
            if let Some(span_ref) = registry.span(id) {
                span_ref
                    .extensions_mut()
                    .replace(EncryptedToken(attribute_value.clone()));
            }
        }
    });
}

pub fn attach_encrypted_token_to_current_span(encrypted_token: &str) {
    let span = Span::current();
    attach_encrypted_token_to_span(&span, encrypted_token);
}

pub async fn with_bearer_token_attribute(request: Request<Body>, next: Next) -> Response {
    if let Some(header_value) = request.headers().get(AUTHORIZATION) {
        if let Ok(raw) = header_value.to_str() {
            let trimmed = raw.trim();
            let token = trimmed
                .strip_prefix("Bearer ")
                .or_else(|| trimmed.strip_prefix("bearer "))
                .unwrap_or(trimmed)
                .trim();

            if !token.is_empty() {
                let encrypted = hash_token(token);
                attach_encrypted_token_to_current_span(&encrypted);
            }
        }
    }

    next.run(request).await
}

struct SeqJsonFormatter;

impl<S, N> FormatEvent<S, N> for SeqJsonFormatter
where
    S: tracing::Subscriber + for<'span> LookupSpan<'span>,
    N: for<'writer> FormatFields<'writer> + 'static,
{
    fn format_event(
        &self,
        ctx: &FmtContext<'_, S, N>,
        mut writer: Writer<'_>,
        event: &tracing::Event<'_>,
    ) -> std::fmt::Result {
        use serde_json::{json, Map};

        let mut record = Map::new();
        record.insert("timestamp".to_string(), json!(Utc::now().to_rfc3339()));
        record.insert(
            "level".to_string(),
            json!(event.metadata().level().as_str()),
        );
        record.insert("target".to_string(), json!(event.metadata().target()));

        if let Some(trace_id) = otel_sdk::find_current_trace_id() {
            record.insert("traceId".to_string(), json!(trace_id));
        }

        if let Some(span) = ctx.lookup_current() {
            record.insert("span".to_string(), json!(span.name()));
            if let Some(token) = span.extensions().get::<EncryptedToken>() {
                record.insert("encrypted_token".to_string(), json!(token.0.clone()));
            }
        }

        let mut fields = Map::new();
        {
            let mut visitor = JsonFieldVisitor::new(&mut fields);
            event.record(&mut visitor);
        }

        for (key, value) in fields {
            record.insert(key, value);
        }

        let json = serde_json::Value::Object(record);
        let serialized = serde_json::to_string(&json).map_err(|_| std::fmt::Error)?;
        Write::write_str(&mut writer, &serialized)?;
        Write::write_char(&mut writer, '\n')
    }
}

struct JsonFieldVisitor<'a> {
    fields: &'a mut serde_json::Map<String, serde_json::Value>,
}

impl<'a> JsonFieldVisitor<'a> {
    fn new(fields: &'a mut serde_json::Map<String, serde_json::Value>) -> Self {
        Self { fields }
    }
}

impl<'a> tracing::field::Visit for JsonFieldVisitor<'a> {
    fn record_bool(&mut self, field: &tracing::field::Field, value: bool) {
        self.fields
            .insert(field.name().to_string(), serde_json::json!(value));
    }

    fn record_i64(&mut self, field: &tracing::field::Field, value: i64) {
        self.fields
            .insert(field.name().to_string(), serde_json::json!(value));
    }

    fn record_u64(&mut self, field: &tracing::field::Field, value: u64) {
        self.fields
            .insert(field.name().to_string(), serde_json::json!(value));
    }

    fn record_f64(&mut self, field: &tracing::field::Field, value: f64) {
        self.fields
            .insert(field.name().to_string(), serde_json::json!(value));
    }

    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        self.fields
            .insert(field.name().to_string(), serde_json::json!(value));
    }

    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        self.fields.insert(
            field.name().to_string(),
            serde_json::json!(format!("{value:?}")),
        );
    }
}

fn parse_otlp_headers(raw: String) -> Option<HashMap<String, String>> {
    let mut headers = HashMap::new();

    for entry in raw.split(',') {
        let entry = entry.trim();
        if entry.is_empty() {
            continue;
        }

        let mut parts = entry.splitn(2, '=');
        match (parts.next(), parts.next()) {
            (Some(key), Some(value)) if !key.trim().is_empty() => {
                headers.insert(key.trim().to_string(), value.trim().to_string());
            }
            _ => eprintln!("Ignoring malformed OTLP header entry: {}", entry),
        }
    }

    if headers.is_empty() {
        None
    } else {
        Some(headers)
    }
}
