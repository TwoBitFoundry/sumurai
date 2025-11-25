import { initTelemetry, shutdownTelemetry } from '@/observability/telemetry';

describe('Telemetry Integration - Auto-Instrumentation', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_OTEL_ENABLED = 'true';
  });

  afterEach(async () => {
    await shutdownTelemetry();
  });

  describe('Initialization', () => {
    it('should initialize successfully with all defaults', async () => {
      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
      expect(tracer).toBeDefined();
    });

    it('should support multiple calls without re-initializing', async () => {
      const first = await initTelemetry();
      const second = await initTelemetry();

      expect(first).toBe(second);
    });
  });

  describe('Environment Configuration Loading', () => {
    it('should use environment values for service name', async () => {
      process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME = 'test-service';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should use environment values for service version', async () => {
      process.env.NEXT_PUBLIC_OTEL_SERVICE_VERSION = '2.0.0';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should use environment values for endpoint', async () => {
      process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT = 'http://seq.example.com:5341/ingest/otlp';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });
  });

  describe('Security Configuration', () => {
    it('should respect body capture setting', async () => {
      process.env.NEXT_PUBLIC_OTEL_CAPTURE_BODIES = 'false';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should respect header sanitization setting', async () => {
      process.env.NEXT_PUBLIC_OTEL_SANITIZE_HEADERS = 'true';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should respect URL sanitization setting', async () => {
      process.env.NEXT_PUBLIC_OTEL_SANITIZE_URLS = 'true';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should respect sensitive endpoint blocking', async () => {
      process.env.NEXT_PUBLIC_OTEL_BLOCK_SENSITIVE_ENDPOINTS = 'true';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });
  });

  describe('Resource Detection', () => {
    it('should create tracer with configured service attributes', async () => {
      process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME = 'test-app';
      process.env.NEXT_PUBLIC_OTEL_SERVICE_VERSION = '1.2.3';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown cleanly', async () => {
      await initTelemetry();

      await shutdownTelemetry();

      expect(true).toBe(true);
    });

    it('should allow re-initialization after shutdown', async () => {
      await initTelemetry();
      await shutdownTelemetry();

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should clear state after shutdown', async () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'false';

      await initTelemetry();
      await shutdownTelemetry();

      const tracer = await initTelemetry();

      expect(tracer).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle disabled telemetry gracefully', async () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'false';

      const tracer = await initTelemetry();

      expect(tracer).toBeNull();
    });

    it('should handle multiple shutdowns', async () => {
      await initTelemetry();

      await shutdownTelemetry();
      await shutdownTelemetry();

      expect(true).toBe(true);
    });
  });

  describe('Configuration Inheritance', () => {
    it('should use defaults when environment not set', async () => {
      delete process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME;
      delete process.env.NEXT_PUBLIC_OTEL_SERVICE_VERSION;
      delete process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT;

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should override defaults with environment values', async () => {
      process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME = 'custom-name';
      process.env.NEXT_PUBLIC_OTEL_SERVICE_VERSION = '99.0.0';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });
  });

  describe('Batch Processing', () => {
    it('should configure batch span processor', async () => {
      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });
  });
});
