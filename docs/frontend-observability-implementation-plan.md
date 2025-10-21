# Frontend OpenTelemetry Observability Implementation Plan

**Project:** Sumaura
**Objective:** Implement full OpenTelemetry instrumentation for React frontend with Seq integration
**Security Context:** Financial application handling Plaid/Teller tokens, JWTs, transaction data
**Approach:** Maximum auto-instrumentation with multi-layer sensitive data sanitization

---

## Executive Summary

Implement OpenTelemetry tracing for the React frontend using `@opentelemetry/auto-instrumentations-web` to achieve:

- **End-to-end distributed tracing** from user interactions → frontend → backend → database
- **Automatic instrumentation** of all HTTP calls, page loads, user interactions (90% coverage with zero manual code)
- **Multi-layer security** to prevent sensitive financial data (tokens, credentials, PII) from reaching Seq
- **Performance overhead** <1% with ~80KB compressed bundle size

**Key Principle:** Instrument everything automatically, sanitize aggressively, manually instrument only critical business flows.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ React Application                                                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Auto-Instrumentation Layer                               │   │
│  │ - Fetch/XHR (all ApiClient calls)                        │   │
│  │ - User Interactions (clicks, form submits)               │   │
│  │ - Document Load (page performance)                       │   │
│  └────────────────┬─────────────────────────────────────────┘   │
│                   │                                              │
│  ┌────────────────▼─────────────────────────────────────────┐   │
│  │ Sanitization Layer (3 levels)                            │   │
│  │ 1. applyCustomAttributesOnSpan (fetch config)            │   │
│  │ 2. SensitiveDataSpanProcessor (pre-export)               │   │
│  │ 3. URL/Header/Token pattern redaction                    │   │
│  └────────────────┬─────────────────────────────────────────┘   │
│                   │                                              │
│  ┌────────────────▼─────────────────────────────────────────┐   │
│  │ WebTracerProvider → BatchSpanProcessor                   │   │
│  └────────────────┬─────────────────────────────────────────┘   │
└───────────────────┼──────────────────────────────────────────────┘
                    │
                    │ OTLP/HTTP (W3C Trace Context)
                    ▼
            ┌───────────────────┐
            │ Seq (OTLP Ingest) │
            │ :5341/ingest/otlp │
            └───────────────────┘
                    │
                    │ Links to backend traces
                    ▼
            ┌───────────────────┐
            │ Backend Traces    │
            │ (existing)        │
            └───────────────────┘
```

---

## Phase 1: Foundation & Auto-Instrumentation

**Goal:** Establish core telemetry with maximum auto-instrumentation and basic sanitization.

### 1.1 Install Dependencies

```bash
cd frontend
npm install --save \
  @opentelemetry/api@^1.9.0 \
  @opentelemetry/sdk-trace-web@^1.25.0 \
  @opentelemetry/instrumentation@^0.52.0 \
  @opentelemetry/auto-instrumentations-web@^0.39.0 \
  @opentelemetry/exporter-trace-otlp-http@^0.52.0 \
  @opentelemetry/resources@^1.25.0 \
  @opentelemetry/semantic-conventions@^1.25.0
