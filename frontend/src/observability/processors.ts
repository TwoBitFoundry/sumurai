import {
  SpanProcessor,
  ReadableSpan,
  Span,
} from '@opentelemetry/sdk-trace-base';
import { Context } from '@opentelemetry/api';
import { redactTokenPatterns } from './sanitization';

const SENSITIVE_ENDPOINTS = [
  /\/api\/auth\/login$/,
  /\/api\/auth\/register$/,
  /\/api\/plaid\/exchange-token$/,
  /\/api\/teller\/exchange-token$/,
];

const AUTH_ENDPOINTS = [
  /\/api\/auth\//,
  /\/api\/plaid\/link-token$/,
];

export class SensitiveDataSpanProcessor implements SpanProcessor {
  private readonly blockSensitiveEndpoints: boolean;
  private readonly redactAuthEndpoints: boolean;

  constructor(options?: {
    blockSensitiveEndpoints?: boolean;
    redactAuthEndpoints?: boolean;
  }) {
    this.blockSensitiveEndpoints = options?.blockSensitiveEndpoints ?? true;
    this.redactAuthEndpoints = options?.redactAuthEndpoints ?? true;
  }

  onStart(_span: Span, _parentContext: Context): void {
  }

  onEnd(span: ReadableSpan): void {
    const url = this.getSpanUrl(span);

    if (!url) return;

    if (this.blockSensitiveEndpoints && this.isSensitiveEndpoint(url)) {
      (span as unknown as { _ended: boolean })._ended = false;
      return;
    }

    if (this.redactAuthEndpoints && this.isAuthEndpoint(url)) {
      this.redactAllNonEssentialAttributes(span);
    }
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  private getSpanUrl(span: ReadableSpan): string | undefined {
    return (
      (span.attributes['http.url'] as string) ||
      (span.attributes['url.full'] as string) ||
      (span.attributes['http.target'] as string)
    );
  }

  private isSensitiveEndpoint(url: string): boolean {
    return SENSITIVE_ENDPOINTS.some(pattern => pattern.test(url));
  }

  private isAuthEndpoint(url: string): boolean {
    return AUTH_ENDPOINTS.some(pattern => pattern.test(url));
  }

  private redactAllNonEssentialAttributes(span: ReadableSpan): void {
    const essentialAttributes = [
      'http.method',
      'http.status_code',
      'http.url',
      'url.full',
      'span.kind',
    ];

    const attributes = { ...span.attributes };
    const mutableSpan = span as unknown as { attributes: Record<string, unknown> };

    for (const [key, value] of Object.entries(attributes)) {
      if (essentialAttributes.includes(key)) {
        if (typeof value === 'string') {
          mutableSpan.attributes[key] = redactTokenPatterns(value);
        }
      } else {
        delete mutableSpan.attributes[key];
      }
    }
  }
}
