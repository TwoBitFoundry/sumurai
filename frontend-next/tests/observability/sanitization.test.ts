import {
  redactTokenPatterns,
  sanitizeUrl,
  sanitizeSpanAttributes,
  preventSensitiveSpans,
} from '@/observability/sanitization';

describe('redactTokenPatterns', () => {
  it('should redact JWT tokens', () => {
    const input =
      'Error: Invalid token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    expect(redactTokenPatterns(input)).toBe('Error: Invalid token [JWT_REDACTED]');
  });

  it('should redact multiple JWT tokens in the same string', () => {
    const input =
      'Token1: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U and Token2: eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYm9iIn0.anotherSignatureHere123';
    const result = redactTokenPatterns(input);
    expect(result).toBe('Token1: [JWT_REDACTED] and Token2: [JWT_REDACTED]');
  });

  it('should redact Plaid tokens', () => {
    const input = 'Token: access-sandbox-abc123-def456-789';
    expect(redactTokenPatterns(input)).toBe('Token: [PLAID_TOKEN_REDACTED]');
  });

  it('should redact Plaid development tokens', () => {
    const input = 'Token: access-development-12345678-90ab-cdef-1234-567890abcdef';
    expect(redactTokenPatterns(input)).toBe('Token: [PLAID_TOKEN_REDACTED]');
  });

  it('should redact Teller tokens', () => {
    const input = 'Token: test_token_abc123def456';
    expect(redactTokenPatterns(input)).toBe('Token: [TELLER_TOKEN_REDACTED]');
  });

  it('should redact credit card numbers', () => {
    const input = 'Card: 4532-1234-5678-9010';
    expect(redactTokenPatterns(input)).toBe('Card: [CC_REDACTED]');
  });

  it('should redact credit card numbers without dashes', () => {
    const input = 'Card: 4532123456789010';
    expect(redactTokenPatterns(input)).toBe('Card: [CC_REDACTED]');
  });

  it('should redact credit card numbers with spaces', () => {
    const input = 'Card: 4532 1234 5678 9010';
    expect(redactTokenPatterns(input)).toBe('Card: [CC_REDACTED]');
  });

  it('should redact SSN numbers', () => {
    const input = 'SSN: 123-45-6789';
    expect(redactTokenPatterns(input)).toBe('SSN: [SSN_REDACTED]');
  });

  it('should redact Bearer tokens', () => {
    const input = 'Authorization: Bearer abc123def456';
    expect(redactTokenPatterns(input)).toBe('Authorization: Bearer [REDACTED]');
  });

  it('should handle non-string input gracefully', () => {
    expect(redactTokenPatterns(123 as any)).toBe(123);
    expect(redactTokenPatterns(null as any)).toBe(null);
    expect(redactTokenPatterns(undefined as any)).toBe(undefined);
  });

  it('should not modify strings without sensitive data', () => {
    const input = 'This is a normal string with no sensitive data';
    expect(redactTokenPatterns(input)).toBe(input);
  });
});

describe('sanitizeUrl', () => {
  it('should redact token query params', () => {
    const url = 'http://api.com/auth?token=abc123&user=bob';
    expect(sanitizeUrl(url)).toBe('http://api.com/auth?token=%5BREDACTED%5D&user=bob');
  });

  it('should redact access_token query params', () => {
    const url = 'http://api.com/callback?access_token=secret123&state=xyz';
    expect(sanitizeUrl(url)).toBe('http://api.com/callback?access_token=%5BREDACTED%5D&state=xyz');
  });

  it('should redact public_token query params', () => {
    const url = 'http://api.com/plaid?public_token=plaid-secret';
    expect(sanitizeUrl(url)).toBe('http://api.com/plaid?public_token=%5BREDACTED%5D');
  });

  it('should redact refresh_token query params', () => {
    const url = 'http://api.com/auth/refresh?refresh_token=refresh123';
    expect(sanitizeUrl(url)).toBe('http://api.com/auth/refresh?refresh_token=%5BREDACTED%5D');
  });

  it('should redact api_key query params', () => {
    const url = 'http://api.com/data?api_key=key123&limit=10';
    expect(sanitizeUrl(url)).toBe('http://api.com/data?api_key=%5BREDACTED%5D&limit=10');
  });

  it('should redact multiple sensitive params', () => {
    const url = 'http://api.com/auth?token=abc&access_token=def&user=bob';
    const sanitized = sanitizeUrl(url);
    expect(sanitized).toContain('token=%5BREDACTED%5D');
    expect(sanitized).toContain('access_token=%5BREDACTED%5D');
    expect(sanitized).toContain('user=bob');
  });

  it('should handle malformed URLs by applying token redaction', () => {
    const malformedUrl = 'not-a-valid-url?token=abc123';
    const result = sanitizeUrl(malformedUrl);
    expect(result).toBe(malformedUrl);
  });

  it('should preserve URL structure for non-sensitive params', () => {
    const url = 'http://api.com/path?user=bob&limit=10&offset=5';
    expect(sanitizeUrl(url)).toBe(url);
  });

  it('should handle URLs without query params', () => {
    const url = 'http://api.com/path';
    expect(sanitizeUrl(url)).toBe(url);
  });

  it('should handle non-string input gracefully', () => {
    expect(sanitizeUrl(123 as any)).toBe(123);
  });
});