```

**Bundle Impact:** ~80KB compressed (acceptable for observability value)

### 1.2 Create Core Telemetry Setup

**File:** `frontend/src/observability/telemetry.ts` (~150 lines)

**Responsibilities:**
- Initialize `WebTracerProvider` with resource detection
- Configure `OTLPTraceExporter` pointing to Seq
- Register `auto-instrumentations-web` with security defaults
- Set up `BatchSpanProcessor` for efficient export
- Register W3C Trace Context propagator (links frontend → backend)

**Key Configuration:**
```typescript
getWebAutoInstrumentations({
  '@opentelemetry/instrumentation-fetch': {
    propagateTraceHeaderCorsUrls: [/.+/], // Enable distributed tracing
    clearTimingResources: true,
    ignoreNetworkEvents: true, // Don't capture request/response bodies
    applyCustomAttributesOnSpan: sanitizeSpanAttributes, // Layer 1 sanitization
  },
  '@opentelemetry/instrumentation-user-interaction': {
    enabled: true,
    eventNames: ['click', 'submit'], // Track user actions
    shouldPreventSpanCreation: preventSensitiveSpans, // Layer 1 prevention
  },
  '@opentelemetry/instrumentation-document-load': {
    enabled: true, // Page load metrics
  },
})
```

**What This Gives You (Automatic):**
- ✅ All `fetch()` calls (entire `ApiClient` instrumented automatically)
- ✅ User interactions (clicks on buttons/links)
- ✅ Page load performance metrics
- ✅ Resource timing (CSS, JS, fonts)
- ✅ Long task detection
- ✅ Distributed tracing headers (`traceparent`) sent to backend

**Acceptance Criteria:**
- [ ] Telemetry initializes without errors
- [ ] Console shows tracer provider registration
- [ ] Test fetch call generates span visible in browser DevTools console

---

## Phase 2: Multi-Layer Security Sanitization

**Goal:** Prevent ALL sensitive data (tokens, credentials, PII) from reaching Seq.

### 2.1 Create Sanitization Utilities

**File:** `frontend/src/observability/sanitization.ts` (~200 lines)

**Responsibilities:**

#### Layer 1: Attribute-Level Sanitization
```typescript
export function sanitizeSpanAttributes(span: Span, request: Request, response: Response): void
```
- Delete sensitive HTTP headers (`Authorization`, `Cookie`, `X-API-Key`)
- Sanitize URL query parameters (`token`, `public_token`, `access_token`)
- Redact token patterns in all string attributes
- Called DURING span creation via `applyCustomAttributesOnSpan`

#### Layer 2: Pattern Redaction
```typescript
export function redactTokenPatterns(value: string): string
```
Redact patterns:
- JWT tokens: `eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}` → `[JWT_REDACTED]`
- Plaid tokens: `access-[a-z]+-[a-f0-9-]{36}` → `[PLAID_TOKEN_REDACTED]`
- Teller tokens: `test_token_[a-zA-Z0-9]+` → `[TELLER_TOKEN_REDACTED]`
- Credit cards: `\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b` → `[CC_REDACTED]`
- SSN: `\b\d{3}-\d{2}-\d{4}\b` → `[SSN_REDACTED]`

#### Layer 3: URL Sanitization
```typescript
export function sanitizeUrl(url: string): string
```
- Parse URL and redact sensitive query params
- Preserve path structure for observability
- Handle malformed URLs gracefully

**Acceptance Criteria:**
- [ ] Unit test: JWT token in span attribute is redacted
- [ ] Unit test: Authorization header is deleted
- [ ] Unit test: URL `?token=abc` becomes `?token=[REDACTED]`
- [ ] Unit test: Plaid/Teller token patterns are redacted
- [ ] Unit test: Credit card numbers are redacted

### 2.2 Create Custom Span Processor

**File:** `frontend/src/observability/processors.ts` (~100 lines)

**Responsibilities:**
- Implement `SpanProcessor` interface for pre-export filtering
- Block entire spans for ultra-sensitive endpoints (login, token exchange)
- Final sanitization pass before export (defense in depth)

```typescript
export class SensitiveDataSpanProcessor implements SpanProcessor {
  onEnd(span: ReadableSpan): void {
    // Option 1: Don't export sensitive endpoint spans at all
    if (this.isSensitiveEndpoint(span.attributes['http.url'])) {
      // Mark span as not sampled (won't be exported)
      return;
    }

    // Option 2: Heavy redaction for auth endpoints
    if (this.isAuthEndpoint(span.attributes['http.url'])) {
      this.redactAllNonEssentialAttributes(span);
    }
  }

