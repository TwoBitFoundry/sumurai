import type { Span, SpanAttributes } from '@opentelemetry/api';

const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'x-api-key',
  'x-auth-token',
  'api-key',
  'auth-token',
];

const SENSITIVE_QUERY_PARAMS = [
  'token',
  'access_token',
  'public_token',
  'refresh_token',
  'api_key',
  'key',
];

const TOKEN_PATTERNS = [
  {
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    replacement: '[JWT_REDACTED]',
  },
  { pattern: /access-[a-z]+-[a-zA-Z0-9-]{10,}/g, replacement: '[PLAID_TOKEN_REDACTED]' },
  { pattern: /test_token_[a-zA-Z0-9]+/g, replacement: '[TELLER_TOKEN_REDACTED]' },
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '[CC_REDACTED]' },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN_REDACTED]' },
  { pattern: /Bearer\s+[A-Za-z0-9_-]+/g, replacement: 'Bearer [REDACTED]' },
];

export function redactTokenPatterns(value: string): string {
  if (typeof value !== 'string') return value;

  let sanitized = value;
  for (const { pattern, replacement } of TOKEN_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') return url;

  try {
    const urlObj = new URL(url);

    SENSITIVE_QUERY_PARAMS.forEach((param) => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, '[REDACTED]');
      }
    });

    return urlObj.toString();
  } catch {
    return redactTokenPatterns(url);
  }
}

export function sanitizeSpanAttributes(span: Span, _request?: Request, _response?: Response): void {
  const attributes = (span as unknown as { attributes: SpanAttributes }).attributes;

  if (!attributes) return;

  const keysToDelete: string[] = [];
  const keysToUpdate: Array<{ key: string; value: unknown }> = [];

  for (const [key, value] of Object.entries(attributes)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_HEADERS.some((header) => lowerKey.includes(header))) {
      keysToDelete.push(key);
      continue;
    }

    if (lowerKey.includes('url') && typeof value === 'string') {
      keysToUpdate.push({ key, value: sanitizeUrl(value) });
      continue;
    }

    if (typeof value === 'string' && value.length > 0) {
      const sanitizedValue = redactTokenPatterns(value);
      if (sanitizedValue !== value) {
        keysToUpdate.push({ key, value: sanitizedValue });
      }
    }
  }

  keysToDelete.forEach((key) => {
    span.setAttribute(key, undefined as unknown as string);
  });

  keysToUpdate.forEach(({ key, value }) => {
    span.setAttribute(key, value as string | number | boolean);
  });
}

export function preventSensitiveSpans(element?: Element, _eventName?: string): boolean {
  if (!element) return false;

  const sensitiveSelectors = [
    'input[type="password"]',
    'input[type="text"][name*="password"]',
    'input[type="text"][name*="token"]',
    'input[name*="card"]',
    'input[name*="ssn"]',
  ];

  for (const selector of sensitiveSelectors) {
    if (element.matches(selector) || element.querySelector(selector)) {
      return true;
    }
  }

  const sensitiveClasses = ['password', 'token', 'secret', 'credential'];
  const elementClasses = element.className?.toLowerCase() || '';

  return sensitiveClasses.some((cls) => elementClasses.includes(cls));
}
