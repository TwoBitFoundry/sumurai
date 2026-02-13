import { type Span, type SpanOptions, SpanStatusCode, type Tracer } from '@opentelemetry/api';
import { type DependencyList, useCallback, useContext, useEffect, useRef } from 'react';
import { TelemetryContext } from './TelemetryProvider';

export function useTracer(): Tracer | null {
  const context = useContext(TelemetryContext);
  if (!context) return null;
  return context.service.getTracer();
}

export function useSpan(name: string, options?: SpanOptions): Span | undefined {
  const tracer = useTracer();
  const context = useContext(TelemetryContext);
  const spanRef = useRef<Span | undefined>(undefined);

  useEffect(() => {
    if (!tracer) return;

    spanRef.current = tracer.startSpan(name, options);

    return () => {
      spanRef.current?.end();
      spanRef.current = undefined;
    };
  }, [tracer, name, options]);

  useEffect(() => {
    if (spanRef.current && context) {
      context.setActiveSpan(spanRef.current);
    }
  }, [context]);

  return spanRef.current;
}

export function useInstrumentedCallback<T extends (...args: unknown[]) => unknown>(
  name: string,
  fn: T,
  deps: DependencyList
): T {
  const tracer = useTracer();

  return useCallback(
    (...args: Parameters<T>) => {
      if (!tracer) return fn(...args);

      const span = tracer.startSpan(name);
      try {
        const result = fn(...args);

        if (result instanceof Promise) {
          return result
            .then((value) => {
              span.setStatus({ code: SpanStatusCode.OK });
              span.end();
              return value;
            })
            .catch((error) => {
              span.recordException(error as Error);
              span.setStatus({ code: SpanStatusCode.ERROR });
              span.end();
              throw error;
            });
        }

        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.end();
        throw error;
      }
    },
    [tracer, name, ...deps, fn]
  ) as T;
}
