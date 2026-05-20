/**
 * Records handled non-fatal issues as OpenTelemetry spans.
 */

import { type Attributes, SpanStatusCode, trace } from '@opentelemetry/api';

const TRACER_NAME = 'sumurai-frontend';

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  return new Error(typeof value === 'string' ? value : String(value));
}

export function recordHandledIssue(
  spanName: string,
  message: string,
  cause?: unknown,
  attributes?: Attributes
): void {
  const tracer = trace.getTracer(TRACER_NAME);
  const span = tracer.startSpan(spanName, {
    attributes: {
      ...attributes,
      'issue.handled': true,
      'issue.message': message,
    },
  });

  if (cause !== undefined) {
    span.recordException(toError(cause));
  }

  span.addEvent(message);
  span.setStatus({ code: SpanStatusCode.ERROR, message });
  span.end();
}