  private isSensitiveEndpoint(url: string): boolean {
    return [
      /\/api\/auth\/login/,
      /\/api\/auth\/register/,
      /\/api\/plaid\/exchange-token/,
      /\/api\/teller\/exchange-token/,
    ].some(pattern => pattern.test(url));
  }
}
```

**Sensitive Endpoints (Consider Blocking):**
- `POST /api/auth/login` (credentials in body)
- `POST /api/auth/register` (password in body)
- `POST /api/plaid/exchange-token` (public_token in body)
- `POST /api/teller/exchange-token` (enrollment_id in body)

**Acceptance Criteria:**
- [ ] Unit test: Span for `/api/auth/login` is not exported
- [ ] Unit test: Non-sensitive spans pass through untouched
- [ ] Integration test: No Authorization headers in exported spans

### 2.3 Environment Configuration

**File:** `frontend/.env.example`

Add:
```bash
# OpenTelemetry Configuration
VITE_OTEL_ENABLED=true
VITE_OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:5341/ingest/otlp
VITE_OTEL_SERVICE_NAME=sumaura-frontend
VITE_OTEL_SERVICE_VERSION=1.0.0

# Security Settings (defaults)
VITE_OTEL_SANITIZE_HEADERS=true
VITE_OTEL_SANITIZE_URLS=true
VITE_OTEL_CAPTURE_BODIES=false
VITE_OTEL_BLOCK_SENSITIVE_ENDPOINTS=true
```

**File:** `frontend/.env`
Copy from `.env.example` and set `VITE_OTEL_ENABLED=true`

**Acceptance Criteria:**
- [ ] Can disable telemetry with `VITE_OTEL_ENABLED=false`
- [ ] Can override Seq endpoint for different environments
- [ ] Security settings are honored in telemetry.ts initialization

---

## Phase 3: React Integration & Context

**Goal:** Provide React-native way to access telemetry for manual instrumentation.

### 3.1 Create Telemetry Provider

**File:** `frontend/src/observability/TelemetryProvider.tsx` (~80 lines)

**Responsibilities:**
- React Context for sharing tracer instance
- Initialize telemetry on mount (call `initTelemetry()`)
- Provide active span tracking for nested components
- Handle cleanup on unmount

```typescript
interface TelemetryContextValue {
  tracer: Tracer;
  activeSpan: Span | undefined;
  setActiveSpan: (span: Span | undefined) => void;
}

export const TelemetryContext = React.createContext<TelemetryContextValue | null>(null);

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const [activeSpan, setActiveSpan] = useState<Span | undefined>();
  const tracer = useRef<Tracer>();

  useEffect(() => {
    if (import.meta.env.VITE_OTEL_ENABLED === 'true') {
      tracer.current = initTelemetry(); // From telemetry.ts
    }

    return () => {
      // Cleanup: flush any pending spans
      shutdownTelemetry();
    };
  }, []);

  // ...
}
```

**Integration Point:** `frontend/src/App.tsx`

Wrap application:
```tsx
export function App() {
  return (
    <ThemeProvider>
      <TelemetryProvider>
        <AppContent />
      </TelemetryProvider>
    </ThemeProvider>
  )
}
```

**Acceptance Criteria:**
- [ ] TelemetryProvider mounts without errors
- [ ] Tracer is accessible via useContext
- [ ] Telemetry shuts down cleanly on unmount
- [ ] Works when VITE_OTEL_ENABLED=false (graceful degradation)

### 3.2 Create Custom Hooks

**File:** `frontend/src/observability/hooks.ts` (~120 lines)

**Purpose:** Provide React-idiomatic way to create spans for manual instrumentation.

#### Hook 1: `useTracer()`
```typescript
export function useTracer(): Tracer | null {
  const context = useContext(TelemetryContext);
  return context?.tracer ?? null;
}
```

#### Hook 2: `useSpan(name, options?)`
```typescript
export function useSpan(name: string, options?: SpanOptions) {
  const tracer = useTracer();
  const spanRef = useRef<Span>();

  useEffect(() => {
    if (!tracer) return;

    spanRef.current = tracer.startSpan(name, options);

    return () => {
      spanRef.current?.end();
    };
  }, [tracer, name]);

  return spanRef.current;
}
```

**Use Case:** Component-level tracing for critical flows
```tsx
function PlaidLinkFlow() {
  useSpan('PlaidLinkFlow.mount');
  // Entire component lifecycle is traced
}
```

#### Hook 3: `useInstrumentedCallback(name, fn, deps)`
```typescript
export function useInstrumentedCallback<T extends (...args: any[]) => any>(
  name: string,
  fn: T,
  deps: DependencyList
): T {
  const tracer = useTracer();

  return useCallback((...args: Parameters<T>) => {
    if (!tracer) return fn(...args);

    const span = tracer.startSpan(name);
    try {
      const result = fn(...args);

      if (result instanceof Promise) {
        return result.finally(() => span.end());
      }

      span.end();
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      throw error;
    }
  }, deps) as T;
}
```

**Use Case:** Trace async operations in callbacks
```tsx
const handleSync = useInstrumentedCallback(
  'syncTransactions',
  async (connectionId: string) => {
    await PlaidService.syncTransactions(connectionId);
  },
  []
);
```

**Acceptance Criteria:**
- [ ] Hooks work when telemetry is disabled (no-op)
- [ ] useSpan creates/ends span on mount/unmount
- [ ] useInstrumentedCallback wraps function with span
- [ ] Errors in callbacks are recorded as span exceptions

### 3.3 Create Public API

**File:** `frontend/src/observability/index.ts` (~20 lines)

```typescript
export { TelemetryProvider } from './TelemetryProvider';
export { useTracer, useSpan, useInstrumentedCallback } from './hooks';
export { initTelemetry, shutdownTelemetry } from './telemetry';
export type { TelemetryContextValue } from './TelemetryProvider';
```

**Separation of Concerns:** All observability code isolated in `src/observability/`

**Acceptance Criteria:**
- [ ] Clean import: `import { TelemetryProvider, useSpan } from '@/observability'`
- [ ] No circular dependencies
- [ ] TypeScript types exported correctly

---

## Phase 4: Critical Flow Manual Instrumentation

**Goal:** Add spans for business-critical flows where auto-instrumentation isn't sufficient.

### 4.1 Instrument Error Boundary

**File:** `frontend/src/components/ErrorBoundary.tsx` (modify existing)

**Change:** Record errors to active span

```typescript
import { trace } from '@opentelemetry/api';

componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  this.setState({ error, errorInfo });

  // Record to active span
  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: this.sanitizeErrorMessage(error.message) // Use existing sanitization
    });
  }

  console.error('ErrorBoundary caught an error:', error, errorInfo);
}
```

**Security:** Use existing `sanitizeErrorMessage()` to prevent token leakage in error messages.

**Acceptance Criteria:**
- [ ] Errors in React tree are recorded as span events
- [ ] Error messages are sanitized (no tokens/credentials)
- [ ] Link error → trace visible in Seq

### 4.2 Instrument Authentication Flow

**File:** `frontend/src/services/authService.ts` (optional)

**Operations to Instrument:**
- `login()` - Trace login attempt (success/failure)
- `register()` - Trace registration
- `refreshToken()` - Trace token refresh (important for debugging 401s)
- `logout()` - Trace logout

**Example:**
```typescript
import { trace } from '@opentelemetry/api';

async login(username: string, password: string): Promise<AuthResponse> {
  const tracer = trace.getTracer('auth-service');
  const span = tracer.startSpan('AuthService.login', {
    attributes: {
      'auth.method': 'password',
      'auth.username': username, // Safe: username, not password
    }
  });

  try {
    const response = await this.httpClient.post('/auth/login', { username, password });
    span.setStatus({ code: SpanStatusCode.OK });
    return response;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}
```

**Security Note:** Do NOT add `password` as span attribute. Auto-instrumentation already captures the HTTP call (body not captured).

**Acceptance Criteria:**
- [ ] Login span visible in Seq
- [ ] Failed login shows error status
- [ ] Token refresh traced (for debugging session issues)
- [ ] No passwords in span attributes

### 4.3 Instrument Provider Connections

**File:** `frontend/src/hooks/usePlaidLinkFlow.ts` (optional)

**Operations to Instrument:**
- Plaid Link modal open
- User completes connection
- Token exchange request
- Account fetch after connection

**Example:**
```typescript
import { useInstrumentedCallback } from '@/observability';

const handleSuccess = useInstrumentedCallback(
  'PlaidLink.onSuccess',
  async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
    // This callback is now traced automatically
    await PlaidService.exchangeToken(publicToken, metadata.institution?.institution_id);
    await refetchConnections();
  },
  [refetchConnections]
);
```

**What You Get:**
```
User clicks "Connect Bank"
  └─ Navigation Span: "click button.connect-plaid" (auto)
      ├─ Span: "PlaidLink.onSuccess" (manual via hook)
      │   ├─ Fetch: POST /api/plaid/exchange-token (auto)
      │   │   └─ Backend Span: handle_exchange_token (existing)
      │   └─ Fetch: GET /api/plaid/accounts (auto)
      └─ Component Re-render (auto if user interaction enabled)
