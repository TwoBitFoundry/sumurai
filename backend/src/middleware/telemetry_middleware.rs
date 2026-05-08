use anyhow::Result;
use axum::{body::Body, extract::Request, middleware::Next, response::Response};
use axum_tracing_opentelemetry::tracing_opentelemetry_instrumentation_sdk as otel_sdk;
use chrono::Utc;
use opentelemetry::{
    global,
    trace::{TraceContextExt, TracerProvider},
};
use opentelemetry_otlp::{WithExportConfig, WithHttpConfig};
use opentelemetry_sdk::{
    error::{OTelSdkError, OTelSdkResult},
    propagation::TraceContextPropagator,
    trace::{SdkTracerProvider, SpanData, SpanExporter},
    Resource,
};
use std::{collections::HashMap, fmt::Write, time::Instant};
use tracing::{info_span, Instrument, Span};
use tracing_opentelemetry::OpenTelemetrySpanExt;
use tracing_subscriber::Layer;
use tracing_subscriber::{
    filter::LevelFilter,
    fmt::{
        format::{FormatEvent, FormatFields, Writer},
        FmtContext,
    },
    layer::SubscriberExt,
    registry::LookupSpan,
    util::SubscriberInitExt,
    EnvFilter,
};

const SENSITIVE_REQUEST_PATHS: &[&str] = &["/api/plaid/exchange-token", "/api/providers/connect"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TracesExporterKind {
    Otlp,
    Console,
    None,
}

impl TracesExporterKind {
    pub fn from_env() -> anyhow::Result<Self> {
        let raw = std::env::var("OTEL_TRACES_EXPORTER")
            .map_err(|_| anyhow::anyhow!("OTEL_TRACES_EXPORTER must be set (otlp|console|none)"))?;

        match raw.to_ascii_lowercase().as_str() {
            "otlp" => Ok(Self::Otlp),
            "console" => Ok(Self::Console),
            "none" => Ok(Self::None),
            other => Err(anyhow::anyhow!(
                "OTEL_TRACES_EXPORTER must be one of otlp|console|none (got {other:?})"
            )),
        }
    }
}

pub struct TelemetryConfig {
    pub env_filter: Option<String>,
    pub otlp_endpoint: String,
    pub otlp_headers: Option<HashMap<String, String>>,
    pub traces_exporter: TracesExporterKind,
}

impl TelemetryConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        let traces_exporter = TracesExporterKind::from_env()?;
        let otlp_endpoint = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT")
            .unwrap_or_else(|_| "http://localhost:5341/ingest/otlp/v1/traces".to_string());

        let otlp_headers = std::env::var("OTEL_EXPORTER_OTLP_HEADERS")
            .ok()
            .and_then(parse_otlp_headers);

        Ok(Self {
            env_filter: std::env::var("RUST_LOG").ok(),
            otlp_endpoint,
            otlp_headers,
            traces_exporter,
        })
    }
}

pub struct TelemetryHandle {
    tracer_provider: Option<SdkTracerProvider>,
}

impl TelemetryHandle {
    pub fn shutdown(self) -> Result<()> {
        let Some(provider) = self.tracer_provider else {
            return Ok(());
        };
        provider
            .shutdown()
            .map_err(|err| anyhow::anyhow!("failed to shutdown tracer provider: {err}"))
    }
}

#[derive(Debug, Default)]
struct ConsoleSpanExporter;

impl SpanExporter for ConsoleSpanExporter {
    fn export(
        &self,
        batch: Vec<SpanData>,
    ) -> impl std::future::Future<Output = OTelSdkResult> + Send {
        for span in batch {
            let is_error = matches!(span.status, opentelemetry::trace::Status::Error { .. });
            if is_error {
                println!("{span:?}");
            }
        }
        futures::future::ready(Ok(()))
    }

    fn shutdown(&mut self) -> std::result::Result<(), OTelSdkError> {
        Ok(())
    }
}

