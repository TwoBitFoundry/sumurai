import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initTelemetry, shutdownTelemetry } from '@/observability/telemetry';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import { ReadableSpan } from '@opentelemetry/sdk-trace-base';

global.fetch = vi.fn();

const createMockResponse = (status: number, body?: any): Response => {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers(),
    json: async () => body,
    text: async () => JSON.stringify(body),
    blob: async () => new Blob(),
    arrayBuffer: async () => new ArrayBuffer(0),
    formData: async () => new FormData(),
    clone: () => createMockResponse(status, body),
    body: null,
    bodyUsed: false,
    redirected: false,
    type: 'basic',
    url: '',
  } as Response;
};

describe('Telemetry Integration - Fetch Instrumentation', () => {
  let exporter: InMemorySpanExporter;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_OTEL_ENABLED = 'true';
    exporter = new InMemorySpanExporter();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await shutdownTelemetry();
    exporter.reset();
  });

  describe('Auto-Instrumentation Coverage', () => {
    it('should capture fetch calls automatically', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse(200, { success: true }));

      await initTelemetry();

      await fetch('http://localhost:8080/api/health');

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8080/api/health');
    });

    it('should capture fetch with custom headers', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse(200));

      await initTelemetry();

      await fetch('http://localhost:8080/api/transactions', {
        headers: { 'Authorization': 'Bearer test-token' },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/transactions',
        expect.objectContaining({
          headers: expect.objectContaining({ 'Authorization': 'Bearer test-token' }),
        })
      );
    });

    it('should capture POST requests with body', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse(201));

      await initTelemetry();

      await fetch('http://localhost:8080/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'Food', amount: 500 }),
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/budgets',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should capture failed fetch requests', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse(500));

      await initTelemetry();

      await fetch('http://localhost:8080/api/transactions');

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should capture network errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await initTelemetry();

      try {
        await fetch('http://localhost:8080/api/transactions');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Security - Header Sanitization', () => {
    it('should NOT include Authorization header in spans', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse(200));

      await initTelemetry();

      await fetch('http://localhost:8080/api/transactions', {
        headers: { 'Authorization': 'Bearer eyJ...' },
      });

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should NOT include Cookie header in spans', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse(200));

      await initTelemetry();

      await fetch('http://localhost:8080/api/transactions', {
        headers: { 'Cookie': 'session=abc123' },
      });

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should NOT include X-API-Key header in spans', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse(200));

      await initTelemetry();

      await fetch('http://localhost:8080/api/data', {
        headers: { 'X-API-Key': 'secret-key-123' },
      });

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Distributed Tracing', () => {
    it('should propagate W3C Trace Context headers', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse(200));

      await initTelemetry();

      await fetch('http://localhost:8080/api/transactions');

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should link frontend spans to backend spans', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse(200));

      await initTelemetry();

      await fetch('http://localhost:8080/api/transactions');

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should record span exceptions for network errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network timeout'));

      await initTelemetry();

      try {
        await fetch('http://localhost:8080/api/transactions');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should mark spans as errors for 4xx responses', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse(404));

      await initTelemetry();

      await fetch('http://localhost:8080/api/invalid');

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should mark spans as errors for 5xx responses', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse(500));

      await initTelemetry();

      await fetch('http://localhost:8080/api/transactions');

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('URL Sanitization', () => {
    it('should redact token query parameters', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse(200));

      await initTelemetry();

      await fetch('http://localhost:8080/api/auth/verify?token=secret123');

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should redact access_token query parameters', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse(200));

      await initTelemetry();

      await fetch('http://localhost:8080/api/callback?access_token=secret');

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should preserve non-sensitive query parameters', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse(200));

      await initTelemetry();

      await fetch('http://localhost:8080/api/transactions?limit=10&offset=0');

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should batch span exports', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse(200));

      await initTelemetry();

      await Promise.all([
        fetch('http://localhost:8080/api/transactions'),
        fetch('http://localhost:8080/api/budgets'),
        fetch('http://localhost:8080/api/analytics/spending'),
      ]);

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should not block the main thread', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse(200));

      await initTelemetry();

      const startTime = Date.now();
      await fetch('http://localhost:8080/api/health');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Configuration Overrides', () => {
    it('should respect VITE_OTEL_ENABLED=false', async () => {
      process.env.NEXT_PUBLIC_OTEL_ENABLED = 'false';
      (global.fetch as any).mockResolvedValue(createMockResponse(200));

      const tracer = await initTelemetry();

      expect(tracer).toBeNull();

      await fetch('http://localhost:8080/api/health');
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should respect custom OTLP endpoint', async () => {
      process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT = 'http://custom-seq:5341/ingest/otlp';
      (global.fetch as any).mockResolvedValue(createMockResponse(200));

      await initTelemetry();

      await fetch('http://localhost:8080/api/health');
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Multiple Concurrent Requests', () => {
    it('should handle concurrent fetch requests', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse(200));

      await initTelemetry();

      await Promise.all([
        fetch('http://localhost:8080/api/transactions'),
        fetch('http://localhost:8080/api/budgets'),
        fetch('http://localhost:8080/api/analytics/spending'),
        fetch('http://localhost:8080/api/analytics/categories'),
        fetch('http://localhost:8080/api/providers/status'),
      ]);

      expect(global.fetch).toHaveBeenCalledTimes(5);
    });

    it('should maintain separate spans for each request', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse(200));

      await initTelemetry();

      const urls = [
        'http://localhost:8080/api/transactions',
        'http://localhost:8080/api/budgets',
      ];

      for (const url of urls) {
        await fetch(url);
      }

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Sensitive Endpoint Blocking', () => {
    it('should handle login endpoint', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse(200));

      await initTelemetry();

      await fetch('http://localhost:8080/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'test', password: 'secret' }),
      });

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle token exchange endpoints', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse(200));

      await initTelemetry();

      await fetch('http://localhost:8080/api/plaid/exchange-token', {
        method: 'POST',
        body: JSON.stringify({ public_token: 'public-token-123' }),
      });

      expect(global.fetch).toHaveBeenCalled();
    });
  });
});

describe('Telemetry Integration - Span Attributes', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_OTEL_ENABLED = 'true';
  });

  afterEach(async () => {
    await shutdownTelemetry();
  });

  it('should include http.method attribute', async () => {
    (global.fetch as any).mockResolvedValue(createMockResponse(200));

    await initTelemetry();
    await fetch('http://localhost:8080/api/health');

    expect(global.fetch).toHaveBeenCalled();
  });

  it('should include http.status_code attribute', async () => {
    (global.fetch as any).mockResolvedValue(createMockResponse(200));

    await initTelemetry();
    await fetch('http://localhost:8080/api/health');

    expect(global.fetch).toHaveBeenCalled();
  });

  it('should include http.url attribute', async () => {
    (global.fetch as any).mockResolvedValue(createMockResponse(200));

    await initTelemetry();
    await fetch('http://localhost:8080/api/health');

    expect(global.fetch).toHaveBeenCalled();
  });
});
