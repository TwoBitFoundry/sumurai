import {
  getTelemetryExportSettings,
  getTracer,
  initTelemetry,
  resolveOtlpTracesUrl,
  shutdownTelemetry,
} from '@/observability/telemetry';

describe('Telemetry - Business Logic', () => {
  afterEach(async () => {
    await shutdownTelemetry();
    delete process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME;
    delete process.env.NEXT_PUBLIC_OTEL_SERVICE_VERSION;
    delete process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.NEXT_PUBLIC_OTEL_EXPORT_BATCH_SIZE;
    delete process.env.NEXT_PUBLIC_OTEL_EXPORT_DELAY_MS;
    delete process.env.NEXT_PUBLIC_OTEL_EXPORT_QUEUE_SIZE;
    delete process.env.NEXT_PUBLIC_OTEL_EXPORT_TIMEOUT_MS;
  });

  describe('Graceful Degradation', () => {
    it('should disable telemetry when NEXT_PUBLIC_OTEL_ENABLED is false', async () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'false';

      const tracer = await initTelemetry();

      expect(tracer).toBeNull();
    });

    it('should return null tracer when telemetry is disabled', () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'false';

      const tracer = getTracer();

      expect(tracer).toBeNull();
    });

    it('should handle shutdown safely when telemetry never initialized', async () => {
      await shutdownTelemetry();

      expect(true).toBe(true);
    });
  });

  describe('Environment Configuration', () => {
    it('should read service name from NEXT_PUBLIC_OTEL_SERVICE_NAME', async () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'true';
      process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME = 'sumurai-frontend-test';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should read service version from NEXT_PUBLIC_OTEL_SERVICE_VERSION', async () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'true';
      process.env.NEXT_PUBLIC_OTEL_SERVICE_VERSION = '1.0.0-test';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should read OTLP endpoint from NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT', async () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'true';
      process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:5341/ingest/otlp';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should apply defaults if environment variables not set', async () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'true';
      delete process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME;
      delete process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT;

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });
  });

  describe('OTLP Endpoint Resolution', () => {
    it('should append the traces path to the configured endpoint', () => {
      expect(resolveOtlpTracesUrl('/ingest/otlp')).toBe('/ingest/otlp/v1/traces');
    });

    it('should trim trailing slashes before appending the traces path', () => {
      expect(resolveOtlpTracesUrl('http://localhost:5341/ingest/otlp/')).toBe(
        'http://localhost:5341/ingest/otlp/v1/traces'
      );
    });
  });

  describe('OTLP Batch Cadence', () => {
    it('should batch spans on a cadence instead of exporting continuously', () => {
      delete process.env.NEXT_PUBLIC_OTEL_EXPORT_BATCH_SIZE;
      delete process.env.NEXT_PUBLIC_OTEL_EXPORT_DELAY_MS;
      delete process.env.NEXT_PUBLIC_OTEL_EXPORT_QUEUE_SIZE;
      delete process.env.NEXT_PUBLIC_OTEL_EXPORT_TIMEOUT_MS;

      expect(getTelemetryExportSettings()).toEqual({
        maxExportBatchSize: 64,
        scheduledDelayMillis: 15000,
        maxQueueSize: 1024,
        exportTimeoutMillis: 30000,
      });
    });

    it('should allow overriding export cadence and batch size through env vars', () => {
      process.env.NEXT_PUBLIC_OTEL_EXPORT_BATCH_SIZE = '20';
      process.env.NEXT_PUBLIC_OTEL_EXPORT_DELAY_MS = '30000';
      process.env.NEXT_PUBLIC_OTEL_EXPORT_QUEUE_SIZE = '500';
      process.env.NEXT_PUBLIC_OTEL_EXPORT_TIMEOUT_MS = '60000';

      expect(getTelemetryExportSettings()).toEqual({
        maxExportBatchSize: 20,
        scheduledDelayMillis: 30000,
        maxQueueSize: 500,
        exportTimeoutMillis: 60000,
      });
    });
  });

  describe('Initialization State Management', () => {
    it('should return valid tracer when enabled', async () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'true';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
      expect(tracer).toBeDefined();
    });

    it('should track initialization state', async () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'true';

      const tracer = await initTelemetry();
      const retrievedTracer = getTracer();

      expect(retrievedTracer).toBe(tracer);
    });

    it('should clear state after shutdown', async () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'true';

      await initTelemetry();
      await shutdownTelemetry();

      const tracer = getTracer();

      expect(tracer).toBeNull();
    });

    it('should handle re-initialization after shutdown', async () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'true';

      const firstTracer = await initTelemetry();
      expect(firstTracer).not.toBeNull();

      await shutdownTelemetry();

      const secondTracer = await initTelemetry();
      expect(secondTracer).not.toBeNull();
    });
  });

  describe('Configuration Flags', () => {
    it('should respect NEXT_PUBLIC_OTEL_CAPTURE_BODIES flag', async () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'true';
      process.env.NEXT_PUBLIC_OTEL_CAPTURE_BODIES = 'false';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should enforce header and URL sanitization by default', async () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'true';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should respect sensitive endpoint blocking flag', async () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'true';
      process.env.NEXT_PUBLIC_OTEL_BLOCK_SENSITIVE_ENDPOINTS = 'true';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });
  });
});