```

**Acceptance Criteria:**
- [ ] Full trace from button click → backend token exchange
- [ ] Provider connection flow visible in Seq
- [ ] Failed connections show error spans

---

## Phase 5: Testing & Validation

**Goal:** Ensure telemetry works correctly and securely.

### 5.1 Unit Tests

**File:** `frontend/src/observability/__tests__/sanitization.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { redactTokenPatterns, sanitizeUrl, sanitizeSpanAttributes } from '../sanitization';

describe('Sanitization', () => {
  describe('redactTokenPatterns', () => {
    it('should redact JWT tokens', () => {
      const input = 'Error: Invalid token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      expect(redactTokenPatterns(input)).toBe('Error: Invalid token [JWT_REDACTED]');
    });

    it('should redact Plaid tokens', () => {
      const input = 'Token: access-sandbox-abc123-def456';
      expect(redactTokenPatterns(input)).toBe('Token: [PLAID_TOKEN_REDACTED]');
    });

    it('should redact credit card numbers', () => {
      const input = 'Card: 4532-1234-5678-9010';
      expect(redactTokenPatterns(input)).toBe('Card: [CC_REDACTED]');
    });
  });

  describe('sanitizeUrl', () => {
    it('should redact token query params', () => {
      const url = 'http://api.com/auth?token=abc123&user=bob';
      expect(sanitizeUrl(url)).toBe('http://api.com/auth?token=[REDACTED]&user=bob');
    });
  });

  describe('sanitizeSpanAttributes', () => {
    it('should delete Authorization header', () => {
      const span = createMockSpan({
        'http.request.header.authorization': 'Bearer eyJ...'
      });
      sanitizeSpanAttributes(span, mockRequest, mockResponse);
      expect(span.attributes['http.request.header.authorization']).toBeUndefined();
    });
  });
});
```

**Coverage Target:** 90%+ for sanitization logic

**Acceptance Criteria:**
- [ ] All sanitization functions have unit tests
- [ ] Tests cover JWT, Plaid, Teller, credit card patterns
- [ ] URL sanitization tested with various formats
- [ ] Span attribute deletion tested

### 5.2 Integration Tests

**File:** `frontend/src/observability/__tests__/telemetry.integration.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initTelemetry, shutdownTelemetry } from '../telemetry';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';

describe('Telemetry Integration', () => {
  let exporter: InMemorySpanExporter;

  beforeEach(() => {
    exporter = new InMemorySpanExporter();
    initTelemetry({ exporter }); // Test override
  });

  afterEach(async () => {
    await shutdownTelemetry();
    exporter.reset();
  });

  it('should capture fetch calls automatically', async () => {
    await fetch('http://localhost:8080/api/health');

    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe('HTTP GET');
    expect(spans[0].attributes['http.url']).toContain('/api/health');
  });

  it('should NOT include Authorization header in spans', async () => {
    await fetch('http://localhost:8080/api/transactions', {
      headers: { 'Authorization': 'Bearer eyJ...' }
    });

    const spans = exporter.getFinishedSpans();
    expect(spans[0].attributes['http.request.header.authorization']).toBeUndefined();
  });
});
```

**Acceptance Criteria:**
- [ ] Auto-instrumentation captures fetch calls
- [ ] No Authorization headers in exported spans
- [ ] Sensitive endpoints are blocked (if configured)
- [ ] Distributed tracing headers are propagated

### 5.3 Manual Validation in Seq

**Steps:**
1. Start backend with Seq: `docker compose up -d`
2. Start frontend: `cd frontend && npm run dev`
3. Open Seq UI: `http://localhost:5341`
4. Navigate frontend: Click around, sync transactions, etc.
5. Query Seq for traces: Filter by `service.name = "sumaura-frontend"`

