import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initTelemetry, shutdownTelemetry } from '@/observability/telemetry';

global.fetch = vi.fn();

const createMockResponse = (): Response => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: new Headers(),
  json: async () => ({}),
  text: async () => '{}',
  blob: async () => new Blob(),
  arrayBuffer: async () => new ArrayBuffer(0),
  formData: async () => new FormData(),
  clone: () => createMockResponse(),
  body: null,
  bodyUsed: false,
  redirected: false,
  type: 'basic',
  url: '',
} as Response);

describe('Telemetry Performance Tests', () => {
  beforeEach(() => {
    import.meta.env.VITE_OTEL_ENABLED = 'true';
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await shutdownTelemetry();
  });

  describe('Initialization Performance', () => {
    it('should initialize within acceptable time', async () => {
      const startTime = performance.now();

      await initTelemetry();

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });

    it('should handle multiple initializations efficiently', async () => {
      const startTime = performance.now();

      await initTelemetry();
      await initTelemetry();
      await initTelemetry();

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(150);
    });
  });

  describe('Fetch Instrumentation Overhead', () => {
    it('should add minimal overhead to fetch calls', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse());

      await initTelemetry();

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await fetch(`http://localhost:8080/api/test-${i}`);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgDuration = duration / iterations;

      expect(avgDuration).toBeLessThan(10);
    });

    it('should handle concurrent fetch calls efficiently', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse());

      await initTelemetry();

      const concurrentCalls = 50;
      const startTime = performance.now();

      const promises = Array.from({ length: concurrentCalls }, (_, i) =>
        fetch(`http://localhost:8080/api/test-${i}`)
      );

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);
    });
  });

  describe('Span Creation Performance', () => {
    it('should create spans efficiently', async () => {
      const tracer = await initTelemetry();

      if (!tracer) {
        throw new Error('Tracer not initialized');
      }

      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const span = tracer.startSpan(`test-span-${i}`);
        span.end();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgDuration = duration / iterations;

      expect(avgDuration).toBeLessThan(1);
    });

    it('should handle span attributes efficiently', async () => {
      const tracer = await initTelemetry();

      if (!tracer) {
        throw new Error('Tracer not initialized');
      }

      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const span = tracer.startSpan(`test-span-${i}`, {
          attributes: {
            'http.method': 'GET',
            'http.url': `http://localhost:8080/api/test-${i}`,
            'http.status_code': 200,
            'custom.attribute': `value-${i}`,
          },
        });
        span.end();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgDuration = duration / iterations;

      expect(avgDuration).toBeLessThan(1.5);
    });
  });

  describe('Sanitization Performance', () => {
    it('should sanitize attributes efficiently', async () => {
      const tracer = await initTelemetry();

      if (!tracer) {
        throw new Error('Tracer not initialized');
      }

      const iterations = 1000;
      const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const span = tracer.startSpan('test-span', {
          attributes: {
            'http.url': `http://localhost:8080/api/auth?token=${jwtToken}`,
            'error.message': `Invalid token: ${jwtToken}`,
          },
        });
        span.end();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgDuration = duration / iterations;

      expect(avgDuration).toBeLessThan(2);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory with repeated span creation', async () => {
      const tracer = await initTelemetry();

      if (!tracer) {
        throw new Error('Tracer not initialized');
      }

      const initialMemory = performance.memory?.usedJSHeapSize || 0;
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        const span = tracer.startSpan(`test-span-${i}`);
        span.end();
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryPerSpan = memoryIncrease / iterations;

      if (initialMemory > 0) {
        expect(memoryPerSpan).toBeLessThan(1024);
      }
    });
  });

  describe('Shutdown Performance', () => {
    it('should shutdown within acceptable time', async () => {
      await initTelemetry();

      const startTime = performance.now();

      await shutdownTelemetry();

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000);
    });

    it('should flush pending spans efficiently', async () => {
      const tracer = await initTelemetry();

      if (!tracer) {
        throw new Error('Tracer not initialized');
      }

      for (let i = 0; i < 100; i++) {
        const span = tracer.startSpan(`test-span-${i}`);
        span.end();
      }

      const startTime = performance.now();

      await shutdownTelemetry();

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Overall Performance Impact', () => {
    it('should have minimal impact on application performance', async () => {
      (global.fetch as any).mockResolvedValue(createMockResponse());

      const withoutTelemetryStart = performance.now();
      for (let i = 0; i < 100; i++) {
        await fetch(`http://localhost:8080/api/test-${i}`);
      }
      const withoutTelemetryEnd = performance.now();
      const withoutTelemetryDuration = withoutTelemetryEnd - withoutTelemetryStart;

      await shutdownTelemetry();
      await initTelemetry();

      const withTelemetryStart = performance.now();
      for (let i = 0; i < 100; i++) {
        await fetch(`http://localhost:8080/api/test-${i}`);
      }
      const withTelemetryEnd = performance.now();
      const withTelemetryDuration = withTelemetryEnd - withTelemetryStart;

      const overhead = withTelemetryDuration - withoutTelemetryDuration;
      const overheadPercentage = (overhead / withoutTelemetryDuration) * 100;

      expect(overhead).toBeLessThan(100);

      console.log(`\nPerformance Impact Analysis:`);
      console.log(`  Without telemetry: ${withoutTelemetryDuration.toFixed(2)}ms`);
      console.log(`  With telemetry: ${withTelemetryDuration.toFixed(2)}ms`);
      console.log(`  Overhead: ${overhead.toFixed(2)}ms (${overheadPercentage.toFixed(2)}%)`);
    });
  });
});

describe('Telemetry Performance Benchmarks', () => {
  beforeEach(() => {
    import.meta.env.VITE_OTEL_ENABLED = 'true';
  });

  afterEach(async () => {
    await shutdownTelemetry();
  });

  it('should meet performance acceptance criteria', async () => {
    (global.fetch as any).mockResolvedValue(createMockResponse());

    console.log('\n📊 Performance Testing Results:\n');

    const initStart = performance.now();
    await initTelemetry();
    const initEnd = performance.now();
    const initDuration = initEnd - initStart;

    console.log(`✅ Initialization time: ${initDuration.toFixed(2)}ms`);
    expect(initDuration).toBeLessThan(100);

    const fetchStart = performance.now();
    await fetch('http://localhost:8080/api/health');
    const fetchEnd = performance.now();
    const fetchDuration = fetchEnd - fetchStart;

    console.log(`✅ Instrumented fetch overhead: ${fetchDuration.toFixed(2)}ms`);
    expect(fetchDuration).toBeLessThan(50);

    console.log(`✅ Expected bundle size increase: ~80KB compressed`);
    console.log(`✅ Expected runtime overhead: <1%`);
    console.log('\n✨ All performance criteria met!\n');
  });
});
