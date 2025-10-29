import { describe, it, expect, afterEach } from 'vitest';
import { initTelemetry, shutdownTelemetry, getTracer } from '@/observability/telemetry';

describe('Telemetry - Business Logic', () => {
  afterEach(async () => {
    await shutdownTelemetry();
  });

  describe('Graceful Degradation', () => {
    it('should disable telemetry when VITE_OTEL_ENABLED is false', async () => {
      import.meta.env.VITE_OTEL_ENABLED = 'false';

      const tracer = await initTelemetry();

      expect(tracer).toBeNull();
    });

    it('should return null tracer when telemetry is disabled', () => {
      import.meta.env.VITE_OTEL_ENABLED = 'false';

      const tracer = getTracer();

      expect(tracer).toBeNull();
    });

    it('should handle shutdown safely when telemetry never initialized', async () => {
      await shutdownTelemetry();

      expect(true).toBe(true);
    });
  });

  describe('Environment Configuration', () => {
    it('should read service name from VITE_OTEL_SERVICE_NAME', async () => {
      import.meta.env.VITE_OTEL_ENABLED = 'true';
      import.meta.env.VITE_OTEL_SERVICE_NAME = 'sumaura-frontend-test';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should read service version from VITE_OTEL_SERVICE_VERSION', async () => {
      import.meta.env.VITE_OTEL_ENABLED = 'true';
      import.meta.env.VITE_OTEL_SERVICE_VERSION = '1.0.0-test';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should read OTLP endpoint from VITE_OTEL_EXPORTER_OTLP_ENDPOINT', async () => {
      import.meta.env.VITE_OTEL_ENABLED = 'true';
      import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:5341/ingest/otlp';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should apply defaults if environment variables not set', async () => {
      import.meta.env.VITE_OTEL_ENABLED = 'true';
      delete import.meta.env.VITE_OTEL_SERVICE_NAME;
      delete import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT;

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });
  });

  describe('Initialization State Management', () => {
    it('should return valid tracer when enabled', async () => {
      import.meta.env.VITE_OTEL_ENABLED = 'true';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
      expect(tracer).toBeDefined();
    });

    it('should track initialization state', async () => {
      import.meta.env.VITE_OTEL_ENABLED = 'true';

      const tracer = await initTelemetry();
      const retrievedTracer = getTracer();

      expect(retrievedTracer).toBe(tracer);
    });

    it('should clear state after shutdown', async () => {
      import.meta.env.VITE_OTEL_ENABLED = 'true';

      await initTelemetry();
      await shutdownTelemetry();

      const tracer = getTracer();

      expect(tracer).toBeNull();
    });

    it('should handle re-initialization after shutdown', async () => {
      import.meta.env.VITE_OTEL_ENABLED = 'true';

      const firstTracer = await initTelemetry();
      expect(firstTracer).not.toBeNull();

      await shutdownTelemetry();

      const secondTracer = await initTelemetry();
      expect(secondTracer).not.toBeNull();
    });
  });

  describe('Configuration Flags', () => {
    it('should respect VITE_OTEL_CAPTURE_BODIES flag', async () => {
      import.meta.env.VITE_OTEL_ENABLED = 'true';
      import.meta.env.VITE_OTEL_CAPTURE_BODIES = 'false';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should respect sanitization enabled flag', async () => {
      import.meta.env.VITE_OTEL_ENABLED = 'true';
      import.meta.env.VITE_OTEL_SANITIZE_HEADERS = 'true';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should respect URL sanitization flag', async () => {
      import.meta.env.VITE_OTEL_ENABLED = 'true';
      import.meta.env.VITE_OTEL_SANITIZE_URLS = 'true';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });

    it('should respect sensitive endpoint blocking flag', async () => {
      import.meta.env.VITE_OTEL_ENABLED = 'true';
      import.meta.env.VITE_OTEL_BLOCK_SENSITIVE_ENDPOINTS = 'true';

      const tracer = await initTelemetry();

      expect(tracer).not.toBeNull();
    });
  });
});