**Validate:**
- [ ] Traces appear in Seq within 10 seconds
- [ ] Distributed trace links frontend span → backend span
- [ ] NO Authorization headers in trace attributes
- [ ] NO tokens (JWT, Plaid, Teller) in trace attributes
- [ ] User interaction spans group related API calls
- [ ] Error spans show sanitized error messages

**Example Seq Query:**
```
service.name = "sumaura-frontend" AND span.kind = "client"
```

**Expected Trace Structure:**
```
[Frontend] click button.sync-btn (200ms)
  └─ [Frontend] HTTP POST /api/providers/sync-transactions (150ms)
      └─ [Backend] handle_sync_transactions (140ms)
          ├─ [Backend] fetch_plaid_transactions (100ms)
          └─ [Backend] insert_transactions (30ms)
```

### 5.4 Performance Testing

**Goal:** Ensure <1% overhead

**Metrics:**
- Bundle size increase: ~80KB compressed (measure with `npm run build`)
- Runtime overhead: <10ms per instrumented operation
- Memory overhead: <5MB for span buffer

**Test:**
```bash
# Before instrumentation
npm run build
# Note dist/ size

# After instrumentation
# Implement all phases
npm run build
# Compare dist/ size

# Should be ~80KB larger (acceptable)
```

**Acceptance Criteria:**
- [ ] Bundle size increase <100KB
- [ ] No noticeable lag in UI interactions
- [ ] Browser DevTools Performance tab shows <1% overhead

---

## Phase 6: Documentation & Rollout

**Goal:** Document setup and enable team usage.

### 6.1 Update Project Documentation

**File:** `CLAUDE.md` (append section)

Add:
```markdown
## Frontend Observability (OpenTelemetry + Seq)

The frontend is fully instrumented with OpenTelemetry for distributed tracing:

**What Gets Traced Automatically:**
- ✅ All HTTP calls (fetch/xhr via `ApiClient`)
- ✅ User interactions (clicks, form submits)
- ✅ Page loads and navigation
- ✅ React component errors (via `ErrorBoundary`)

**Viewing Traces:**
1. Ensure Seq is running: `docker compose up -d`
2. Open Seq UI: http://localhost:5341
3. Filter by service: `service.name = "sumaura-frontend"`
4. Click traces to see frontend → backend → database flow

**Security:**
- All sensitive data (tokens, credentials, PII) is sanitized before export
- Request/response bodies are NEVER captured
- Authorization headers are stripped
- See `frontend/src/observability/sanitization.ts` for full redaction logic

**Manual Instrumentation (Optional):**
```typescript
import { useSpan, useInstrumentedCallback } from '@/observability';

function CriticalComponent() {
  useSpan('CriticalComponent.mount'); // Traces component lifecycle

  const handleAction = useInstrumentedCallback(
    'handleAction',
    async () => { /* ... */ },
    []
  );
}
```

**Configuration:**
- `VITE_OTEL_ENABLED=true` - Enable/disable telemetry
- `VITE_OTEL_EXPORTER_OTLP_ENDPOINT` - Seq OTLP endpoint
- See `frontend/.env.example` for all options
```

### 6.2 Create Observability README

**File:** `frontend/src/observability/README.md`

```markdown
# Frontend Observability

This directory contains OpenTelemetry instrumentation for the Sumaura React frontend.

## Architecture

- `telemetry.ts` - Core initialization, auto-instrumentation setup
- `sanitization.ts` - Multi-layer sensitive data redaction
- `processors.ts` - Custom span processors for pre-export filtering
- `TelemetryProvider.tsx` - React Context for manual instrumentation
- `hooks.ts` - React hooks for component-level tracing

## Quick Start

Telemetry is initialized automatically when `VITE_OTEL_ENABLED=true`. No code changes needed.

## Adding Manual Instrumentation

Use hooks for critical flows:

```typescript
import { useSpan } from '@/observability';

