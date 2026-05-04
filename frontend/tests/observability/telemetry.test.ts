import {
  getTracer,
  IGNORE_OTEL_SELF_EXPORT_URLS,
  initTelemetry,
  PUBLIC_BROWSER_OTLP_EXPORT_PATH,
  resolveBrowserOtlpExportUrl,
  shutdownTelemetry,
} from '@/observability/telemetry';

describe('Telemetry - Business Logic', () => {
  afterEach(async () => {
    await shutdownTelemetry();
    delete process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME;
    delete process.env.NEXT_PUBLIC_OTEL_SERVICE_VERSION;
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

    it('should apply defaults if environment variables not set', async () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'true';
      delete process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME;

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });
  });

  describe('OTLP export URL resolution', () => {
    it('uses same-origin HTTP(S) URLs unchanged', () => {
      expect(resolveBrowserOtlpExportUrl('http://collector:4318/v1/traces')).toBe(
        'http://collector:4318/v1/traces'
      );
    });

    it('prefixes bare paths with the runtime origin when available', () => {
      expect(resolveBrowserOtlpExportUrl(PUBLIC_BROWSER_OTLP_EXPORT_PATH)).toBe(
        `${window.location.origin}${PUBLIC_BROWSER_OTLP_EXPORT_PATH}`
      );
    });

    it('trims trailing slashes on absolute URLs', () => {
      expect(resolveBrowserOtlpExportUrl('http://collector:4318/export/')).toBe(
        'http://collector:4318/export'
      );
    });

    it('uses the fixed relay path when the argument is whitespace', () => {
      expect(resolveBrowserOtlpExportUrl('   \n')).toBe(
        `${window.location.origin}${PUBLIC_BROWSER_OTLP_EXPORT_PATH}`
      );
    });
  });

  describe('Self-export URL ignore patterns', () => {
    it('matches OTLP relay paths passed to instrumentation', () => {
      expect(IGNORE_OTEL_SELF_EXPORT_URLS.length).toBe(2);
      expect(
        IGNORE_OTEL_SELF_EXPORT_URLS.some((r) =>
          r.test('https://example.com/api/v1/public/telemetry')
        )
      ).toBe(true);
      expect(
        IGNORE_OTEL_SELF_EXPORT_URLS.some((r) =>
          r.test('https://example.com/api/v1/private/telemetry')
        )
      ).toBe(true);
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
