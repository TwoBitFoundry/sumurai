import { trace, Tracer, Span } from '@opentelemetry/api';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
import { sanitizeSpanAttributes, preventSensitiveSpans } from './sanitization';
import { SensitiveDataSpanProcessor, HttpRouteSpanProcessor, FilteringSpanProcessor } from './processors';
import { AuthService } from '../services/authService';

let tracerProvider: WebTracerProvider | null = null;
let tracer: Tracer | null = null;

function getConfig() {
  const env = process.env
  return {
    enabled: env.NEXT_PUBLIC_OTEL_ENABLED === 'true',
    serviceName: env.NEXT_PUBLIC_OTEL_SERVICE_NAME || 'sumaura-frontend',
    serviceVersion: env.NEXT_PUBLIC_OTEL_SERVICE_VERSION || '1.0.0',
    endpoint: env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:5341/ingest/otlp',
    seqApiKey: env.NEXT_PUBLIC_OTEL_SEQ_API_KEY || '',
    captureBodies: env.NEXT_PUBLIC_OTEL_CAPTURE_BODIES === 'true',
    sanitizeHeaders: env.NEXT_PUBLIC_OTEL_SANITIZE_HEADERS !== 'false',
    sanitizeUrls: env.NEXT_PUBLIC_OTEL_SANITIZE_URLS !== 'false',
    blockSensitiveEndpoints: env.NEXT_PUBLIC_OTEL_BLOCK_SENSITIVE_ENDPOINTS !== 'false'
  };
}

function getSpanAttributes(span: Span): Record<string, unknown> {
  return ((span as unknown as { attributes?: Record<string, unknown> }).attributes) ?? {};
}

function resolvePath(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const resolved = new URL(url, window.location.origin);
    return resolved.pathname || '/';
  } catch {
    if (url.startsWith('/')) {
      return url;
    }
    return null;
  }
}

function setHttpSpanName(span: Span, method?: string, url?: string): void {
  const path = resolvePath(url);
  if (!path) return;
  const httpMethod = method?.toUpperCase() || 'GET';
  const spanName = `${httpMethod} ${path}`;
  span.setAttribute('http.route', path);
  queueMicrotask(() => {
    span.updateName(spanName);
  });
}

function getSpanUrl(span: Span): string | undefined {
  const attributes = getSpanAttributes(span);
  const urlCandidates = ['http.url', 'url.full', 'http.target'];
  for (const key of urlCandidates) {
    const value = attributes[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function setEncryptedTokenAttribute(span: Span): void {
  const hash = AuthService.getEncryptedTokenHashSync();
  if (hash) {
    span.setAttribute('encrypted_token', hash);
    return;
  }

  void AuthService.ensureEncryptedTokenHash()
    .then(result => {
      if (result) {
        span.setAttribute('encrypted_token', result);
      }
    })
    .catch(() => {
      // Swallow errors to avoid interfering with telemetry pipeline
    });
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
    url: `${config.endpoint}/v1/traces`,
    headers: config.seqApiKey ? {
      'X-Seq-ApiKey': config.seqApiKey,
    } : {},
  });

  const batchSpanProcessor = new BatchSpanProcessor(exporter);
  const sensitiveDataProcessor = new SensitiveDataSpanProcessor({
    blockSensitiveEndpoints: config.blockSensitiveEndpoints,
    redactAuthEndpoints: true,
  });
  const routeSpanProcessor = new HttpRouteSpanProcessor();
  const filteredBatchSpanProcessor = new FilteringSpanProcessor(
    batchSpanProcessor,
    span => sensitiveDataProcessor.shouldBlockSpan(span),
  );

  tracerProvider = new WebTracerProvider({
    resource,
    spanProcessors: [sensitiveDataProcessor, routeSpanProcessor, filteredBatchSpanProcessor],
  });

  trace.setGlobalTracerProvider(tracerProvider);

  try {
    registerInstrumentations({
      instrumentations: [
        getWebAutoInstrumentations({
          '@opentelemetry/instrumentation-fetch': {
            enabled: true,
            propagateTraceHeaderCorsUrls: [/.+/],
            clearTimingResources: true,
            ignoreNetworkEvents: true,
            applyCustomAttributesOnSpan: (span: Span, request: Request, response: Response) => {
              setHttpSpanName(span, request.method, request.url);
              setEncryptedTokenAttribute(span);
              if (config.sanitizeHeaders || config.sanitizeUrls) {
                sanitizeSpanAttributes(span, request, response);
              }
            },
          },
          '@opentelemetry/instrumentation-xml-http-request': {
            enabled: true,
            propagateTraceHeaderCorsUrls: [/.+/],
            ignoreNetworkEvents: true,
            applyCustomAttributesOnSpan: (span: Span) => {
              const attributes = getSpanAttributes(span);
              setHttpSpanName(
                span,
                typeof attributes['http.method'] === 'string' ? attributes['http.method'] as string : undefined,
                getSpanUrl(span),
              );
              setEncryptedTokenAttribute(span);
              if (config.sanitizeHeaders || config.sanitizeUrls) {
                sanitizeSpanAttributes(span);
              }
            },
          },
          '@opentelemetry/instrumentation-user-interaction': {
            enabled: true,
            eventNames: ['click', 'submit'],
            shouldPreventSpanCreation: (eventName: string, element: Element) => {
              return preventSensitiveSpans(element, eventName);
            },
          },
          '@opentelemetry/instrumentation-document-load': {
            enabled: true,
          },
        }),
      ],
    });
  } catch {
    // Auto-instrumentations may not be available in test environments
  }

  tracer = trace.getTracer(config.serviceName, config.serviceVersion);

  void AuthService.ensureEncryptedTokenHash();

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