function MyComponent() {
  useSpan('MyComponent.mount'); // Traces component lifecycle
  // ...
}
```

## Security

All sensitive data is sanitized at 3 layers before export. See `sanitization.ts` for patterns.

**What's Blocked:**
- Authorization/Cookie/X-API-Key headers
- JWT tokens (eyJ...)
- Plaid tokens (access-sandbox-...)
- Teller tokens (test_token_...)
- Credit cards, SSNs
- Query params: token, access_token, public_token

## Testing

```bash
npm test -- observability
```
```

### 6.3 Add NPM Scripts

**File:** `frontend/package.json` (modify)

Add:
```json
{
  "scripts": {
    "test:otel": "vitest run observability",
    "test:otel:ui": "vitest --ui observability",
    "build:analyze": "vite build --mode analyze"
  }
}
```

### 6.4 Update .gitignore

**File:** `frontend/.gitignore` (verify)

Ensure:
```
.env
.env.local
```

**Do NOT commit:** `.env` with actual Seq endpoints

---

## Phase 7: Optional Enhancements

**Goal:** Advanced features if basic implementation proves valuable.

### 7.1 Add Metrics (Optional)

If you want metrics in addition to traces:

**Install:**
```bash
npm install @opentelemetry/sdk-metrics @opentelemetry/exporter-metrics-otlp-http
```

**Metrics to Consider:**
- Counter: Failed login attempts
- Histogram: Plaid Link connection duration
- Gauge: Active connections count

**File:** `frontend/src/observability/metrics.ts`

### 7.2 Add Logs (Optional)

If you want structured logs sent to Seq:

**Install:**
```bash
npm install @opentelemetry/api-logs @opentelemetry/sdk-logs @opentelemetry/exporter-logs-otlp-http
```

**Use Case:** Console.log replacement that links logs → traces

### 7.3 Add Session Replay (Optional)

**Warning:** Be VERY careful with PII. Consider LogRocket/Sentry with PII masking.

### 7.4 Add Real User Monitoring (RUM)

**Metrics:**
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)
- Time to Interactive (TTI)

**Already captured** by `@opentelemetry/instrumentation-document-load`

---

## Rollout Strategy

### Development
1. Implement Phase 1-3 (foundation + security)
2. Test locally with Seq running
3. Validate sanitization with unit tests
4. Manual validation: Check Seq UI for leaked tokens (there should be none)

### Staging
1. Deploy with `VITE_OTEL_ENABLED=true`
2. Monitor Seq for 1 week
3. Validate distributed tracing works frontend → backend
4. Check for any performance degradation (<1% expected)

### Production
1. Gradually enable via feature flag (if available)
2. Monitor Seq ingestion rate (should be <1GB/day for typical usage)
3. Set up Seq retention policies (7-30 days depending on compliance)

---

## Success Metrics

| Metric | Target | Validation |
|--------|--------|------------|
| **Coverage** | 90%+ of HTTP calls traced | Check Seq: all `/api/*` calls present |
| **Distributed Tracing** | 100% frontend → backend linkage | Click trace in Seq, see backend spans |
| **Security** | Zero tokens in Seq | Search Seq for `eyJ`, `access-`, `Bearer` |
| **Performance** | <1% overhead | Lighthouse score difference <5 points |
| **Bundle Size** | <100KB increase | `npm run build` size comparison |
| **Error Tracking** | 100% errors linked to traces | Trigger error, find in Seq with trace context |

---

## Troubleshooting

### Spans Not Appearing in Seq

**Check:**
1. `VITE_OTEL_ENABLED=true` in `.env`
2. Seq is running: `docker compose ps | grep seq`
3. Seq endpoint correct: `http://localhost:5341/ingest/otlp`
4. Browser console for OTLP export errors
5. Seq UI → Settings → API Keys (ensure ingestion enabled)

### Distributed Tracing Not Linking

**Check:**
1. W3C Trace Context propagator registered in `telemetry.ts`
2. Backend extracts `traceparent` header (should already work)
3. CORS allows `traceparent` header
4. Check span IDs match in Seq query

### Sensitive Data Leaking

**Immediate Action:**
1. Disable export: `VITE_OTEL_ENABLED=false`
2. Audit `sanitization.ts` - add missing patterns
3. Add unit test for the leaked pattern
4. Re-deploy with fix
5. Contact Seq admin to purge leaked traces (retention policy)