pub fn init(config: &TelemetryConfig) -> Result<TelemetryHandle> {
    let env_filter = match &config.env_filter {
        Some(filter) => EnvFilter::try_new(filter.clone()).unwrap_or_else(|err| {
            eprintln!("Invalid RUST_LOG value ({filter:?}): {err}. Falling back to \"info\".");
            EnvFilter::new("info")
        }),
        None => EnvFilter::new("info"),
    };

    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_target(false)
        .event_format(SeqJsonFormatter);

    global::set_text_map_propagator(TraceContextPropagator::new());

    let resource = Resource::builder()
        .with_service_name("sumurai-backend")
        .build();

    let (tracer_provider, otel_layer) = match config.traces_exporter {
        TracesExporterKind::Otlp => {
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
            let tracer_provider = opentelemetry_sdk::trace::SdkTracerProvider::builder()
                .with_resource(resource)
                .with_batch_exporter(exporter)
                .build();
            let tracer = tracer_provider.tracer("accounting-backend");
            (
                Some(tracer_provider.clone()),
                Some(
                    tracing_opentelemetry::layer()
                        .with_tracer(tracer)
                        .with_filter(LevelFilter::INFO),
                ),
            )
        }
        TracesExporterKind::Console => {
            println!("OTEL traces exporter: console");
            let exporter = ConsoleSpanExporter;
            let tracer_provider = opentelemetry_sdk::trace::SdkTracerProvider::builder()
                .with_resource(resource)
                .with_batch_exporter(exporter)
                .build();
            let tracer = tracer_provider.tracer("accounting-backend");
            (
                Some(tracer_provider.clone()),
                Some(
                    tracing_opentelemetry::layer()
                        .with_tracer(tracer)
                        .with_filter(LevelFilter::INFO),
                ),
            )
        }
        TracesExporterKind::None => {
            println!("OTEL traces exporter: none");
            let tracer_provider = opentelemetry_sdk::trace::SdkTracerProvider::builder()
                .with_resource(resource)
                .build();
            let tracer = tracer_provider.tracer("accounting-backend");
            (
                Some(tracer_provider.clone()),
                Some(
                    tracing_opentelemetry::layer()
                        .with_tracer(tracer)
                        .with_filter(LevelFilter::INFO),
                ),
            )
        }
    };

    let base = tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer);
    match otel_layer {
        Some(layer) => base
            .with(layer)
            .try_init()
            .map_err(|err| anyhow::anyhow!("failed to initialize tracing subscriber: {err}"))?,
        None => base
            .try_init()
            .map_err(|err| anyhow::anyhow!("failed to initialize tracing subscriber: {err}"))?,
    };

    if let Some(provider) = tracer_provider.clone() {
        global::set_tracer_provider(provider);
    }

    Ok(TelemetryHandle { tracer_provider })
}

pub async fn request_tracing_middleware(request: Request<Body>, next: Next) -> Response {
    let method = request.method().clone();
    let path = request.uri().path().to_string();
    if SENSITIVE_REQUEST_PATHS
        .iter()
        .any(|&sensitive| sensitive == path)
    {
        return next.run(request).await;
    }
    let start_time = Instant::now();

    let span = info_span!(
        "api_request",
        http.method = %method,
        http.route = %path,
        http.status_code = tracing::field::Empty,
        duration_ms = tracing::field::Empty,
        session_id = tracing::field::Empty
    );

    let span_name = format!("{method} {path}");

    async move {
        Span::current()
            .context()
            .span()
            .update_name(span_name.clone());

        let response = next.run(request).await;
        let status = response.status();
        let duration_ms = start_time.elapsed().as_secs_f64() * 1000.0;

        Span::current().record("http.status_code", status.as_u16() as i64);
        Span::current().record("duration_ms", duration_ms);

        response
    }
    .instrument(span)
    .await
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