describe('sanitizeSpanAttributes', () => {
  const createMockSpan = (attributes: Record<string, any>) => {
    return {
      attributes,
      setAttribute: (key: string, value: any) => {
        if (value === undefined) {
          delete attributes[key];
        } else {
          attributes[key] = value;
        }
      },
    } as any;
  };

  it('should delete Authorization header', () => {
    const span = createMockSpan({
      'http.request.header.authorization': 'Bearer eyJ...',
    });
    sanitizeSpanAttributes(span);
    expect(span.attributes['http.request.header.authorization']).toBeUndefined();
  });

  it('should delete Cookie header', () => {
    const span = createMockSpan({
      'http.request.header.cookie': 'session=abc123',
    });
    sanitizeSpanAttributes(span);
    expect(span.attributes['http.request.header.cookie']).toBeUndefined();
  });

  it('should delete X-API-Key header', () => {
    const span = createMockSpan({
      'http.request.header.x-api-key': 'secret-key-123',
    });
    sanitizeSpanAttributes(span);
    expect(span.attributes['http.request.header.x-api-key']).toBeUndefined();
  });

  it('should delete case-insensitive sensitive headers', () => {
    const span = createMockSpan({
      'http.request.header.Authorization': 'Bearer abc',
      'http.request.header.COOKIE': 'session=xyz',
    });
    sanitizeSpanAttributes(span);
    expect(span.attributes['http.request.header.Authorization']).toBeUndefined();
    expect(span.attributes['http.request.header.COOKIE']).toBeUndefined();
  });

  it('should sanitize URLs in attributes', () => {
    const span = createMockSpan({
      'http.url': 'http://api.com/auth?token=secret123',
    });
    sanitizeSpanAttributes(span);
    expect(span.attributes['http.url']).toContain('token=%5BREDACTED%5D');
  });

  it('should redact JWT tokens in attribute values', () => {
    const span = createMockSpan({
      'error.message':
        'Invalid token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    });
    sanitizeSpanAttributes(span);
    expect(span.attributes['error.message']).toBe('Invalid token: [JWT_REDACTED]');
  });

  it('should preserve non-sensitive attributes', () => {
    const span = createMockSpan({
      'http.method': 'POST',
      'http.status_code': 200,
      'service.name': 'sumurai-frontend',
    });
    sanitizeSpanAttributes(span);
    expect(span.attributes['http.method']).toBe('POST');
    expect(span.attributes['http.status_code']).toBe(200);
    expect(span.attributes['service.name']).toBe('sumurai-frontend');
  });

  it('should handle spans with no attributes', () => {
    const span = { attributes: undefined, setAttribute: () => {} } as any;
    expect(() => sanitizeSpanAttributes(span)).not.toThrow();
  });

  it('should handle empty attribute objects', () => {
    const span = createMockSpan({});
    expect(() => sanitizeSpanAttributes(span)).not.toThrow();
  });
});

describe('preventSensitiveSpans', () => {
  it('should prevent spans for password input fields', () => {
    const input = document.createElement('input');
    input.type = 'password';
    expect(preventSensitiveSpans(input, 'click')).toBe(true);
  });

  it('should prevent spans for token input fields', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'auth_token';
    expect(preventSensitiveSpans(input, 'click')).toBe(true);
  });

  it('should prevent spans for card input fields', () => {
    const input = document.createElement('input');
    input.name = 'credit_card';
    expect(preventSensitiveSpans(input, 'click')).toBe(true);
  });

  it('should prevent spans for SSN input fields', () => {
    const input = document.createElement('input');
    input.name = 'ssn';
    expect(preventSensitiveSpans(input, 'click')).toBe(true);
  });

  it('should prevent spans for elements with password class', () => {
    const div = document.createElement('div');
    div.className = 'password-field';
    expect(preventSensitiveSpans(div, 'click')).toBe(true);
  });

  it('should prevent spans for elements with token class', () => {
    const div = document.createElement('div');
    div.className = 'api-token-input';
    expect(preventSensitiveSpans(div, 'click')).toBe(true);
  });

  it('should prevent spans for elements with credential class', () => {
    const div = document.createElement('div');
    div.className = 'user-credential';
    expect(preventSensitiveSpans(div, 'click')).toBe(true);
  });

  it('should allow spans for normal input fields', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'username';
    expect(preventSensitiveSpans(input, 'click')).toBe(false);
  });

  it('should allow spans for normal buttons', () => {
    const button = document.createElement('button');
    button.textContent = 'Submit';
    expect(preventSensitiveSpans(button, 'click')).toBe(false);
  });

  it('should handle undefined element', () => {
    expect(preventSensitiveSpans(undefined, 'click')).toBe(false);
  });

  it('should prevent spans for elements containing sensitive child elements', () => {
    const form = document.createElement('form');
    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    form.appendChild(passwordInput);
    expect(preventSensitiveSpans(form, 'submit')).toBe(true);
  });
});