### Performance Issues

**Check:**
1. BatchSpanProcessor settings (batch size, timeout)
2. Disable user interaction instrumentation if too noisy
3. Increase sampling rate (export 50% of spans instead of 100%)

---

## Files Summary

| Phase | File | Lines | Purpose |
|-------|------|-------|---------|
| 1 | `frontend/src/observability/telemetry.ts` | 150 | Core setup, auto-instrumentation |
| 2 | `frontend/src/observability/sanitization.ts` | 200 | Multi-layer redaction |
| 2 | `frontend/src/observability/processors.ts` | 100 | Custom span processors |
| 3 | `frontend/src/observability/TelemetryProvider.tsx` | 80 | React Context |
| 3 | `frontend/src/observability/hooks.ts` | 120 | React hooks for manual tracing |
| 3 | `frontend/src/observability/index.ts` | 20 | Public API |
| 4 | Modify: `frontend/src/components/ErrorBoundary.tsx` | +10 | Record errors to spans |
| 4 | Modify: `frontend/src/App.tsx` | +5 | Add TelemetryProvider |
| 5 | `frontend/src/observability/__tests__/sanitization.test.ts` | 150 | Sanitization unit tests |
| 5 | `frontend/src/observability/__tests__/telemetry.integration.test.ts` | 100 | Integration tests |
| 6 | `frontend/src/observability/README.md` | 80 | Documentation |
| 6 | Modify: `CLAUDE.md` | +50 | Project docs update |
| 6 | Modify: `frontend/.env.example` | +10 | Environment config |

**Total New Code:** ~900 lines
**Modified Existing:** ~65 lines
**Tests:** ~250 lines

---

## Dependencies Summary

```json
{
  "dependencies": {
    "@opentelemetry/api": "^1.9.0",
    "@opentelemetry/sdk-trace-web": "^1.25.0",
    "@opentelemetry/instrumentation": "^0.52.0",
    "@opentelemetry/auto-instrumentations-web": "^0.39.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.52.0",
    "@opentelemetry/resources": "^1.25.0",
    "@opentelemetry/semantic-conventions": "^1.25.0"
  },
  "devDependencies": {
    "@opentelemetry/sdk-trace-base": "^1.25.0"
  }
}
```

**Bundle Impact:** ~80KB compressed (gzipped)

---

## Next Steps for Implementation

1. **Start with Phase 1:** Install dependencies, create `telemetry.ts`
2. **Validate early:** Test with a single fetch call before proceeding
3. **Security first:** Implement Phase 2 (sanitization) before enabling in production
4. **Iterate:** Add manual instrumentation (Phase 4) only where auto-instrumentation gaps exist
5. **Monitor:** Use Seq to find areas needing better instrumentation

---

## Questions for Product/Security Review

Before production rollout:

1. **Retention:** How long should frontend traces be retained in Seq? (Recommendation: 7-30 days)
2. **Sampling:** Should we sample (e.g., 50% of traces) or capture 100%? (Recommendation: 100% initially, sample later if volume high)
3. **PII Policy:** Are usernames considered PII? Should we redact them? (Currently: usernames kept, passwords/tokens redacted)
4. **Compliance:** Does this meet SOC 2 / PCI DSS requirements? (Recommendation: Security audit `sanitization.ts`)
5. **Costs:** What's the Seq ingestion budget? (Estimate: <1GB/day for typical usage)

---

## References

- [OpenTelemetry Browser Instrumentation](https://opentelemetry.io/docs/languages/js/instrumentation/)
- [Seq OTLP Ingestion](https://docs.datalust.co/docs/ingestion-with-opentelemetry)
- [Handling Sensitive Data in OpenTelemetry](https://opentelemetry.io/docs/security/handling-sensitive-data/)
- [W3C Trace Context Specification](https://www.w3.org/TR/trace-context/)

---

**Status:** Ready for implementation
**Estimated Effort:** 2-3 days for Phases 1-5, +1 day for testing/validation
**Risk Level:** Low (graceful degradation, feature flag, comprehensive sanitization)
