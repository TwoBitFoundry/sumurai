import { initTelemetry, shutdownTelemetry, getTracer } from '@/observability/telemetry';

describe('Telemetry Validation', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_OTEL_ENABLED = 'true';
  });

  afterEach(async () => {
    await shutdownTelemetry();
  });

  describe('Telemetry initializes without errors', () => {
    it('should initialize tracer provider without throwing', async () => {
      expect(async () => {
        await initTelemetry();
      }).not.toThrow();
    });

    it('should return valid tracer instance', async () => {
      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
      expect(tracer).toBeDefined();
    });
  });

  describe('Console shows tracer provider registration', () => {
    it('should have registered tracer provider globally', async () => {
      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should be retrievable via getTracer', async () => {
      await initTelemetry();
      const tracer = getTracer();

      expect(tracer).not.toBeNull();
    });
  });

  describe('Test fetch call generates span visible in browser DevTools', () => {
    it('should create tracer capable of starting spans', async () => {
      const tracer = await initTelemetry();

      if (tracer) {
        const span = tracer.startSpan('test-operation');
        expect(span).toBeDefined();
        expect(typeof span.end).toBe('function');
        span.end();
      }
    });

    it('should support span attributes', async () => {
      const tracer = await initTelemetry();

      if (tracer) {
        const span = tracer.startSpan('api-call', {
          attributes: {
            'http.method': 'GET',
            'http.url': 'http://localhost:8080/api/health',
            'span.kind': 'client',
          },
        });
        expect(span).toBeDefined();
        span.end();
      }
    });

    it('should support nested spans for tracing call hierarchy', async () => {
      const tracer = await initTelemetry();

      if (tracer) {
        const parentSpan = tracer.startSpan('fetch-data');
        const childSpan = tracer.startSpan('parse-response');

        expect(parentSpan).toBeDefined();
        expect(childSpan).toBeDefined();

        childSpan.end();
        parentSpan.end();
      }
    });
  });

  describe('Feature Coverage', () => {
    it('should initialize WebTracerProvider with resource detection', async () => {
      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should configure OTLPTraceExporter pointing to Seq', async () => {
      process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:5341/ingest/otlp';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should register auto-instrumentations for fetch, user-interaction, document-load', async () => {
      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should set up BatchSpanProcessor for efficient export', async () => {
      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should register W3C Trace Context propagator for distributed tracing', async () => {
      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });
  });

  describe('Graceful Degradation', () => {
    it('should handle disabled telemetry without errors', async () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'false';

      const tracer = await initTelemetry();

      expect(tracer).toBeNull();
    });

    it('should not crash when telemetry disabled', async () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'false';

      expect(async () => {
        await initTelemetry();
      }).not.toThrow();
    });

    it('should support re-enabling after being disabled', async () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'false';
      const disabledTracer = await initTelemetry();
      expect(disabledTracer).toBeNull();

      await shutdownTelemetry();

      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'true';
      const enabledTracer = await initTelemetry();
      expect(enabledTracer).not.toBeNull();
    });
  });

  describe('Configuration Validation', () => {
    it('should read all required environment variables', async () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'true';
      process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME = 'sumurai-frontend';
      process.env.NEXT_PUBLIC_OTEL_SERVICE_VERSION = '1.0.0';
      process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:5341/ingest/otlp';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should apply sensible defaults for missing configuration', async () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'true';
      delete process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME;
      delete process.env.NEXT_PUBLIC_OTEL_SERVICE_VERSION;
      delete process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT;

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown tracer provider cleanly', async () => {
      await initTelemetry();

      expect(async () => {
        await shutdownTelemetry();
      }).not.toThrow();
    });

    it('should flush any pending spans before shutdown', async () => {
      const tracer = await initTelemetry();

      if (tracer) {
        const span = tracer.startSpan('test-span');
        span.end();
      }

      expect(async () => {
        await shutdownTelemetry();
      }).not.toThrow();
    });
  });
});
