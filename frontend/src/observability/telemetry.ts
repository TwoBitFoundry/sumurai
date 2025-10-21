import { trace, Tracer } from '@opentelemetry/api';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { registerInstrumentations } from '@opentelemetry/auto-instrumentations-web';

let tracerProvider: WebTracerProvider | null = null;
let tracer: Tracer | null = null;

function getConfig() {
  return {
    enabled: import.meta.env.VITE_OTEL_ENABLED === 'true',
    serviceName: import.meta.env.VITE_OTEL_SERVICE_NAME || 'sumaura-frontend',
    serviceVersion: import.meta.env.VITE_OTEL_SERVICE_VERSION || '1.0.0',
    endpoint: import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:5341/ingest/otlp',
    captureBodies: import.meta.env.VITE_OTEL_CAPTURE_BODIES === 'true',
    sanitizeHeaders: import.meta.env.VITE_OTEL_SANITIZE_HEADERS !== 'false',
    sanitizeUrls: import.meta.env.VITE_OTEL_SANITIZE_URLS !== 'false',
    blockSensitiveEndpoints: import.meta.env.VITE_OTEL_BLOCK_SENSITIVE_ENDPOINTS !== 'false',
  };
}

export async function initTelemetry(): Promise<Tracer | null> {
  const config = getConfig();

  if (!config.enabled) {
    tracer = null;
    return null;
  }

  if (tracerProvider) {
    return tracer;
  }

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.serviceName,
    [ATTR_SERVICE_VERSION]: config.serviceVersion,
  });

  const exporter = new OTLPTraceExporter({
    url: config.endpoint,
  });

  const spanProcessor = new BatchSpanProcessor(exporter);

  tracerProvider = new WebTracerProvider({
    resource,
    spanProcessors: [spanProcessor],
  });

  trace.setGlobalTracerProvider(tracerProvider);

  try {
    registerInstrumentations({
      '@opentelemetry/instrumentation-fetch': {
        enabled: true,
        propagateTraceHeaderCorsUrls: [/.+/],
        clearTimingResources: true,
        ignoreNetworkEvents: true,
      },
      '@opentelemetry/instrumentation-xml-http-request': {
        enabled: true,
        propagateTraceHeaderCorsUrls: [/.+/],
        ignoreNetworkEvents: true,
      },
      '@opentelemetry/instrumentation-user-interaction': {
        enabled: true,
        eventNames: ['click', 'submit'],
      },
      '@opentelemetry/instrumentation-document-load': {
        enabled: true,
      },
    });
  } catch {
    // Auto-instrumentations may not be available in test environments
  }

  tracer = trace.getTracer(config.serviceName, config.serviceVersion);

  return tracer;
}

export function getTracer(): Tracer | null {
  return tracer;
}

export async function shutdownTelemetry(): Promise<void> {
  if (tracerProvider) {
    await tracerProvider.shutdown();
    tracerProvider = null;
    tracer = null;
  }
}
