import {
  SpanProcessor,
  ReadableSpan,
  Span,
} from '@opentelemetry/sdk-trace-base';
import { Context, trace } from '@opentelemetry/api';
import { redactTokenPatterns } from './sanitization';
import { AuthService } from '../services/authService';

const SENSITIVE_ENDPOINTS = [
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

    if (this.shouldBlockSpanForUrl(url)) {
      if (url) {
        this.recordSanitizedOutcome(span, url);
      }
      return;
    }

    if (!url) return;

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

  public shouldBlockSpan(span: ReadableSpan): boolean {
    return this.shouldBlockSpanForUrl(this.getSpanUrl(span));
  }

  private getSpanUrl(span: ReadableSpan): string | undefined {
    return (
      (span.attributes['http.url'] as string) ||
      (span.attributes['url.full'] as string) ||
      (span.attributes['http.target'] as string)
    );
  }

  private isSensitiveEndpoint(url: string): boolean {
    const normalizedUrl = this.stripQueryAndFragment(url);
    return SENSITIVE_ENDPOINTS.some(pattern => pattern.test(normalizedUrl));
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

  private shouldBlockSpanForUrl(url: string | undefined): boolean {
    if (!this.blockSensitiveEndpoints || !url) {
      return false;
    }

    return this.isSensitiveEndpoint(url);
  }

  private stripQueryAndFragment(url: string): string {
    const index = url.search(/[?#]/);
    if (index === -1) {
      return url;
    }
    return url.slice(0, index);
  }

  private recordSanitizedOutcome(span: ReadableSpan, url: string): void {
    const tracer = trace.getTracer('sumaura-frontend', '1.0.0');
    const provider = url.includes('/plaid/') ? 'plaid' : url.includes('/teller/') ? 'teller' : 'unknown';
    const endpoint = this.getEndpointKey(url, provider);
    const status =
      (span.attributes['http.status_code'] as number | undefined) ??
      (span.attributes['http.response.status_code'] as number | undefined) ??
      0;
    const method =
      (span.attributes['http.method'] as string | undefined) ??
      (span.attributes['http.request.method'] as string | undefined) ??
      'POST';

    const attributes: Record<string, unknown> = {
      'http.method': method,
      'http.status_code': status,
      provider,
    };

    if (endpoint) {
      attributes.endpoint = endpoint;
    }

    const auditSpan = tracer.startSpan('sensitive-provider-endpoint', {
      attributes,
    });
    auditSpan.end();
  }

  private getEndpointKey(url: string, provider: string): string | undefined {
    if (provider === 'plaid') {
      return 'plaid.exchange-token';
    }

    if (provider === 'teller' && url.includes('/connect')) {
      return 'teller.connect';
    }

    if (provider === 'teller') {
      return 'teller.exchange-token';
    }

    return undefined;
  }
}

export class HttpRouteSpanProcessor implements SpanProcessor {
  onStart(_span: Span, _parentContext: Context): void {
  }

  onEnd(span: ReadableSpan): void {
    const attributes = span.attributes ?? {};
    const method = this.getMethod(attributes);
    const route = this.getRoute(attributes);

    if (!method || !route) {
      return;
    }

    const normalizedRoute = route.startsWith('/') ? route : `/${route.replace(/^\/*/, '')}`;
    const spanName = `${method.toUpperCase()} ${normalizedRoute}`;

    if (span.name !== spanName) {
      (span as unknown as { name: string }).name = spanName;
    }

    const encryptedToken = AuthService.getEncryptedTokenHashSync();
    const mutableSpan = span as unknown as { attributes: Record<string, unknown> };

    if (encryptedToken) {
      mutableSpan.attributes = {
        ...mutableSpan.attributes,
        encrypted_token: encryptedToken,
      };
    } else {
      void AuthService.ensureEncryptedTokenHash()
        .then(hash => {
          if (hash) {
            mutableSpan.attributes = {
              ...mutableSpan.attributes,
              encrypted_token: hash,
            };
          }
        })
        .catch(() => {});
    }
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  private getMethod(attributes: Record<string, unknown>): string | undefined {
    const methodCandidates = ['http.method', 'http.request.method'];
    for (const key of methodCandidates) {
      const value = attributes[key];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }
    return undefined;
  }

  private getRoute(attributes: Record<string, unknown>): string | undefined {
    if (typeof attributes['http.route'] === 'string' && attributes['http.route']) {
      return attributes['http.route'] as string;
    }

    const urlCandidates = ['http.target', 'http.url', 'url.full'];
    for (const key of urlCandidates) {
      const value = attributes[key];
      if (typeof value !== 'string' || value.length === 0) {
        continue;
      }

      const path = this.extractPath(value);
      if (path) {
        return path;
      }
    }
    return undefined;
  }

  private extractPath(url: string): string | undefined {
    try {
      const parsed = new URL(url, window.location.origin);
      return parsed.pathname || '/';
    } catch {
      if (url.startsWith('/')) {
        return url;
      }
      return undefined;
    }
  }
}

export class FilteringSpanProcessor implements SpanProcessor {
  constructor(
    private readonly delegate: SpanProcessor,
    private readonly shouldSkip: (span: ReadableSpan) => boolean,
  ) {}

  onStart(span: Span, parentContext: Context): void {
    this.delegate.onStart(span, parentContext);
  }

  onEnd(span: ReadableSpan): void {
    if (this.shouldSkip(span)) {
      return;
    }

    this.delegate.onEnd(span);
  }

  forceFlush(): Promise<void> {
    return this.delegate.forceFlush();
  }

  shutdown(): Promise<void> {
    return this.delegate.shutdown();
  }
}
