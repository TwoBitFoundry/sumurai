import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SensitiveDataSpanProcessor, FilteringSpanProcessor } from '@/observability/processors';
import { ReadableSpan } from '@opentelemetry/sdk-trace-base';

const createMockSpan = (url: string, additionalAttributes?: Record<string, any>): ReadableSpan => {
  const attributes: Record<string, any> = {
    'http.url': url,
    'http.method': 'POST',
    'http.status_code': 200,
    ...additionalAttributes,
  };

  return {
    attributes,
    name: 'test-span',
    spanContext: () => ({
      traceId: 'test-trace-id',
      spanId: 'test-span-id',
      traceFlags: 1,
    }),
    startTime: [0, 0],
    endTime: [1, 0],
    status: { code: 0 },
    events: [],
    links: [],
    duration: [1, 0],
    ended: true,
    resource: {} as any,
    instrumentationLibrary: { name: 'test', version: '1.0.0' },
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
    kind: 1,
  } as ReadableSpan;
};

describe('SensitiveDataSpanProcessor', () => {
  describe('Provider Credential Endpoint Blocking', () => {
    let processor: SensitiveDataSpanProcessor;

    beforeEach(() => {
      processor = new SensitiveDataSpanProcessor({
        blockSensitiveEndpoints: true,
        redactAuthEndpoints: false,
      });
    });

    it('should not block spans for /api/auth/login endpoint', () => {
      const span = createMockSpan('http://localhost:8080/api/auth/login');

      expect(processor.shouldBlockSpan(span)).toBe(false);
      expect(() => processor.onEnd(span)).not.toThrow();
    });

    it('should not block spans for /api/auth/register endpoint', () => {
      const span = createMockSpan('http://localhost:8080/api/auth/register');

      expect(processor.shouldBlockSpan(span)).toBe(false);
      expect(() => processor.onEnd(span)).not.toThrow();
    });

    it('should block spans for /api/plaid/exchange-token endpoint', () => {
      const span = createMockSpan('http://localhost:8080/api/plaid/exchange-token');

      expect(processor.shouldBlockSpan(span)).toBe(true);
      expect(() => processor.onEnd(span)).not.toThrow();
    });

    it('should block spans for /api/teller/exchange-token endpoint', () => {
      const span = createMockSpan('http://localhost:8080/api/teller/exchange-token');

      expect(processor.shouldBlockSpan(span)).toBe(true);
      expect(() => processor.onEnd(span)).not.toThrow();
    });

    it('should allow spans for non-sensitive endpoints', () => {
      const span = createMockSpan('http://localhost:8080/api/transactions');

      expect(processor.shouldBlockSpan(span)).toBe(false);
      expect(() => processor.onEnd(span)).not.toThrow();
    });

    it('should allow spans for /api/auth endpoints that are not login/register', () => {
      const span = createMockSpan('http://localhost:8080/api/auth/refresh');

      expect(processor.shouldBlockSpan(span)).toBe(false);
      expect(() => processor.onEnd(span)).not.toThrow();
    });

    it('should handle spans without url attribute', () => {
      const span = createMockSpan('');
      delete span.attributes['http.url'];

      expect(() => processor.onEnd(span)).not.toThrow();
    });
  });

  describe('Auth Endpoint Redaction', () => {
    let processor: SensitiveDataSpanProcessor;

    beforeEach(() => {
      processor = new SensitiveDataSpanProcessor({
        blockSensitiveEndpoints: false,
        redactAuthEndpoints: true,
      });
    });

    it('should redact non-essential attributes for /api/auth/ endpoints', () => {
      const span = createMockSpan('http://localhost:8080/api/auth/login', {
        'user.id': 'user-123',
        'request.body': 'sensitive-data',
        'custom.attribute': 'some-value',
      });

      processor.onEnd(span);

      expect(span.attributes['http.method']).toBe('POST');
      expect(span.attributes['http.status_code']).toBe(200);
      expect(span.attributes['http.url']).toBeDefined();

      expect(span.attributes['user.id']).toBeUndefined();
      expect(span.attributes['request.body']).toBeUndefined();
      expect(span.attributes['custom.attribute']).toBeUndefined();
    });

    it('should redact non-essential attributes for /api/plaid/link-token endpoint', () => {
      const span = createMockSpan('http://localhost:8080/api/plaid/link-token', {
        'user.id': 'user-123',
        'request.body': 'sensitive-data',
      });

      processor.onEnd(span);

      expect(span.attributes['http.method']).toBe('POST');
      expect(span.attributes['http.url']).toBeDefined();

      expect(span.attributes['user.id']).toBeUndefined();
      expect(span.attributes['request.body']).toBeUndefined();
    });

    it('should preserve essential attributes (http.method, http.status_code, http.url)', () => {
      const span = createMockSpan('http://localhost:8080/api/auth/refresh', {
        'some.attribute': 'value',
      });

      processor.onEnd(span);

      expect(span.attributes['http.method']).toBe('POST');
      expect(span.attributes['http.status_code']).toBe(200);
      expect(span.attributes['http.url']).toBe('http://localhost:8080/api/auth/refresh');
    });

    it('should redact JWT tokens in essential attributes', () => {
      const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const span = createMockSpan(`http://localhost:8080/api/auth/verify?token=${jwtToken}`);

      processor.onEnd(span);

      expect(span.attributes['http.url']).not.toContain(jwtToken);
      expect(span.attributes['http.url']).toContain('[JWT_REDACTED]');
    });

    it('should not redact non-auth endpoints', () => {
      const span = createMockSpan('http://localhost:8080/api/transactions', {
        'user.id': 'user-123',
        'custom.attribute': 'value',
      });

      processor.onEnd(span);

      expect(span.attributes['user.id']).toBe('user-123');
      expect(span.attributes['custom.attribute']).toBe('value');
    });
  });

  describe('Configuration Options', () => {
    it('should respect blockSensitiveEndpoints=false', () => {
      const processor = new SensitiveDataSpanProcessor({
        blockSensitiveEndpoints: false,
      });

      const span = createMockSpan('http://localhost:8080/api/plaid/exchange-token');

      expect(processor.shouldBlockSpan(span)).toBe(false);
      expect(() => processor.onEnd(span)).not.toThrow();
    });

    it('should respect redactAuthEndpoints=false', () => {
      const processor = new SensitiveDataSpanProcessor({
        redactAuthEndpoints: false,
      });

      const span = createMockSpan('http://localhost:8080/api/auth/refresh', {
        'user.id': 'user-123',
      });

      processor.onEnd(span);

      expect(span.attributes['user.id']).toBe('user-123');
    });

    it('should use default options when not specified', () => {
      const processor = new SensitiveDataSpanProcessor();

      const span = createMockSpan('http://localhost:8080/api/plaid/exchange-token');

      expect(processor.shouldBlockSpan(span)).toBe(true);
      expect(() => processor.onEnd(span)).not.toThrow();
    });
  });

  describe('URL Extraction', () => {
    let processor: SensitiveDataSpanProcessor;

    beforeEach(() => {
      processor = new SensitiveDataSpanProcessor();
    });

    it('should extract URL from http.url attribute', () => {
      const span = createMockSpan('http://localhost:8080/api/plaid/exchange-token');

      expect(processor.shouldBlockSpan(span)).toBe(true);
    });

    it('should extract URL from url.full attribute', () => {
      const span = createMockSpan('');
      delete span.attributes['http.url'];
      span.attributes['url.full'] = 'http://localhost:8080/api/plaid/exchange-token';

      expect(processor.shouldBlockSpan(span)).toBe(true);
    });

    it('should extract URL from http.target attribute', () => {
      const span = createMockSpan('');
      delete span.attributes['http.url'];
      span.attributes['http.target'] = '/api/plaid/exchange-token';

      expect(processor.shouldBlockSpan(span)).toBe(true);
    });

    it('should handle spans with no URL attributes gracefully', () => {
      const span = createMockSpan('');
      delete span.attributes['http.url'];

      expect(() => processor.onEnd(span)).not.toThrow();
    });
  });

  describe('Lifecycle Methods', () => {
    let processor: SensitiveDataSpanProcessor;

    beforeEach(() => {
      processor = new SensitiveDataSpanProcessor();
    });

    it('should implement forceFlush without errors', async () => {
      await expect(processor.forceFlush()).resolves.toBeUndefined();
    });

    it('should implement shutdown without errors', async () => {
      await expect(processor.shutdown()).resolves.toBeUndefined();
    });

    it('should implement onStart without errors', () => {
      const span = {} as any;
      const context = {} as any;

      expect(() => processor.onStart(span, context)).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    let processor: SensitiveDataSpanProcessor;

    beforeEach(() => {
      processor = new SensitiveDataSpanProcessor();
    });

    it('should handle URLs with query parameters', () => {
      const span = createMockSpan('http://localhost:8080/api/plaid/exchange-token?redirect=/dashboard');

      expect(processor.shouldBlockSpan(span)).toBe(true);
      expect(() => processor.onEnd(span)).not.toThrow();
    });

    it('should handle URLs with fragments', () => {
      const span = createMockSpan('http://localhost:8080/api/teller/exchange-token#section');

      expect(processor.shouldBlockSpan(span)).toBe(true);
      expect(() => processor.onEnd(span)).not.toThrow();
    });

    it('should handle relative URLs', () => {
      const span = createMockSpan('/api/plaid/exchange-token');

      expect(processor.shouldBlockSpan(span)).toBe(true);
    });

    it('should be case-sensitive for endpoint matching', () => {
      const span = createMockSpan('http://localhost:8080/api/PLAID/EXCHANGE-TOKEN');

      expect(processor.shouldBlockSpan(span)).toBe(false);
      expect(() => processor.onEnd(span)).not.toThrow();
    });
  });
});

describe('FilteringSpanProcessor', () => {
  const createDelegate = () => ({
    onStart: vi.fn(),
    onEnd: vi.fn(),
    shutdown: vi.fn().mockResolvedValue(undefined),
    forceFlush: vi.fn().mockResolvedValue(undefined),
  });

  it('should skip delegate onEnd when predicate returns true', () => {
    const delegate = createDelegate();
    const filter = new FilteringSpanProcessor(delegate, () => true);
    const span = createMockSpan('http://localhost:8080/api/auth/login');

    filter.onStart(span as unknown as any, {} as any);
    filter.onEnd(span);

    expect(delegate.onStart).toHaveBeenCalledTimes(1);
    expect(delegate.onEnd).not.toHaveBeenCalled();
  });

  it('should forward to delegate when predicate returns false', () => {
    const delegate = createDelegate();
    const filter = new FilteringSpanProcessor(delegate, () => false);
    const span = createMockSpan('http://localhost:8080/api/transactions');

    filter.onStart(span as unknown as any, {} as any);
    filter.onEnd(span);

    expect(delegate.onStart).toHaveBeenCalledTimes(1);
    expect(delegate.onEnd).toHaveBeenCalledWith(span);
  });

  it('should forward forceFlush and shutdown', async () => {
    const delegate = createDelegate();
    const filter = new FilteringSpanProcessor(delegate, () => false);

    await filter.forceFlush();
    await filter.shutdown();

    expect(delegate.forceFlush).toHaveBeenCalledTimes(1);
    expect(delegate.shutdown).toHaveBeenCalledTimes(1);
  });
});
